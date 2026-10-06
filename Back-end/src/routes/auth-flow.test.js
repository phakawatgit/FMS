import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const authPath = require.resolve("./auth.js");
const sessionPath = require.resolve("../middleware/firebase-session.js");
const firebaseAdminPath = require.resolve("../lib/firebase-admin.js");
const nodemailerPath = require.resolve("nodemailer");
const prisma = require("../lib/prisma.js");
const originalAuth = require.cache[authPath];
const originalFirebaseAdmin = require.cache[firebaseAdminPath];
const originalSession = require.cache[sessionPath];
const originalNodemailer = require.cache[nodemailerPath];
const originalEnvironment = { ...process.env };
let firebaseAuth;
let router;
let sentMessages;
let issuedOtpData;
let mailSender;

function setupRouter() {
  sentMessages = [];
  issuedOtpData = null;
  firebaseAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-1" }),
    getUser: vi.fn().mockResolvedValue({ uid: "firebase-1", email: "user@example.com", emailVerified: false }),
    getUserByEmail: vi.fn().mockResolvedValue({ uid: "firebase-1", email: "user@example.com" }),
    updateUser: vi.fn().mockResolvedValue({}),
    createSessionCookie: vi.fn().mockResolvedValue("session-cookie"),
  };
  require.cache[firebaseAdminPath] = { id: firebaseAdminPath, filename: firebaseAdminPath, loaded: true, exports: { getFirebaseAuth: () => firebaseAuth } };
  require.cache[sessionPath] = {
    id: sessionPath, filename: sessionPath, loaded: true,
    exports: {
      SESSION_MAX_AGE_MS: 1000,
      clearSessionCookies: (res) => res.setHeader("Set-Cookie", ["fms_session=", "fms_csrf="]),
      requireCsrfForUnsafeMethods: (_req, _res, next) => next(),
      requireFirebaseSession: (req, _res, next) => { req.auth ||= { userId: "db-user-1" }; next(); },
      setSessionCookies: (res) => { res.setHeader("Set-Cookie", ["fms_session=mock", "fms_csrf=mock"]); return "csrf-mock"; },
      upsertFirebaseUser: vi.fn().mockResolvedValue({ id: "db-user-1", email: "user@example.com", name: "User", firstName: "Test", role: "NURSE" }),
    },
  };
  mailSender = vi.fn(async (message) => sentMessages.push(message));
  require.cache[nodemailerPath] = { id: nodemailerPath, filename: nodemailerPath, loaded: true, exports: { createTransport: vi.fn(() => ({ sendMail: mailSender })) } };
  delete require.cache[authPath];
  router = require(authPath);
  process.env.SMTP_HOST = "smtp.example.test";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_USER = "fms@example.test";
  process.env.SMTP_PASS = "test-password";
  process.env.OTP_HASH_SECRET = "test-secret";
}

function handler(method, path) {
  const route = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  return route.route.stack.at(-1).handle;
}

function response() {
  const headers = {};
  return {
    statusCode: 200, body: undefined, headers,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    getHeader(name) { return headers[name]; },
    setHeader(name, value) { headers[name] = value; return this; },
  };
}

const request = (body = {}, authorization = "Bearer test-token") => ({ body, get: (name) => name === "Authorization" ? authorization : "" });

beforeEach(() => setupRouter());
afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnvironment };
  delete require.cache[authPath];
  if (originalAuth) require.cache[authPath] = originalAuth;
  if (originalFirebaseAdmin) require.cache[firebaseAdminPath] = originalFirebaseAdmin;
  else delete require.cache[firebaseAdminPath];
  if (originalSession) require.cache[sessionPath] = originalSession;
  else delete require.cache[sessionPath];
  if (originalNodemailer) require.cache[nodemailerPath] = originalNodemailer;
  else delete require.cache[nodemailerPath];
});

