import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const router = require("./health.js");

it("returns a healthy API status and timestamp", () => {
  const handler = router.stack[0].route.stack[0].handle;
  const res = { body: undefined, json(body) { this.body = body; return this; } };

  handler({}, res);

  expect(res.body.success).toBe(true);
  expect(res.body.service).toBe("fms-api");
  expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
});

describe("database health route", () => {
  const databaseRouter = require("./database.js");
  const prisma = require("../lib/prisma.js");
  const databaseHandler = databaseRouter.stack[0].route.stack[0].handle;

  afterEach(() => vi.restoreAllMocks());

  it("reports a connected PostgreSQL database", async () => {
    vi.spyOn(prisma, "$queryRaw").mockResolvedValue([{ "?column?": 1 }]);
    const res = { body: undefined, json(body) { this.body = body; return this; }, status() { return this; } };

    await databaseHandler({}, res);

    expect(res.body).toEqual({ success: true, database: "postgresql", status: "connected" });
  });

  it("reports a disconnected database when the query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma, "$queryRaw").mockRejectedValue(new Error("connection refused"));
    const res = {
      statusCode: 200,
      body: undefined,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };

    await databaseHandler({}, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ success: false, database: "postgresql", status: "disconnected" });
  });
});
