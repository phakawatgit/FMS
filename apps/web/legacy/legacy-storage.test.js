import { afterEach, describe, expect, it, vi } from "vitest";

const scripts = import.meta.glob("../../../Front-end/legacy-storage.js");

function xhrMock() {
  return class XMLHttpRequestMock {
    status = 200;
    responseText = "{}";
    headers = {};
    open(method, url, async) { this.method = method; this.url = url; this.async = async; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    send(body) {
      this.body = body;
      if (this.url.endsWith("/api/catalog")) this.responseText = JSON.stringify({ data: this.method === "POST" ? { code: "C1", name: "Bandage" } : JSON.parse(body).records });
      else if (this.url.includes("/api/duty-shifts")) this.responseText = JSON.stringify({ data: this.method === "POST" ? JSON.parse(body).records : { id: "d1", name: "Updated" } });
      else this.responseText = JSON.stringify({ data: [] });
    }
  };
}

async function loadStorage() {
  history.replaceState({}, "", "/legacy/index.html");
  document.cookie = "fms_csrf=test-csrf; path=/";
  vi.stubGlobal("XMLHttpRequest", xhrMock());
  const requests = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    requests.push({ url, options });
    const route = String(url);
    let data = {};
    if (route.endsWith("/api/infirmary-visits")) data = { records: [{ id: "visit-1" }] };
    else if (route.endsWith("/api/borrow-records")) data = { id: "borrow-1", status: "borrowed" };
    else if (route.includes("/extensions")) data = { id: "borrow-1", due: "2026-10-10" };
    else if (route.includes("/returns")) data = { id: "borrow-1", status: "returned" };
    else if (route.includes("/api/duty-shifts/")) data = { id: "d1", firstName: "Nurse", lastName: "One" };
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  }));
  await Object.values(scripts)[0]();
  return { storage: window.FMSStorage, requests };
}

async function loadMigratingStorage({ role, remote = {}, omitSession = false }) {
  history.replaceState({}, "", "/legacy/menu.html");
  if (omitSession) sessionStorage.removeItem("fms-admin-session");
  else sessionStorage.setItem("fms-admin-session", JSON.stringify({ role }));
  const calls = [];
  vi.stubGlobal("XMLHttpRequest", class {
    status = 200;
    responseText = "{}";
    open(method, url, async) { this.method = method; this.url = url; this.async = async; }
    setRequestHeader() {}
    send(body) {
      calls.push({ method: this.method, url: this.url, body });
      if (this.method === "GET" && this.url.endsWith("/api/legacy-storage")) this.responseText = JSON.stringify({ data: remote });
      if (this.method === "GET" && this.url.endsWith("/api/duty-shifts")) this.responseText = JSON.stringify({ data: [] });
    }
  });
  await Object.values(scripts)[0]();
  return { storage: window.FMSStorage, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  localStorage.clear();
  document.body.replaceChildren();
});

