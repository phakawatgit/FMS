import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/history-catalog.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/history-catalog.js");
const order = {
  id: "order-1", title: "Order 1", documentTitle: "Clinic stock", createdAt: "2026-10-01T10:00:00Z", status: "Completed",
  requester: "Ava", department: "Clinic", items: [{ code: "M1", name: "Bandage", quantity: 2, option: "box" }],
};

async function loadPage(orders = [order], stock = [{ code: "M1", name: "Bandage", genericName: "Gauze", category: "equipment", total: 8, used: 1, unit: "box", image: "https://example.test/m1.png" }]) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  document.documentElement.lang = "th";
  history.replaceState({}, "", "/legacy/history-catalog.html");
  const values = new Map([
    ["fms-history-catalog-orders", typeof orders === "string" ? orders : JSON.stringify(orders)],
    ["fms-stock-records", typeof stock === "string" ? stock : JSON.stringify(stock)],
  ]);
  vi.stubGlobal("FMSStorage", { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) });
  vi.stubGlobal("print", vi.fn());
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:catalog-history"), revokeObjectURL: vi.fn() });
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

describe("catalog order history", () => {
  it("renders searchable orders and expandable live product details", async () => {
    await loadPage();
    expect(document.querySelectorAll(".order-history-card")).toHaveLength(1);
    expect(document.querySelector(".order-history-card").textContent).toContain("Clinic stock");
    document.querySelector("[data-order-detail]").click();
    expect(document.querySelector(".order-history-detail").hidden).toBe(false);
    document.getElementById("languageButton").click();
    expect(document.documentElement.lang).toBe("en");
    document.querySelector("[data-order-detail]").click();
    document.querySelector("[data-product-detail]").click();
    expect(document.querySelector(".product-detail-panel").hidden).toBe(false);
    expect(document.querySelector(".product-detail-panel").textContent).toContain("Generic name");
    expect(document.querySelector(".product-detail-panel").textContent).toContain("Gauze");
    const search = document.getElementById("searchInput");
    search.value = "missing text";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector(".empty-state")).not.toBeNull();
    document.getElementById("clearSearch").click();
    expect(document.querySelectorAll(".order-history-card")).toHaveLength(1);
  });

  it("exports individual and full orders and restores panels after print", async () => {
    await loadPage([order, { ...order, id: "order-2", title: "Order 2", items: [] }]);
    document.querySelector("[data-order-detail]").click();
    document.querySelector("[data-export-format='excel']").click();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    document.querySelector("[data-export-format='pdf']").click();
    expect(window.print).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event("beforeprint"));
    expect(document.querySelectorAll(".order-history-card.print-excluded")).toHaveLength(1);
    window.dispatchEvent(new Event("afterprint"));
    expect(document.querySelectorAll(".order-history-card.print-excluded")).toHaveLength(0);
    document.getElementById("exportExcel").click();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(2);
    document.getElementById("exportPdf").click();
    expect(window.print).toHaveBeenCalledTimes(2);
  });

  it("deletes orders, responds to storage changes, localizes and shows empty results", async () => {
    const values = await loadPage();
    document.querySelector("[data-delete-order='order-1']").click();
    expect(JSON.parse(values.get("fms-history-catalog-orders"))).toEqual([]);
    expect(document.querySelector(".empty-state")).not.toBeNull();
    window.dispatchEvent(new StorageEvent("storage", { key: "fms-stock-records" }));
    document.getElementById("languageButton").click();
    expect(document.documentElement.lang).toBe("en");
    document.getElementById("notificationButton").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
  });

  it("renders legacy product shapes without current stock and filters by normalized fields", async () => {
    const legacy = {
      name: "Order saved", createdAt: "2026-10-02", status: "Processing",
      products: [{ productName: "Rare supply", productCode: "OLD-2", count: 2, variant: "small", photoUrl: "https://example.test/old.png", category: "equipment", unit: "piece" }],
    };
    await loadPage([legacy]);
    expect(document.querySelector(".order-history-card").textContent).toContain("Order saved");
    expect(document.querySelector(".order-history-products").innerHTML).toContain("example.test/old.png");
    document.querySelector("[data-product-detail]").click();
    expect(document.querySelector(".product-thumb img").src).toBe("https://example.test/old.png");
    expect(document.querySelector(".product-detail-panel").textContent).toContain("OLD-2");
    const search = document.getElementById("searchInput");
    search.value = "  OLD-2  ";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelectorAll(".order-history-card")).toHaveLength(1);
    search.value = "not here";
    document.getElementById("languageButton").click();
    document.getElementById("historySearchForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(document.querySelector(".empty-state").textContent).toContain("No matching");
  });

  it("supports swipe gestures, pointer cancellation, invalid deletion IDs, and visible-page refresh", async () => {
    await loadPage();
    const card = document.querySelector(".order-history-card");
    card.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 100 }));
    document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 50, cancelable: true }));
    expect(card.style.transform).toContain("translateX");
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 20 }));
    expect(card.classList.contains("is-swipe-ready")).toBe(true);
    card.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 100 }));
    document.dispatchEvent(new Event("pointercancel"));
    expect(card.classList.contains("is-dragging")).toBe(false);
    document.querySelector(".order-delete-button").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 100 }));
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 100 }));
    document.querySelector("[data-order-detail]").click();
    document.querySelector("[data-delete-order]").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    if (visibilityDescriptor) Object.defineProperty(document, "visibilityState", visibilityDescriptor);
    else delete document.visibilityState;
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    const missingExport = document.createElement("button");
    missingExport.dataset.exportOrder = "not-present";
    missingExport.dataset.exportFormat = "excel";
    document.getElementById("orderHistoryList").append(missingExport);
    missingExport.click();
    const missingDelete = document.createElement("button");
    missingDelete.dataset.deleteOrder = "not-present";
    document.getElementById("orderHistoryList").append(missingDelete);
    missingDelete.click();
  });

  it("resolves current products by normalized name and supports object images and missing details", async () => {
    const legacy = {
      id: "order / saved", name: "Saved order", status: "Processing", products: [
        { productName: "Gauze", count: 0, variant: "pack", image: "/saved.png" },
        { productName: "Archive <supply> & 'wrap' \"sterile\"", image: { src: "/archive.png" } },
        { productName: "No image product" },
        {},
      ],
    };
    await loadPage([legacy], [{
      productName: "Gauze", productCode: "G-1", category: "topical", total: 4, used: 5, unit: "box", image: { url: "/current.png" },
    }]);
    const products = [...document.querySelectorAll(".order-history-product")];
    expect(products).toHaveLength(4);
    expect(products[0].querySelector("img").getAttribute("src")).toBe("/current.png");
    expect(products[1].querySelector("img").getAttribute("src")).toBe("/archive.png");
    expect(products[1].querySelector(".product-summary strong").textContent).toBe("Archive <supply> & 'wrap' \"sterile\"");
    expect(products[2].querySelector(".product-thumb span")).not.toBeNull();
    products[3].querySelector("[data-product-detail]").click();
    expect(products[3].querySelector(".product-detail-panel").textContent).not.toContain("Current stock");
    products[0].querySelector("[data-product-detail]").click();
    expect(products[0].querySelector(".product-detail-panel").textContent).toContain("0 box");
  });

  it("handles corrupted persisted JSON and localizes numbered legacy order titles", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadPage("not valid JSON", "{}");
    expect(document.querySelector(".empty-state")).not.toBeNull();
    expect(warn).toHaveBeenCalled();

    const numbered = {
      id: "numbered", title: "การสั่งซื้อสินค้าครั้งที่ 12",
      status: "บันทึกคำสั่งซื้อแล้ว", items: [],
    };
    vi.resetModules();
    const earlier = { ...numbered, id: "earlier", createdAt: "2026-10-01T08:00:00Z" };
    const later = { ...numbered, id: "later", createdAt: "2026-10-02T08:00:00Z" };
    const undated = { ...numbered, id: "undated" };
    const fallbackTitle = { id: "fallback-title", documentTitle: "Fallback PO" };
    const departmentOnly = { id: "department", title: "Department order", department: "Clinic", products: [] };
    const requesterOnly = { id: "requester", title: "Requester order", requester: "Ava", products: [] };
    await loadPage([later, fallbackTitle, earlier, undated, departmentOnly, requesterOnly]);
    expect(document.querySelector(".order-history-card").dataset.orderId).toBe("fallback-title");
    expect([...document.querySelectorAll(".order-history-card")].map((card) => card.dataset.orderId)).toEqual(["fallback-title", "department", "requester", "undated", "earlier", "later"]);
    document.getElementById("languageButton").click();
    expect(document.querySelector("[data-order-id='earlier'] .order-history-toggle").textContent).toContain("Order #12");
    expect(document.querySelector("[data-order-id='earlier'] .mockup-status").textContent).toBe("Order saved");
    document.getElementById("exportExcel").click();
    vi.resetModules();
    await loadPage([undated, later]);
    expect(document.querySelector(".order-history-card").dataset.orderId).toBe("undated");
  });

  it("exports sparse legacy orders and leaves short pointer movements closed", async () => {
    const sparseOrder = { name: "Old order", products: [{}] };
    const values = await loadPage([sparseOrder], []);
    const card = document.querySelector(".order-history-card");
    expect(card.dataset.orderId).toBe("order-0");
    const exportButton = document.querySelector("[data-export-format='excel']");
    exportButton.click();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(document.querySelector(".order-history-card").classList.contains("print-excluded")).toBe(false);

    card.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 100 }));
    const smallMove = new PointerEvent("pointermove", { bubbles: true, clientX: 95, cancelable: true });
    document.dispatchEvent(smallMove);
    expect(smallMove.defaultPrevented).toBe(false);
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 80 }));
    expect(card.classList.contains("is-swipe-ready")).toBe(false);
    document.querySelector("[data-delete-order='order-0']").click();
    expect(JSON.parse(values.get("fms-history-catalog-orders"))).toEqual([]);
  });

  it("loads historical image field variants and refreshes after storage values disappear", async () => {
    const historical = {
      id: "images", items: [
        { code: "IMAGE-URL" }, { code: "IMAGE-DATA" }, { code: "PHOTO" }, { code: "PHOTO-URL" },
        { productName: "Saved image", image: { dataUrl: "data:image/png;base64,AA" } }, { productCode: "STOCK-ALIAS" },
        { productName: "Empty image object", image: {} },
      ],
    };
    await loadPage([historical], [
      { name: "No product identifiers", genericName: "Other" },
      { code: "IMAGE-URL", name: "URL", imageUrl: "/url.png" },
      { code: "IMAGE-DATA", name: "Data", imageDataUrl: "/data.png" },
      { code: "PHOTO", name: "Photo", photo: "/photo.png" },
      { code: "PHOTO-URL", name: "Photo URL", photoUrl: "/photo-url.png" },
      { productCode: "STOCK-ALIAS", name: "Stock alias", image: { src: "/alias.png" } },
    ]);
    document.getElementById("languageButton").click();
    const sources = [...document.querySelectorAll(".product-thumb img")].map((image) => image.getAttribute("src"));
    expect(sources).toEqual(["/url.png", "/data.png", "/photo.png", "/photo-url.png", "data:image/png;base64,AA", "/alias.png"]);
    expect(document.querySelectorAll(".order-history-product")[6].querySelector(".product-thumb span")).not.toBeNull();
    vi.stubGlobal("FMSStorage", { getItem: () => null, setItem: vi.fn() });
    document.getElementById("searchInput").dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector(".empty-state")).not.toBeNull();
    const missingDelete = document.createElement("button");
    missingDelete.dataset.deleteOrder = "missing";
    document.getElementById("orderHistoryList").append(missingDelete);
    missingDelete.click();
  });

  it("renders saved item details when the current stock cache is not an array", async () => {
    await loadPage([order], "{}");
    document.querySelector("[data-order-detail]").click();
    document.querySelector("[data-product-detail]").click();
    expect(document.querySelector(".product-detail-current").textContent).not.toContain("จากคลังปัจจุบัน");
    expect(document.querySelector(".product-detail-panel").querySelectorAll("dt")).toHaveLength(7);
  });
});
