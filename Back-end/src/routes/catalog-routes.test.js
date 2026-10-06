import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const router = require("./catalog.js");
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

const request = (body = {}) => ({
  body,
  protocol: "http",
  get: (name) => name === "host" ? "localhost:4000" : "",
});

function catalogRow(overrides = {}) {
  return {
    code: "MED-001",
    name: "Bandage",
    productName: null,
    genericName: null,
    category: "First aid",
    form: null,
    size: null,
    unit: "box",
    storageLocation: "Cabinet A",
    total: 20,
    used: 3,
    remaining: 17,
    status: "Available",
    benefit: null,
    symptom: null,
    usage: null,
    warning: null,
    expiry: null,
    imageUrl: null,
    imageData: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    ...overrides,
  };
}

function imageResponse() {
  return {
    headers: {},
    set(name, value) { this.headers[name] = value; return this; },
    send(value) { this.body = value; return this; },
    sendStatus(code) { this.statusCode = code; return this; },
    redirect(code, url) { this.statusCode = code; this.redirectUrl = url; return this; },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("catalog API routes", () => {
  it("returns serialized catalog rows", async () => {
    vi.spyOn(prisma.catalog, "findMany").mockResolvedValue([catalogRow()]);
    const res = response();

    await handler("get", "/")(request(), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data[0]).toMatchObject({ code: "MED-001", storageLocation: "Cabinet A", remaining: 17 });
  });

  it("creates a valid catalog record", async () => {
    vi.spyOn(prisma.catalog, "create").mockResolvedValue(catalogRow());
    const res = response();

    await handler("post", "/")(request({ record: {
      code: "MED-001", name: "Bandage", category: "First aid", unit: "box",
      total: 20, used: 3, storageLocation: "Cabinet A",
    } }), res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toMatchObject({ code: "MED-001", storageLocation: "Cabinet A" });
    expect(prisma.catalog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ storageLocation: "Cabinet A", remaining: 17 }) });
  });

  it("rejects a catalog record with missing required fields", async () => {
    const create = vi.spyOn(prisma.catalog, "create");
    const res = response();

    await handler("post", "/")(request({ record: { code: "", name: "", category: "" } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("reports catalog read failures without exposing database errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma.catalog, "findMany").mockRejectedValue(new Error("database unavailable"));
    const res = response();
    await handler("get", "/")(request(), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.success).toBe(false);
  });

  it("retries a duplicate generated code using the next available number", async () => {
    vi.spyOn(prisma.catalog, "create")
      .mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "P2002" }))
      .mockResolvedValueOnce(catalogRow({ code: "MED-002" }));
    vi.spyOn(prisma.catalog, "findMany").mockResolvedValue([{ code: "MED-001" }]);
    const res = response();
    await handler("post", "/")(request({ record: { code: "MED-001", name: "Bandage", category: "First aid" } }), res);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.code).toBe("MED-002");
    expect(prisma.catalog.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ code: "MED-002" }) });
  });

  it("preserves server storage location when synchronizing older client records", async () => {
    const tx = {
      catalog: {
        findUnique: vi.fn().mockResolvedValue({ storageLocation: "Cold storage" }),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([catalogRow({ storageLocation: "Cold storage" })]),
      },
    };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(tx));
    const res = response();
    await handler("put", "/")(request({ records: [{ code: "MED-001", name: "Bandage", category: "First aid", total: 4, used: 1 }] }), res);
    expect(res.body.success).toBe(true);
    expect(tx.catalog.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ storageLocation: "Cold storage" }) }));
    expect(tx.catalog.deleteMany).toHaveBeenCalled();
  });

  it("serves stored image bytes and redirects remote images", async () => {
    const findUnique = vi.spyOn(prisma.catalog, "findUnique");
    const bytes = Buffer.from("image");
    findUnique.mockResolvedValueOnce({ imageData: bytes, imageMimeType: "image/png", imageUrl: "/api/catalog/MED-001/image" });
    const image = imageResponse();
    await handler("get", "/:code/image")({ params: { code: "MED-001" } }, image);
    expect(image.body).toEqual(bytes);
    expect(image.headers["Content-Type"]).toBe("image/png");
    expect(image.headers["Cross-Origin-Resource-Policy"]).toBe("cross-origin");

    findUnique.mockResolvedValueOnce({ imageData: null, imageUrl: "https://cdn.example.com/medicine.png" });
    const redirect = imageResponse();
    await handler("get", "/:code/image")({ params: { code: "MED-002" } }, redirect);
    expect(redirect.statusCode).toBe(302);
    expect(redirect.redirectUrl).toContain("cdn.example.com");
  });

  it("returns not found or unavailable when a catalog image cannot be loaded", async () => {
    const findUnique = vi.spyOn(prisma.catalog, "findUnique").mockResolvedValueOnce(null).mockResolvedValueOnce({ imageData: null, imageUrl: null }).mockRejectedValueOnce(new Error("database unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const expected of [404, 404, 503]) {
      const res = imageResponse();
      await handler("get", "/:code/image")({ params: { code: "MED-001" } }, res);
      expect(res.statusCode).toBe(expected);
    }
    expect(findUnique).toHaveBeenCalledTimes(3);
  });

  it("validates catalog updates and preserves server image data for local image URLs", async () => {
    const invalid = response();
    await handler("put", "/")(request({ records: [{ code: "MED-001", name: "Bandage", category: "First aid", image: "javascript:alert(1)" }] }), invalid);
    expect(invalid.statusCode).toBe(400);

    const imageData = Buffer.from("persisted image");
    const tx = {
      catalog: {
        findUnique: vi.fn().mockResolvedValueOnce({ storageLocation: "Cold storage" }).mockResolvedValueOnce({ imageData, imageMimeType: "image/png" }),
        upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn().mockResolvedValue([catalogRow()]),
      },
    };
    vi.spyOn(prisma, "$transaction").mockImplementation((callback) => callback(tx));
    const saved = response();
    await handler("put", "/")(request({ records: [{ code: "MED-001", name: "Bandage", category: "First aid", image: "http://localhost:4000/api/catalog/MED-001/image" }] }), saved);
    expect(saved.body.success).toBe(true);
    expect(tx.catalog.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ storageLocation: "Cold storage", imageData, imageMimeType: "image/png" }) }));
  });

  it("rejects duplicate sync rows and reports create conflicts and database failures", async () => {
    const duplicate = response();
    const input = { code: "MED-001", name: "Bandage", category: "First aid" };
    await handler("put", "/")(request({ records: [input, input] }), duplicate);
    expect(duplicate.statusCode).toBe(400);

    vi.spyOn(prisma.catalog, "create").mockRejectedValue(Object.assign(new Error("duplicate"), { code: "P2002" }));
    vi.spyOn(prisma.catalog, "findMany").mockResolvedValue([]);
    const conflict = response();
    await handler("post", "/")(request({ record: input }), conflict);
    expect(conflict.statusCode).toBe(409);

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma.catalog, "create").mockRejectedValue(new Error("database unavailable"));
    const failed = response();
    await handler("post", "/")(request({ record: input }), failed);
    expect(failed.statusCode).toBe(503);
  });
});
