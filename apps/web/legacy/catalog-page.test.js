import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pageHtml = readFileSync(resolve(process.cwd(), "../../Front-end/catalog.html"), "utf8");
const records = [
  { code: "MED-1", name: "Gauze", genericName: "Cotton gauze", category: "oral", total: 20, used: 3, unit: "box" },
  { code: "MED-2", name: "Gloves", genericName: "Protective gloves", category: "equipment", total: 8, used: 0, unit: "pair", image: "/assets/gloves.png" },
];

async function loadPage({ stock = records, cart = {} } = {}) {
  const page = new DOMParser().parseFromString(pageHtml, "text/html");
  document.documentElement.lang = page.documentElement.lang;
  document.head.innerHTML = page.head.innerHTML;
  document.body.innerHTML = page.body.innerHTML;
  window.FMSStorage = {
    getItem: (key) => JSON.stringify(key === "fms-stock-records" ? stock : cart),
    setItem: vi.fn(),
  };
  vi.stubGlobal("print", vi.fn());
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:catalog"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await import("../../../Front-end/catalog.js");
  return { URLStub };
}

describe("Catalog page", () => {
  beforeEach(() => vi.resetModules());

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("renders catalog entries and filters by search text", async () => {
    await loadPage();
    expect(document.querySelectorAll(".catalog-card")).toHaveLength(2);
    const search = document.getElementById("searchInput");
    fireEvent.input(search, { target: { value: "glove" } });

    expect(document.querySelectorAll(".catalog-card")).toHaveLength(1);
    expect(document.querySelector(".catalog-card h2").textContent).toBe("Gloves");
  });

  it("filters by category and toggles the category menu", async () => {
    await loadPage();
    fireEvent.click(document.getElementById("filterToggle"));
    expect(document.getElementById("filterMenu").hidden).toBe(false);
    fireEvent.click(document.querySelector('[data-filter="oral"]'));

    expect(document.getElementById("filterMenu").hidden).toBe(true);
    expect(document.querySelectorAll(".catalog-card")).toHaveLength(1);
    expect(document.querySelector(".catalog-card h2").textContent).toBe("Gauze");
  });

  it("updates the cart when the quantity controls are used", async () => {
    await loadPage();
    const increment = document.querySelector('[data-code="MED-1"][data-delta="1"]');
    fireEvent.click(increment);

    expect(document.getElementById("cartCount").textContent).toBe("1");
    expect(window.FMSStorage.setItem).toHaveBeenCalledWith("fms-catalog-cart", expect.stringContaining('"MED-1"'));
  });

  it("adds the selected amount and package option through the quantity modal", async () => {
    await loadPage();
    fireEvent.click(document.querySelector('[data-add="MED-2"]'));
    const modal = document.querySelector(".quantity-modal-backdrop");
    expect(modal.hidden).toBe(false);

    document.getElementById("quantityModalInput").value = "3";
    const option = modal.querySelectorAll("[data-modal-option]")[1];
    fireEvent.click(option);
    fireEvent.click(modal.querySelector(".quantity-modal-confirm"));

    expect(modal.hidden).toBe(true);
    expect(document.getElementById("cartCount").textContent).toBe("1");
    expect(window.FMSStorage.setItem).toHaveBeenCalledWith(
      "fms-catalog-cart",
      expect.stringContaining('"MED-2":{"quantity":3'),
    );
  });

  it("opens and closes the product image viewer", async () => {
    await loadPage();
    fireEvent.click(document.querySelector('.catalog-card img[alt="Gloves"]'));
    const viewer = document.querySelector(".catalog-image-viewer");
    expect(viewer.hidden).toBe(false);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(viewer.hidden).toBe(true);
    expect(viewer.querySelector("img").hasAttribute("src")).toBe(false);
  });

  it("switches the catalog labels to English", async () => {
    await loadPage();
    fireEvent.click(document.getElementById("languageButton"));

    expect(document.documentElement.lang).toBe("en");
    expect(document.querySelector('[data-filter="oral"]').textContent).toContain("Oral medicine");
  });

  it("removes zero-quantity cart entries and clamps package-modal quantities to one", async () => {
    await loadPage({ cart: { "MED-1": { quantity: 2, option: "box" } } });
    expect(document.getElementById("cartCount").textContent).toBe("1");
    fireEvent.click(document.querySelector('[data-code="MED-1"][data-delta="-1"]'));
    expect(document.querySelector('[data-code="MED-1"][data-delta="-1"] + span').textContent).toBe("1/100");
    fireEvent.click(document.querySelector('[data-code="MED-1"][data-delta="-1"]'));
    expect(document.getElementById("cartCount").textContent).toBe("0");

    fireEvent.click(document.querySelector('[data-add="MED-2"]'));
    const modal = document.querySelector(".quantity-modal-backdrop");
    document.getElementById("quantityModalInput").value = "0";
    fireEvent.keyDown(document.getElementById("quantityModalInput"), { key: "Enter" });
    expect(modal.hidden).toBe(true);
    expect(document.getElementById("cartCount").textContent).toBe("1");
    expect(window.FMSStorage.setItem).toHaveBeenCalledWith("fms-catalog-cart", expect.stringContaining('"MED-2":{"quantity":1'));
  });

  it("closes quantity dialogs by cancel, close, backdrop, and Escape and shows no search results", async () => {
    await loadPage();
    const addButton = document.querySelector('[data-add="MED-1"]');
    const modal = document.querySelector(".quantity-modal-backdrop");
    fireEvent.click(addButton);
    fireEvent.click(modal.querySelector(".quantity-modal-cancel"));
    expect(modal.hidden).toBe(true);
    fireEvent.click(addButton);
    fireEvent.click(modal.querySelector(".quantity-modal-close"));
    expect(modal.hidden).toBe(true);
    fireEvent.click(addButton);
    fireEvent.click(modal);
    expect(modal.hidden).toBe(true);
    fireEvent.click(addButton);
    fireEvent.keyDown(document.getElementById("quantityModalInput"), { key: "Escape" });
    expect(modal.hidden).toBe(true);

    const search = document.getElementById("searchInput");
    fireEvent.input(search, { target: { value: "no matching product" } });
    expect(document.querySelector("#catalogGrid .empty")).not.toBeNull();
  });

  it("exports catalog CSV, prints, and toggles its notification panel", async () => {
    const { URLStub } = await loadPage();
    fireEvent.click(document.getElementById("exportExcel"));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(URLStub.createObjectURL).toHaveBeenCalledOnce();
    expect(URLStub.revokeObjectURL).toHaveBeenCalledOnce();
    fireEvent.click(document.getElementById("exportPdf"));
    expect(window.print).toHaveBeenCalledOnce();
    fireEvent.click(document.getElementById("notificationButton"));
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    fireEvent.click(document.getElementById("closeNotification"));
    expect(document.getElementById("notificationPanel").hidden).toBe(true);
  });
});
