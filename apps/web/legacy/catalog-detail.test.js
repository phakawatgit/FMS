import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const frontendPath = resolve(process.cwd(), "../../Front-end");
const scripts = import.meta.glob("../../../Front-end/{catalog-detail-layout,catalog-detail-page}.js");

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
  localStorage.clear();
});

it("renders catalog details, adds configured quantities to cart, and handles export and notifications", async () => {
  const html = readFileSync(resolve(frontendPath, "catalog-detail.html"), "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  document.documentElement.lang = "th";
  history.replaceState({}, "", "/legacy/catalog-detail.html?code=M1");
  const stock = [
    { code: "M1", name: "Bandage", genericName: "Gauze", category: "equipment", total: 10, used: 2, unit: "box", size: "small", storageLocation: "Cabinet A" },
    { code: "M2", name: "Antiseptic", category: "oral", total: 4, used: 0, unit: "bottle" },
  ];
  localStorage.setItem("fms-stock-records", JSON.stringify(stock));
  const values = new Map([["fms-stock-records", JSON.stringify(stock)]]);
  vi.stubGlobal("FMSStorage", {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  vi.stubGlobal("print", vi.fn());
  vi.stubGlobal("scrollTo", vi.fn());
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  HTMLElement.prototype.scrollTo ||= vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  for (const name of ["catalog-detail-layout.js", "catalog-detail-page.js"]) {
    const path = Object.keys(scripts).find((key) => key.endsWith(`/${name}`));
    await scripts[path]();
  }

  expect(document.querySelector("#detail h1").textContent).toContain("Bandage");
  document.querySelectorAll("[data-detail-option]")[1].click();
  const quantity = document.getElementById("detailQuantityValue");
  quantity.value = "3";
  quantity.dispatchEvent(new Event("input", { bubbles: true }));
  document.querySelector("[data-detail-quantity='1']").click();
  expect(quantity.value).toBe("4");
  document.querySelector("#detailLayoutAddCart").click();
  expect(JSON.parse(values.get("fms-catalog-cart")).M1).toMatchObject({ quantity: 4 });
  expect(JSON.parse(values.get("fms-catalog-cart")).M1.option).toBe(document.querySelectorAll("[data-detail-option]")[1].dataset.detailOption);

  document.querySelector(".recommendation-next").click();
  document.getElementById("notificationButton").click();
  expect(document.getElementById("notificationPanel").hidden).toBe(false);
  document.getElementById("closeNotification").click();
  expect(document.getElementById("notificationPanel").hidden).toBe(true);

  document.getElementById("exportPdf").click();
  expect(window.print).toHaveBeenCalledOnce();
  document.getElementById("exportExcel").click();
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
});

it("clamps detail quantities, synchronizes cart feedback, and scrolls to recommendations", async () => {
  const html = readFileSync(resolve(frontendPath, "catalog-detail.html"), "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  document.documentElement.lang = "th";
  history.replaceState({}, "", "/legacy/catalog-detail.html?code=M1");
  const stock = [
    { code: "M1", name: "Bandage", total: 10, used: 2 },
    { code: "M2", name: "Mask", total: 5, used: 1 },
  ];
  const values = new Map([["fms-stock-records", JSON.stringify(stock)], ["fms-catalog-cart", "{}"]]);
  vi.stubGlobal("FMSStorage", { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) });
  vi.stubGlobal("scrollTo", vi.fn());
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:detail"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  HTMLElement.prototype.scrollTo ||= vi.fn();
  HTMLElement.prototype.scrollIntoView ||= vi.fn();
  for (const name of ["catalog-detail-layout.js", "catalog-detail-page.js"]) {
    const path = Object.keys(scripts).find((key) => key.endsWith(`/${name}`));
    await scripts[path]();
  }

  const quantity = document.getElementById("detailQuantityValue");
  document.querySelector("[data-detail-quantity='-1']").click();
  expect(quantity.value).toBe("1");
  quantity.type = "text";
  quantity.value = "2abc";
  quantity.dispatchEvent(new Event("input", { bubbles: true }));
  expect(quantity.value).toBe("2");
  quantity.value = "0";
  quantity.dispatchEvent(new Event("change", { bubbles: true }));
  expect(quantity.value).toBe("1");
  document.querySelectorAll("[data-detail-option]")[2].click();
  document.getElementById("detailLayoutAddCart").click();
  expect(JSON.parse(values.get("fms-catalog-cart")).M1).toMatchObject({ quantity: 1 });
  expect(document.getElementById("detailCartCount").textContent).toContain("1");

  const dot = document.querySelector("[data-recommendation-dot='0']");
  const scrollIntoView = vi.spyOn(document.querySelector(".recommendation-card"), "scrollIntoView");
  dot.click();
  expect(scrollIntoView).toHaveBeenCalledOnce();
  document.querySelector(".recommendation-grid").dispatchEvent(new Event("scroll"));
});

it("handles a missing detail record and export fallback without crashing", async () => {
  const html = readFileSync(resolve(frontendPath, "catalog-detail.html"), "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  history.replaceState({}, "", "/legacy/catalog-detail.html?code=missing");
  vi.stubGlobal("FMSStorage", { getItem: () => "[]", setItem: vi.fn() });
  vi.stubGlobal("print", vi.fn());
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  for (const name of ["catalog-detail-layout.js", "catalog-detail-page.js"]) {
    const path = Object.keys(scripts).find((key) => key.endsWith(`/${name}`));
    await scripts[path]();
  }
  document.querySelector(".language").click();
  expect(document.documentElement.lang).toBe("en");
  document.querySelector(".language").click();
  expect(document.documentElement.lang).toBe("th");
  document.getElementById("exportExcel").click();
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  document.getElementById("exportPdf").click();
  expect(window.print).toHaveBeenCalledOnce();
});