describe("legacy storage API adapter", () => {
  it("exposes storage-compatible reads, keys, length, writes, and deletes", async () => {
    const { storage } = await loadStorage();
    expect(storage.length).toBe(0);
    expect(storage.getItem("missing")).toBeNull();
    storage.setItem("custom-key", JSON.stringify({ value: 1 }));
    expect(JSON.parse(storage.getItem("custom-key"))).toEqual({ value: 1 });
    expect(storage.key(0)).toBe("custom-key");
    expect(storage.key(99)).toBeNull();
    storage.removeItem("custom-key");
    expect(storage.getItem("custom-key")).toBeNull();
    storage.setItem("another-key", "plain text");
    storage.clear();
    expect(storage.length).toBe(0);
  });

  it("saves and caches infirmary, borrow, extension, return, and duty-shift API results", async () => {
    const { storage, requests } = await loadStorage();
    await storage.saveInfirmaryVisit({ symptom: "Headache" });
    await storage.createBorrowRecord({ fullName: "Ava" });
    await storage.extendBorrowRecord("borrow-1", "2026-10-10");
    await storage.returnBorrowRecord("borrow-1", [{ code: "M1", quantity: 1 }]);
    storage.setItem("fms-local-duty-records", JSON.stringify([{ id: "d1" }]));
    await storage.updateDutyShift("d1", { firstName: "Nurse" });
    expect(JSON.parse(storage.getItem("fms-infirmary-visits"))).toEqual([{ id: "visit-1" }]);
    expect(JSON.parse(storage.getItem("fms-borrow-return-records"))).toMatchObject([{ id: "borrow-1", status: "returned" }]);
    expect(JSON.parse(storage.getItem("fms-local-duty-records"))[0]).toMatchObject({ id: "d1", firstName: "Nurse" });
    expect(requests).toHaveLength(5);
    expect(requests[0].options.headers["X-FMS-CSRF"]).toBe("test-csrf");
  });

  it("routes catalog and generic writes to their respective endpoints", async () => {
    const { storage } = await loadStorage();
    storage.setItem("fms-stock-records", JSON.stringify([{ code: "C1", name: "Bandage" }]));
    expect(JSON.parse(storage.getItem("fms-stock-records"))).toEqual([{ code: "C1", name: "Bandage" }]);
    expect(storage.addCatalogRecord({ name: "Bandage" })).toMatchObject({ code: "C1" });
    expect(JSON.parse(storage.getItem("fms-stock-records"))).toEqual([{ code: "C1", name: "Bandage" }]);
    storage.removeItem("fms-stock-records");
    expect(storage.getItem("fms-stock-records")).toBeNull();
  });

  it("migrates admin browser data once while keeping server values authoritative", async () => {
    localStorage.setItem("fms-stock-records", JSON.stringify([{ code: "OLD" }]));
    localStorage.setItem("fms-custom-raw", "legacy plain text");
    localStorage.setItem("other-key", "keep");
    const { storage, calls } = await loadMigratingStorage({ role: "admin", remote: { "fms-stock-records": [{ code: "SERVER" }] } });
    expect(JSON.parse(storage.getItem("fms-stock-records"))).toEqual([{ code: "SERVER" }]);
    expect(calls.some((call) => call.method === "PUT" && call.url.endsWith("fms-stock-records"))).toBe(false);
    expect(localStorage.getItem("fms-stock-records")).toBeNull();
    expect(localStorage.getItem("fms-custom-raw")).toBeNull();
    expect(localStorage.getItem("other-key")).toBe("keep");
  });

  it("limits nurse migrations to approved clinical and duty keys", async () => {
    localStorage.setItem("fms-stock-records", JSON.stringify([{ code: "PRIVATE-STOCK" }]));
    localStorage.setItem("fms-infirmary-visits", JSON.stringify([{ id: "visit-1" }]));
    const { calls } = await loadMigratingStorage({ role: "nurse" });
    const imports = calls.filter((call) => call.method === "PUT").map((call) => decodeURIComponent(call.url.split("/").at(-1)));
    expect(imports).toEqual(["fms-infirmary-visits"]);
    expect(localStorage.getItem("fms-stock-records")).not.toBeNull();
    expect(localStorage.getItem("fms-infirmary-visits")).toBeNull();
  });

  it("leaves private legacy data untouched when there is no authenticated session", async () => {
    localStorage.setItem("fms-stock-records", JSON.stringify([{ code: "PRIVATE" }]));
    const { calls } = await loadMigratingStorage({ omitSession: true });
    expect(calls.some((call) => call.method === "PUT")).toBe(false);
    expect(localStorage.getItem("fms-stock-records")).not.toBeNull();
  });

  it("surfaces server failures and leaves storage unavailable when initialization fails", async () => {
    history.replaceState({}, "", "/legacy/catalog.html");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("XMLHttpRequest", class {
      status = 503;
      responseText = JSON.stringify({ message: "database unavailable" });
      open() {}
      setRequestHeader() {}
      send() {}
    });
    await Object.values(scripts)[0]();
    expect(document.getElementById("fms-storage-error").textContent).toContain("เชื่อมต่อฐานข้อมูลไม่ได้");
    expect(window.FMSStorage.getItem("fms-stock-records")).toBeNull();
    expect(() => window.FMSStorage.setItem("key", "value")).toThrow("unavailable");
  });

  it("does not show a persistent banner for permission failures", async () => {
    history.replaceState({}, "", "/legacy/catalog.html");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("XMLHttpRequest", class {
      status = 403;
      responseText = JSON.stringify({ message: "Forbidden" });
      open() {}
      setRequestHeader() {}
      send() {}
    });
    await Object.values(scripts)[0]();
    expect(document.getElementById("fms-storage-error")).toBeNull();
  });

  it("rejects failed API writes and reports errors from catalog and visit operations", async () => {
    const { storage } = await loadStorage();
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 409, json: async () => ({ success: false, message: "Conflict" }) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(storage.saveInfirmaryVisit({})).rejects.toThrow("Conflict");
    await expect(storage.createBorrowRecord({})).rejects.toThrow("Conflict");
    await expect(storage.extendBorrowRecord("id", "2026-10-10")).rejects.toThrow("Conflict");
    await expect(storage.returnBorrowRecord("id", [])).rejects.toThrow("Conflict");
    await expect(storage.updateDutyShift("id", {})).rejects.toThrow("Conflict");
    expect(document.getElementById("fms-storage-error")).not.toBeNull();
  });

  it("reports failed synchronous catalog, duty-shift, and generic storage mutations", async () => {
    const { storage } = await loadStorage();
    document.body.insertAdjacentHTML("afterbegin", '<header class="topbar"></header>');
    vi.stubGlobal("requestAnimationFrame", (callback) => callback());
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("XMLHttpRequest", class {
      status = 503;
      responseText = "not JSON";
      open() {}
      setRequestHeader() {}
      send() {}
    });

    expect(() => storage.setItem("fms-local-duty-records", "[]")).toThrow("503");
    expect(() => storage.setItem("fms-stock-records", "[]")).toThrow("503");
    expect(() => storage.setItem("fms-custom-record", "{bad JSON")).toThrow("503");
    expect(() => storage.addCatalogRecord({ name: "Rejected" })).toThrow("503");
    expect(() => storage.removeItem("custom-record")).toThrow("503");
    expect(document.getElementById("fms-storage-error").getAttribute("role")).toBe("alert");
    expect(document.getElementById("fms-storage-error").textContent).toBeTruthy();
  });

  it("rejects protected mutations while initialization is unavailable", async () => {
    history.replaceState({}, "", "/legacy/catalog.html");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("XMLHttpRequest", class {
      status = 503;
      responseText = "";
      open() {}
      setRequestHeader() {}
      send() {}
    });
    await Object.values(scripts)[0]();
    expect(() => window.FMSStorage.setItem("key", "value")).toThrow("unavailable");
    expect(() => window.FMSStorage.removeItem("key")).toThrow("unavailable");
    expect(() => window.FMSStorage.addCatalogRecord({})).toThrow("unavailable");
    await expect(window.FMSStorage.saveInfirmaryVisit({})).rejects.toThrow("unavailable");
    expect(document.getElementById("fms-storage-error").getAttribute("role")).toBe("alert");
  });

  it("handles empty initialization responses and server values without duty records", async () => {
    history.replaceState({}, "", "/legacy/catalog.html");
    vi.stubGlobal("XMLHttpRequest", class {
      status = 200;
      responseText = "";
      open() {}
      setRequestHeader() {}
      send() {}
    });
    await Object.values(scripts)[0]();
    expect(window.FMSStorage.length).toBe(0);
    expect(window.FMSStorage.getItem("missing")).toBeNull();

    vi.resetModules();
    const migrated = await loadMigratingStorage({ role: "admin", remote: { "fms-local-duty-records": [{ id: "cached" }] } });
    expect(JSON.parse(migrated.storage.getItem("fms-local-duty-records"))).toEqual([]);
  });

  it("writes successfully without a CSRF cookie and tolerates empty XHR responses", async () => {
    history.replaceState({}, "", "/legacy/index.html");
    document.cookie = "fms_csrf=; Max-Age=0; path=/";
    const calls = [];
    vi.stubGlobal("XMLHttpRequest", class {
      status = 200;
      responseText = "";
      headers = {};
      open(method, url) { this.method = method; this.url = url; }
      setRequestHeader(name, value) { this.headers[name] = value; }
      send(body) { calls.push({ headers: this.headers, body }); }
    });
    await Object.values(scripts)[0]();
    window.FMSStorage.setItem("fms-custom-record", "not-json");
    expect(calls[0].headers["Content-Type"]).toBe("application/json");
    expect(calls[0].headers["X-FMS-CSRF"]).toBeUndefined();
    expect(calls[0].body).toContain("not-json");
    expect(window.FMSStorage.getItem("fms-custom-record")).toBe("not-json");
  });

  it("uses empty-cache fallbacks for borrow, duty, and catalog records", async () => {
    const { storage } = await loadStorage();
    const added = storage.addCatalogRecord({ name: "First item" });
    expect(added).toMatchObject({ code: "C1" });
    expect(JSON.parse(storage.getItem("fms-stock-records"))).toHaveLength(1);
    await storage.extendBorrowRecord("missing", "2026-10-10");
    await storage.returnBorrowRecord("missing", []);
    const updated = await storage.updateDutyShift("missing", { firstName: "Nurse" });
    expect(updated).toMatchObject({ id: "d1", firstName: "Nurse" });
    expect(JSON.parse(storage.getItem("fms-local-duty-records"))).toHaveLength(1);
  });

  it("replaces a duplicate borrow record while retaining unrelated loans", async () => {
    const { storage } = await loadStorage();
    storage.setItem("fms-borrow-return-records", JSON.stringify([{ id: "borrow-1" }, { id: "older" }]));
    await storage.createBorrowRecord({ fullName: "Ava" });
    expect(JSON.parse(storage.getItem("fms-borrow-return-records")).map(({ id }) => id)).toEqual(["borrow-1", "older"]);
  });

  it("uses empty record arrays when catalog and duty endpoints return no data", async () => {
    history.replaceState({}, "", "/legacy/index.html");
    vi.stubGlobal("XMLHttpRequest", class {
      status = 200;
      responseText = "{}";
      open() {}
      setRequestHeader() {}
      send() {}
    });
    await Object.values(scripts)[0]();
    window.FMSStorage.setItem("fms-local-duty-records", "[]");
    window.FMSStorage.setItem("fms-stock-records", "[]");
    expect(window.FMSStorage.getItem("fms-local-duty-records")).toBe("[]");
    expect(window.FMSStorage.getItem("fms-stock-records")).toBe("[]");
  });

  it("uses an empty borrow cache when the cache key was removed before a return", async () => {
    const { storage } = await loadStorage();
    storage.removeItem("fms-borrow-return-records");
    const result = await storage.returnBorrowRecord("borrow-1", []);
    expect(result.id).toBe("borrow-1");
    expect(JSON.parse(storage.getItem("fms-borrow-return-records"))).toEqual([result]);
  });

  it("uses fallback messages for unsuccessful API responses with empty bodies", async () => {
    const { storage } = await loadStorage();
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: false }) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(storage.saveInfirmaryVisit({})).rejects.toThrow("Visit save failed (200).");
    await expect(storage.createBorrowRecord({})).rejects.toThrow("Borrow save failed (200).");
    await expect(storage.extendBorrowRecord("id", "2026-10-10")).rejects.toThrow("Borrow extension save failed (200).");
    await expect(storage.returnBorrowRecord("id", [])).rejects.toThrow("Return save failed (200).");
    await expect(storage.updateDutyShift("id", {})).rejects.toThrow("Duty shift update failed (200).");
  });

  it("attaches a storage error after the document body is created", async () => {
    history.replaceState({}, "", "/legacy/catalog.html");
    const body = document.body;
    document.documentElement.removeChild(body);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("requestAnimationFrame", (callback) => callback());
    vi.stubGlobal("XMLHttpRequest", class {
      status = 503;
      responseText = "";
      open() {}
      setRequestHeader() {}
      send() {}
    });
    await Object.values(scripts)[0]();
    expect(document.body).toBeNull();
    document.documentElement.append(body);
    body.innerHTML = '<header class="topbar"></header>';
    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(document.getElementById("fms-storage-error")).toBeTruthy();
    expect(document.getElementById("fms-storage-error").style.top).toBe("0px");
  });

  it("reports a network error when an XHR has no HTTP status", async () => {
    history.replaceState({}, "", "/legacy/index.html");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("XMLHttpRequest", class {
      status = 0;
      responseText = "";
      open(_method, url) { if (url.endsWith("/api/legacy-storage") || url.endsWith("/api/duty-shifts")) this.status = 200; }
      setRequestHeader() {}
      send() {}
    });
    await Object.values(scripts)[0]();
    expect(() => window.FMSStorage.setItem("fms-network-check", "true")).toThrow("network error");
    expect(errors.mock.calls.some(([, error]) => error?.message.includes("network error"))).toBe(true);
  });
});
