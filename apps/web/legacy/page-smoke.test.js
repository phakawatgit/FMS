import { readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const frontendPath = resolve(process.cwd(), "../../Front-end");
const pageNames = readdirSync(frontendPath).filter((name) => name.endsWith(".html"));
const scripts = import.meta.glob("../../../Front-end/*.js");

function installBrowserMocks() {
  // These tests verify synchronous page startup. Suppress delayed refresh loops
  // so a scheduled render cannot run after the next page replaces the DOM.
  const noTimer = vi.fn(() => 0);
  vi.stubGlobal("setTimeout", noTimer);
  vi.stubGlobal("setInterval", noTimer);
  window.setTimeout = noTimer;
  window.setInterval = noTimer;

  class MockXMLHttpRequest {
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader() {}
    send() {
      this.status = 200;
      this.responseText = JSON.stringify({ success: true, data: [] });
    }
  }

  window.XMLHttpRequest = MockXMLHttpRequest;
  window.FMS_API_URL = "http://localhost:4000";
  window.__FMS_TEST_AUTH_USER__ = {
    uid: "test-user",
    email: "test@example.com",
    displayName: "Test User",
    getIdToken: async () => "test-token",
  };
  globalThis.record = { status: "observe", firstName: "Test", lastName: "Visitor", createdAt: new Date().toISOString() };
  vi.stubGlobal("target", document.getElementById("detail") || document.createElement("section"));
  vi.stubGlobal("escapeHtml", (value) => String(value ?? "").replace(/[&<>\"']/g, ""));
  window.sessionStorage.setItem("fms-admin-session", JSON.stringify({ role: "admin" }));
  window.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
  window.scrollTo = vi.fn();
  window.print = vi.fn();
  window.alert = vi.fn();
  window.confirm = vi.fn(() => true);
  window.open = vi.fn(() => ({ document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() }));
  window.matchMedia = vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    fillText: vi.fn(), measureText: () => ({ width: 10 }), setTransform: vi.fn(), scale: vi.fn(),
  }));
}

async function bootPage(name) {
  const html = readFileSync(resolve(frontendPath, name), "utf8");
  const page = new DOMParser().parseFromString(html, "text/html");
  document.documentElement.lang = page.documentElement.lang;
  document.head.innerHTML = page.head.innerHTML;
  document.body.innerHTML = page.body.innerHTML;
  // Classic browser scripts rely on named elements becoming window globals.
  for (const id of ["startDate", "endDate", "branchInput", "facultySelect", "resetButton", "languageButton"]) {
    const element = document.getElementById(id);
    if (element) vi.stubGlobal(id, element);
  }
  vi.stubGlobal("parseInputDate", (value) => value ? new Date(`${value}T00:00:00`) : null);
  vi.stubGlobal("language", "th");
  vi.stubGlobal("notificationsRead", false);
  vi.stubGlobal("medicinePageSize", 8);
  vi.stubGlobal("renderInteractiveDonut", vi.fn());
  vi.stubGlobal("renderInteractivePie", vi.fn());
  vi.stubGlobal("translations", { th: { all: "ทั้งหมด", items: "รายการ" }, en: { all: "All", items: "items" } });
  for (const id of ["notificationBadge", "notificationList"]) {
    const element = document.getElementById(id);
    if (element) vi.stubGlobal(id, element);
  }
  const detailId = name === "assessment-detail.html" ? `?id=${encodeURIComponent(globalThis.record.createdAt)}` : "";
  history.replaceState({}, "", `/legacy/${name}${detailId}`);
  localStorage.clear();
  if (name === "assessment-detail.html") localStorage.setItem("fms-infirmary-visits", JSON.stringify([globalThis.record]));
  sessionStorage.clear();
  installBrowserMocks();

  const scriptNames = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)]
    .map((match) => match[1])
    .filter((src) => src.startsWith("./") && src.split("?")[0].endsWith(".js"))
    .map((src) => basename(src.split("?")[0]))
    // Shared identifiers are installed above to exercise legacy scripts as isolated modules.

  const loadedScripts = [];
  for (const scriptName of scriptNames) {
    const key = Object.keys(scripts).find((modulePath) => modulePath.endsWith(`/${scriptName}`));
    if (key) {
      await scripts[key]();
      loadedScripts.push(scriptName);
      if (scriptName === "legacy-storage.js") vi.stubGlobal("FMSStorage", window.FMSStorage);
    }
  }
  return loadedScripts;
}

describe("legacy page startup", () => {
  it.each(pageNames)("boots %s with its page scripts", async (name) => {
    vi.resetModules();

    const loadedScripts = await bootPage(name);

    expect(loadedScripts.length, `${name} should load its local JavaScript. Modules: ${Object.keys(scripts).join(", ")}`).toBeGreaterThan(0);
    expect(document.body.textContent.trim().length).toBeGreaterThan(0);
  });

});
