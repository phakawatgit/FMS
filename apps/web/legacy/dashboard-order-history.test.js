import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/dashboard.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/dashboard-order-history.js");
const currentYear = new Date().getFullYear();

async function load({ orders = [], products = [], language = "en" } = {}) {
  vi.resetModules();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.body.innerHTML = parsed.body.innerHTML;
  const store = new Map([
    ["fms-history-catalog-orders", JSON.stringify(orders)],
    ["fms-stock-records", JSON.stringify(products)],
  ]);
  vi.stubGlobal("FMSStorage", { getItem: (key) => store.get(key) ?? null });
  vi.stubGlobal("language", language);
  vi.stubGlobal("languageButton", document.getElementById("languageButton"));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  vi.spyOn(window, "setInterval").mockReturnValue(0);
  await Object.values(scripts)[0]();
  return store;
}

afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); document.body.replaceChildren();
});

describe("dashboard purchase history calendar", () => {
  it("renders current and future orders, opens date details and resolves live product data", async () => {
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const date = `${currentYear}-${month}-15T10:30:00.000Z`;
    await load({
      orders: [
        { id: "current", date, title: "Clinic order", status: "approved", requester: "Nurse", department: "ER", documentTitle: "PO-1", items: [{ code: "A1", quantity: 2 }] },
        { id: "future", date: `${currentYear + 1}-02-02`, items: [{ productName: "Bandage", count: 3 }] },
        { id: "invalid", date: "not a date" },
        { id: "past", date: `${currentYear - 1}-02-02` },
      ],
      products: [{ code: "A1", name: "Gauze", category: "equipment", form: "roll", size: "5cm", unit: "roll", total: 20, used: 5, expiry: "2030-01-01", benefit: "Cover wounds", symptom: "wound", usage: "wrap", warning: "keep dry", image: { url: "/gauze.png" } }],
    });
    const content = document.getElementById("purchaseCalendarContent");
    const dayCell = [...content.querySelectorAll("[data-calendar-date]")].find((el) => el.dataset.calendarDate === `${currentYear}-${month}-15`);
    expect(dayCell).toBeTruthy();
    dayCell.click();
    expect(document.getElementById("purchaseDayDialog").open).toBe(true);
    const toggle = document.querySelector("[data-purchase-detail]");
    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector(".purchase-day-dialog").textContent).toContain("Gauze");
    expect(document.querySelector(".purchase-day-dialog img").getAttribute("src")).toBe("/gauze.png");
  });

  it("opens annual picker, changes years, closes it and handles empty storage refreshes", async () => {
    const store = await load();
    document.getElementById("purchaseCalendarToday").click();
    expect(document.getElementById("purchaseAnnualDialog").open).toBe(true);
    const picker = document.querySelector("[data-toggle-year-picker]");
    picker.click();
    expect(document.querySelector("[role=listbox]").hidden).toBe(false);
    document.querySelector(`[data-select-calendar-year='${currentYear + 2}']`).click();
    expect(document.querySelector("[data-select-calendar-year].is-selected")).toBeTruthy();
    document.querySelector("[data-close-annual-dialog]").click();
    expect(document.getElementById("purchaseAnnualDialog").open).toBe(false);
    store.set("fms-history-catalog-orders", "not json");
    window.dispatchEvent(new StorageEvent("storage", { key: "fms-history-catalog-orders" }));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(document.querySelector(".purchase-order-empty")).toBeTruthy();
  }, 15000);
});
