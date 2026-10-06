import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/catalog-order.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/catalog-order.js");

async function loadPage(cart = { M1: { quantity: 2, option: "box" } }, { withHistorySave = false } = {}) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  if (withHistorySave) {
    const saveButton = document.createElement("button");
    saveButton.id = "saveOrderToHistory";
    document.body.append(saveButton);
  }
  history.replaceState({}, "", "/legacy/catalog-order.html");
  const values = new Map([
    ["fms-stock-records", JSON.stringify([{ code: "M1", name: "Bandage", total: 10, used: 1 }])],
    ["fms-catalog-cart", JSON.stringify(cart)],
    ["fms-history-catalog-orders", "[]"],
  ]);
  vi.stubGlobal("FMSStorage", {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  vi.stubGlobal("print", vi.fn());
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:order"), revokeObjectURL: vi.fn() });
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

describe("catalog order document", () => {
  it("persists the title and saves a compact history snapshot only once", async () => {
    const values = await loadPage();
    expect(document.getElementById("orderCount").textContent).toBe("1");
    expect(document.getElementById("orderList").textContent).toContain("Bandage");
    const title = document.getElementById("orderTitle");
    title.value = "First Aid Restock";
    title.dispatchEvent(new Event("input", { bubbles: true }));
    expect(values.get("fms-order-title")).toBe("First Aid Restock");
    document.getElementById("submitOrder").click();
    const saved = JSON.parse(values.get("fms-history-catalog-orders"));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ documentTitle: "First Aid Restock", items: [{ code: "M1", quantity: 2, option: "box" }] });
    document.getElementById("submitOrder").click();
    expect(JSON.parse(values.get("fms-history-catalog-orders"))).toHaveLength(1);
  });

  it("offers print and Excel exports and records before opening the export dialog", async () => {
    const values = await loadPage();
    document.getElementById("submitOrder").click();
    expect(document.getElementById("exportModal").hidden).toBe(false);
    expect(JSON.parse(values.get("fms-history-catalog-orders"))).toHaveLength(1);
    document.getElementById("exportPdf").click();
    expect(window.print).toHaveBeenCalledOnce();
    document.getElementById("submitOrder").click();
    document.getElementById("exportExcel").click();
    await vi.waitFor(() => expect(document.getElementById("exportExcel").disabled).toBe(false));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(document.getElementById("exportModal").hidden).toBe(true);
  });

  it("renders a cart without items and disables history save", async () => {
    const values = await loadPage({});
    expect(document.getElementById("orderCount").textContent).toBe("0");
    document.getElementById("submitOrder").click();
    expect(JSON.parse(values.get("fms-history-catalog-orders"))).toHaveLength(0);
  });

  it("reports storage quota failures while saving order history", async () => {
    const values = await loadPage(undefined, { withHistorySave: true });
    const setItem = vi.fn(() => {
      const error = new Error("full");
      error.name = "QuotaExceededError";
      throw error;
    });
    vi.stubGlobal("FMSStorage", { getItem: (key) => values.get(key) ?? null, setItem });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    document.getElementById("saveOrderToHistory").click();
    expect(document.getElementById("saveOrderToHistory").title).toContain("เต็ม");
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(setItem).toHaveBeenCalledOnce();
  });

  it("exports image data when available and safely falls back when image loading fails", async () => {
    const values = await loadPage({
      M1: { quantity: 2, option: "box", image: "/bandage.png" },
      M2: { quantity: 1, option: "pack", image: "/gauze.png" },
    });
    const originalFetch = window.fetch;
    window.fetch = vi.fn()
      .mockResolvedValueOnce({ blob: async () => new Blob(["image"], { type: "image/png" }) })
      .mockRejectedValueOnce(new Error("offline"));
    document.getElementById("exportExcel").click();
    await vi.waitFor(() => expect(document.getElementById("exportExcel").disabled).toBe(false));
    expect(window.fetch).toHaveBeenCalledTimes(2);
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    window.fetch = originalFetch;
    expect(values.get("fms-history-catalog-orders")).toBe("[]");
  });
});
