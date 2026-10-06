import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pageHtml = readFileSync(resolve(process.cwd(), "../../Front-end/borrow-return.html"), "utf8");
const originalUrl = window.URL;
const loan = {
  id: "loan-1", item: "Alex Example", fullName: "Alex Example", borrower: "Nurse", kind: "Nurse",
  date: "01/10/2569", due: "08/10/2569", extendedDue: "12/10/2569", extensionDate: "05/10/2569",
  status: "borrowed", role: "Staff", items: [{ name: "Bandage", code: "MED-1", quantity: 3 }],
};

async function loadPage(records = [loan], stock = []) {
  const page = new DOMParser().parseFromString(pageHtml, "text/html");
  document.documentElement.lang = page.documentElement.lang;
  document.head.innerHTML = page.head.innerHTML;
  document.body.innerHTML = page.body.innerHTML;
  const extendBorrowRecord = vi.fn(async (_id, dueDate) => ({ ...records[0], due: dueDate, extendedDue: dueDate, extensionDate: "13/10/2569" }));
  window.FMSStorage = {
    getItem: (key) => JSON.stringify(key === "fms-borrow-return-records" ? records : key === "fms-stock-records" ? stock : []),
    extendBorrowRecord,
  };
  window.scrollTo = vi.fn();
  window.print = vi.fn();
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:borrow-return"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  window.URL = URLStub;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await import("../../../Front-end/borrow-return.js");
  return { extendBorrowRecord, URLStub };
}

