import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/stock.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/stock.js");
const products = [
  { code: "M1", name: "Bandage", genericName: "Gauze", category: "equipment", total: 10, used: 2, remaining: 8 },
  { code: "M2", name: "Paracetamol", category: "oral", total: 5, used: 1, remaining: 4 },
];

async function loadPage(stock = products) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;
  const values = new Map([["fms-stock-records", JSON.stringify(stock)]]);
  vi.stubGlobal("FMSStorage", {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  vi.stubGlobal("FMSAdminAudit", { logDeleted: vi.fn() });
  vi.stubGlobal("print", vi.fn());
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:stock"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  await Object.values(scripts)[0]();
  return values;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  document.body.replaceChildren();
});

describe("stock inventory page", () => {
  it("filters products by category and search, and keeps stock totals consistent", async () => {
    const values = await loadPage();
    expect(document.querySelectorAll(".medicine-card")).toHaveLength(2);
    document.querySelector(".filter[data-filter='oral']").click();
    expect(document.querySelectorAll(".medicine-card")).toHaveLength(1);
    expect(document.querySelector(".medicine-card h2").textContent).toContain("Paracetamol");
    document.querySelector(".filter[data-filter='all']").click();
    const search = document.getElementById("searchInput");
    search.value = "gauze";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelectorAll(".medicine-card")).toHaveLength(1);

    search.value = "";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const card = document.querySelector("[data-code='M1']");
    card.querySelector("[data-field='total'][data-delta='1']").click();
    expect(document.querySelector("[data-code='M1'] .total strong").textContent).toBe("11");
    expect(document.querySelector("[data-code='M1'] .remaining strong").textContent).toBe("9");
    expect(JSON.parse(values.get("fms-stock-records"))[0]).toMatchObject({ total: 11, remaining: 9 });
    document.querySelector("[data-code='M1'] [data-field='remaining'][data-delta='1']").click();
    expect(JSON.parse(values.get("fms-stock-records"))[0].remaining).toBe(9);
  });

  it("confirms deletion, keeps a canceled item, and records an audit entry on removal", async () => {
    const values = await loadPage();
    document.querySelector("[data-code='M1'] [data-management='delete']").click();
    document.querySelector(".fms-confirm-cancel").click();
    expect(JSON.parse(values.get("fms-stock-records"))).toHaveLength(2);
    document.querySelector("[data-code='M1'] [data-management='delete']").click();
    document.querySelector(".fms-confirm-delete").click();
    await vi.waitFor(() => expect(JSON.parse(values.get("fms-stock-records"))).toHaveLength(1));
    expect(JSON.parse(values.get("fms-stock-records"))[0].code).toBe("M2");
    expect(window.FMSAdminAudit.logDeleted).toHaveBeenCalledWith("fms-stock-records", products[0], "user-deleted-stock");
  });

  it("provides notifications, export, language, and an empty inventory state", async () => {
    await loadPage([]);
    expect(document.getElementById("stockGrid").textContent).not.toBe("");
    document.getElementById("notificationButton").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    document.getElementById("closeNotification").click();
    document.getElementById("exportPdf").click();
    expect(window.print).toHaveBeenCalledOnce();
    document.getElementById("exportExcel").click();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    document.getElementById("languageButton").click();
    expect(document.documentElement.lang).toBe("en");
  });

  it("saves the selected inventory record before opening its edit form", async () => {
    const record = { name: "Uncoded supply", total: 3, used: 0, remaining: 3 };
    const values = await loadPage([record]);
    document.querySelector("[data-management='edit']").click();
    expect(JSON.parse(values.get("fms-edit-stock-record"))).toMatchObject(record);
    expect(values.get("fms-edit-stock-code")).toBeTruthy();
  });
});
