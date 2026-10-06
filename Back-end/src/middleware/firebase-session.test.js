import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { requireRole, requireCsrfForUnsafeMethods, setSessionCookies, clearSessionCookies, upsertFirebaseUser } = require("./firebase-session.js");
const prisma = require("../lib/prisma.js");

function response() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: undefined,
    headers,
    getHeader: (name) => headers.get(name),
    setHeader: (name, value) => headers.set(name, value),
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.FMS_ADMIN_EMAILS;
});

describe("session and role middleware", () => {
  it("rejects a request without an authenticated user", () => {
    const res = response();
    const next = vi.fn();

    requireRole("ADMIN")({}, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects roles that are not allowed and allows a matching role", () => {
    const denied = response();
    const next = vi.fn();
    requireRole("ADMIN")({ auth: { role: "NURSE" } }, denied, next);
    expect(denied.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();

    const allowed = vi.fn();
    requireRole("ADMIN", "NURSE")({ auth: { role: "NURSE" } }, response(), allowed);
    expect(allowed).toHaveBeenCalledOnce();
  });

  it("skips CSRF checks for safe methods", () => {
    const next = vi.fn();
    requireCsrfForUnsafeMethods({ method: "GET" }, response(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("accepts matching session, cookie and header CSRF tokens", () => {
    const res = response();
    const csrf = setSessionCookies(res, "test-session");
    const next = vi.fn();
    const req = {
      method: "POST",
      headers: { cookie: `fms_session=test-session; fms_csrf=${csrf}` },
      get: (name) => name === "X-FMS-CSRF" ? csrf : "",
    };

    requireCsrfForUnsafeMethods(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.getHeader("Set-Cookie")).toHaveLength(2);
  });

  it("rejects an invalid CSRF token", () => {
    const res = response();
    const next = vi.fn();
    requireCsrfForUnsafeMethods({
      method: "DELETE",
      headers: { cookie: "fms_session=test-session; fms_csrf=wrong" },
      get: () => "wrong",
    }, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("CSRF validation failed");
    expect(next).not.toHaveBeenCalled();
  });

  it.each([{ email: "", emailVerified: true }, { email: "user@example.com", emailVerified: false }])("requires verified Firebase email addresses", async (user) => {
    await expect(upsertFirebaseUser({ uid: "f1", ...user })).rejects.toMatchObject({ status: 403 });
  });

  it("creates a configured admin and restores a missing profile from a duty shift", async () => {
    process.env.FMS_ADMIN_EMAILS = " ADMIN@example.com, other@example.com ";
    vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);
    vi.spyOn(prisma.user, "create").mockResolvedValue({ id: "f1", firstName: "A" });
    const created = await upsertFirebaseUser({ uid: "f1", email: "admin@example.com", emailVerified: true, displayName: "Admin" });
    expect(prisma.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ role: "ADMIN", email: "admin@example.com" }) });
    expect(created.firstName).toBe("A");

    vi.spyOn(prisma.user, "create").mockResolvedValue({ id: "f2", email: "nurse@example.com" });
    vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);
    vi.spyOn(prisma.dutyShift, "findFirst").mockResolvedValue({ firstName: "Nurse", lastName: "One", nickname: "N" });
    vi.spyOn(prisma.user, "update").mockResolvedValue({ id: "f2", firstName: "Nurse", lastName: "One" });
    await upsertFirebaseUser({ uid: "f2", email: "nurse@example.com", emailVerified: true });
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: "Nurse One" }) }));
  });

  it("updates existing users, skips profile restoration, and rejects linked identities", async () => {
    vi.spyOn(prisma.user, "findFirst").mockResolvedValue({ id: "u1", firebaseUid: "f1", name: "Old" });
    vi.spyOn(prisma.user, "update").mockResolvedValue({ id: "u1", firstName: "A" });
    vi.spyOn(prisma.dutyShift, "findFirst");
    await upsertFirebaseUser({ uid: "f1", email: "user@example.com", emailVerified: true, displayName: "New" });
    expect(prisma.dutyShift.findFirst).not.toHaveBeenCalled();

    vi.spyOn(prisma.user, "findFirst").mockResolvedValue({ id: "u2", firebaseUid: "different", email: "user@example.com" });
    await expect(upsertFirebaseUser({ uid: "f1", email: "user@example.com", emailVerified: true })).rejects.toMatchObject({ status: 409 });
  });

  it("clears session cookies and marks cookies secure in production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res = response();
    setSessionCookies(res, "prod-session");
    expect(res.getHeader("Set-Cookie").join(";")).toContain("Secure");
    clearSessionCookies(res);
    expect(res.getHeader("Set-Cookie")).toHaveLength(4);
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  });
});
