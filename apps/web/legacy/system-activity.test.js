import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(process.cwd(), "../../Front-end/system-activity.html"), "utf8");
const scripts = import.meta.glob("../../../Front-end/system-activity.js");

async function load({ records = {}, session = null } = {}) {
  vi.resetModules();
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.body.innerHTML = parsed.body.innerHTML;
  sessionStorage.clear();
  if (session) sessionStorage.setItem("fms-admin-session", JSON.stringify(session));
  window.__FMS_TEST_AUTH_USER__ = { uid: "staff-1" };
  vi.stubGlobal("FMSStorage", { getItem: (key) => records[key] ?? null });
  const URLStub = Object.assign(class extends URL {}, { createObjectURL: vi.fn(() => "blob:activities"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("URL", URLStub);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.spyOn(window, "print").mockImplementation(() => {});
  await Object.values(scripts)[0]();
  return URLStub;
}

afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); document.body.replaceChildren(); sessionStorage.clear(); delete window.__FMS_TEST_AUTH_USER__;
});

describe("system activity history cards", () => {
  it("summarizes eligible visit, stock, catalog and borrow history", async () => {
    await load({ records: {
      "fms-infirmary-visits": JSON.stringify([
        { status: "normal", medicine: "Bandage", createdAt: "2026-10-01" },
        { status: "refer", medicine: "Gauze", createdAt: "2026-10-02" },
        { status: "observe", medicine: "Gauze" },
      ]),
      "fms-stock-records": JSON.stringify([{ name: "Bandage <box>", date: "2026-10-03" }]),
      "fms-history-catalog-orders": "invalid-json",
      "fms-borrow-return-records": JSON.stringify([{ item: "Loan", borrowDate: "2026-10-04" }]),
      "fms-history-borrow-return": JSON.stringify([{ item: "Return", completedAt: "2026-10-05" }]),
    } });
    const cards = [...document.querySelectorAll(".activity-card")];
    expect(cards).toHaveLength(4);
    expect(cards[0].textContent).toContain("2 รายการ");
    expect(cards[1].textContent).toContain("4 รายการ");
    expect(cards[1].getAttribute("href")).toBe("./history-stock.html");
    expect(cards[2].textContent).toContain("0 รายการ");
    expect(cards[3].textContent).toContain("2 รายการ");
    expect(cards[0].getAttribute("href")).toBe("./infirmary-visit-history.html");
  });

  it("switches language, exports categories, prints, toggles notifications and refreshes", async () => {
    const URLStub = await load({ session: { role: "admin" } });
    document.getElementById("languageButton").click();
    expect(document.documentElement.lang).toBe("en");
    expect(document.getElementById("pageTitle").textContent).toBe("History");
    expect(document.querySelector(".activity-card").textContent).toContain("No records yet");
    document.getElementById("exportExcel").click();
    expect(URLStub.createObjectURL).toHaveBeenCalledOnce();
    expect(URLStub.revokeObjectURL).toHaveBeenCalledOnce();
    document.getElementById("exportPdf").click();
    expect(window.print).toHaveBeenCalledOnce();
    document.getElementById("notificationButton").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(false);
    document.body.click();
    expect(document.getElementById("notificationPanel").hidden).toBe(true);
    document.getElementById("notificationButton").click();
    document.getElementById("closeNotification").click();
    expect(document.getElementById("notificationPanel").hidden).toBe(true);
    window.dispatchEvent(new StorageEvent("storage", { key: "fms-stock-records" }));
    window.dispatchEvent(new Event("focus"));
    expect(document.querySelectorAll(".activity-card")).toHaveLength(4);
  });
});
