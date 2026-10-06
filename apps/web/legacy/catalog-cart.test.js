import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/catalog-cart.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/catalog-cart.js");

async function loadPage(cart = { A: { quantity: 2, option: "box" }, B: { quantity: 1 } }, stock = [{ code: "A", name: "Bandage", symptom: "Wound" }]) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  document.documentElement.lang = "th";
  history.replaceState({}, "", "/legacy/catalog-cart.html");
  const values = new Map([
    ["fms-stock-records", JSON.stringify(stock)],
    ["fms-catalog-cart", JSON.stringify(cart)],
  ]);
  vi.stubGlobal("FMSStorage", {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  vi.stubGlobal("print", vi.fn());
  await Object.values(scripts)[0]();
  return values;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("catalog cart", () => {
  it("renders saved items, changes quantities, and persists selection state", async () => {
    const values = await loadPage();
    expect(document.getElementById("cartTotal").textContent).toBe("(2)");
    expect(document.getElementById("cartList").textContent).toContain("Bandage");
    document.querySelector("[data-delta='-1'][data-code='A']").click();
    expect(JSON.parse(values.get("fms-catalog-cart")).A.quantity).toBe(1);
    const qty = document.querySelector("[data-quantity='A']");
    qty.value = "0";
    qty.dispatchEvent(new Event("change", { bubbles: true }));
    expect(JSON.parse(values.get("fms-catalog-cart")).A.quantity).toBe(1);
    document.getElementById("selectAll").checked = true;
    document.getElementById("selectAll").dispatchEvent(new Event("change", { bubbles: true }));
    expect([...document.querySelectorAll("[data-select]")].every((box) => box.checked)).toBe(true);
    document.getElementById("selectAll").checked = false;
    document.getElementById("selectAll").dispatchEvent(new Event("change", { bubbles: true }));
    expect([...document.querySelectorAll("[data-select]")].some((box) => box.checked)).toBe(false);
  });

  it("confirms selected deletions, supports cancellation and prints exports", async () => {
    const values = await loadPage();
    document.getElementById("deleteSelected").click();
    expect(document.getElementById("confirmModal").hidden).toBe(false);
    document.getElementById("modalCancel").click();
    expect(JSON.parse(values.get("fms-catalog-cart"))).toHaveProperty("A");
    const selectA = document.querySelector("[data-select='A']");
    selectA.checked = true;
    selectA.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("deleteSelected").click();
    document.getElementById("modalConfirm").click();
    expect(JSON.parse(values.get("fms-catalog-cart"))).not.toHaveProperty("A");
    document.querySelector(".topbar .excel").click();
    expect(window.print).toHaveBeenCalledOnce();
  });

  it("clears an empty cart view and switches language", async () => {
    await loadPage({});
    expect(document.getElementById("cartList").querySelector(".cart-empty-state")).not.toBeNull();
    document.getElementById("clearCart").click();
    expect(document.getElementById("confirmModal").hidden).toBe(true);
    document.querySelector(".language").click();
    expect(document.documentElement.lang).toBe("en");
  });

  it("handles fallback records, invalid quantities, selection changes, and modal dismissal", async () => {
    const values = await loadPage({
      UNKNOWN: { quantity: 2 },
      ZERO: { quantity: 0 },
      A: { quantity: 1, option: "box" },
    });
    expect(document.getElementById("cartTotal").textContent).toBe("(2)");
    expect(document.getElementById("cartList").textContent).toContain("UNKNOWN");

    const unknownQty = document.querySelector("[data-quantity='UNKNOWN']");
    unknownQty.value = "not-a-number";
    unknownQty.dispatchEvent(new Event("change", { bubbles: true }));
    expect(JSON.parse(values.get("fms-catalog-cart")).UNKNOWN.quantity).toBe(1);
    document.querySelector("[data-delta='-1'][data-code='UNKNOWN']").click();
    expect(JSON.parse(values.get("fms-catalog-cart")).UNKNOWN.quantity).toBe(1);
    document.querySelector("[data-delta='1'][data-code='UNKNOWN']").click();
    expect(JSON.parse(values.get("fms-catalog-cart")).UNKNOWN.quantity).toBe(2);

    const selectA = document.querySelector("[data-select='A']");
    selectA.checked = true;
    selectA.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("selectAll").checked = true;
    document.getElementById("selectAll").dispatchEvent(new Event("change", { bubbles: true }));
    expect([...document.querySelectorAll("[data-select]")].every((box) => box.checked)).toBe(true);
    document.getElementById("selectAll").checked = false;
    document.getElementById("selectAll").dispatchEvent(new Event("change", { bubbles: true }));
    expect([...document.querySelectorAll("[data-select]")].some((box) => box.checked)).toBe(false);

    document.getElementById("deleteSelected").click();
    expect(document.getElementById("confirmModal").hidden).toBe(true);
    document.getElementById("clearCart").click();
    expect(document.getElementById("confirmModal").hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("confirmModal").hidden).toBe(true);
    document.getElementById("clearCart").click();
    document.getElementById("confirmModal").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("confirmModal").hidden).toBe(true);
  });

  it("renders item images and prints each export control", async () => {
    await loadPage({ A: { quantity: 1 } }, [{ code: "A", name: "Bandage", image: "/bandage.png" }]);
    expect(document.querySelector(".cart-image img").src).toContain("bandage.png");
    document.querySelectorAll(".topbar .export").forEach((button) => button.click());
    expect(window.print).toHaveBeenCalledTimes(document.querySelectorAll(".topbar .export").length);
  });
});