describe("Borrow and return page", () => {
  let pageHarness;

  beforeEach(async () => {
    vi.resetModules();
    pageHarness = await loadPage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.URL = originalUrl;
    delete window.FMSStorage;
    delete window.FMSBorrowHistoryStore;
    document.body.replaceChildren();
  });

  it("shows extended loans and filters them by borrower", () => {
    expect(document.querySelector(".borrow-card h3").textContent).toBe("Alex Example");
    fireEvent.input(document.getElementById("borrowSearch"), { target: { value: "nobody" } });
    expect(document.querySelector(".borrow-card")).toBeNull();
    expect(document.querySelector(".empty-state")).not.toBeNull();
  });

  it("switches between extended loans and active returns", () => {
    fireEvent.click(document.getElementById("returnTab"));
    expect(document.getElementById("borrowPage").classList.contains("is-return-view")).toBe(true);
    expect(document.querySelector(".borrow-card h3").textContent).toBe("Alex Example");
    fireEvent.click(document.getElementById("returnHome"));
    expect(document.getElementById("borrowPage").classList.contains("is-return-view")).toBe(false);
  });

  it("opens a loan detail view with outstanding item information", () => {
    fireEvent.click(document.querySelector("[data-return='loan-1']"));

    expect(document.getElementById("borrowPage").hidden).toBe(true);
    expect(document.getElementById("returnDetailView").hidden).toBe(false);
    expect(document.getElementById("returnDetailTitle").textContent).toBe("Alex Example");
    expect(document.querySelector(".return-detail-item-list").textContent).toContain("Bandage");

    fireEvent.click(document.querySelector("[data-detail-back]"));
    expect(document.getElementById("borrowPage").hidden).toBe(false);
  });

  it("opens the extension modal with the current due date", () => {
    fireEvent.click(document.querySelector("[data-return='loan-1']"));
    fireEvent.click(document.querySelector("[data-detail-extend]"));

    expect(document.getElementById("extendBorrowModal").hidden).toBe(false);
    expect(document.getElementById("extendDueDate").value).toBe("2026-10-08");

    fireEvent.click(document.getElementById("cancelExtendBorrow"));
    expect(document.getElementById("extendBorrowModal").hidden).toBe(true);
  });

  it("switches page language", () => {
    fireEvent.click(document.querySelector(".language"));

    expect(document.documentElement.lang).toBe("en");
    expect(document.getElementById("borrowTab").textContent).toContain("Borrowing");
  });

  it("supports calendar picker keyboard controls and closes menus on outside click", () => {
    const monthButton = document.getElementById("calendarMonthButton");
    const monthOptions = document.getElementById("calendarMonthOptions");
    monthButton.click();
    expect(monthOptions.hidden).toBe(false);
    monthOptions.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(document.activeElement.dataset.month).toBe("11");
    monthOptions.querySelector("[data-month='0']").click();
    expect(monthOptions.hidden).toBe(true);
    monthButton.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(monthButton.getAttribute("aria-expanded")).toBe("true");
    monthOptions.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.activeElement).toBe(monthButton);

    const yearButton = document.getElementById("calendarYearButton");
    const yearOptions = document.getElementById("calendarYearOptions");
    yearButton.click();
    yearOptions.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(document.activeElement.hasAttribute("data-year")).toBe(true);
    yearOptions.querySelector("[data-year]").click();
    expect(yearOptions.hidden).toBe(true);
    yearButton.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(yearOptions.hidden).toBe(false);
    yearOptions.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement.hasAttribute("data-year")).toBe(true);
    yearOptions.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(document.activeElement.hasAttribute("data-year")).toBe(true);
    yearOptions.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.activeElement).toBe(yearButton);
    monthButton.click();
    document.body.click();
    expect(monthOptions.hidden).toBe(true);
    document.dispatchEvent(new Event("visibilitychange"));
  });

  it("exports records and saves a successful loan extension", async () => {
    const { extendBorrowRecord, URLStub } = pageHarness;
    document.getElementById("exportExcel").click();
    expect(URLStub.createObjectURL).toHaveBeenCalledOnce();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    document.querySelector("[data-return='loan-1']").click();
    document.querySelector("[data-detail-extend]").click();
    document.getElementById("extendDueDate").value = "2026-10-20";
    document.getElementById("extendBorrowForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(extendBorrowRecord).toHaveBeenCalledWith("loan-1", "2026-10-20"));
    expect(document.getElementById("extendBorrowModal").hidden).toBe(true);
    expect(document.getElementById("returnDetailView").hidden).toBe(false);
  });

  it("validates a missing due date, closes the extension dialog from Escape, and reports API failures", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const reportValidity = vi.spyOn(document.getElementById("extendDueDate"), "reportValidity").mockReturnValue(false);
    const { extendBorrowRecord } = pageHarness;
    document.querySelector("[data-return='loan-1']").click();
    document.querySelector("[data-detail-extend]").click();
    document.getElementById("extendDueDate").value = "";
    document.getElementById("extendBorrowForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(reportValidity).toHaveBeenCalledOnce();
    expect(extendBorrowRecord).not.toHaveBeenCalled();

    document.getElementById("extendDueDate").value = "2026-10-20";
    extendBorrowRecord.mockRejectedValueOnce(new Error("extension conflict"));
    document.getElementById("extendBorrowForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(alert).toHaveBeenCalledWith("extension conflict"));
    expect(document.querySelector('#extendBorrowForm button[type="submit"]').disabled).toBe(false);
    document.getElementById("extendBorrowModal").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("extendBorrowModal").hidden).toBe(true);
  });

  it("classifies returned, extended, overdue, and legacy date records across both views", async () => {
    vi.resetModules();
    await loadPage([
      { id: "extended", item: "Extended", kind: "Staff", date: "01/10/2569", due: "10/10/2569", extendedDue: "20/10/2569", extensionDate: "05/10/2569", status: "borrowed", items: [{ name: "Bandage", code: "MED-1", quantity: 1 }] },
      { id: "overdue", item: "Overdue", kind: "Nurse", due: "01/01/2568", status: "overdue", items: [{ name: "Mask", code: "M2", quantity: 2 }] },
      { id: "legacy-past", item: "Legacy due", kind: "Staff", dueDate: "2020-01-01", status: "borrowed", products: { M3: { name: "Tape", count: 3 } } },
      { id: "invalid", item: "Invalid date", due: "not-a-date", status: "borrowed", items: [{ name: "Cotton", quantity: 1 }] },
      { id: "returned", item: "Already returned", due: "01/01/2568", returnedDate: "02/01/2568", status: "returned", items: [{ name: "Gauze", quantity: 1 }] },
      { id: "empty", item: "Empty items", due: "01/01/2568", status: "borrowed", items: [] },
    ]);
    expect(document.querySelectorAll(".borrow-card")).toHaveLength(3);
    expect(document.querySelector("[data-return='extended']").closest(".borrow-card").classList.contains("is-due")).toBe(true);
    expect(document.querySelector("[data-return='overdue']").closest(".borrow-card").classList.contains("is-overdue")).toBe(true);
    expect(document.querySelector("[data-return='legacy-past']")).not.toBeNull();

    document.querySelector("[data-return='legacy-past']").click();
    expect(document.querySelectorAll(".return-detail-item")).toHaveLength(1);
    expect(document.querySelector(".return-detail-item").textContent).toContain("Tape");
    expect(document.querySelector(".return-detail-item").textContent).toContain("3");
    document.querySelector("[data-detail-back]").click();
    document.getElementById("returnTab").click();
    expect(document.querySelectorAll(".borrow-card")).toHaveLength(4);
    expect(document.querySelector("[data-return='returned']")).toBeNull();
  });

  it("renders escaped item names and resolves legacy product codes through stock", async () => {
    vi.resetModules();
    await loadPage(
      [{
        id: "legacy-products", item: "<Borrower & Nurse>", due: "2026-10-20", extendedDue: "2026-10-20", extensionDate: "2026-10-10", status: "borrowed",
        products: { "MED<&1": { productName: "", count: 2 } },
      }],
      [{ code: "MED<&1", name: "Gauze & tape" }],
    );
    const cardName = document.querySelector(".borrow-card h3");
    expect(cardName.innerHTML).toContain("&lt;Borrower &amp; Nurse&gt;");
    document.querySelector("[data-return='legacy-products']").click();
    expect(document.querySelector(".return-detail-item strong").textContent).toBe("Gauze & tape");
    expect(document.querySelector(".return-detail-item small").textContent).toContain("MED<&1");
    document.getElementById("exportPdf").click();
    expect(window.print).toHaveBeenCalledOnce();
  });
});
