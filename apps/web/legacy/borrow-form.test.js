import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const frontendPath = resolve(process.cwd(), "../../Front-end");
const scripts = import.meta.glob("../../../Front-end/borrow-form.js");

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  localStorage.clear();
});

it("filters stock, selects borrowing items, sets due dates, and saves the agreement", async () => {
  const html = readFileSync(resolve(frontendPath, "borrow-form.html"), "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  document.documentElement.lang = "th";
  history.replaceState({}, "", "/legacy/borrow-form.html");
  const stock = [
    { code: "LOW", name: "Low stock kit", total: 10, used: 9, unit: "kit", symptom: "First aid" },
    { code: "OUT", name: "Out of stock item", total: 5, used: 5, unit: "box" },
  ];
  const values = new Map([
    ["fms-stock-records", JSON.stringify(stock)],
    ["fms-borrow-products", JSON.stringify({ REMOVED: { quantity: 3 } })],
  ]);
  vi.stubGlobal("FMSStorage", {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  vi.stubGlobal("print", vi.fn());
  const script = Object.keys(scripts)[0];
  await scripts[script]();

  expect(document.querySelectorAll(".product-card")).toHaveLength(2);
  expect(document.querySelector('[data-product-code="LOW"] .remaining').classList.contains("is-low-stock")).toBe(true);
  expect(document.querySelector('[data-product-code="OUT"] .remaining').classList.contains("is-out-of-stock")).toBe(true);
  expect(JSON.parse(values.get("fms-borrow-products"))).not.toHaveProperty("REMOVED");

  document.getElementById("productSearch").value = "no matching medicine";
  document.getElementById("productSearch").dispatchEvent(new Event("input", { bubbles: true }));
  expect(document.querySelector("#productGrid").textContent).toContain("ไม่พบรายการสินค้า");
  document.getElementById("productSearch").value = "";
  document.getElementById("productSearch").dispatchEvent(new Event("input", { bubbles: true }));

  document.querySelector('[data-favorite="LOW"]').click();
  expect(document.querySelector('[data-product-quantity="LOW"]').disabled).toBe(false);
  const quantity = document.querySelector('[data-product-quantity="LOW"]');
  quantity.value = "0";
  quantity.dispatchEvent(new Event("input", { bubbles: true }));
  expect(JSON.parse(values.get("fms-borrow-products")).LOW.quantity).toBe(1);

  const dueDate = document.getElementById("dueDateInput");
  const expectedDays = (value) => Math.round((new Date(`${value}T00:00:00`) - new Date(`${dueDate.min}T00:00:00`)) / 86400000);
  const itemChecks = document.querySelectorAll('input[name="item"]');
  itemChecks[1].checked = true;
  itemChecks[1].dispatchEvent(new Event("change", { bubbles: true }));
  expect(expectedDays(dueDate.value)).toBe(90);
  itemChecks[1].checked = false;
  itemChecks[0].checked = true;
  itemChecks[0].dispatchEvent(new Event("change", { bubbles: true }));
  expect(expectedDays(dueDate.value)).toBe(7);

  document.querySelector('input[name="fullName"]').value = "Ada Nurse";
  document.querySelector('input[name="phone"]').value = "0812345678";
  document.querySelector('input[name="role"]').checked = true;
  document.getElementById("borrowForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  expect(JSON.parse(values.get("fms-borrow-form"))).toMatchObject({ fullName: "Ada Nurse", phone: "0812345678", products: { LOW: { quantity: 1 } } });
  expect(document.getElementById("borrowSavedModal").hidden).toBe(false);
  document.getElementById("borrowSavedClose").click();
  expect(document.getElementById("borrowSavedModal").hidden).toBe(true);

  document.querySelector(".topbar .language").click();
  expect(document.documentElement.lang).toBe("en");
  document.querySelector(".topbar .export.pdf").click();
  expect(window.print).toHaveBeenCalledOnce();
});
