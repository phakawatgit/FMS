import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const router = require("./index.js");
const prisma = require("../lib/prisma.js");
const catalogRouter = require("./catalog.js");

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

afterEach(() => vi.restoreAllMocks());

describe("core API routes", () => {
  it("builds dashboard data from visit history and related medicine rows", async () => {
    const visitedAt = new Date("2026-10-04T03:00:00.000Z");
    vi.spyOn(prisma.patient, "findMany").mockResolvedValue([
      { id: "p1", faculty: "engineering", infirmaryHistory: [{ createdAt: visitedAt.toISOString(), status: "observe" }] },
      { id: "empty", infirmaryHistory: [] },
    ]);
    vi.spyOn(prisma.patientMedication, "findMany").mockResolvedValue([{ visitId: visitedAt.toISOString(), catalogCode: "M1", medicineName: "Bandage", quantity: 2 }]);
    vi.spyOn(prisma.catalog, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.borrowRecord, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.legacyStorage, "findUnique").mockResolvedValue({ value: [] });
    const res = response();

    await handler("get", "/dashboard/data")({ protocol: "http", get: () => "localhost" }, res);

    expect(res.body.data.visits[0]).toMatchObject({ faculty: "engineering", medicine: "Bandage", quantity: 2 });
    expect(res.body.data.stock).toEqual([]);
    expect(res.body.data.purchaseOrders).toEqual([]);
  });

  it("includes current patient visits, preserves history fallbacks and tolerates absent purchase documents", async () => {
    const visitedAt = new Date("2026-10-04T03:00:00.000Z");
    vi.spyOn(prisma.patient, "findMany").mockResolvedValue([
      { id: "p1", branch: "North", gender: "female", visitedAt, infirmaryHistory: [] },
      { id: "p2", faculty: "science", infirmaryHistory: [{ date: "2026-10-03", medicines: [{ name: "Ice pack", quantity: 1 }] }] },
    ]);
    vi.spyOn(prisma.patientMedication, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.catalog, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.borrowRecord, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.legacyStorage, "findUnique").mockResolvedValue(null);
    const res = response();

    await handler("get", "/dashboard/data")({ protocol: "http", get: () => "localhost" }, res);

    expect(res.body.data.visits).toHaveLength(2);
    expect(res.body.data.visits[0]).toMatchObject({ id: "p1", branch: "North", gender: "female", createdAt: visitedAt.toISOString() });
    expect(res.body.data.visits[1]).toMatchObject({ faculty: "science", medicine: "Ice pack", quantity: 1 });
    expect(res.body.data.purchaseOrders).toEqual([]);
  });

  it("returns service unavailable when dashboard data queries fail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma.patient, "findMany").mockRejectedValue(new Error("database unavailable"));
    vi.spyOn(prisma.patientMedication, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.catalog, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.borrowRecord, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.legacyStorage, "findUnique").mockResolvedValue(null);
    const res = response();

    await handler("get", "/dashboard/data")({}, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.success).toBe(false);
  });

  it("enriches shared visit history with current patient status and matching duty responsibility", async () => {
    const createdAt = "2026-10-04T05:00:00.000Z";
    vi.spyOn(prisma.legacyStorage, "findMany").mockResolvedValue([
      { key: "fms-infirmary-visits", value: [
        { createdAt, enteredByEmail: "NURSE@example.com", status: "normal", hospitalName: "Old Hospital" },
        { createdAt: "not-a-date", enteredById: "user-1", status: "observe" },
        { createdAt, status: "refer" },
      ] },
      { key: "fms-stock-records", value: [{ name: "private legacy stock" }] },
      { key: "admin-secret", value: "filtered" },
      { key: "fms-borrow-return-records", value: [] },
    ]);
    vi.spyOn(prisma.patient, "findMany").mockResolvedValue([
      { visitedAt: new Date(createdAt), status: "observe", hospitalName: "Current Hospital" },
    ]);
    vi.spyOn(prisma.dutyShift, "findMany").mockResolvedValue([{
      id: "shift-1", userId: "nurse-1", date: new Date("2026-10-04T00:00:00.000Z"),
      firstName: "Ada", lastName: "Nurse", nickname: "A", user: { email: "nurse@example.com" },
    }]);
    vi.spyOn(prisma.borrowRecord, "findMany").mockResolvedValue([]);
    vi.spyOn(catalogRouter, "listRecords").mockResolvedValue([{ code: "M1", name: "Bandage" }]);

    const res = response();
    await handler("get", "/legacy-storage")({ auth: { role: "NURSE" } }, res);

    const visits = res.body.data["fms-infirmary-visits"];
    expect(res.body.data["admin-secret"]).toBeUndefined();
    expect(res.body.data["fms-stock-records"]).toEqual([{ code: "M1", name: "Bandage" }]);
    expect(visits[0]).toMatchObject({
      status: "observe", hospitalName: "Current Hospital", responsibleShiftId: "shift-1",
      responsibleUserId: "nurse-1", responsibleName: "Ada Nurse", responsibleNickname: "A",
      responsibleFromDutyShift: true,
    });
    expect(visits[1]).toMatchObject({ createdAt: "not-a-date" });
    expect(visits[2]).toMatchObject({ status: "observe" });
    expect(visits[2]).not.toHaveProperty("responsibleFromDutyShift");
  });

  it("returns API overview counts", async () => {
    vi.spyOn(prisma.user, "count").mockResolvedValue(4);
    vi.spyOn(prisma.dutyShift, "count").mockResolvedValue(12);
    const res = response();

    await handler("get", "/overview")({}, res);

    expect(res.body).toMatchObject({ success: true, data: { database: "connected", counts: { users: 4, dutyShifts: 12 } } });
  });

  it("reports overview database failures as service unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma.user, "count").mockRejectedValue(new Error("database unavailable"));
    vi.spyOn(prisma.dutyShift, "count").mockResolvedValue(0);
    const res = response();

    await handler("get", "/overview")({}, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.database).toBe("disconnected");
  });

  it("lists nurses and reports database read failures", async () => {
    const list = vi.spyOn(prisma.nurse, "findMany").mockResolvedValue([{ id: "n1", fullName: "A Nurse" }]);
    const res = response();
    await handler("get", "/nurses")({}, res);
    expect(res.body.data).toEqual([{ id: "n1", fullName: "A Nurse" }]);
    expect(list).toHaveBeenCalledWith({ orderBy: { fullName: "asc" } });

    vi.spyOn(console, "error").mockImplementation(() => {});
    list.mockRejectedValue(new Error("database unavailable"));
    const failed = response();
    await handler("get", "/nurses")({}, failed);
    expect(failed.statusCode).toBe(503);
  });

  it("lists user accounts and converts user query failures to service unavailable", async () => {
    const list = vi.spyOn(prisma.user, "findMany").mockResolvedValue([{ id: "u1", role: "NURSE" }]);
    const res = response();
    await handler("get", "/users")({}, res);
    expect(res.body.data).toEqual([{ id: "u1", role: "NURSE" }]);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ name: "asc" }, { email: "asc" }] }));

    vi.spyOn(console, "error").mockImplementation(() => {});
    list.mockRejectedValue(new Error("database unavailable"));
    const failed = response();
    await handler("get", "/users")({}, failed);
    expect(failed.statusCode).toBe(503);
  });

  it("returns not found for unknown users and service unavailable for role transaction errors", async () => {
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback({
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      user: { findUnique: vi.fn().mockResolvedValue(null) },
    }));
    const missing = response();
    await handler("patch", "/users/:id/role")({ params: { id: "missing" }, body: { role: "NURSE" } }, missing);
    expect(missing.statusCode).toBe(404);

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma, "$transaction").mockRejectedValue(new Error("database unavailable"));
    const failed = response();
    await handler("patch", "/users/:id/role")({ params: { id: "u1" }, body: { role: "ADMIN" } }, failed);
    expect(failed.statusCode).toBe(503);
  });

  it("merges normalized and legacy duty shifts and handles list failures", async () => {
    vi.spyOn(prisma.dutyShift, "findMany").mockResolvedValue([{ id: "db-1", date: new Date("2026-10-05T00:00:00Z"), createdAt: new Date("2026-10-05T00:00:00Z"), color: "color-2", firstName: "Sam", lastName: "Nurse", user: { email: "sam@example.com" } }]);
    vi.spyOn(prisma.legacyStorage, "findUnique").mockResolvedValue({ value: [
      { date: "2026-10-06", email: "old@example.com", firstName: "Old", lastName: "Nurse", colorId: "color-3" },
      { date: "", uid: "skip" },
    ] });
    const res = response();
    await handler("get", "/duty-shifts")({}, res);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((row) => row.date)).toEqual(["2026-10-06", "2026-10-05"]);

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma.dutyShift, "findMany").mockRejectedValue(new Error("database unavailable"));
    const failed = response();
    await handler("get", "/duty-shifts")({}, failed);
    expect(failed.statusCode).toBe(503);
  });

  it("validates role changes before opening a transaction", async () => {
    const transaction = vi.spyOn(prisma, "$transaction");
    const res = response();

    await handler("patch", "/users/:id/role")({ params: { id: "user-1" }, body: { role: "OWNER" } }, res);

    expect(res.statusCode).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("updates a user role inside the serialized role-change transaction", async () => {
    const user = { id: "user-1", email: "nurse@example.com", role: "ADMIN", isActive: true };
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: user.id, role: "NURSE", isActive: true }),
        update: vi.fn().mockResolvedValue(user),
        count: vi.fn(),
      },
    };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(tx));
    const res = response();

    await handler("patch", "/users/:id/role")({ params: { id: user.id }, body: { role: "admin" } }, res);

    expect(res.body).toMatchObject({ success: true, data: user });
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: user.id }, data: { role: "ADMIN" } }));
    expect(tx.user.count).not.toHaveBeenCalled();
  });

  it("prevents demoting the last active administrator", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN", isActive: true }),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn(),
      },
    };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(tx));
    const res = response();

    await handler("patch", "/users/:id/role")({ params: { id: "admin-1" }, body: { role: "NURSE" } }, res);

    expect(res.statusCode).toBe(409);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("allows demoting an administrator when another active administrator remains", async () => {
    const tx = {
      $executeRaw: vi.fn(),
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "admin-2", role: "ADMIN", isActive: true }),
        count: vi.fn().mockResolvedValue(2),
        update: vi.fn().mockResolvedValue({ id: "admin-2", role: "NURSE" }),
      },
    };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(tx));
    const res = response();
    await handler("patch", "/users/:id/role")({ params: { id: "admin-2" }, body: { role: "NURSE" } }, res);
    expect(res.body).toMatchObject({ success: true, data: { role: "NURSE" } });
    expect(tx.user.count).toHaveBeenCalledOnce();
    expect(tx.user.update).toHaveBeenCalledOnce();
  });

  it("rejects duty shifts that do not belong to the signed-in user", async () => {
    const transaction = vi.spyOn(prisma, "$transaction");
    const res = response();

    await handler("post", "/duty-shifts")({
      auth: { uid: "user-1", email: "user@example.com", userId: "user-1", role: "NURSE" },
      body: { records: [{ uid: "other-user", date: "2026-10-04", colorId: "color-1", firstName: "A", lastName: "B" }] },
    }, res);

    expect(res.statusCode).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a duty shift request containing no records owned by the signed-in user", async () => {
    const res = response();
    await handler("post", "/duty-shifts")({
      auth: { uid: "user-1", userId: "user-1", role: "NURSE" },
      body: { records: [{ uid: "user-2", date: "2026-10-04", colorId: "color-1", firstName: "A", lastName: "B" }] },
    }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("signed-in user");
  });

  it("saves a signed-in nurse's duty shift and updates their profile", async () => {
    const shift = { id: "shift-1", userId: "user-1", date: new Date("2026-10-04T00:00:00.000Z"), color: "color-3", firstName: "A", lastName: "Nurse", nickname: "Ann", affiliation: "FMS", user: { email: "a@example.com" }, createdAt: new Date(), updatedAt: new Date() };
    const tx = {
      dutyShift: { findFirst: vi.fn().mockResolvedValue(null), upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([shift]) },
      user: { update: vi.fn() },
      legacyStorage: { findUnique: vi.fn().mockResolvedValue({ value: [{ uid: "user-1", date: "2026-10-04" }, { uid: "other", date: "2026-10-04" }] }), upsert: vi.fn() },
    };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(tx));
    vi.spyOn(prisma.legacyStorage, "findUnique").mockResolvedValue({ value: [{ uid: "other", date: "2026-10-04" }] });
    const res = response();

    await handler("post", "/duty-shifts")({ auth: { uid: "user-1", email: "a@example.com", userId: "user-1", role: "NURSE" }, body: { records: [{ uid: "user-1", date: "2026-10-04", colorId: "color-3", firstName: "A", lastName: "Nurse", nickname: "Ann", affiliation: "FMS" }] } }, res);

    expect(res.body.success).toBe(true);
    expect(tx.dutyShift.upsert).toHaveBeenCalledOnce();
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: "A Nurse" }) }));
    expect(tx.legacyStorage.upsert).toHaveBeenCalledOnce();
  });

  it("rejects oversized, invalid, and conflicting duty shifts", async () => {
    const auth = { uid: "user-1", email: "a@example.com", userId: "user-1", role: "NURSE" };
    const oversized = response();
    await handler("post", "/duty-shifts")({ auth, body: { records: Array(1001).fill({}) } }, oversized);
    expect(oversized.statusCode).toBe(400);

    const invalid = response();
    await handler("post", "/duty-shifts")({ auth, body: { records: [{ uid: "user-1", date: "2026-02-30", colorId: "color-0", firstName: "A", lastName: "B" }] } }, invalid);
    expect(invalid.statusCode).toBe(400);

    const tx = { dutyShift: { findFirst: vi.fn().mockResolvedValue({ id: "other-shift" }) } };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(tx));
    const conflict = response();
    await handler("post", "/duty-shifts")({ auth, body: { records: [{ uid: "user-1", date: "2026-10-04", colorId: "color-1", firstName: "A", lastName: "B" }] } }, conflict);
    expect(conflict.statusCode).toBe(409);
  });

  it("validates and protects duty shift updates", async () => {
    const invalid = response();
    await handler("put", "/duty-shifts/:id")({ body: { date: "2026-02-30", colorId: "color-1" }, params: { id: "shift-1" }, auth: { role: "NURSE", userId: "user-1" } }, invalid);
    expect(invalid.statusCode).toBe(400);

    const tx = { dutyShift: { findUnique: vi.fn().mockResolvedValue({ id: "shift-1", userId: "other", date: new Date(), user: { email: "other@example.com" } }) } };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(tx));
    const forbidden = response();
    await handler("put", "/duty-shifts/:id")({ body: { date: "2026-10-04", colorId: "color-1" }, params: { id: "shift-1" }, auth: { role: "NURSE", userId: "user-1" } }, forbidden);
    expect(forbidden.statusCode).toBe(403);
  });

  it("updates an owned duty shift and maps missing and conflicting rows to their HTTP statuses", async () => {
    const current = { id: "shift-1", userId: "user-1", date: new Date("2026-10-04T00:00:00Z"), color: "color-1", user: { email: "nurse@example.com" } };
    const tx = {
      dutyShift: {
        findUnique: vi.fn().mockResolvedValue(current),
        update: vi.fn().mockResolvedValue({ ...current, date: new Date("2026-10-05T00:00:00Z"), color: "color-2", firstName: "A", lastName: "Nurse", updatedAt: new Date("2026-10-05T01:00:00Z") }),
      },
      legacyStorage: { findUnique: vi.fn().mockResolvedValue({ value: [{ date: "2026-10-04", email: "nurse@example.com" }, { date: "2026-10-04", uid: "other" }] }), upsert: vi.fn() },
    };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(tx));
    const req = { body: { date: "2026-10-05", colorId: "color-2" }, params: { id: "shift-1" }, auth: { role: "NURSE", userId: "user-1" } };
    const saved = response();
    await handler("put", "/duty-shifts/:id")(req, saved);
    expect(saved.body.success).toBe(true);
    expect(tx.dutyShift.update).toHaveBeenCalledOnce();
    expect(tx.legacyStorage.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { value: [{ date: "2026-10-04", uid: "other" }] } }));

    const missingTx = { dutyShift: { findUnique: vi.fn().mockResolvedValue(null) } };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(missingTx));
    const missing = response();
    await handler("put", "/duty-shifts/:id")(req, missing);
    expect(missing.statusCode).toBe(404);

    const conflictTx = { dutyShift: { findUnique: vi.fn().mockResolvedValue(current), update: vi.fn().mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" })) } };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(conflictTx));
    const conflict = response();
    await handler("put", "/duty-shifts/:id")(req, conflict);
    expect(conflict.statusCode).toBe(409);
  });

  it("cancels an owned duty shift from the database and removes its legacy mirror", async () => {
    const current = { id: "shift-delete", userId: "user-1", date: new Date("2026-10-04T00:00:00Z"), user: { email: "nurse@example.com" } };
    const tx = {
      dutyShift: { findUnique: vi.fn().mockResolvedValue(current), delete: vi.fn().mockResolvedValue(current) },
      legacyStorage: {
        findUnique: vi.fn().mockResolvedValue({ value: [
          { date: "2026-10-04", email: "nurse@example.com" },
          { date: "2026-10-04", uid: "other-user" },
        ] }),
        upsert: vi.fn(),
      },
    };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(tx));
    const req = { params: { id: "shift-delete" }, auth: { role: "NURSE", userId: "user-1" } };
    const deleted = response();
    await handler("delete", "/duty-shifts/:id")(req, deleted);
    expect(deleted.body).toEqual({ success: true });
    expect(tx.dutyShift.delete).toHaveBeenCalledWith({ where: { id: "shift-delete" } });
    expect(tx.legacyStorage.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { value: [{ date: "2026-10-04", uid: "other-user" }] } }));

    tx.dutyShift.findUnique.mockResolvedValue({ ...current, userId: "someone-else" });
    const forbidden = response();
    await handler("delete", "/duty-shifts/:id")(req, forbidden);
    expect(forbidden.statusCode).toBe(403);
    expect(tx.dutyShift.delete).toHaveBeenCalledOnce();

    tx.dutyShift.findUnique.mockResolvedValue(null);
    const missing = response();
    await handler("delete", "/duty-shifts/:id")(req, missing);
    expect(missing.statusCode).toBe(404);
  });

  it("upserts a canonical nurse name and reports nurse list results", async () => {
    const nurse = { id: "n1", fullName: "Ann Nurse" };
    vi.spyOn(prisma.nurse, "findMany").mockResolvedValue([{ fullName: "Ann Nurse" }]);
    const upsert = vi.spyOn(prisma.nurse, "upsert").mockResolvedValue(nurse);
    vi.spyOn(prisma.user, "update").mockResolvedValue({});
    vi.spyOn(prisma, "$transaction").mockResolvedValue([nurse, {}]);
    const saved = response();
    await handler("post", "/nurses")({ auth: { userId: "u1" }, body: { firstName: " Ann ", lastName: "Nurse", nickname: "A" } }, saved);
    expect(saved.body.data).toEqual(nurse);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { fullName: "Ann Nurse" } }));

    vi.spyOn(prisma.nurse, "findMany").mockResolvedValue([nurse]);
    const listed = response();
    await handler("get", "/nurses")({}, listed);
    expect(listed.body.data).toEqual([nurse]);
  });

  it("rejects incomplete nurse profiles and malformed legacy imports before database writes", async () => {
    const nurseWrite = vi.spyOn(prisma.nurse, "upsert");
    const nurseResponse = response();
    await handler("post", "/nurses")({ body: { firstName: " ", lastName: "Nurse" } }, nurseResponse);
    expect(nurseResponse.statusCode).toBe(400);
    expect(nurseWrite).not.toHaveBeenCalled();

    const transaction = vi.spyOn(prisma, "$transaction");
    const bulkResponse = response();
    await handler("post", "/legacy-storage/bulk")({ body: { data: [] } }, bulkResponse);
    expect(bulkResponse.statusCode).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("filters shared legacy keys for nurses, keeps admin keys and overlays normalized catalog and borrow rows", async () => {
    vi.spyOn(prisma.legacyStorage, "findMany").mockResolvedValue([
      { key: "fms-order-title", value: "Quarterly order" },
      { key: "fms-admin-private", value: "secret" },
      { key: "fms-stock-records", value: [{ code: "old" }] },
      { key: "fms-infirmary-visits", value: [
        { createdAt: "2026-10-04T03:00:00.000Z", enteredByEmail: "nurse@example.com", status: "normal" },
        { createdAt: "invalid-date", status: "normal" },
      ] },
      { key: "fms-borrow-return-records", value: [{ id: "borrow-1", extensionDate: "2026-10-10", due: "2026-10-10" }] },
    ]);
    vi.spyOn(prisma.catalog, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.borrowRecord, "findMany").mockResolvedValue([{
      id: "borrow-1", borrowerName: "Ava", borrowerTypes: [], borrowTypes: [], roles: [], status: "BORROWED",
      borrowedAt: new Date("2026-10-01"), dueAt: new Date("2026-10-08"),
      items: [{ itemName: "Bandage", catalogCode: "M1", quantityBorrowed: 2, quantityReturned: 0, returns: [] }],
    }]);
    vi.spyOn(prisma.patient, "findMany").mockResolvedValue([{ visitedAt: new Date("2026-10-04T03:00:00.000Z"), status: "observe", hospitalName: "City Hospital" }]);
    vi.spyOn(prisma.dutyShift, "findMany").mockResolvedValue([{ id: "shift-1", userId: "nurse-1", date: new Date("2026-10-04T00:00:00.000Z"), firstName: "Nurse", lastName: "One", nickname: "N", user: { email: "nurse@example.com" } }]);
    const request = { protocol: "http", get: () => "localhost", auth: { role: "NURSE" } };
    const nurseResponse = response();
    await handler("get", "/legacy-storage")(request, nurseResponse);
    expect(nurseResponse.body.data["fms-order-title"]).toBe("Quarterly order");
    expect(nurseResponse.body.data["fms-admin-private"]).toBeUndefined();
    expect(nurseResponse.body.data["fms-stock-records"]).toEqual([]);
    expect(nurseResponse.body.data["fms-borrow-return-records"][0]).toMatchObject({ id: "borrow-1", extensionDate: "2026-10-10" });
    expect(nurseResponse.body.data["fms-infirmary-visits"][0]).toMatchObject({ status: "observe", hospitalName: "City Hospital", responsibleShiftId: "shift-1", responsibleName: "Nurse One" });
    expect(nurseResponse.body.data["fms-infirmary-visits"][1]).toMatchObject({ createdAt: "invalid-date", status: "normal" });

    const adminResponse = response();
    await handler("get", "/legacy-storage")({ ...request, auth: { role: "ADMIN" } }, adminResponse);
    expect(adminResponse.body.data["fms-admin-private"]).toBe("secret");

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma.legacyStorage, "findMany").mockRejectedValue(new Error("database unavailable"));
    const failed = response();
    await handler("get", "/legacy-storage")(request, failed);
    expect(failed.statusCode).toBe(503);
  });

  it("imports legacy key/value data transactionally and can preserve existing values", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback({ legacyStorage: { upsert } }));
    const res = response();
    await handler("post", "/legacy-storage/bulk")({ body: {
      data: { " shared-key ": "incoming", "": "ignored", ["k".repeat(121)]: "ignored", nullable: null }, preserveExisting: true,
    } }, res);
    expect(res.body).toEqual({ success: true, count: 2 });
    expect(upsert).toHaveBeenCalledWith({ where: { key: "shared-key" }, create: { key: "shared-key", value: "incoming" }, update: {} });
    expect(upsert).toHaveBeenCalledWith({ where: { key: "nullable" }, create: { key: "nullable", value: null }, update: {} });
  });

  it("validates bulk legacy input, syncs imported stock, and reports transaction failures", async () => {
    const invalid = response();
    await handler("post", "/legacy-storage/bulk")({ body: { data: [] } }, invalid);
    expect(invalid.statusCode).toBe(400);

    const upsert = vi.fn().mockResolvedValue({});
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback({ legacyStorage: { upsert } }));
    vi.spyOn(catalogRouter, "syncRecords").mockResolvedValue([{}]);
    const synced = response();
    await handler("post", "/legacy-storage/bulk")({ protocol: "http", get: () => "localhost", body: { data: { "fms-stock-records": [{ code: "M1" }] } } }, synced);
    expect(synced.body).toEqual({ success: true, count: 1 });
    expect(upsert).not.toHaveBeenCalled();
    expect(catalogRouter.syncRecords).toHaveBeenCalledWith([{ code: "M1" }], expect.any(Object));

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma, "$transaction").mockRejectedValue(new Error("database unavailable"));
    const failed = response();
    await handler("post", "/legacy-storage/bulk")({ body: { data: { key: "value" } } }, failed);
    expect(failed.statusCode).toBe(503);
  });

  it("rejects invalid infirmary visits before touching patient records", async () => {
    const transaction = vi.spyOn(prisma, "$transaction");
    const res = response();

    await handler("post", "/infirmary-visits")({ auth: { userId: "nurse-1", role: "NURSE" }, body: { record: { firstName: "A" } } }, res);

    expect(res.statusCode).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid medicine dispensing quantities", async () => {
    const transaction = vi.spyOn(prisma, "$transaction");
    const res = response();

    await handler("post", "/infirmary-visits")({
      auth: { userId: "nurse-1", role: "NURSE" },
      body: { record: {
        firstName: "A", lastName: "B", symptom: "Headache", status: "normal", createdAt: "2026-10-04T10:00:00.000Z",
        medications: [{ code: "MED-1", quantity: 0 }],
      } },
    }, res);

    expect(res.statusCode).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects malformed visit payloads, out-of-range patient measurements, and oversized medication lists", async () => {
    const transaction = vi.spyOn(prisma, "$transaction");
    const base = { firstName: "Ada", lastName: "Nurse", symptom: "Headache", status: "normal", createdAt: "2026-10-04T10:00:00.000Z" };
    const invalidRecords = [
      [],
      { ...base, studentId: "s".repeat(81) },
      { ...base, age: "151" },
      { ...base, weight: "1.111" },
      { ...base, medications: {} },
      { ...base, medications: Array(51).fill({ code: "M1", quantity: 1 }) },
      { ...base, medications: [{ code: "M1", quantity: Number.MAX_SAFE_INTEGER }, { code: "M1", quantity: Number.MAX_SAFE_INTEGER }] },
    ];
    for (const record of invalidRecords) {
      const res = response();
      await handler("post", "/infirmary-visits")({ auth: { userId: "nurse-1", role: "NURSE" }, body: { record } }, res);
      expect(res.statusCode).toBe(400);
    }
    expect(transaction).not.toHaveBeenCalled();
  });

  it("maps missing and ambiguous medicine names to client and conflict errors", async () => {
    const makeTx = (matches) => ({
      user: { findUnique: vi.fn().mockResolvedValue({ id: "nurse-1", email: "nurse@example.com" }) },
      dutyShift: { findUnique: vi.fn().mockResolvedValue(null) },
      legacyStorage: { upsert: vi.fn(), findUnique: vi.fn().mockResolvedValue({ value: [] }) },
      $queryRaw: vi.fn(),
      patientMedication: { findMany: vi.fn().mockResolvedValue([]) },
      catalog: { findMany: vi.fn().mockResolvedValue(matches) },
      patient: { create: vi.fn() },
    });
    const record = { firstName: "Ada", lastName: "Nurse", symptom: "Cut", status: "normal", createdAt: "2026-10-04T10:00:00.000Z", medications: [{ name: "Bandage", quantity: 1 }] };
    for (const [matches, expected] of [[[], 400], [[{ id: "c1" }, { id: "c2" }], 409]]) {
      vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(makeTx(matches)));
      vi.spyOn(console, "error").mockImplementation(() => {});
      const res = response();
      await handler("post", "/infirmary-visits")({ auth: { userId: "nurse-1", role: "NURSE" }, body: { record } }, res);
      expect(res.statusCode).toBe(expected);
      vi.restoreAllMocks();
    }
  });

  it("persists a visit, patient history, and legacy snapshot transactionally", async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: "nurse-1", email: "nurse@example.com", name: "Nurse One", firstName: "Nurse", lastName: "One", nickname: "N" }) },
      dutyShift: { findUnique: vi.fn().mockResolvedValue(null) },
      legacyStorage: { upsert: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue({ value: [] }) },
      $queryRaw: vi.fn().mockResolvedValue([]),
      patientMedication: { findMany: vi.fn().mockResolvedValue([]) },
      patient: { create: vi.fn().mockResolvedValue({ id: "patient-1" }) },
    };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(tx));
    const res = response();
    await handler("post", "/infirmary-visits")({ auth: { userId: "nurse-1", uid: "nurse-1", email: "nurse@example.com", role: "NURSE" }, body: { record: {
      firstName: "Ada", lastName: "Nurse", symptom: "Headache", status: "normal", createdAt: "2026-10-04T10:00:00.000Z", visitorType: "student", age: "20",
    } } }, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.patientId).toBe("patient-1");
    expect(tx.patient.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: "Ada Nurse", status: "normal" }) }));
    expect(tx.legacyStorage.upsert).toHaveBeenCalledTimes(2);
  });

  it("dispenses catalog stock and saves medicine attribution with storage location", async () => {
    const catalogItem = { id: "catalog-1", code: "MED-1", name: "Bandage", unit: "box", total: 10, remaining: 10, storageLocation: "Cabinet A" };
    const afterDispensing = { id: "catalog-1", total: 10, remaining: 1 };
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: "nurse-1", email: "nurse@example.com", firstName: "Nurse", lastName: "One" }) },
      dutyShift: { findUnique: vi.fn().mockResolvedValue({ id: "shift-1", userId: "nurse-1", firstName: "Nurse", lastName: "One", nickname: "N" }) },
      legacyStorage: { upsert: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue({ value: [] }) },
      $queryRaw: vi.fn().mockResolvedValue([]),
      patientMedication: { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      catalog: {
        findUnique: vi.fn().mockResolvedValueOnce(catalogItem).mockResolvedValueOnce(afterDispensing),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
      patient: { create: vi.fn().mockResolvedValue({ id: "patient-1" }) },
    };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(tx));
    const res = response();
    await handler("post", "/infirmary-visits")({ auth: { userId: "nurse-1", uid: "nurse-1", email: "nurse@example.com", role: "NURSE" }, body: { record: {
      firstName: "Ada", lastName: "Nurse", symptom: "Cut", status: "observe", createdAt: "2026-10-04T10:00:00.000Z", medications: [{ code: "MED-1", quantity: 2 }],
    } } }, res);
    expect(res.statusCode).toBe(201);
    expect(tx.catalog.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { used: { increment: 2 }, remaining: { decrement: 2 } } }));
    expect(tx.patientMedication.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ storageLocation: "Cabinet A", quantity: 2 })] });
    expect(res.body.data.records[0].medicines[0]).toMatchObject({ storageLocation: "Cabinet A", name: "Bandage" });
  });

  it("rejects unavailable medicine stock without creating patient rows", async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: "nurse-1", email: "nurse@example.com" }) },
      dutyShift: { findUnique: vi.fn().mockResolvedValue(null) },
      legacyStorage: { upsert: vi.fn(), findUnique: vi.fn().mockResolvedValue({ value: [] }) },
      $queryRaw: vi.fn(), patientMedication: { findMany: vi.fn().mockResolvedValue([]) },
      catalog: { findUnique: vi.fn().mockResolvedValue({ id: "c1", code: "M1", name: "Bandage", unit: "box", total: 2, remaining: 2 }), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      patient: { create: vi.fn() },
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(tx));
    const res = response();
    await handler("post", "/infirmary-visits")({ auth: { userId: "nurse-1", role: "NURSE" }, body: { record: {
      firstName: "Ada", lastName: "Nurse", symptom: "Cut", status: "normal", createdAt: "2026-10-04T10:00:00.000Z", medications: [{ code: "M1", quantity: 3 }],
    } } }, res);
    expect(res.statusCode).toBe(409);
    expect(tx.patient.create).not.toHaveBeenCalled();
  });

  it("blocks nurses from writing keys outside their allowed set", async () => {
    const upsert = vi.spyOn(prisma.legacyStorage, "upsert");
    const res = response();

    await handler("put", "/legacy-storage/:key")({ params: { key: "admin-secrets" }, auth: { role: "NURSE" }, body: { value: "x" } }, res);

    expect(res.statusCode).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("persists a permitted shared storage key", async () => {
    const saved = { key: "fms-order-title", value: "October orders" };
    const upsert = vi.spyOn(prisma.legacyStorage, "upsert").mockResolvedValue(saved);
    const res = response();

    await handler("put", "/legacy-storage/:key")({ params: { key: saved.key }, auth: { role: "NURSE" }, body: { value: saved.value } }, res);

    expect(res.body).toEqual({ success: true, data: saved });
    expect(upsert).toHaveBeenCalledWith({ where: { key: saved.key }, create: saved, update: { value: saved.value } });
  });

  it("protects and merges a nurse's own duty profile and shift rows", async () => {
    const profileUpsert = vi.spyOn(prisma.legacyStorage, "upsert").mockResolvedValue({ key: "fms-duty-profiles" });
    vi.spyOn(prisma.legacyStorage, "findUnique").mockResolvedValueOnce({ value: { "nurse@example.com": { uid: "nurse-1", firstName: "Old" }, "other@example.com": { uid: "other", firstName: "Other" } } });
    const profile = response();
    await handler("put", "/legacy-storage/:key")({ params: { key: "fms-duty-profiles" }, auth: { role: "NURSE", uid: "nurse-1", email: "nurse@example.com" }, body: { value: { "nurse@example.com": { uid: "nurse-1", firstName: "New" } } } }, profile);
    expect(profile.body.success).toBe(true);
    expect(profileUpsert).toHaveBeenCalledWith(expect.objectContaining({ update: { value: expect.objectContaining({ "other@example.com": { uid: "other", firstName: "Other" }, "nurse@example.com": { uid: "nurse-1", firstName: "New" } }) } }));

    const mismatched = response();
    await handler("put", "/legacy-storage/:key")({ params: { key: "fms-duty-profiles" }, auth: { role: "NURSE", uid: "nurse-1", email: "nurse@example.com" }, body: { value: { "nurse@example.com": { uid: "other" } } } }, mismatched);
    expect(mismatched.statusCode).toBe(403);

    vi.spyOn(prisma.legacyStorage, "findUnique").mockResolvedValue({ value: [{ uid: "other", date: "2026-10-04", colorId: "color-1" }] });
    const shifts = response();
    await handler("put", "/legacy-storage/:key")({ params: { key: "fms-local-duty-records" }, auth: { role: "NURSE", uid: "nurse-1" }, body: { value: [{ uid: "other", date: "2026-10-04", colorId: "color-1" }, { uid: "nurse-1", date: "2026-10-05", colorId: "color-2" }] } }, shifts);
    expect(shifts.body.success).toBe(true);
    expect(profileUpsert).toHaveBeenCalledWith(expect.objectContaining({ update: { value: expect.arrayContaining([{ uid: "other", date: "2026-10-04", colorId: "color-1" }, { uid: "nurse-1", date: "2026-10-05", colorId: "color-2" }]) } }));

    const tampered = response();
    await handler("put", "/legacy-storage/:key")({ params: { key: "fms-local-duty-records" }, auth: { role: "NURSE", uid: "nurse-1" }, body: { value: [{ uid: "other", date: "2026-10-06", colorId: "color-3" }] } }, tampered);
    expect(tampered.statusCode).toBe(403);
  });

  it("synchronizes current patient statuses when visit history is replaced", async () => {
    const transaction = {
      legacyStorage: { upsert: vi.fn().mockResolvedValue({ key: "fms-infirmary-visits" }) },
      patient: {
        findMany: vi.fn().mockResolvedValue([
          { id: "p1", visitedAt: new Date("2026-10-04T00:00:00Z"), infirmaryHistory: [{ createdAt: "2026-10-04T00:00:00.000Z", status: "normal" }, { createdAt: "old", status: "normal" }] },
          { id: "p2", infirmaryHistory: [{ createdAt: "unrelated", status: "normal" }] },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(transaction));
    const res = response();
    const visit = { createdAt: "2026-10-04T00:00:00.000Z", status: "refer", hospitalName: "City Hospital", symptom: "Cut", sys: "120", dia: "80", pr: "70" };
    await handler("put", "/legacy-storage/:key")({ params: { key: "fms-infirmary-visits" }, auth: { role: "ADMIN" }, body: { value: [visit] } }, res);
    expect(res.body.success).toBe(true);
    expect(transaction.patient.update).toHaveBeenCalledOnce();
    expect(transaction.patient.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1" }, data: expect.objectContaining({ status: "refer", hospitalName: "City Hospital", symptom: "Cut" }) }));
  });

  it("keeps patient rows unchanged when visits do not match or have invalid timestamps", async () => {
    const transaction = {
      legacyStorage: { upsert: vi.fn().mockResolvedValue({ key: "fms-infirmary-visits" }) },
      patient: {
        findMany: vi.fn().mockResolvedValue([
          { id: "unmatched", infirmaryHistory: [{ createdAt: "2026-10-03T00:00:00.000Z", status: "normal" }] },
          { id: "invalid-date", infirmaryHistory: [{ createdAt: "not-a-date", status: "normal" }] },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(transaction));
    const res = response();
    await handler("put", "/legacy-storage/:key")({
      params: { key: "fms-infirmary-visits" }, auth: { role: "ADMIN" },
      body: { value: [{ createdAt: "not-a-date", status: "observe" }, { createdAt: "2026-10-04T00:00:00.000Z", status: "invalid" }] },
    }, res);

    expect(res.body.success).toBe(true);
    expect(transaction.patient.update).toHaveBeenCalledOnce();
    expect(transaction.patient.update).toHaveBeenCalledWith({
      where: { id: "invalid-date" },
      data: { infirmaryHistory: [{ createdAt: "not-a-date", status: "observe" }] },
    });
  });

  it("treats deleting a missing allowed storage key as success", async () => {
    vi.spyOn(prisma.legacyStorage, "delete").mockRejectedValue(Object.assign(new Error("missing"), { code: "P2025" }));
    const res = response();

    await handler("delete", "/legacy-storage/:key")({ params: { key: "fms-borrow-products" }, auth: { role: "NURSE" } }, res);

    expect(res.body).toEqual({ success: true });
  });

  it("clears catalog records through the shared delete endpoint and handles clear errors", async () => {
    const clear = vi.spyOn(catalogRouter, "syncRecords").mockResolvedValue([]);
    const res = response();
    await handler("delete", "/legacy-storage/:key")({ params: { key: "fms-stock-records" }, auth: { role: "ADMIN" } }, res);
    expect(res.body).toEqual({ success: true });
    expect(clear).toHaveBeenCalledWith([]);

    vi.spyOn(console, "error").mockImplementation(() => {});
    clear.mockRejectedValue(new Error("database unavailable"));
    const failed = response();
    await handler("delete", "/legacy-storage/:key")({ params: { key: "fms-stock-records" }, auth: { role: "ADMIN" } }, failed);
    expect(failed.statusCode).toBe(503);
  });

  it("rejects overlong legacy keys", async () => {
    const res = response();
    await handler("put", "/legacy-storage/:key")({ params: { key: "x".repeat(121) }, auth: { role: "ADMIN" }, body: { value: 1 } }, res);
    expect(res.statusCode).toBe(400);
  });
});
