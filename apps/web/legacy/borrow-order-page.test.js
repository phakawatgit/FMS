import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/borrow-order.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/borrow-order.js");
const activityScripts = import.meta.glob("../../../Front-end/borrow-order-activity.js");

async function loadPage({ selected = { M1: { quantity: 2 } }, stock = [{ code: "M1", name: "Bandage", total: 5, used: 1, remaining: 4 }], form = { fullName: "Ava Nurse", role: "Staff", items: ["nurse bag"] }, createBorrowRecord = vi.fn() } = {}) {
  vi.resetModules();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  const values = new Map([
    ["fms-stock-records", JSON.stringify(stock)],
    ["fms-borrow-products", JSON.stringify(selected)],
    ["fms-borrow-form", JSON.stringify(form)],
  ]);
  const removeItem = vi.fn((key) => values.delete(key));
  vi.stubGlobal("FMSStorage", { getItem: (key) => values.get(key) ?? null, removeItem, createBorrowRecord });
  vi.stubGlobal("print", vi.fn());
  vi.stubGlobal("alert", vi.fn());
  const files = new Map();
  vi.stubGlobal("JSZip", class {
    file(name, value) { files.set(name, value); return this; }
    async generateAsync() { return new Blob(["test-xlsx"]); }
  });
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:borrow-order"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await Object.values(scripts)[0]();
  return { values, files, removeItem };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("borrow order summary and export", () => {
  it("renders borrower and selected item details, and filters Excel items", async () => {
    const { files } = await loadPage();
    expect(document.getElementById("borrowerDetails").textContent).toContain("Ava Nurse");
    expect(document.getElementById("orderProducts").textContent).toContain("Bandage");
    document.getElementById("openExport").click();
    expect(document.getElementById("exportModal").hidden).toBe(false);
    document.querySelector("[data-export-item='M1']").checked = false;
    document.getElementById("exportExcel").click();
    await vi.waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce());
    expect(files.get("xl/worksheets/sheet1.xml")).not.toContain("Bandage");
    expect(document.getElementById("exportModal").hidden).toBe(true);
  });

  it("supports modal close, escape and PDF print; shows the empty product state", async () => {
    await loadPage({ selected: {} });
    expect(document.querySelector(".order-empty")).not.toBeNull();
    document.getElementById("openExport").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("exportModal").hidden).toBe(true);
    document.getElementById("openExport").click();
    document.getElementById("exportPdf").click();
    expect(window.print).toHaveBeenCalledOnce();
    expect(document.getElementById("exportModal").hidden).toBe(true);
  });

  it("validates missing borrower or items and recovers from API save failures", async () => {
    await loadPage({ selected: {}, form: {} });
    document.getElementById("saveOrder").click();
    expect(document.querySelector(".order-notice-modal").hidden).toBe(false);
    document.querySelector(".order-notice-close").click();

    const api = vi.fn().mockRejectedValue(new Error("API unavailable"));
    await loadPage({ createBorrowRecord: api });
    document.getElementById("saveOrder").click();
    expect(api).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(document.getElementById("saveOrder").disabled).toBe(false));
    expect(document.querySelector(".order-notice-message").textContent).toBe("API unavailable");
  });

  it("embeds accessible product images in the Excel package and continues when an image cannot load", async () => {
    const stock = [{ code: "M1", name: "Bandage", total: 5, used: 1, remaining: 4, image: "https://example.test/bandage.png" }];
    const { files } = await loadPage({ stock });
    vi.stubGlobal("Image", class {
      naturalWidth = 80;
      naturalHeight = 40;
      set src(value) { this.source = value; queueMicrotask(() => this.onload?.()); }
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn(), set fillStyle(_value) {} });
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,embedded-image");
    document.getElementById("openExport").click();
    document.getElementById("exportExcel").click();
    await vi.waitFor(() => expect(files.get("xl/media/image1.png")).toBe("embedded-image"));
    expect(files.get("xl/worksheets/_rels/sheet1.xml.rels")).toContain("drawing");

    await loadPage({ stock: [{ ...stock[0], image: "https://example.test/missing.png" }] });
    vi.stubGlobal("Image", class {
      set src(_value) { queueMicrotask(() => this.onerror?.()); }
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    document.getElementById("openExport").click();
    document.getElementById("exportExcel").click();
    await vi.waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(2));
    expect(console.warn).toHaveBeenCalled();
  });

  it("adds conditional activity and personal-use details to the borrow summary", async () => {
    await loadPage({ form: { fullName: "Ava", items: ["กระเป๋าพยาบาล", "ส่วนบุคคล"], activity: "Sports day", reason: "Personal first aid" } });
    await Object.values(activityScripts)[0]();
    const details = [...document.querySelectorAll(".activity-detail")];
    expect(details).toHaveLength(2);
    expect(details.map((row) => row.textContent)).toEqual(expect.arrayContaining(["ใช้กับกิจกรรม:Sports day", "รายละเอียดการใช้งาน:Personal first aid"]));
  });
});
