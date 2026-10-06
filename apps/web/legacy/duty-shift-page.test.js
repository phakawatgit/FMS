import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pageHtml = readFileSync(resolve(process.cwd(), "../../Front-end/duty-shift.html"), "utf8");

async function loadPage(records = [], { sessionRole = "admin", authUser = null, profiles = {}, rawRecords = JSON.stringify(records), rawProfiles = JSON.stringify(profiles) } = {}) {
  const page = new DOMParser().parseFromString(pageHtml, "text/html");
  document.documentElement.lang = page.documentElement.lang;
  document.head.innerHTML = page.head.innerHTML;
  document.body.innerHTML = page.body.innerHTML;
  if (sessionRole === "malformed") window.sessionStorage.setItem("fms-admin-session", "not-json");
  else if (sessionRole) window.sessionStorage.setItem("fms-admin-session", JSON.stringify({ role: sessionRole }));
  else window.sessionStorage.removeItem("fms-admin-session");
  const values = new Map([["fms-local-duty-records", rawRecords], ["fms-duty-profiles", rawProfiles]]);
  window.__FMS_TEST_STORAGE__ = values;
  window.__FMS_TEST_AUTH_USER__ = authUser;
  window.FMSStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: vi.fn((key, value) => values.set(key, value)),
    updateDutyShift: vi.fn(async (id, changes) => {
      const saved = JSON.parse(values.get("fms-local-duty-records"));
      values.set("fms-local-duty-records", JSON.stringify(saved.map((item) => item.id === id ? { ...item, ...changes } : item)));
    }),
    deleteDutyShift: vi.fn(async (id) => {
      const saved = JSON.parse(values.get("fms-local-duty-records"));
      values.set("fms-local-duty-records", JSON.stringify(saved.filter((item) => item.id !== id)));
    }),
  };
  vi.stubGlobal("confirm", vi.fn(() => true));
  window.print = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  await import("../../../Front-end/duty-shift.js");
}

