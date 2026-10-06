import { createRequire } from "node:module";
import { afterEach, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const modulePath = require.resolve("./prisma.js");
const clientPath = require.resolve("@prisma/client");
const originalClientModule = require.cache[clientPath];
const originalPrismaModule = require.cache[modulePath];
const originalNodeEnv = process.env.NODE_ENV;
const originalGlobalPrisma = globalThis.__fmsPrisma;
const PrismaClient = vi.fn(function PrismaClientMock() { this.connected = true; });

function loadFreshPrisma() {
  delete require.cache[modulePath];
  return require(modulePath);
}

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalGlobalPrisma === undefined) delete globalThis.__fmsPrisma;
  else globalThis.__fmsPrisma = originalGlobalPrisma;
  if (originalClientModule) require.cache[clientPath] = originalClientModule;
  else delete require.cache[clientPath];
  if (originalPrismaModule) require.cache[modulePath] = originalPrismaModule;
  else delete require.cache[modulePath];
  PrismaClient.mockClear();
});

it("does not keep the Prisma client on globalThis in production", () => {
  process.env.NODE_ENV = "production";
  delete globalThis.__fmsPrisma;
  require.cache[clientPath] = { id: clientPath, filename: clientPath, loaded: true, exports: { PrismaClient } };

  const prisma = loadFreshPrisma();

  expect(prisma.connected).toBe(true);
  expect(PrismaClient).toHaveBeenCalledOnce();
  expect(globalThis.__fmsPrisma).toBeUndefined();
});

it("reuses a globally cached client outside production", () => {
  process.env.NODE_ENV = "test";
  const cached = { connected: "cached" };
  globalThis.__fmsPrisma = cached;
  require.cache[clientPath] = { id: clientPath, filename: clientPath, loaded: true, exports: { PrismaClient } };

  expect(loadFreshPrisma()).toBe(cached);
  expect(PrismaClient).not.toHaveBeenCalled();
});
