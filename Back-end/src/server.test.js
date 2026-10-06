import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { app, startServer } = require("./server.js");
const prisma = require("./lib/prisma.js");
let server;

async function openServer() {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

afterEach(async () => {
  vi.restoreAllMocks();
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  server = undefined;
});

describe("API server", () => {
  it("serves the root status without exposing the Express header", async () => {
    const response = await fetch(await openServer());
    expect(response.status).toBe(200);
    expect(response.headers.get("x-powered-by")).toBeNull();
    expect(await response.json()).toEqual({ name: "FMS API", status: "running", version: "1.0.0" });
  });

  it.each(["http://localhost:3001", "http://10.1.2.3:8080"])("accepts trusted origin %s", async (origin) => {
    const response = await fetch(await openServer(), { headers: { Origin: origin } });
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("rejects an untrusted origin through the error handler", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await fetch(await openServer(), { headers: { Origin: "https://attacker.example" } });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false });
  });

  it("serves health publicly, requires sessions for protected routes, and returns JSON 404s", async () => {
    const base = await openServer();
    expect((await fetch(`${base}/api/health`)).status).toBe(200);
    const protectedResponse = await fetch(`${base}/api/users`);
    expect(protectedResponse.status).toBe(401);
    expect((await protectedResponse.json()).message).toBe("Authentication required");
    const missing = await fetch(`${base}/missing`);
    expect(missing.status).toBe(404);
    const missingBody = await missing.json();
    expect(missingBody.success).toBe(false);
    const missingPublicApiRoute = await fetch(`${base}/api/auth/unknown`);
    expect(missingPublicApiRoute.status).toBe(404);
    expect(await missingPublicApiRoute.json()).toEqual(missingBody);
  });

  it("seeds nurse names before listening", async () => {
    const fakeServer = { listening: true };
    vi.spyOn(prisma.nurse, "createMany").mockResolvedValue({ count: 10 });
    vi.spyOn(app, "listen").mockImplementation((_port, callback) => { callback(); return fakeServer; });
    vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(startServer()).resolves.toBe(fakeServer);
    expect(prisma.nurse.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([expect.objectContaining({ fullName: expect.any(String) })]),
      skipDuplicates: true,
    });
    expect(prisma.nurse.createMany.mock.calls[0][0].data).toHaveLength(10);
    expect(app.listen).toHaveBeenCalledOnce();
  });

  it("exits when nurse seeding fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => undefined);
    vi.spyOn(prisma.nurse, "createMany").mockRejectedValue(new Error("seed failed"));
    await expect(startServer()).resolves.toBeUndefined();
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
