import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const firebaseAdminPath = require.resolve("../lib/firebase-admin.js");
const sessionPath = require.resolve("./firebase-session.js");
const originalFirebaseAdmin = require.cache[firebaseAdminPath];
const firebaseAuth = { verifySessionCookie: vi.fn().mockResolvedValue({ uid: "firebase-1", email: "nurse@example.com" }) };
require.cache[firebaseAdminPath] = { id: firebaseAdminPath, filename: firebaseAdminPath, loaded: true, exports: { getFirebaseAuth: () => firebaseAuth } };
delete require.cache[sessionPath];
const { requireFirebaseSession } = require(sessionPath);
const prisma = require("../lib/prisma.js");

function response() {
  return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

afterEach(() => vi.restoreAllMocks());

describe("Firebase session verification", () => {
  it("rejects requests without a session cookie", async () => {
    const res = response();
    const next = vi.fn();
    await requireFirebaseSession({ headers: {} }, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches active account identity to the request", async () => {
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue({ id: "user-1", role: "NURSE", isActive: true });
    const req = { headers: { cookie: "fms_session=session%20cookie" } };
    const next = vi.fn();
    await requireFirebaseSession(req, response(), next);
    expect(firebaseAuth.verifySessionCookie).toHaveBeenCalledWith("session cookie", true);
    expect(req.auth).toEqual({ uid: "firebase-1", email: "nurse@example.com", role: "NURSE", userId: "user-1" });
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects inactive or missing accounts and invalid session cookies", async () => {
    vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "u2", role: "NURSE", isActive: false });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = response();
      await requireFirebaseSession({ headers: { cookie: "fms_session=expired" } }, res, vi.fn());
      expect(res.statusCode).toBe(403);
    }
    firebaseAuth.verifySessionCookie.mockRejectedValueOnce(new Error("expired"));
    const invalid = response();
    await requireFirebaseSession({ headers: { cookie: "fms_session=bad" } }, invalid, vi.fn());
    expect(invalid.statusCode).toBe(401);
  });
});
