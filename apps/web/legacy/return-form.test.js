import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/return-form.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/return-form.js");
const loan = {
  id: "loan-return-1", fullName: "Test Borrower", status: "borrowed", stockCommitted: true,
  items: [{ code: "MED-1", quantity: 3 }],
  borrowedItems: [{ code: "MED-1", name: "Old name", quantity: 3 }],
};

async function loadPage({ record = loan, stock = [{ code: "MED-1", name: "Bandage", total: 10, used: 3, remaining: 7 }], returnBorrowRecord = vi.fn(), recordId = "" } = {}) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  document.documentElement.lang = "th";
  history.replaceState({}, "", `/legacy/return-form.html${recordId ? `?id=${recordId}` : ""}`);
  const values = new Map([
    ["fms-borrow-return-records", JSON.stringify(record ? [record] : [])],
    ["fms-stock-records", JSON.stringify(stock)],
  ]);
  vi.stubGlobal("FMSStorage", {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    returnBorrowRecord,
  });
  vi.stubGlobal("print", vi.fn());
  await Object.values(scripts)[0]();
  return { values, returnBorrowRecord };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("return form", () => {
  it("renders a loan, clamps return quantity, and shows validation for zero returns", async () => {
    await loadPage();
    expect(document.getElementById("returnBorrowerDetails").textContent).toContain("Test Borrower");
    expect(document.getElementById("borrowedProducts").textContent).toContain("Bandage");
    const quantity = document.querySelector("[data-return-quantity='0']");
    quantity.value = "99";
    quantity.dispatchEvent(new Event("input", { bubbles: true }));
    expect(quantity.value).toBe("3");
    quantity.value = "0";
    quantity.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("submitReturn").click();
    expect(document.getElementById("returnNoticeModal").hidden).toBe(false);
    expect(document.querySelector(".return-page").inert).toBe(true);
    document.getElementById("closeReturnNotice").click();
    expect(document.getElementById("returnNoticeModal").hidden).toBe(true);
  });

  it("submits selected quantities through storage and reports API errors", async () => {
    const api = vi.fn().mockRejectedValueOnce(new Error("API unavailable"));
    await loadPage({ returnBorrowRecord: api });
    const quantity = document.querySelector("[data-return-quantity='0']");
    quantity.value = "2";
    quantity.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("submitReturn").click();
    expect(api).toHaveBeenCalledWith("loan-return-1", [{ code: "MED-1", quantity: 2 }]);
    await vi.waitFor(() => expect(document.getElementById("returnNoticeMessage").textContent).toBe("API unavailable"));
    expect(document.getElementById("submitReturn").disabled).toBe(false);
  });

  it("shows the empty state for missing records and supports print export", async () => {
    await loadPage({ record: null });
    expect(document.getElementById("returnEmptyState").hidden).toBe(false);
    expect(document.getElementById("submitReturn").disabled).toBe(true);
    document.getElementById("openReturnExport").click();
    expect(document.getElementById("returnExportModal").hidden).toBe(false);
    document.getElementById("returnExportPdf").click();
    expect(window.print).toHaveBeenCalledOnce();
  });

  it("exports the current return report as an Excel-compatible download", async () => {
    await loadPage();
    const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:return"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("URL", URLStub);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    document.getElementById("openReturnExport").click();
    document.getElementById("returnExportExcel").click();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(URLStub.revokeObjectURL).toHaveBeenCalledWith("blob:return");
    expect(document.getElementById("returnExportModal").hidden).toBe(true);
  });

  it("submits a complete return through the API and shows errors when stock data is malformed", async () => {
    const api = vi.fn().mockResolvedValue({ ok: true });
    await loadPage({ returnBorrowRecord: api, stock: [] });
    const quantity = document.querySelector("[data-return-quantity='0']");
    quantity.value = "2";
    quantity.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("submitReturn").click();
    await vi.waitFor(() => expect(api).toHaveBeenCalledWith("loan-return-1", [{ code: "MED-1", quantity: 2 }]));
    expect(document.getElementById("submitReturn").disabled).toBe(true);
  });

  it("normalizes legacy product maps and renders already returned records as empty", async () => {
    const legacy = { ...loan, items: undefined, products: { "MED-1": { quantity: 2, name: "Legacy bandage" } } };
    await loadPage({ record: legacy });
    expect(document.getElementById("returnProducts").textContent).toContain("Bandage");
    expect(document.querySelector("[data-return-quantity='0']").max).toBe("2");

    vi.resetModules();
    const returned = { ...loan, status: "returned" };
    await loadPage({ record: returned });
    expect(document.getElementById("returnEmptyState").hidden).toBe(false);
    expect(document.getElementById("returnStatus").textContent).not.toBe("");
  });

  it("closes confirmations by cancel, backdrop, and Escape", async () => {
    await loadPage();
    document.getElementById("cancelReturn").click();
    expect(document.getElementById("returnNoticeModal").hidden).toBe(false);
    document.getElementById("cancelReturnNotice").click();
    expect(document.querySelector(".return-page").inert).toBe(false);
    document.getElementById("cancelReturn").click();
    document.getElementById("returnNoticeModal").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("returnNoticeModal").hidden).toBe(true);
    document.getElementById("cancelReturn").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.getElementById("returnNoticeModal").hidden).toBe(true);
  });

  it("reports that there is no return report available to export", async () => {
    await loadPage({ record: null });
    document.getElementById("openReturnExport").click();
    document.getElementById("returnExportExcel").click();
    expect(document.getElementById("returnExportModal").hidden).toBe(true);
    expect(document.getElementById("returnNoticeModal").hidden).toBe(false);
  });

  it("supports checkbox selection and the legacy single-product fallback", async () => {
    const legacy = { id: "legacy-1", borrower: "Visitor", status: "overdue", productCode: "MED-1", quantity: 4 };
    await loadPage({ record: legacy, stock: [{ code: "MED-1", name: "Bandage", image: "https://example.test/bandage.png" }] });
    expect(document.querySelector(".return-sheet-heading").classList.contains("is-overdue")).toBe(true);
    expect(document.querySelector(".borrowed-product-card img").src).toBe("https://example.test/bandage.png");
    expect(document.querySelector("[data-return-quantity='0']").max).toBe("4");

    const checkbox = document.querySelector("[data-return-check='0']");
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.activeElement).toBe(document.querySelector("[data-return-quantity='0']"));
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.querySelector("[data-return-quantity='0']").value).toBe("0");
  });

  it("clamps negative return values and dismisses export by backdrop or Escape", async () => {
    await loadPage();
    const quantity = document.querySelector("[data-return-quantity='0']");
    quantity.value = "-5";
    quantity.dispatchEvent(new Event("input", { bubbles: true }));
    expect(quantity.value).toBe("0");
    document.getElementById("openReturnExport").click();
    document.getElementById("returnExportModal").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("returnExportModal").hidden).toBe(true);
    document.querySelector(".export").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.getElementById("returnExportModal").hidden).toBe(true);
  });

  it("confirms notice actions and loads a record selected by URL", async () => {
    const another = { ...loan, id: "other-loan", fullName: "Other Borrower" };
    await loadPage({ record: another, recordId: "other-loan" });
    expect(document.getElementById("returnBorrowerDetails").textContent).toContain("Other Borrower");
    document.getElementById("submitReturn").click();
    document.getElementById("confirmReturnNotice").click();
    expect(document.getElementById("returnNoticeModal").hidden).toBe(true);
  });
});
