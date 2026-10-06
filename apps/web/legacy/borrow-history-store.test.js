import { afterEach, describe, expect, it, vi } from "vitest";

const scripts = import.meta.glob("../../../Front-end/borrow-return-history-store.js");
const values = new Map();
let failWrites = false;

async function loadStore() {
  vi.resetModules();
  values.clear();
  failWrites = false;
  vi.stubGlobal("FMSStorage", {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { if (failWrites) throw new Error("storage disabled"); values.set(key, value); },
  });
  await scripts[Object.keys(scripts)[0]]();
  return window.FMSBorrowHistoryStore;
}

afterEach(() => vi.unstubAllGlobals());

describe("borrow history snapshot store", () => {
  it("compacts saved records and item details to supported fields", async () => {
    const store = await loadStore();
    expect(store.save([{
      id: "loan-1", fullName: "A Nurse", internalOnly: true,
      items: [{ name: "Bandage", quantity: 2, internalOnly: true }],
      returnHistory: [{ date: "2026-10-04", ignored: true, items: [{ code: "MED-1", quantity: 1, ignored: true }] }],
    }])).toBe(true);
    expect(JSON.parse(values.get(store.key))).toEqual([{
      id: "loan-1", fullName: "A Nurse",
      items: [{ name: "Bandage", quantity: 2 }],
      borrowedItems: [{ name: "Bandage", quantity: 2 }],
      returnHistory: [{ date: "2026-10-04", items: [{ code: "MED-1", quantity: 1 }] }],
    }]);
  });

  it("falls back to live data for invalid or absent history and migrates it", async () => {
    const store = await loadStore();
    values.set("fms-borrow-return-records", JSON.stringify([{ id: "live-1", item: "Tool", extra: true }]));
    expect(store.read()).toMatchObject([{ id: "live-1", item: "Tool" }]);
    expect(JSON.parse(values.get(store.key))[0].extra).toBeUndefined();

    values.set(store.key, "bad-json");
    expect(store.read()).toHaveLength(1);
    values.set("fms-borrow-return-records", "[]");
    values.set(store.key, "{}");
    expect(store.read()).toEqual([]);
  });

  it("returns false for invalid snapshots or blocked storage writes", async () => {
    const store = await loadStore();
    expect(store.save(null)).toBe(false);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    failWrites = true;
    expect(store.save([])).toBe(false);
    expect(error).toHaveBeenCalledOnce();
  });
});
