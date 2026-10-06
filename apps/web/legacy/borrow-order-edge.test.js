import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/borrow-order.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/borrow-order.js");

async function loadPage({ selected = { M1: { quantity: 2 } }, form = { fullName: "Ava Nurse", role: "Staff", items: ["nurse bag"] }, createBorrowRecord = vi.fn() } = {}) {
  vi.resetModules();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  const values = new Map([
    ["fms-stock-records", JSON.stringify([{ code: "M1", name: "Bandage", total: 4, used: 1 }])],
    ["fms-borrow-products", JSON.stringify(selected)],
    ["fms-borrow-form", JSON.stringify(form)],
  ]);
  const removeItem = vi.fn((key) => values.delete(key));
  vi.stubGlobal("FMSStorage", { getItem: (key) => values.get(key) ?? null, removeItem, createBorrowRecord });
  vi.stubGlobal("print", vi.fn());
  vi.stubGlobal("JSZip", class {
    files = new Map();
    file(name, value) { this.files.set(name, value); return this; }
    async generateAsync() { return new Blob(["xlsx"]); }
  });
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:borrow"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await Object.values(scripts)[0]();
  return { values, removeItem, createBorrowRecord, URLStub };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("borrow order edge flows", () => {
  it("persists a valid borrowing request and deletes the draft cart", async () => {
    const createBorrowRecord = vi.fn(async () => ({ id: "loan-created" }));
    const { removeItem } = await loadPage({ createBorrowRecord });
    document.getElementById("saveOrder").click();
    await vi.waitFor(() => expect(createBorrowRecord).toHaveBeenCalledOnce());
    expect(createBorrowRecord.mock.calls[0][0]).toMatchObject({
      fullName: "Ava Nurse",
      borrowTypes: ["nurse bag"],
      items: [{ code: "M1", quantity: 2 }],
    });
    expect(removeItem).toHaveBeenCalledWith("fms-borrow-products");
  });

  it("exports an empty package and handles failure to load the XLSX library", async () => {
    const { URLStub } = await loadPage({ selected: {} });
    document.getElementById("exportExcel").click();
    await vi.waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce());
    expect(URLStub.createObjectURL).toHaveBeenCalledOnce();

    await loadPage();
    vi.stubGlobal("JSZip", undefined);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    document.getElementById("exportExcel").click();
    const loader = [...document.querySelectorAll("script")].find((script) => script.src.includes("jszip"));
    expect(loader).toBeTruthy();
    loader.dispatchEvent(new Event("error"));
    await vi.waitFor(() => expect(document.querySelector(".order-notice-modal").hidden).toBe(false));
    expect(document.querySelector(".order-notice-message").textContent).not.toBe("");
    expect(errorLog).toHaveBeenCalledOnce();
  });

  it("validates save requests, restores the button after storage errors, and dismisses dialogs", async () => {
    await loadPage({ form: {}, selected: {} });
    document.getElementById("saveOrder").click();
    expect(document.querySelector(".order-notice-modal").hidden).toBe(false);
    expect(document.getElementById("saveOrder").disabled).toBe(false);
    document.querySelector(".order-notice-close").click();

    const createBorrowRecord = vi.fn(async () => { throw new Error("write failed"); });
    await loadPage({ createBorrowRecord });
    document.getElementById("saveOrder").click();
    await vi.waitFor(() => expect(createBorrowRecord).toHaveBeenCalledOnce());
    expect(document.querySelector(".order-notice-message").textContent).toBe("write failed");
    expect(document.getElementById("saveOrder").disabled).toBe(false);
    document.querySelector(".order-notice-close").click();
    expect(document.querySelector(".order-notice-modal").hidden).toBe(true);
  });

  it("opens and closes export dialogs from buttons, backdrop, Escape, and PDF export", async () => {
    const { } = await loadPage();
    const modal = document.getElementById("exportModal");
    document.getElementById("openExport").click();
    expect(modal.hidden).toBe(false);
    document.getElementById("closeExport").click();
    expect(modal.hidden).toBe(true);
    document.querySelector(".topbar .export").click();
    expect(modal.hidden).toBe(false);
    modal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal.hidden).toBe(true);
    modal.hidden = false;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(modal.hidden).toBe(true);
    document.getElementById("exportPdf").click();
    expect(window.print).toHaveBeenCalledOnce();
  });
});