describe("authentication and OTP workflows", () => {
  it("returns the current profile, reports lookup errors and clears session cookies on logout", async () => {
    const profile = { id: "db-user-1", email: "user@example.com", name: "A User", role: "NURSE" };
    vi.spyOn(prisma.user, "findUnique").mockResolvedValue(profile);
    const profileRes = response();
    await handler("get", "/session")({ auth: { userId: profile.id } }, profileRes);
    expect(profileRes.body.data.user).toEqual(profile);

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(prisma.user, "findUnique").mockRejectedValue(new Error("database unavailable"));
    const failed = response();
    await handler("get", "/session")({ auth: { userId: profile.id } }, failed);
    expect(failed.statusCode).toBe(503);

    const loggedOut = response();
    await handler("post", "/session/logout")({}, loggedOut);
    expect(loggedOut.body).toEqual({ success: true });
    expect(loggedOut.headers["Set-Cookie"]).toEqual(["fms_session=", "fms_csrf="]);
  });

  it("establishes a Firebase session and returns the profile with CSRF cookies", async () => {
    firebaseAuth.getUser.mockResolvedValue({ uid: "firebase-1", email: "user@example.com", emailVerified: true });
    const sessionRes = response();
    await handler("post", "/session")(request(), sessionRes);
    expect(sessionRes.body.success).toBe(true);
    expect(sessionRes.headers["Set-Cookie"]).toHaveLength(2);

    vi.spyOn(prisma.user, "findUnique").mockResolvedValue({ id: "db-user-1", email: "user@example.com", role: "NURSE" });
    const profileRes = response();
    await handler("get", "/session")({ auth: { userId: "db-user-1" } }, profileRes);
    expect(profileRes.body.data.user.id).toBe("db-user-1");
    const logoutRes = response();
    handler("post", "/session/logout")({}, logoutRes);
    expect(logoutRes.headers["Set-Cookie"]).toHaveLength(2);
  });

  it("sends a signup OTP for an unverified account and verifies a matching code", async () => {
    vi.spyOn(prisma.passwordResetOtp, "deleteMany").mockResolvedValue({ count: 0 });
    vi.spyOn(prisma.passwordResetOtp, "create").mockImplementation(async ({ data }) => {
      issuedOtpData = data;
      return data;
    });
    const requestRes = response();
    await handler("post", "/signup/otp/request")(request({}, "Bearer token"), requestRes);
    expect(requestRes.body.success).toBe(true);
    expect(sentMessages).toHaveLength(1);
    const code = sentMessages[0].text.match(/OTP: (\d{6})/)[1];
    expect(issuedOtpData.email).toBe("user@example.com");

    vi.spyOn(prisma.passwordResetOtp, "findFirst").mockResolvedValue({ id: "otp-1", firebaseUid: "firebase-1", codeHash: issuedOtpData.codeHash, expiresAt: new Date(Date.now() + 60_000), attempts: 0 });
    vi.spyOn(prisma.passwordResetOtp, "update").mockResolvedValue({});
    const verifyRes = response();
    await handler("post", "/signup/otp/verify")(request({ code }), verifyRes);
    expect(verifyRes.body.success).toBe(true);
    expect(firebaseAuth.updateUser).toHaveBeenCalledWith("firebase-1", { emailVerified: true });
  });

  it("returns a generic reset response for unknown accounts and counts wrong OTP attempts", async () => {
    firebaseAuth.getUserByEmail.mockRejectedValueOnce(new Error("not found"));
    const unknownRes = response();
    await handler("post", "/password-reset/otp/request")({ body: { email: " MISSING@example.com " } }, unknownRes);
    expect(unknownRes.body.success).toBe(true);

    vi.spyOn(prisma.passwordResetOtp, "findFirst").mockResolvedValue({ id: "otp-2", codeHash: "different", expiresAt: new Date(Date.now() + 30_000), attempts: 0 });
    const update = vi.spyOn(prisma.passwordResetOtp, "update").mockResolvedValue({});
    const verifyRes = response();
    await handler("post", "/password-reset/otp/verify")({ body: { email: " User@Example.com ", code: "123456" } }, verifyRes);
    expect(verifyRes.statusCode).toBe(400);
    expect(update).toHaveBeenCalledWith({ where: { id: "otp-2" }, data: { attempts: { increment: 1 } } });
  });

  it("completes a reset using a valid token and rejects an expired token", async () => {
    vi.spyOn(prisma.passwordResetOtp, "findFirst").mockResolvedValueOnce({ id: "otp-3", firebaseUid: "firebase-1", resetTokenExpiresAt: new Date(Date.now() + 60_000) });
    vi.spyOn(prisma.passwordResetOtp, "delete").mockResolvedValue({});
    const successRes = response();
    await handler("post", "/password-reset/complete")({ body: { email: "user@example.com", resetToken: "valid", password: "new-pass" } }, successRes);
    expect(firebaseAuth.updateUser).toHaveBeenCalledWith("firebase-1", { password: "new-pass" });
    expect(successRes.body.success).toBe(true);

    vi.spyOn(prisma.passwordResetOtp, "findFirst").mockResolvedValueOnce({ id: "otp-4", resetTokenExpiresAt: new Date(Date.now() - 1000) });
    const expiredRes = response();
    await handler("post", "/password-reset/complete")({ body: { email: "user@example.com", resetToken: "expired", password: "new-pass" } }, expiredRes);
    expect(expiredRes.statusCode).toBe(400);
  });

  it("rejects missing credentials, invalid OTPs, expired OTPs, and locked OTPs", async () => {
    const noSession = response();
    await handler("post", "/session")(request({}, ""), noSession);
    expect(noSession.statusCode).toBe(401);
    const badSignupCode = response();
    await handler("post", "/signup/otp/verify")(request({ code: "123" }), badSignupCode);
    expect(badSignupCode.statusCode).toBe(400);
    const noEmail = response();
    await handler("post", "/password-reset/otp/request")({ body: { email: " " } }, noEmail);
    expect(noEmail.statusCode).toBe(400);

    const find = vi.spyOn(prisma.passwordResetOtp, "findFirst");
    find.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "expired", expiresAt: new Date(Date.now() - 1), attempts: 0 }).mockResolvedValueOnce({ id: "locked", expiresAt: new Date(Date.now() + 60_000), attempts: 5 });
    for (const id of ["missing", "expired", "locked"]) {
      const res = response();
      await handler("post", "/password-reset/otp/verify")({ body: { email: "user@example.com", code: "123456" } }, res);
      expect(res.statusCode).toBe(400);
    }
  });

  it("cleans up an OTP if email delivery fails and reports an unconfigured SMTP server", async () => {
    const deleteMany = vi.spyOn(prisma.passwordResetOtp, "deleteMany").mockResolvedValue({ count: 1 });
    vi.spyOn(prisma.passwordResetOtp, "create").mockImplementation(async ({ data }) => data);
    mailSender.mockRejectedValueOnce(new Error("mail relay down"));
    const failedDelivery = response();
    await handler("post", "/signup/otp/request")(request({}, "Bearer token"), failedDelivery);
    expect(failedDelivery.statusCode).toBe(503);
    expect(deleteMany).toHaveBeenCalledTimes(2);

    process.env.SMTP_HOST = "";
    const unconfigured = response();
    await handler("post", "/password-reset/otp/request")({ body: { email: "user@example.com" } }, unconfigured);
    expect(unconfigured.statusCode).toBe(503);
    expect(unconfigured.body.message).toContain("SMTP");
  });

  it("issues password reset tokens only after a matching OTP and rejects short passwords", async () => {
    const otp = { id: "otp-reset", expiresAt: new Date(Date.now() + 60_000), attempts: 0, codeHash: "" };
    const email = "user@example.com";
    const crypto = require("node:crypto");
    otp.codeHash = crypto.createHmac("sha256", process.env.OTP_HASH_SECRET).update(`${email}:123456`).digest("hex");
    vi.spyOn(prisma.passwordResetOtp, "findFirst").mockResolvedValue(otp);
    const update = vi.spyOn(prisma.passwordResetOtp, "update").mockResolvedValue({});
    const verified = response();
    await handler("post", "/password-reset/otp/verify")({ body: { email, code: "123456" } }, verified);
    expect(verified.body.resetToken).toMatch(/^[a-f0-9]{64}$/);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "otp-reset" }, data: expect.objectContaining({ resetTokenHash: expect.any(String) }) }));

    const short = response();
    await handler("post", "/password-reset/complete")({ body: { email, resetToken: "token", password: "123" } }, short);
    expect(short.statusCode).toBe(400);
  });

  it("covers auth service failures, verified or missing signup email, mismatched OTP owners and reset database errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    firebaseAuth.verifyIdToken.mockRejectedValueOnce(Object.assign(new Error("token rejected"), { status: 401 }));
    const rejectedSession = response();
    await handler("post", "/session")(request(), rejectedSession);
    expect(rejectedSession.statusCode).toBe(401);
    expect(rejectedSession.body.message).toBe("token rejected");

    firebaseAuth.getUser.mockResolvedValueOnce({ uid: "firebase-1", email: " ", emailVerified: false });
    const missingSignupEmail = response();
    await handler("post", "/signup/otp/request")(request(), missingSignupEmail);
    expect(missingSignupEmail.statusCode).toBe(400);

    firebaseAuth.getUser.mockResolvedValueOnce({ uid: "firebase-1", email: "user@example.com", emailVerified: true });
    const verifiedSignupEmail = response();
    await handler("post", "/signup/otp/request")(request(), verifiedSignupEmail);
    expect(verifiedSignupEmail.statusCode).toBe(400);

    const crypto = require("node:crypto");
    const validCodeHash = crypto.createHmac("sha256", process.env.OTP_HASH_SECRET).update("user@example.com:123456").digest("hex");
    vi.spyOn(prisma.passwordResetOtp, "findFirst").mockResolvedValue({
      id: "otp-wrong-owner", firebaseUid: "another-user", codeHash: validCodeHash, expiresAt: new Date(Date.now() + 60_000), attempts: 0,
    });
    const wrongOwner = response();
    await handler("post", "/signup/otp/verify")(request({ code: "123456" }), wrongOwner);
    expect(wrongOwner.statusCode).toBe(400);

    vi.spyOn(prisma.passwordResetOtp, "findFirst").mockRejectedValue(new Error("OTP database unavailable"));
    const resetVerifyFailure = response();
    await handler("post", "/password-reset/otp/verify")({ body: { email: "user@example.com", code: "123456" } }, resetVerifyFailure);
    expect(resetVerifyFailure.statusCode).toBe(503);

    const incompleteReset = response();
    await handler("post", "/password-reset/complete")({ body: { email: "user@example.com", resetToken: "", password: "secret" } }, incompleteReset);
    expect(incompleteReset.statusCode).toBe(400);
  });
});
