import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/menu.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/menu.js");
const authUser = { uid: "nurse-1", email: "nurse@example.com", displayName: "Ava Nurse", getIdToken: async () => "test-token" };

async function loadPage({ role = "ADMIN", notifications = [{ level: "warning", title: "Low stock", detail: "Bandage" }], profiles = {}, dutyRecords = [], fetchImpl } = {}) {
  vi.resetModules();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  document.documentElement.lang = "th";
  history.replaceState({}, "", "/legacy/menu.html");
  sessionStorage.clear();
  window.__FMS_TEST_AUTH_USER__ = authUser;
  window.__FMS_AUTH_MOCK_OVERRIDES__ = {};
  document.cookie = "fms_csrf=test-csrf; path=/";
  const values = new Map([
    ["fms-local-duty-records", JSON.stringify(dutyRecords)],
    ["fms-duty-profiles", JSON.stringify(profiles)],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  vi.stubGlobal("FMSStorage", storage);
  vi.stubGlobal("FMSNotifications", { getAll: vi.fn(() => notifications) });
  const fetchMock = fetchImpl || vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { user: { role } } }) }));
  vi.stubGlobal("fetch", fetchMock);
  await Object.values(scripts)[0]();
  await vi.waitFor(() => expect(sessionStorage.getItem("fms-admin-session")).not.toBeNull());
  return { values, storage, fetchMock };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
  sessionStorage.clear();
  localStorage.clear();
});

