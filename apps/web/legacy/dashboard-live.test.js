import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/dashboard.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/dashboard-live.js");
const today = new Date();
const isoDay = (offset) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset).toISOString();
const visits = [
  { createdAt: isoDay(0), branch: "North", faculty: "engineering", gender: "male", symptom: "Headache", medicine: "Bandage", quantity: 2, status: "refer", hospitalName: "City Hospital" },
  { createdAt: isoDay(0), branch: "South", faculty: "business", gender: "female", symptom: "Headache", medicines: [{ name: "Bandage", quantity: 1 }, { name: "Gauze", quantity: 3 }], status: "refer", hospitalName: "City Hospital" },
];
const stock = [
  { code: "EXP", name: "Expired", total: 5, used: 1, expiry: isoDay(-2) },
  { code: "LOW", name: "Low", total: 10, used: 7, minStock: 4 },
  { code: "OK", name: "Normal", total: 10, used: 1 },
  { code: "LATER", productName: "Later expiry", total: 5, used: 0, expiry: isoDay(60) },
];
const documentListeners = [];
const windowListeners = [];

beforeEach(() => {
  documentListeners.length = 0;
  windowListeners.length = 0;
  const addDocumentListener = document.addEventListener.bind(document);
  const addWindowListener = window.addEventListener.bind(window);
  vi.spyOn(document, "addEventListener").mockImplementation((...args) => {
    documentListeners.push(args);
    return addDocumentListener(...args);
  });
  vi.spyOn(window, "addEventListener").mockImplementation((...args) => {
    windowListeners.push(args);
    return addWindowListener(...args);
  });
});

async function loadPage({ localVisits = visits, localStock = stock, database = null } = {}) {
  vi.resetModules();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  document.documentElement.lang = "en";
  const branchSelect = document.getElementById("branchInput");
  branchSelect.add(new Option("North", "North"));
  history.replaceState({}, "", "/legacy/dashboard.html");
  const values = new Map([
    ["fms-infirmary-visits", JSON.stringify(localVisits)],
    ["fms-infirmary-history", "[]"],
    ["fms-stock-records", JSON.stringify(localStock)],
  ]);
  const parseInputDate = (value) => value ? new Date(`${value}T00:00:00`) : null;
  for (const [name, element] of Object.entries({
    startDate: document.getElementById("startDate"), endDate: document.getElementById("endDate"),
    branchInput: document.getElementById("branchInput"), facultySelect: document.getElementById("facultySelect"),
    resetButton: document.getElementById("resetButton"), languageButton: document.getElementById("languageButton"),
    notificationBadge: document.getElementById("notificationBadge"), notificationList: document.getElementById("notificationList"),
  })) vi.stubGlobal(name, element);
  vi.stubGlobal("parseInputDate", parseInputDate);
  vi.stubGlobal("language", "en");
  vi.stubGlobal("translations", { en: { all: "All", items: "items" }, th: { all: "ทั้งหมด", items: "รายการ" } });
  vi.stubGlobal("notificationsRead", false);
  vi.stubGlobal("medicinePageSize", 10);
  vi.stubGlobal("FMSStorage", { getItem: (key) => values.get(key) ?? null });
  vi.stubGlobal("FMSNotifications", { getAll: () => [{ level: "warning", title: "Inventory", detail: "Check stock" }] });
  vi.stubGlobal("renderInteractiveDonut", vi.fn());
  vi.stubGlobal("renderInteractivePie", vi.fn());
  vi.stubGlobal("fetch", vi.fn(async () => database
    ? { ok: true, json: async () => ({ success: true, data: database }) }
    : { ok: false, json: async () => ({ success: false, message: "offline" }) }));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(window, "setInterval").mockReturnValue(0);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:dashboard"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await Object.values(scripts)[0]();
  return { values, parseInputDate };
}

