import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadNotifications(records = {}) {
  window.FMSStorage = {
    getItem(key) {
      if (!Object.hasOwn(records, key)) return null;
      return typeof records[key] === "string" ? records[key] : JSON.stringify(records[key]);
    },
  };
  await import("../../../Front-end/notification-utils.js");
  return window.FMSNotifications;
}

describe("legacy notification rules", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 4, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.FMSStorage;
  });

  it("notifies for expired and out-of-stock medicine", async () => {
    const notifications = (await loadNotifications({
      "fms-stock-records": [{ name: "Medicine A", expiry: "03/10/2026", remaining: 0 }],
    })).getAll("en");

    expect(notifications.map(({ title, level }) => [title, level])).toEqual([
      ["Expired medicine", "critical"],
      ["Out of stock", "critical"],
    ]);
  });

  it("notifies for medicine expiring within 30 days and stock below ten", async () => {
    const notifications = (await loadNotifications({
      "fms-stock-records": [{ name: "Medicine B", expiry: "20/10/2026", remaining: 4, unit: "boxes" }],
    })).getAll("en");

    expect(notifications).toHaveLength(2);
    expect(notifications[0].title).toBe("Medicine expiring soon");
    expect(notifications[1]).toMatchObject({ level: "warning", title: "Low medicine stock" });
    expect(notifications[1].detail).toContain("4 boxes");
  });

  it("notifies when borrowed items are overdue or due within seven days", async () => {
    const notifications = (await loadNotifications({
      "fms-borrow-return-records": [
        { fullName: "Alex", due: "03/10/2026", status: "borrowed" },
        { fullName: "Sam", due: "10/10/2026", status: "borrowed" },
        { fullName: "Jo", due: "05/10/2026", status: "borrowed", extendedDue: "20/10/2026" },
      ],
    })).getAll("en");

    expect(notifications.map(({ title, level }) => [title, level])).toEqual([
      ["Overdue borrowed item", "critical"],
      ["Borrowed item due soon", "warning"],
    ]);
  });

  it("ignores returned loans and malformed storage", async () => {
    const notifications = (await loadNotifications({
      "fms-stock-records": "not an array",
      "fms-borrow-return-records": [
        { fullName: "Returned", due: "01/10/2026", status: "returned" },
        { fullName: "Also returned", due: "01/10/2026", status: "borrowed", returnedDate: "02/10/2026" },
      ],
    })).getAll("en");

    expect(notifications).toEqual([]);
  });

  it("covers localized stock alerts, fallback fields, date aliases, and stock thresholds", async () => {
    const notifications = (await loadNotifications({
      "fms-stock-records": [
        { productName: "Near expiry", expiryDate: "03-11-2026", total: 15, used: 6 },
        { genericName: "Low stock", remaining: 9, unit: "vials" },
        { name: "No stock", remaining: -3, expiry: "invalid-date" },
        { name: "Primary date", expiry: "03/11/2026", remaining: 10 },
        { name: "Plenty", remaining: 10, expiry: "05/12/2026" },
        { name: "Unknown date", expiry: "99/99/9999", remaining: 20 },
        { expiry: "03/10/2026", total: 0, used: 0 },
      ],
    })).getAll("th");

    expect(notifications).toHaveLength(7);
    expect(notifications[0].detail).toContain("Near expiry");
    expect(notifications[1].detail).toContain("Near expiry");
    expect(notifications[2].detail).toContain("Low stock");
    expect(notifications[2].detail).toContain("9 vials");
    expect(notifications[3].detail).toContain("No stock");
    expect(notifications.some(({ detail }) => detail.includes("Primary date"))).toBe(true);
    expect(notifications[0].title).not.toBe("Medicine expiring soon");
    expect(notifications[2].title).not.toBe("Low medicine stock");
  });

  it("covers borrow due-date aliases, localized labels, and returned item arrays", async () => {
    const notifications = (await loadNotifications({
      "fms-stock-records": "not valid JSON",
      "fms-borrow-return-records": [
        { item: "Due today", status: "", dueDate: "04/10/2026" },
        { borrower: "Soon", extensionDate: "11/10/2026" },
        { fullName: "Late", status: "OVERDUE", expectedReturnDate: "08/10/2026" },
        { fullName: "No date", status: "borrowed", due: "bad-date" },
        { fullName: "Empty items", items: [], dueDate: "03/10/2026" },
      ],
    })).getAll("th");

    expect(notifications).toHaveLength(3);
    expect(notifications[0].detail).toContain("Due today");
    expect(notifications[1].detail).toContain("Soon");
    expect(notifications[2].detail).toContain("Late");
    expect(notifications.map(({ level }) => level)).toEqual(["warning", "warning", "critical"]);
  });

  it("handles storage exceptions, Buddhist calendar years, and fallback notification names", async () => {
    window.FMSStorage = { getItem: () => "{}" };
    const service = window.FMSNotifications;
    expect(service.getAll()).toEqual([]);
    window.FMSStorage = { getItem: () => { throw new Error("storage unavailable"); } };
    expect(service.getAll()).toEqual([]);

    const withRecords = await loadNotifications({
      "fms-stock-records": [
        { expiry: "03/10/2569", total: 2, used: 2 },
        { genericName: "Generic", expiry: "2026-10-03", remaining: 5 },
      ],
      "fms-borrow-return-records": [
        { dueDate: "2026-10-03" },
        { borrower: "Return due", returnDueDate: "10/10/2026" },
      ],
    });
    const localized = withRecords.getAll("th");
    expect(localized).toHaveLength(6);
    expect(localized[0].detail).toBeTruthy();
    expect(localized.some(({ detail }) => detail.includes("Generic"))).toBe(true);
    expect(localized.some(({ detail }) => detail.includes("Return due"))).toBe(true);
    const english = withRecords.getAll("en");
    expect(english.some(({ title, detail }) => title === "Low medicine stock" && detail.includes("units"))).toBe(true);
    expect(english.some(({ detail }) => detail.includes("Borrowed item"))).toBe(true);
  });
});