describe("Duty shift page", () => {
  beforeEach(async () => {
    vi.resetModules();
    await loadPage();
  });

  it("renders the calendar and pages through the 50 color choices", () => {
    expect(document.querySelectorAll(".calendar-cell").length).toBeGreaterThan(28);
    expect(document.querySelectorAll(".color-choice")).toHaveLength(20);
    expect(document.querySelectorAll(".color-page-dot")).toHaveLength(3);

    fireEvent.click(document.getElementById("nextColorPage"));

    expect(document.querySelector('[data-color="color-21"]')).toBeInTheDocument();
    expect(document.querySelector('[data-color="color-1"]')).toBeNull();
  });

  it("requires a color before saving a duty shift", () => {
    fireEvent.submit(document.getElementById("dutyForm"));

    expect(document.getElementById("dutyStatus").textContent).not.toBe("");
    expect(window.FMSStorage.setItem).not.toHaveBeenCalled();
  });

  it("saves the selected color and nurse profile and syncs it to the API", async () => {
    document.getElementById("nurseFirstName").value = "Nurse";
    document.getElementById("nurseLastName").value = "Example";
    document.getElementById("nurseNickname").value = "N";
    fireEvent.click(document.querySelector('[data-color="color-3"]'));
    fireEvent.submit(document.getElementById("dutyForm"));

    await waitFor(() => expect(window.FMSStorage.setItem).toHaveBeenCalledTimes(2));
    expect(JSON.parse(window.__FMS_TEST_STORAGE__.get("fms-local-duty-records"))).toEqual([
      expect.objectContaining({ firstName: "Nurse", lastName: "Example", colorId: "color-3" }),
    ]);
    expect(window.FMSStorage.setItem).toHaveBeenCalledWith("fms-duty-profiles", expect.stringContaining('"admin"'));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/nurses"), expect.objectContaining({ method: "POST" }));
    expect(document.querySelector(".duty-record-card").textContent).toContain("Nurse Example");
  });

  it("filters saved shifts and opens the editable detail dialog", () => {
    const record = {
      id: "shift-1", uid: "admin", nurseName: "Nurse Example", firstName: "Nurse", lastName: "Example",
      email: "admin@example.com", date: "2026-10-04", colorId: "color-2", colorValue: "blue", updatedAt: "2026-10-04T10:00:00.000Z",
    };
    window.__FMS_TEST_STORAGE__.set("fms-local-duty-records", JSON.stringify([record]));
    window.dispatchEvent(new StorageEvent("storage", { key: "fms-local-duty-records" }));
    fireEvent.input(document.getElementById("recordSearch"), { target: { value: "missing" } });
    expect(document.querySelector(".duty-record-empty").textContent).not.toBe("");

    fireEvent.input(document.getElementById("recordSearch"), { target: { value: "nurse" } });
    fireEvent.click(document.querySelector("[data-duty-detail]"));

    expect(document.querySelector(".duty-detail-modal").hidden).toBe(false);
    expect(document.getElementById("dutyDetailName").textContent).toContain("Nurse Example");
    expect(document.getElementById("dutyDetailDate").disabled).toBe(false);
  });

  it("switches language and toggles notifications", () => {
    fireEvent.click(document.getElementById("languageButton"));
    expect(document.documentElement.lang).toBe("en");

    const panel = document.getElementById("notificationPanel");
    fireEvent.click(document.getElementById("notificationButton"));
    expect(panel.hidden).toBe(false);
    fireEvent.click(document.getElementById("closeNotification"));
    expect(panel.hidden).toBe(true);
  });

  it("edits an authorized shift and refreshes the calendar and color choices", async () => {
    const record = { id: "shift-edit", uid: "admin", nurseName: "Nurse Example", firstName: "Nurse", lastName: "Example", date: "2026-10-04", colorId: "color-2", updatedAt: "2026-10-04T10:00:00Z" };
    vi.resetModules();
    await loadPage([record]);
    fireEvent.click(document.querySelector("[data-duty-detail]"));
    const nextColor = document.querySelector("[data-detail-color='color-3']");
    fireEvent.click(nextColor);
    fireEvent.change(document.getElementById("dutyDetailDate"), { target: { value: "2026-11-12" } });
    fireEvent.submit(document.getElementById("dutyDetailForm"));
    await waitFor(() => expect(window.FMSStorage.updateDutyShift).toHaveBeenCalledWith("shift-edit", { date: "2026-11-12", colorId: "color-3" }));
    await waitFor(() => expect(document.querySelector(".duty-detail-modal").hidden).toBe(true));
    expect(JSON.parse(window.__FMS_TEST_STORAGE__.get("fms-local-duty-records"))[0]).toMatchObject({ date: "2026-11-12", colorId: "color-3" });
  });

  it("cancels an owned duty shift through the database storage action", async () => {
    const record = { id: "shift-cancel", uid: "admin", nurseName: "Nurse Example", date: "2026-10-04", colorId: "color-2" };
    vi.resetModules();
    await loadPage([record]);
    fireEvent.click(document.querySelector("[data-duty-detail]"));
    const cancelShiftButton = document.querySelector(".duty-detail-remove");
    expect(cancelShiftButton.hidden).toBe(false);
    fireEvent.click(cancelShiftButton);
    await waitFor(() => expect(window.FMSStorage.deleteDutyShift).toHaveBeenCalledWith("shift-cancel"));
    await waitFor(() => expect(document.querySelector(".duty-detail-modal").hidden).toBe(true));
    expect(JSON.parse(window.__FMS_TEST_STORAGE__.get("fms-local-duty-records"))).toEqual([]);
    expect(document.querySelector("[data-duty-detail]")).toBeNull();
  });

  it("keeps an editable dialog open and restores the save button after API failure", async () => {
    const record = { id: "shift-edit", uid: "admin", nurseName: "Nurse Example", date: "2026-10-04", colorId: "color-2" };
    vi.resetModules();
    await loadPage([record]);
    window.FMSStorage.updateDutyShift.mockRejectedValueOnce(new Error("Conflict"));
    fireEvent.click(document.querySelector("[data-duty-detail]"));
    fireEvent.submit(document.getElementById("dutyDetailForm"));
    await waitFor(() => expect(document.getElementById("dutyDetailStatus").textContent).toBe("Conflict"));
    expect(document.querySelector(".duty-detail-save").disabled).toBe(false);
    expect(document.querySelector(".duty-detail-modal").hidden).toBe(false);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector(".duty-detail-modal").hidden).toBe(true);
  });

  it("supports accessible calendar pickers, calendar selection, and Excel download", () => {
    const monthTrigger = document.getElementById("monthTrigger");
    fireEvent.keyDown(monthTrigger, { key: "ArrowDown" });
    expect(document.getElementById("monthOptions").hidden).toBe(false);
    fireEvent.keyDown(document.getElementById("monthOptions"), { key: "End" });
    expect(document.activeElement.dataset.value).toBe("12");
    fireEvent.click(document.querySelector("#monthOptions [data-value='12']"));
    expect(document.getElementById("monthOptions").hidden).toBe(true);
    fireEvent.click(document.querySelector(".calendar-cell[data-date]"));
    expect(document.getElementById("selectedDateLabel").textContent).not.toBe("");

    const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:duty"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("URL", URLStub);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(document.getElementById("exportExcel"));
    expect(URLStub.revokeObjectURL).toHaveBeenCalledWith("blob:duty");
  });

  it("restores a Firebase user's saved profile and permits the user to edit their own shifts", async () => {
    const user = { uid: "nurse-1", email: "NURSE@example.com", displayName: "Nurse Example" };
    const date = new Date();
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const priorDate = new Date(date);
    priorDate.setDate(priorDate.getDate() - 1);
    const priorDateKey = `${priorDate.getFullYear()}-${String(priorDate.getMonth() + 1).padStart(2, "0")}-${String(priorDate.getDate()).padStart(2, "0")}`;
    const ownShift = { id: "own-shift", uid: user.uid, email: user.email, nurseName: "<Old & Nurse>", firstName: "Old", lastName: "Name", date: dateKey, colorId: "color-4" };
    const previousShift = { id: "prior-shift", uid: user.uid, email: user.email, nurseName: "Earlier Nurse", date: priorDateKey, colorId: "color-4" };
    vi.resetModules();
    await loadPage([ownShift, previousShift], {
      sessionRole: null,
      authUser: user,
      profiles: { "nurse@example.com": { firstName: "Saved", lastName: "Profile", nickname: "SP", affiliation: "Clinic", colorId: "color-5" } },
    });

    expect(document.getElementById("nurseFirstName").value).toBe("Saved");
    expect(document.getElementById("nurseLastName").value).toBe("Profile");
    expect(document.getElementById("nurseNickname").value).toBe("SP");
    expect(document.getElementById("nurseAffiliation").value).toBe("Clinic");
    expect(document.querySelector('[data-color="color-5"]').classList.contains("is-selected")).toBe(true);
    expect(document.querySelector(".duty-record-card").innerHTML).toContain("&lt;Old &amp; Nurse&gt;");

    fireEvent.click(document.querySelector("[data-duty-detail]"));
    expect(document.querySelector(".duty-detail-modal").hidden).toBe(false);
    expect(document.getElementById("dutyDetailDate").disabled).toBe(false);
    fireEvent.click(document.querySelector(".duty-detail-cancel"));
    expect(document.querySelector(".duty-detail-modal").hidden).toBe(true);

    fireEvent.submit(document.getElementById("dutyForm"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/nurses"), expect.objectContaining({ method: "POST" })));
    const savedRecords = JSON.parse(window.__FMS_TEST_STORAGE__.get("fms-local-duty-records"));
    expect(savedRecords).toHaveLength(2);
    expect(savedRecords.find((item) => item.date === dateKey)).toMatchObject({ uid: user.uid, firstName: "Saved", colorId: "color-5" });
  });

  it("keeps another user's shift read-only and safely ignores malformed admin sessions", async () => {
    const user = { uid: "nurse-2", email: "nurse2@example.com", displayName: "Second Nurse" };
    const dateKey = "2026-10-04";
    const otherShift = { id: "other-shift", uid: "nurse-1", email: "nurse1@example.com", nurseName: "Other Nurse", date: dateKey, colorId: "color-6" };
    vi.resetModules();
    await loadPage([otherShift], { sessionRole: null, authUser: user });
    fireEvent.click(document.querySelector("[data-duty-detail]"));
    expect(document.getElementById("dutyDetailDate").disabled).toBe(true);
    expect(document.querySelector(".duty-detail-save").hidden).toBe(true);
    fireEvent.click(document.querySelector(".duty-detail-close"));
    expect(document.querySelector(".duty-detail-modal").hidden).toBe(true);

    vi.resetModules();
    await loadPage([], { sessionRole: "malformed", authUser: user });
    expect(document.getElementById("dutyForm")).toBeInTheDocument();
  });

  it("covers picker keyboard controls, record card keyboard actions, export, and outside dismissals", () => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const rows = [
      { id: "today", uid: "admin", nurseName: "Today Nurse", date: todayKey, colorId: "color-1", updatedAt: "2026-10-05T10:00:00.000Z" },
      { id: "yesterday", uid: "admin", nurseName: "Yesterday Nurse", date: "2026-10-04", colorId: "color-2", createdAt: "2026-10-04T08:30:00.000Z" },
    ];
    window.__FMS_TEST_STORAGE__.set("fms-local-duty-records", JSON.stringify(rows));
    window.dispatchEvent(new StorageEvent("storage", { key: "fms-local-duty-records" }));

    const monthTrigger = document.getElementById("monthTrigger");
    fireEvent.click(monthTrigger);
    expect(document.getElementById("monthOptions").hidden).toBe(false);
    fireEvent.click(monthTrigger);
    expect(document.getElementById("monthOptions").hidden).toBe(true);
    fireEvent.keyDown(monthTrigger, { key: "Enter" });
    expect(document.getElementById("monthOptions").hidden).toBe(false);
    fireEvent.keyDown(document.getElementById("monthOptions"), { key: "ArrowDown" });
    fireEvent.keyDown(document.getElementById("monthOptions"), { key: "ArrowUp" });
    fireEvent.keyDown(document.getElementById("monthOptions"), { key: "Home" });
    fireEvent.keyDown(document.getElementById("monthOptions"), { key: "End" });
    fireEvent.keyDown(document.getElementById("monthOptions"), { key: "Escape" });
    expect(document.getElementById("monthOptions").hidden).toBe(true);
    fireEvent.click(document.body);

    fireEvent.click(document.querySelector('[data-page="1"]'));
    expect(document.querySelector('[data-color="color-21"]')).not.toBeNull();
    fireEvent.click(document.getElementById("previousColorPage"));
    expect(document.querySelector('[data-color="color-1"]')).not.toBeNull();

    const todayCard = document.querySelector('[data-duty-detail="id:today"]');
    fireEvent.keyDown(todayCard, { key: "Enter" });
    expect(document.querySelector(".duty-detail-modal").hidden).toBe(false);
    fireEvent.click(document.querySelector(".duty-detail-modal"));
    expect(document.querySelector(".duty-detail-modal").hidden).toBe(true);
    fireEvent.keyDown(document.querySelector('[data-duty-detail="id:yesterday"]'), { key: " " });
    expect(document.querySelector(".duty-detail-modal").hidden).toBe(false);
    fireEvent.keyDown(document.getElementById("calendarGrid"), { key: "Escape" });
    fireEvent.keyDown(document.querySelector(".duty-detail-modal"), { key: "Escape" });
    expect(document.querySelector(".duty-detail-modal").hidden).toBe(true);

    const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:duty-list"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("URL", URLStub);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(document.getElementById("exportExcel"));
    expect(URLStub.createObjectURL).toHaveBeenCalledOnce();
    expect(URLStub.revokeObjectURL).toHaveBeenCalledOnce();
    fireEvent.click(document.getElementById("exportPdf"));
    expect(window.print).toHaveBeenCalledOnce();

    fireEvent.click(document.getElementById("notificationButton"));
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    fireEvent.click(document.body);
    expect(document.getElementById("notificationPanel").hidden).toBe(true);
  });

  it("falls back from malformed caches and ignores clicks outside actionable controls", async () => {
    vi.resetModules();
    await loadPage([], { rawRecords: "not-json", rawProfiles: "not-json" });
    expect(document.querySelector(".duty-record-card")).toBeNull();

    const month = document.getElementById("calendarMonth");
    const monthValue = month.value;
    month.value = "";
    fireEvent.change(month);
    month.value = monthValue;
    fireEvent.change(month);

    fireEvent.click(document.getElementById("calendarGrid"));
    fireEvent.click(document.getElementById("colorPalette"));
    fireEvent.click(document.getElementById("colorPagination"));
    fireEvent.click(document.getElementById("dutyRecordList"));
    fireEvent.keyDown(document.getElementById("dutyRecordList"), { key: "Escape" });
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated-key" }));

    const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:empty-duty"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("URL", URLStub);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(document.getElementById("exportExcel"));
    expect(URLStub.createObjectURL).toHaveBeenCalledOnce();
    expect(URLStub.revokeObjectURL).toHaveBeenCalledOnce();
  });
});

afterEach(() => {
  window.sessionStorage.removeItem("fms-admin-session");
  window.__FMS_TEST_AUTH_USER__ = null;
  delete window.__FMS_TEST_STORAGE__;
  delete window.FMSStorage;
  vi.restoreAllMocks();
});
