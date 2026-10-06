import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/borrow-return-history.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/borrow-return-history.js");
const loans = [{
  id: "loan-history-1", fullName: "Ava Nurse", role: "Staff", status: "overdue", due: "2026-10-03",
  date: "2026-10-01", items: [{ code: "M1", name: "Bandage", quantity: 3 }],
  returnHistory: [{ date: "2026-10-04", items: [{ code: "M1", name: "Bandage", quantity: 1 }] }],
}];

async function loadPage(records = loans, stock = [{ code: "M1", name: "Bandage", total: 10, used: 2, remaining: 8, unit: "box" }]) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  const values = new Map([["fms-borrow-return-records", JSON.stringify(records)], ["fms-stock-records", JSON.stringify(stock)]]);
  vi.stubGlobal("FMSStorage", { getItem: (key) => values.get(key) ?? null });
  vi.stubGlobal("FMSBorrowHistoryStore", { read: () => records });
  vi.stubGlobal("print", vi.fn());
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:borrow-history"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await Object.values(scripts)[0]();
  return values;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("borrow and return history page", () => {
  it("renders nested returns and filters the borrower and medicine records", async () => {
    await loadPage();
    expect(document.querySelectorAll(".history-record")).toHaveLength(1);
    expect(document.querySelector(".nested-return-record").textContent).toContain("Bandage");
    document.querySelector("[data-borrow-event-toggle]").click();
    expect(document.querySelector(".borrow-history-event-detail").hidden).toBe(false);
    const search = document.getElementById("searchInput");
    search.value = "not-a-match";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector(".empty-state")).not.toBeNull();
    document.getElementById("clearSearch").click();
    expect(document.querySelector(".history-record")).not.toBeNull();
  });

  it("opens return details, supports export, refresh and translation", async () => {
    await loadPage();
    document.querySelector("[data-detail-event-id^='return-']").click();
    expect(document.getElementById("borrowDetailModal").hidden).toBe(false);
    expect(document.getElementById("borrowDetailContent").textContent).toContain("Bandage");
    document.querySelector("[data-detail-export='excel']").click();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    document.querySelector("[data-close-borrow-detail]").click();
    document.getElementById("languageButton").click();
    expect(document.documentElement.lang).toBe("en");
    document.getElementById("notificationButton").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    window.dispatchEvent(new Event("focus"));
    document.getElementById("exportPdf").click();
    expect(window.print).toHaveBeenCalledOnce();
  });

  it("renders an empty history for an invalid stored shape", async () => {
    await loadPage([]);
    expect(document.querySelector(".empty-state")).not.toBeNull();
    document.getElementById("exportExcel").click();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });

  it("normalizes legacy borrow and return shapes and renders stock-backed item details", async () => {
    const rows = [
      {
        id: "kit 1", fullName: "Kit Borrower", roles: ["Staff", "Nurse"],
        borrowTypes: ["à¸à¸£à¸°à¹€à¸›à¹‹à¸²à¸žà¸¢à¸²à¸šà¸²à¸¥", "à¸ªà¹ˆà¸§à¸™à¸šà¸¸à¸„à¸„à¸¥", "ignored"],
        status: "returned", dueDate: "2026-10-10", phone: "555-0100", studentId: "S1", activity: "Training", reason: "Clinic",
        borrowedItems: [{ productName: "Mask", productCode: "P1", count: 2, image: "/mask.png" }],
        returnHistory: [{ date: "2026-10-04", items: [{ productName: "Mask", productCode: "P1", count: 1 }] }],
      },
      { name: "Legacy borrower", kind: "Equipment", productCode: "P2", quantity: 1, returnedDate: "invalid-date" },
    ];
    await loadPage(rows, [{ productCode: "P1", productName: "Protective Mask", imageUrl: "/current-mask.png", unit: "piece", total: 8, used: 3, category: "equipment", genericName: "Mask", form: "Box", expiry: "2027-01-01" }]);
    expect(document.querySelectorAll(".history-record")).toHaveLength(2);
    expect(document.querySelectorAll(".nested-return-record")).toHaveLength(2);
    expect(document.querySelector(".history-item-image").src).toContain("current-mask.png");
    expect(document.querySelector(".history-status.is-returned")).not.toBeNull();

    document.querySelector("[data-borrow-event-toggle]").click();
    const detailTrigger = document.querySelector("[data-detail-event-id='return-kit 1-0']");
    detailTrigger.click();
    const detail = document.getElementById("borrowDetailContent");
    expect(detail.textContent).toContain("Protective Mask");
    expect(detail.textContent).toContain("Training");
    expect(detail.textContent).toContain("555-0100");
    expect(detail.querySelector(".detail-item-image").src).toContain("current-mask.png");
    document.querySelector("[data-detail-export='excel']").click();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    document.querySelector("[data-detail-export='pdf']").click();
    await vi.waitFor(() => expect(window.print).toHaveBeenCalledOnce());
    expect(document.querySelector(".borrow-detail-print-root")).not.toBeNull();
    window.dispatchEvent(new Event("afterprint"));
    expect(document.querySelector(".borrow-detail-print-root")).toBeNull();
    expect(document.body.classList.contains("printing-borrow-detail")).toBe(false);
  });

  it("supports detail focus restoration, live history refresh, and empty item fallbacks", async () => {
    const records = [{ id: "legacy", borrower: "Borrower", department: "Ops", quantity: 2, productCode: "OLD" }];
    await loadPage(records, "invalid-json-stock");
    const trigger = document.querySelector("[data-detail-event-id='borrow-legacy']");
    document.querySelector("[data-borrow-event-toggle]").click();
    document.querySelector("[data-detail-event-id='borrow-legacy']").click();
    expect(document.getElementById("borrowDetailContent").textContent).toContain("Borrower");
    expect(document.getElementById("borrowDetailContent").querySelector(".detail-empty")).toBeNull();
    document.getElementById("borrowDetailContent").querySelector("[data-close-borrow-detail]").click();
    expect(document.activeElement).toBe(trigger);
    records[0].fullName = "Updated borrower";
    window.dispatchEvent(new StorageEvent("storage", { key: "fms-borrow-return-records" }));
    expect(document.querySelector(".history-record").textContent).toContain("Updated borrower");
  });
});
