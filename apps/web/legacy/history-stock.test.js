import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/history-stock.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/history-stock.js");

async function loadPage({ stock = [], visits = [], view = "dispense-history", storageOverrides = {} } = {}) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  history.replaceState({}, "", `/legacy/history-stock.html?view=${view}`);
  document.documentElement.lang = "th";
  const values = new Map([
    ["fms-stock-records", JSON.stringify(stock)],
    ["fms-infirmary-visits", JSON.stringify(visits)],
    ...Object.entries(storageOverrides),
  ]);
  vi.stubGlobal("FMSStorage", { getItem: (key) => values.get(key) ?? null });
  vi.stubGlobal("print", vi.fn());
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:history"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await Object.values(scripts)[0]();
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("stock and dispensing history", () => {
  it("lists expired, expiring, out-of-stock and low-stock items and searches them", async () => {
    const soon = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    await loadPage({
      view: "stock-status",
      stock: [
        { code: "EX", name: "Expired item", total: 5, used: 1, expiry: "01/01/2020" },
        { code: "SOON", name: "Soon item", total: 10, used: 0, expiry: soon },
        { code: "OUT", name: "Empty item", total: 2, used: 2 },
        { code: "LOW", name: "Low item", total: 10, used: 7, threshold: 4 },
      ],
    });
    expect(document.getElementById("stockHistory").hidden).toBe(false);
    expect(document.querySelectorAll(".stock-record").length).toBeGreaterThanOrEqual(4);
    const search = document.getElementById("searchInput");
    search.value = "Low item";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelectorAll(".stock-record")).toHaveLength(1);
    expect(document.querySelector(".stock-record h3").textContent).toContain("Low item");
    document.getElementById("clearSearch").click();
    expect(search.value).toBe("");
  });

  it("opens and closes a stock status detail dialog and refreshes on storage events", async () => {
    await loadPage({ view: "stock-status", stock: [{ code: "OUT", name: "Empty item", total: 2, used: 2 }] });
    const trigger = document.querySelector("[data-history-index]");
    trigger.click();
    expect(document.getElementById("stockDetailModal").hidden).toBe(false);
    expect(document.getElementById("stockDetailContent").textContent).toContain("Empty item");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("stockDetailModal").hidden).toBe(true);
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new StorageEvent("storage", { key: "fms-stock-records" }));
    expect(document.querySelector(".stock-record")).not.toBeNull();
  });

  it("filters placeholder dispense records, links product images, opens details, and exports", async () => {
    await loadPage({
      visits: [
        { medicine: "Select medicine", quantity: 1 },
        { medicine: "Bandage 10 mg", medicineCode: "M1", firstName: "Ava", lastName: "Nurse", quantity: 2, createdAt: "2026-10-01T10:00:00Z" },
      ],
      stock: [{ code: "M1", name: "Bandage", image: "https://example.test/bandage.png" }],
    });
    expect(document.querySelectorAll(".dispense-record")).toHaveLength(1);
    expect(document.querySelector(".dispense-record img").src).toContain("bandage.png");
    document.querySelector("[data-dispense-index]").click();
    expect(document.getElementById("stockDetailModal").hidden).toBe(false);
    expect(document.getElementById("stockDetailContent").textContent).toContain("Ava Nurse");
    document.getElementById("languageButton").click();
    expect(document.documentElement.lang).toBe("en");
    document.getElementById("exportCsv").click();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    document.getElementById("exportPdf").click();
    expect(window.print).toHaveBeenCalledOnce();
  });

  it("groups legacy stock aliases, handles invalid storage, empty search results, and English status details", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await loadPage({
      view: "stock-status",
      stock: [
        { productName: "Old", code: "OLD", total: -2, used: -1, expiry: "01/01/2560", image: { dataUrl: "/old.png" } },
        { name: "Low by alias", total: 10, used: 8, lowStockThreshold: 3, expiry: "bad-date" },
        { name: "No alert", total: 10, used: 1, expiry: "bad-date" },
      ],
      storageOverrides: { "fms-stock-records": "{invalid" },
    });
    expect(warn).toHaveBeenCalled();
    expect(document.querySelector(".empty-state")).not.toBeNull();
    expect(document.getElementById("exportCsv")).toBeTruthy();
    document.getElementById("languageButton").click();
    document.getElementById("searchInput").value = "nothing here";
    document.getElementById("searchInput").dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector(".empty-state").textContent).toContain("No matching");
  });

  it("renders stock aliases, closes details from its button, and exports status CSV", async () => {
    const old = new Date(2020, 0, 1).toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 50 * 86400000).toISOString().slice(0, 10);
    await loadPage({
      view: "stock-status",
      stock: [
        { productName: "Old", genericName: "Alias", code: "OLD", total: -2, used: -1, expiry: old, image: { dataUrl: "/old.png" } },
        { name: "Low by alias", total: 10, used: 8, lowStockThreshold: 3, expiry: "bad-date" },
        { name: "Soon but available", total: 10, used: 1, threshold: 2, expiry: soon },
        { name: "No alert", total: 10, used: 1, threshold: 2, expiry: "bad-date" },
      ],
    });
    expect(document.querySelectorAll(".stock-record")).toHaveLength(3);
    expect(document.querySelector(".stock-record img").src).toContain("old.png");
    document.getElementById("languageButton").click();
    expect(document.querySelector(".history-section h2").textContent).toContain("Expired medicines");
    const expired = [...document.querySelectorAll(".stock-record")].find((item) => item.textContent.includes("Old"));
    expired.querySelector("[data-history-index]").click();
    expect(document.getElementById("stockDetailContent").textContent).toContain("Old");
    document.querySelector("[data-close-detail]").click();
    expect(document.getElementById("stockDetailModal").hidden).toBe(true);
    document.getElementById("exportCsv").click();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });

  it("resolves dispensing records by name aliases, falls back to placeholders, and filters empty matches", async () => {
    await loadPage({
      visits: [
        { medicineName: "Bandage 10 mg", firstName: "Ava", quantity: 0, date: "invalid date" },
        { medicineName: "Gauze pad", drugName: "Gauze pad", visitorType: "Guest", studentId: "S2", symptom: "Cut" },
        { medicine: "Select medicine", quantity: 1 },
      ],
      stock: [
        { productName: "Bandage", imageUrl: "/bandage.png" },
        { displayName: "Gauze", photo: "/gauze.png" },
      ],
    });
    expect(document.querySelectorAll(".dispense-record")).toHaveLength(2);
    expect(document.querySelector(".dispense-record img").src).toContain("bandage.png");
    document.getElementById("languageButton").click();
    const search = document.getElementById("searchInput");
    search.value = "not found";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector(".empty-state").textContent).toContain("No dispensing history");
    search.value = "Gauze";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("[data-dispense-index]").click();
    expect(document.getElementById("stockDetailContent").textContent).toContain("Guest");
    expect(document.getElementById("stockDetailContent").textContent).toContain("Recipient type");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("stockDetailModal").hidden).toBe(true);
    document.getElementById("exportCsv").click();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });

  it("handles menu, form, refresh, and escaped stock values through their user actions", async () => {
    await loadPage({
      view: "stock-status",
      stock: [{ name: "<Bandage & gauze>", total: 2, used: 2, expiry: "01/01/2020" }],
    });
    expect(document.querySelector(".stock-record h3").innerHTML).toContain("&lt;Bandage &amp; gauze&gt;");

    const button = document.getElementById("stockMenuButton");
    const menu = document.getElementById("stockMenu");
    button.click();
    expect(menu.hidden).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    document.body.click();
    expect(menu.hidden).toBe(true);
    button.click();
    const menuLink = menu.querySelector("a");
    menuLink.addEventListener("click", (event) => event.preventDefault(), { capture: true, once: true });
    menuLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(button.getAttribute("aria-expanded")).toBe("false");

    const form = document.getElementById("historySearchForm");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(document.querySelectorAll(".stock-record").length).toBeGreaterThan(0);
    const notificationButton = document.getElementById("notificationButton");
    notificationButton.click();
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    notificationButton.click();
    expect(document.getElementById("notificationPanel").hidden).toBe(true);
  });
});