describe("main menu", () => {
  it("loads the admin menu, notifications and language switcher", async () => {
    await loadPage();
    expect(document.querySelectorAll(".menu-card").length).toBe(8);
    expect(document.querySelector(".menu-card[href='./admin-settings.html']")).not.toBeNull();
    expect(document.querySelectorAll("#colorPalette .color-choice")).toHaveLength(20);
    expect(document.getElementById("notificationBadge").textContent).toBe("1");
    document.getElementById("notificationButton").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    document.getElementById("markNotificationsRead").click();
    expect(document.getElementById("notificationBadge").hidden).toBe(true);
    document.querySelector("input[name='language'][value='en']").click();
    expect(document.documentElement.lang).toBe("en");
    expect(document.querySelector(".menu-card h3").textContent).toBe("Dashboard and Report");
  });

  it("pages colors, prevents duplicate colors, and saves a nurse duty record", async () => {
    const { values } = await loadPage({ profiles: { "other@example.com": { uid: "other", colorId: "color-1" } } });
    expect(document.querySelector(".color-choice[data-color='color-1']").classList.contains("is-locked")).toBe(true);
    document.getElementById("nextColorPage").click();
    expect(document.querySelectorAll("#colorPalette .color-choice")).toHaveLength(20);
    document.getElementById("previousColorPage").click();
    const color = document.querySelector(".color-choice:not(.is-locked)");
    color.click();
    document.getElementById("nurseFirstName").value = "Ava";
    document.getElementById("nurseLastName").value = "Nurse";
    document.getElementById("nurseNickname").value = "Av";
    document.getElementById("nurseAffiliation").value = "Clinic";
    document.getElementById("dutyForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.getElementById("dutyStatus").textContent).not.toBe(""));
    const records = JSON.parse(values.get("fms-local-duty-records"));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ uid: "nurse-1", firstName: "Ava", lastName: "Nurse", nickname: "Av", affiliation: "Clinic" });
    expect(JSON.parse(values.get("fms-duty-profiles"))["nurse@example.com"].colorId).toBe(records[0].colorId);
    expect(document.querySelector(".calendar-duty-dot")).not.toBeNull();
  });

  it("opens the annual calendar, selects a year and closes from Escape", async () => {
    await loadPage();
    document.getElementById("viewCalendarButton").click();
    expect(document.getElementById("yearCalendarModal").hidden).toBe(false);
    expect(document.querySelectorAll(".mini-month")).toHaveLength(12);
    document.getElementById("yearCalendarTrigger").click();
    expect(document.getElementById("yearCalendarOptions").hidden).toBe(false);
    document.getElementById("yearCalendarNext").click();
    expect(document.getElementById("yearCalendarValue").textContent).toBe("2027");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("yearCalendarModal").hidden).toBe(true);
  });

  it("rejects a session that the API does not recognize", async () => {
    vi.resetModules();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    document.head.innerHTML = parsed.head.innerHTML;
    document.body.innerHTML = parsed.body.innerHTML;
    history.replaceState({}, "", "/legacy/menu.html");
    window.__FMS_TEST_AUTH_USER__ = authUser;
    vi.stubGlobal("FMSStorage", { getItem: () => "[]", setItem: vi.fn() });
    vi.stubGlobal("FMSNotifications", { getAll: () => [] });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ success: false }) })));
    await Object.values(scripts)[0]();
    await vi.waitFor(() => expect(window.fetch).toHaveBeenCalledOnce());
    expect(sessionStorage.getItem("fms-admin-session")).toBeNull();
  });

  it("restores a nurse profile, records today's attendance once, and refreshes from storage", async () => {
    const profile = { uid: "nurse-1", email: "nurse@example.com", colorId: "color-4", firstName: "Ava", lastName: "Nurse", nickname: "Av", affiliation: "Clinic" };
    const { values, storage } = await loadPage({ role: "NURSE", profiles: { "nurse@example.com": profile } });
    expect(document.getElementById("nurseFirstName").value).toBe("Ava");
    expect(JSON.parse(values.get("fms-local-duty-records"))).toEqual([expect.objectContaining({ date: expect.any(String), colorId: "color-4", uid: "nurse-1" })]);

    const alreadySaved = JSON.parse(values.get("fms-local-duty-records"));
    window.dispatchEvent(new StorageEvent("storage", { key: "fms-local-duty-records" }));
    expect(JSON.parse(values.get("fms-local-duty-records"))).toEqual(alreadySaved);
    document.getElementById("viewCalendarButton").click();
    storage.setItem("fms-duty-profiles", JSON.stringify({ "nurse@example.com": { ...profile, firstName: "Ava Updated" } }));
    window.dispatchEvent(new StorageEvent("storage", { key: "fms-duty-profiles" }));
    expect(document.getElementById("nurseFirstName").value).toBe("Ava Updated");
    expect(document.querySelectorAll(".mini-month")).toHaveLength(12);
  });

  it("reports missing names, duplicate personal colors and storage failures without saving", async () => {
    const profile = { uid: "nurse-1", email: "nurse@example.com", colorId: "color-5", firstName: "Ava", lastName: "Nurse" };
    const today = new Date();
    const existing = { ...profile, date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}` };
    const { values, storage } = await loadPage({ role: "NURSE", profiles: { "nurse@example.com": profile }, dutyRecords: [existing] });
    document.getElementById("nurseLastName").value = "";
    expect(document.querySelector('[data-color="color-5"]').classList.contains("is-selected")).toBe(true);
    document.getElementById("dutyForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(JSON.parse(values.get("fms-local-duty-records"))).toHaveLength(1);

    document.getElementById("nurseLastName").value = "Nurse";
    storage.setItem("fms-duty-profiles", JSON.stringify({ "nurse@example.com": profile, "other@example.com": { uid: "other", colorId: "color-5" } }));
    document.getElementById("dutyForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(document.getElementById("dutyStatus").textContent).not.toBe("");
    expect(JSON.parse(values.get("fms-local-duty-records"))).toHaveLength(1);

    storage.setItem = () => { throw new Error("storage unavailable"); };
    document.querySelector('[data-color="color-6"]')?.click();
    document.getElementById("dutyForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(document.getElementById("dutyStatus").textContent).not.toBe("");
  });

  it("opens and closes notification panels with no notifications and handles year picker keyboard input", async () => {
    await loadPage({ notifications: [] });
    expect(document.getElementById("notificationBadge").hidden).toBe(true);
    document.getElementById("notificationButton").click();
    document.body.click();
    expect(document.getElementById("notificationPanel").hidden).toBe(true);
    document.getElementById("viewCalendarButton").click();
    const trigger = document.getElementById("yearCalendarTrigger");
    trigger.click();
    document.getElementById("yearCalendarOptions").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement.hasAttribute("data-year")).toBe(true);
    document.getElementById("yearCalendarOptions").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(document.getElementById("yearCalendarOptions").hidden).toBe(true);
    expect(document.getElementById("yearCalendarModal").hidden).toBe(true);
    document.getElementById("viewCalendarButton").click();
    trigger.click();
    document.querySelector("#yearCalendarOptions [data-year='2027']").click();
    expect(document.getElementById("yearCalendarModal").hidden).toBe(false);
    expect(document.getElementById("yearCalendarValue").textContent).toBe("2027");
    document.getElementById("closeYearCalendar").click();
    expect(document.getElementById("yearCalendarModal").hidden).toBe(true);
  });

  it("clears the menu session and signs out even if the API logout response is unsuccessful", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { user: { role: "ADMIN" } } }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ success: false }) });
    const { fetchMock: activeFetch } = await loadPage({ fetchImpl: fetchMock });
    const signOut = vi.fn(async () => {});
    window.__FMS_AUTH_MOCK_OVERRIDES__.signOut = signOut;
    expect(sessionStorage.getItem("fms-admin-session")).not.toBeNull();
    document.getElementById("signOutButton").click();
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(sessionStorage.getItem("fms-admin-session")).toBeNull();
    expect(activeFetch).toHaveBeenCalledWith(expect.stringContaining("/session/logout"), expect.objectContaining({ method: "POST" }));
  });
});
