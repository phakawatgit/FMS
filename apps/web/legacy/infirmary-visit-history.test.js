import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/infirmary-visit-history.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/infirmary-visit-history.js");

async function load(value) {
  vi.resetModules();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.body.innerHTML = parsed.body.innerHTML;
  document.documentElement.lang = "th";
  const store = { getItem: () => value };
  vi.stubGlobal("FMSStorage", store);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:visits"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.spyOn(window, "print").mockImplementation(() => {});
  await Object.values(scripts)[0]();
  return { store, URLStub };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); document.body.replaceChildren(); });

describe("infirmary visit history", () => {
  it("filters eligible visits and safely displays complete internal and external details", async () => {
    const records = [
      { firstName: "Ava <N>", lastName: "Nurse &", nickname: "Av", studentId: "S1", branch: "North", status: "normal", createdAt: "2026-10-04T10:00:00Z", gender: "female", blood: "O", weight: 55, height: 162, symptom: "Cut <hand>", sys: 120, dia: 80, pr: 70, medicine: "Bandage", quantity: 2, enteredByName: "Recorded By", responsibleName: "Duty Nurse", responsibleFromDutyShift: true, visitorDetail: "Student" },
      { firstName: "Guest", visitorType: "guest", visitorDetailExternal: "Visitor <company>", status: "refer", hospitalName: "City Hospital", createdAt: "invalid" },
      { firstName: "Hidden", status: "observe" },
    ];
    await load(JSON.stringify(records));
    expect(document.querySelectorAll(".visit-card")).toHaveLength(2);
    expect(document.querySelector(".visit-card").innerHTML).toContain("Ava &lt;N&gt; Nurse &amp;");
    document.getElementById("searchInput").value = "guest";
    document.getElementById("searchInput").dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelectorAll(".visit-card")).toHaveLength(1);
    expect(document.querySelector(".visit-card").textContent).toContain("Visitor <company>");
    document.getElementById("searchInput").value = "missing";
    document.getElementById("searchInput").dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector(".empty-state")).toBeTruthy();
    document.getElementById("searchInput").value = "ava";
    document.getElementById("searchInput").dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector(".visit-view-btn").click();
    expect(document.getElementById("visitDetailDialog").open).toBe(true);
    expect(document.getElementById("visitDetailFields").innerHTML).toContain("Cut &lt;hand&gt;");
    expect(document.getElementById("visitDetailFields").textContent).toContain("Duty Nurse");
    document.getElementById("languageButton").click();
    expect(document.documentElement.lang).toBe("en");
    expect(document.getElementById("visitDetailTitle").textContent).toBe("Visit details");
  });

  it("exports filtered visit data, prints, toggles notifications, and refreshes from storage", async () => {
    const { URLStub } = await load(JSON.stringify([{ firstName: "A", lastName: "B", status: "refer", createdAt: "2026-10-01T12:00:00Z" }]));
    document.getElementById("exportExcel").click();
    expect(URLStub.createObjectURL).toHaveBeenCalledOnce();
    expect(URLStub.revokeObjectURL).toHaveBeenCalledOnce();
    document.getElementById("exportPdf").click();
    expect(window.print).toHaveBeenCalledOnce();
    const button = document.getElementById("notificationButton");
    button.click();
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    document.body.click();
    expect(document.getElementById("notificationPanel").hidden).toBe(true);
    button.click();
    document.getElementById("closeNotification").click();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    window.dispatchEvent(new StorageEvent("storage", { key: "fms-infirmary-visits" }));
    expect(document.querySelectorAll(".visit-card")).toHaveLength(1);
    document.getElementById("closeVisitDetail").click();
  });

  it("shows the correct empty state for corrupt, non-list, and empty storage", async () => {
    await load("invalid-json");
    expect(document.querySelector(".empty-state").textContent).toContain("ยังไม่มีประวัติ");
    await load(JSON.stringify({ records: [] }));
    expect(document.querySelector(".empty-state")).toBeTruthy();
    await load("[]");
    expect(document.querySelector(".empty-state")).toBeTruthy();
  });
});
