import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const router = require("./borrow.js");
const prisma = require("../lib/prisma.js");

function handler(method, path) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  return layer.route.stack.at(-1).handle;
}

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function borrowRow(overrides = {}) {
  return {
    id: "borrow-1",
    borrowerName: "Alex",
    borrowTypes: ["Student"],
    roles: ["Student"],
    borrowedAt: new Date("2026-09-01T00:00:00.000Z"),
    dueAt: new Date("2026-10-10T00:00:00.000Z"),
    originalDueAt: null,
    extendedAt: null,
    returnedAt: null,
    status: "BORROWED",
    branch: null,
    nickname: null,
    studentId: null,
    phone: null,
    activity: null,
    reason: null,
    items: [],
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("borrow API routes", () => {
  it("commits a borrow and decrements catalog stock in a transaction", async () => {
    const item = { id: "item-1", code: "MED-1", name: "Bandage", unit: "box", remaining: 8 };
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue(borrowRow({
      items: [{ itemName: "Bandage", catalogCode: "MED-1", quantityBorrowed: 2, quantityReturned: 0, returns: [] }],
    }));
    const transaction = vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback({
      catalog: { findUnique: vi.fn().mockResolvedValue(item), updateMany },
      borrowRecord: { create },
    }));
    const res = response();

    await handler("post", "/")({ body: { fullName: " Alex ", dueDate: "2026-10-10", items: [{ code: "MED-1", quantity: 2 }] } }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.items).toEqual([expect.objectContaining({ code: "MED-1", quantity: 2 })]);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "item-1", remaining: { gte: 2 } },
      data: { used: { increment: 2 }, remaining: { decrement: 2 } },
    }));
    expect(create).toHaveBeenCalledOnce();
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("rejects a borrow when the requested quantity exceeds available stock", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const create = vi.fn();
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback({
      catalog: {
        findUnique: vi.fn().mockResolvedValue({ id: "item-1", code: "MED-1", name: "Bandage", unit: "box" }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      borrowRecord: { create },
    }));
    const res = response();

    await handler("post", "/")({ body: { fullName: "Alex", dueDate: "2026-10-10", items: [{ code: "MED-1", quantity: 1 }] } }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe("Insufficient stock");
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects incomplete borrow requests before opening a transaction", async () => {
    const transaction = vi.spyOn(prisma, "$transaction");
    const res = response();

    await handler("post", "/")({ body: { fullName: "Alex", dueDate: "invalid", items: [] } }, res);

    expect(res.statusCode).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("extends a borrow only to a later valid date", async () => {
    const current = borrowRow();
    const updated = borrowRow({
      dueAt: new Date("2026-10-15T00:00:00.000Z"),
      originalDueAt: current.dueAt,
      extendedAt: new Date("2026-10-01T00:00:00.000Z"),
    });
    const update = vi.fn().mockResolvedValue(updated);
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback({
      borrowRecord: {
        findUnique: vi.fn().mockResolvedValue(current),
        update,
      },
    }));
    const res = response();

    await handler("post", "/:id/extensions")({ params: { id: current.id }, body: { dueDate: "2026-10-15" } }, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.extendedDue).toBeTruthy();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ originalDueAt: current.dueAt }) }));
  });

  it("rejects an extension date that is not later than the current due date", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const current = borrowRow();
    const update = vi.fn();
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback({
      borrowRecord: { findUnique: vi.fn().mockResolvedValue(current), update },
    }));
    const res = response();

    await handler("post", "/:id/extensions")({ params: { id: current.id }, body: { dueDate: "2026-10-01" } }, res);

    expect(res.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("records partial returns, restores stock and keeps the borrow open", async () => {
    const current = borrowRow({
      items: [{ id: "borrow-item-1", itemName: "Bandage", catalogCode: "MED-1", catalogId: "item-1", quantityBorrowed: 5, quantityReturned: 0, returns: [] }],
    });
    const afterReturn = borrowRow({
      status: "PARTIALLY_RETURNED",
      items: [{ ...current.items[0], quantityReturned: 2, returns: [{ returnedAt: new Date("2026-10-01"), quantity: 2, condition: "Good", note: null }] }],
    });
    const borrowItemUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const catalogUpdate = vi.fn().mockResolvedValue({});
    const recordUpdate = vi.fn().mockResolvedValue(afterReturn);
    const findUnique = vi.fn().mockResolvedValueOnce(current).mockResolvedValueOnce(afterReturn);
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback({
      borrowRecord: { findUnique, update: recordUpdate },
      borrowItem: { updateMany: borrowItemUpdate },
      borrowReturn: { create: vi.fn().mockResolvedValue({}) },
      catalog: { update: catalogUpdate },
    }));
    const res = response();

    await handler("post", "/:id/returns")({
      params: { id: current.id },
      body: { items: [{ code: "MED-1", quantity: 2, condition: "Good" }] },
    }, res);

    expect(res.body.data.status).toBe("borrowed");
    expect(res.body.data.items[0].quantity).toBe(3);
    expect(catalogUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { used: { decrement: 2 }, remaining: { increment: 2 } } }));
    expect(recordUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "PARTIALLY_RETURNED", returnedAt: null } }));
    expect(borrowItemUpdate).toHaveBeenCalledOnce();
  });

  it("lists borrow records with extension and return history and handles read failures", async () => {
    const row = borrowRow({
      originalDueAt: new Date("2026-10-01T00:00:00Z"), extendedAt: new Date("2026-10-02T00:00:00Z"),
      returnedAt: new Date("2026-10-03T00:00:00Z"), status: "RETURNED",
      items: [{ itemName: "Bandage", catalogCode: "MED-1", quantityBorrowed: 3, quantityReturned: 3, returns: [{ returnedAt: new Date("2026-10-03T00:00:00Z"), quantity: 3, condition: "Good", note: "sealed" }] }],
    });
    const findMany = vi.spyOn(prisma.borrowRecord, "findMany").mockResolvedValue([row]);
    const res = response();
    await handler("get", "/")({}, res);
    expect(res.body.data[0]).toMatchObject({ status: "returned", originalDue: expect.any(String), extensionDate: expect.any(String), returnedDate: expect.any(String) });
    expect(res.body.data[0].returnHistory[0].items[0]).toMatchObject({ code: "MED-1", condition: "Good", note: "sealed" });
    expect(findMany).toHaveBeenCalledOnce();

    vi.spyOn(console, "error").mockImplementation(() => {});
    findMany.mockRejectedValue(new Error("database unavailable"));
    const failed = response();
    await handler("get", "/")({}, failed);
    expect(failed.statusCode).toBe(503);
  });

  it("maps missing catalog items and invalid line quantities while preserving database errors", async () => {
    const invoke = async (catalogItem, quantity = 1) => {
      vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback({
        catalog: { findUnique: vi.fn().mockResolvedValue(catalogItem), updateMany: vi.fn() }, borrowRecord: { create: vi.fn() },
      }));
      const res = response();
      await handler("post", "/")({ body: { fullName: "Alex", dueDate: "2026-10-10", items: [{ code: "MED-1", quantity }] } }, res);
      return res;
    };
    const missing = await invoke(null);
    expect(missing.statusCode).toBe(404);
    const invalid = await invoke({ id: "item-1", code: "MED-1" }, 0);
    expect(invalid.statusCode).toBe(400);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma, "$transaction").mockRejectedValue(new Error("database unavailable"));
    const failed = response();
    await handler("post", "/")({ body: { fullName: "Alex", dueDate: "2026-10-10", items: [{ code: "MED-1", quantity: 1 }] } }, failed);
    expect(failed.statusCode).toBe(503);
  });

  it("rejects extensions of returned or missing records and malformed calendar dates", async () => {
    const malformed = response();
    await handler("post", "/:id/extensions")({ params: { id: "borrow-1" }, body: { dueDate: "2026-02-30" } }, malformed);
    expect(malformed.statusCode).toBe(400);
    const current = borrowRow({ status: "RETURNED" });
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback({ borrowRecord: { findUnique: vi.fn().mockResolvedValue(current), update: vi.fn() } }));
    const returned = response();
    await handler("post", "/:id/extensions")({ params: { id: current.id }, body: { dueDate: "2026-10-15" } }, returned);
    expect(returned.statusCode).toBe(409);
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback({ borrowRecord: { findUnique: vi.fn().mockResolvedValue(null) } }));
    const missing = response();
    await handler("post", "/:id/extensions")({ params: { id: current.id }, body: { dueDate: "2026-10-15" } }, missing);
    expect(missing.statusCode).toBe(404);
  });

  it("marks a borrow fully returned and rejects return requests for missing or exhausted items", async () => {
    const current = borrowRow({ items: [{ id: "i1", itemName: "Bandage", catalogCode: "MED-1", catalogId: null, quantityBorrowed: 2, quantityReturned: 0, returns: [] }] });
    const after = borrowRow({ items: [{ ...current.items[0], quantityReturned: 2 }] });
    const findUnique = vi.fn().mockResolvedValueOnce(current).mockResolvedValueOnce(after);
    const update = vi.fn().mockResolvedValue(borrowRow({ status: "RETURNED", returnedAt: new Date(), items: after.items }));
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback({
      borrowRecord: { findUnique, update }, borrowItem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, borrowReturn: { create: vi.fn() }, catalog: { update: vi.fn() },
    }));
    const complete = response();
    await handler("post", "/:id/returns")({ params: { id: "borrow-1" }, body: { items: [{ code: "MED-1", quantity: 2 }] } }, complete);
    expect(complete.body.data.status).toBe("returned");
    expect(complete.body.data.returnedDate).not.toBe("");

    const empty = response();
    await handler("post", "/:id/returns")({ params: { id: "borrow-1" }, body: { items: [] } }, empty);
    expect(empty.statusCode).toBe(400);
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback({ borrowRecord: { findUnique: vi.fn().mockResolvedValue(null) } }));
    const missing = response();
    await handler("post", "/:id/returns")({ params: { id: "missing" }, body: { items: [{ code: "MED-1", quantity: 1 }] } }, missing);
    expect(missing.statusCode).toBe(404);
  });
});