afterEach(() => {
  documentListeners.forEach(([type, listener, options]) => document.removeEventListener(type, listener, options));
  windowListeners.forEach(([type, listener, options]) => window.removeEventListener(type, listener, options));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("live dashboard aggregates", () => {
  it("aggregates visits, medicines, symptoms, gender, referrals and stock", async () => {
    await loadPage();
    expect(window.getLiveDashboardVisits()).toHaveLength(2);
    expect(document.querySelectorAll(".medicine-legend li")).toHaveLength(2);
    expect(document.querySelector(".symptom-legend").textContent).toContain("Headache");
    expect(document.getElementById("maleCount").textContent).toBe("1");
    expect(document.getElementById("femaleCount").textContent).toBe("1");
    expect(document.getElementById("referralCount").childNodes[0].nodeValue).toBe("2");
    expect(document.getElementById("referralList").textContent).toContain("City Hospital");
    expect(document.querySelector("[data-medicine-status='expired']").closest(".stock").querySelector("small").textContent).toContain("1");
    expect(document.querySelector("[data-medicine-status='low']").closest(".stock").querySelector("small").textContent).toContain("1");

    document.getElementById("branchInput").value = "North";
    document.getElementById("branchInput").dispatchEvent(new Event("input", { bubbles: true }));
    expect(window.getLiveDashboardVisits()).toHaveLength(1);
    window.dispatchEvent(new StorageEvent("storage", { key: "fms-infirmary-visits" }));
    window.downloadLiveDashboardExcel();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it("pages stock detail items and uses database dashboard records after refresh", async () => {
    const database = { visits: [{ ...visits[0], branch: "Database" }], stock: [{ code: "E0", name: "DB expired", total: 4, used: 1, expiry: isoDay(-1), image: "/medicine.png" }] };
    await loadPage({ database });
    await vi.waitFor(() => expect(window.getLiveDashboardVisits()[0].branch).toBe("Database"));
    document.querySelector("[data-medicine-status='expired']").click();
    expect(document.getElementById("medicineDetailModal").open).toBe(true);
    document.getElementById("closeMedicineModal").click();
    expect(document.getElementById("medicineDetailModal").open).toBe(false);
    document.querySelector("[data-medicine-status='expired']").click();
    expect(document.getElementById("medicineDetailModal").open).toBe(true);
    expect(document.getElementById("medicinePicker").options).toHaveLength(1);
    expect(document.getElementById("medicineNextPage").disabled).toBe(true);
    expect(document.getElementById("medicineDetailName").textContent).toBe("DB expired");
    document.getElementById("medicinePicker").value = "0";
    document.getElementById("medicinePicker").dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.getElementById("medicineDetailName").textContent).toBe("DB expired");
    window.dispatchEvent(new Event("focus"));
    expect(window.fetch).toHaveBeenCalled();
  });

  it("renders empty charts, alerts and no-product detail when records are absent", async () => {
    await loadPage({ localVisits: [], localStock: [] });
    expect(document.querySelector(".medicine-chart .chart-empty").hidden).toBe(false);
    expect(document.getElementById("notificationBadge").hidden).toBe(false);
    document.querySelector("[data-medicine-status='expired']").click();
    expect(document.getElementById("medicineDetailModal").open).toBe(true);
    expect(document.getElementById("medicineDetailName").textContent).toBeTruthy();
  });

  it("pages through multiple status records, handles image failures, and exports with XLSX", async () => {
    const expiredStock = Array.from({ length: 12 }, (_, index) => ({
      code: `E${index}`,
      name: `Expired ${index}`,
      total: 4,
      used: 1,
      expiry: isoDay(-1),
      ...(index === 0 ? { image: "/broken.png" } : {}),
    }));
    await loadPage({ database: { visits: visits.slice(0, 1), stock: expiredStock } });
    await vi.waitFor(() => expect(window.getLiveDashboardVisits()).toHaveLength(1));
    await vi.waitFor(() => expect(document.querySelector("[data-medicine-status='expired']").closest(".stock").querySelector("small").textContent).toContain("12"));
    document.querySelector("[data-medicine-status='expired']").click();
    expect(document.getElementById("medicinePageSummary").textContent).toBe("1–10 / 12");
    expect(document.getElementById("medicineNextPage").disabled).toBe(false);
    document.getElementById("medicineDetailImage").querySelector("img").dispatchEvent(new Event("error"));
    expect(document.getElementById("medicineDetailImage").querySelector("img")).toBeNull();
    document.getElementById("medicineNextPage").click();
    expect(document.getElementById("medicinePageSummary").textContent).toContain("12");
    expect(document.getElementById("medicinePrevPage").disabled).toBe(false);
    document.getElementById("medicinePrevPage").click();
    expect(document.getElementById("medicineDetailName").textContent).toBe("Expired 0");

    const xlsx = {
      utils: { book_new: vi.fn(() => ({})), aoa_to_sheet: vi.fn(() => ({})), book_append_sheet: vi.fn() },
      writeFile: vi.fn(),
    };
    vi.stubGlobal("XLSX", xlsx);
    window.downloadLiveDashboardExcel();
    expect(xlsx.utils.book_append_sheet).toHaveBeenCalledOnce();
    expect(xlsx.writeFile).toHaveBeenCalledWith({}, "FMS-Dashboard-Report.xlsx");
  });

  it("filters database visits by dates, branch, and faculty and reports no referrals", async () => {
    const entries = [
      { createdAt: isoDay(-2), branch: "North", faculty: "engineering", gender: "m", medicine: "   ", symptom: "Pain" },
      { date: isoDay(0), branch: "South", faculty: "business", gender: "f", medicines: [{ name: "", quantity: 9 }, { name: "Gauze", quantity: 0 }], symptom: "Pain" },
      { visitDate: "31/12/2569", branch: "North", faculty: "engineering", gender: "unknown" },
      { createdAt: "invalid-date", branch: "North", faculty: "engineering" },
    ];
    await loadPage({ database: { visits: entries, stock: [] } });
    await vi.waitFor(() => expect(window.getLiveDashboardVisits()).toHaveLength(4));
    document.getElementById("branchInput").value = "North";
    document.getElementById("facultySelect").value = "engineering";
    document.getElementById("startDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("startDate").dispatchEvent(new Event("change", { bubbles: true }));
    expect(window.getLiveDashboardVisits()).toHaveLength(2);
    expect(document.getElementById("referralList").textContent).toContain("No referrals");
    document.getElementById("facultySelect").value = "business";
    document.getElementById("facultySelect").dispatchEvent(new Event("change", { bubbles: true }));
    expect(window.getLiveDashboardVisits()).toHaveLength(0);
    expect(document.getElementById("maleBar").style.width).toBe("0%");
  });
});
