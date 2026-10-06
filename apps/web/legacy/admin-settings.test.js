import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const frontendPath = resolve(process.cwd(), "../../Front-end");
const scripts = import.meta.glob("../../../Front-end/*.js");

async function loadScript(name) {
  const path = Object.keys(scripts).find((key) => key.endsWith(`/${name}`));
  if (!path) throw new Error(`Script not found: ${name}`);
  await scripts[path]();
}

async function bootAdminPage() {
  vi.resetModules();
  const html = readFileSync(resolve(frontendPath, "admin-settings.html"), "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.documentElement.lang = "th";
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  history.replaceState({}, "", "/legacy/admin-settings.html");
  localStorage.clear();
  sessionStorage.clear();
  const values = new Map([
    ["fms-stock-records", JSON.stringify([{ name: "Bandage", code: "M1" }])],
    ["fms-admin-deleted-records", JSON.stringify([
      { collection: "fms-stock-records", deletedAt: "2026-10-04T10:00:00.000Z", record: { name: "Bandage" }, reason: "expired" },
      { collection: "fms-borrow-records", deletedAt: "2026-10-03T10:00:00.000Z", record: { name: "Loan" }, reason: "duplicate" },
    ])],
  ]);
  vi.stubGlobal("FMSStorage", {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  vi.stubGlobal("FMS_API_URL", "http://localhost:4000");
  window.FMS_API_URL = "http://localhost:4000";
  window.FMSNotifications = { getAll: () => [{ title: "Low stock", detail: "Bandage", level: "warning" }] };
  const users = [{ id: "u1", email: "nurse@example.com", name: "Nurse", role: "NURSE" }];
  const fetch = vi.fn(async (_url, options = {}) => ({
    ok: true,
    json: async () => ({ success: true, data: users }),
    options,
  }));
  vi.stubGlobal("fetch", fetch);

  await loadScript("admin-audit.js");
  await loadScript("admin-settings.js");
  return { values, fetch };
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
  document.body.replaceChildren();
});

describe("admin settings page", () => {
  it("adds, deduplicates, and removes dropdown options", async () => {
    const { values } = await bootAdminPage();
    expect(document.querySelector("#summaryDeleted").textContent).toBe("2");
    expect(document.querySelector('[data-options-list="medicines"]').textContent).toContain("Bandage");

    document.getElementById("optionTypeButton").click();
    document.querySelector('[data-option-type="branches"]').click();
    const value = document.querySelector('#optionForm input[name="value"]');
    value.value = "Emergency ward";
    document.getElementById("optionForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(document.querySelector('[data-options-list="branches"]').textContent).toContain("Emergency ward");
    expect(JSON.parse(values.get("fms-admin-options")).branches).toContain("Emergency ward");

    value.value = "Emergency ward";
    document.getElementById("optionForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(document.querySelectorAll('[data-options-list="branches"] [data-remove-option="branches"]')).toHaveLength(3);
    document.querySelector('[data-options-list="branches"] [data-remove-option="branches"][data-index="2"]').click();
    expect(JSON.parse(values.get("fms-admin-options")).branches).not.toContain("Emergency ward");
  });

  it("filters deleted records and switches settings panels", async () => {
    await bootAdminPage();
    expect(document.querySelectorAll("#deletedRows tr")).toHaveLength(2);
    document.querySelector('[data-deleted-category="stock"]').click();
    expect(document.querySelectorAll("#deletedRows tr")).toHaveLength(1);
    expect(document.querySelector("#deletedRows").textContent).toContain("Bandage");

    document.querySelector('[data-panel="activityPanel"]').click();
    expect(document.getElementById("activityPanel").hidden).toBe(false);
    expect(document.getElementById("databasePanel").hidden).toBe(true);
  });

  it("loads users, sends role changes with CSRF, and handles API failures", async () => {
    const { fetch } = await bootAdminPage();
    document.cookie = "fms_csrf=test-csrf";
    document.querySelector('[data-panel="usersPanel"]').click();
    await vi.waitFor(() => expect(document.querySelector("#userRows select")).toBeInTheDocument());
    const roleSelect = document.querySelector('#userRows select');
    roleSelect.value = "ADMIN";
    document.querySelector("#userRows [data-save-role]").click();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/users/u1/role"), expect.objectContaining({ method: "PATCH" })));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    const patchOptions = fetch.mock.calls.find(([, options]) => options.method === "PATCH")[1];
    expect(patchOptions.headers["X-FMS-CSRF"]).toBe("test-csrf");

    fetch.mockImplementationOnce(async () => ({ ok: false, json: async () => ({ message: "unavailable" }) }));
    document.querySelector('[data-panel="usersPanel"]').click();
    await vi.waitFor(() => expect(document.getElementById("usersMessage").textContent).toBe("unavailable"));
  });

  it("opens and closes notifications", async () => {
    await bootAdminPage();
    document.getElementById("notificationButton").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    expect(document.getElementById("notificationList").textContent).toContain("Low stock");
    document.getElementById("closeNotification").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(true);
  });
});
