const express = require("express");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const prisma = require("../lib/prisma");
const { getFirebaseAuth } = require("../lib/firebase-admin");
const {
  clearSessionCookies,
  requireCsrfForUnsafeMethods,
  requireFirebaseSession,
  SESSION_MAX_AGE_MS,
  setSessionCookies,
  upsertFirebaseUser,
} = require("../middleware/firebase-session");

const router = express.Router();
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function bearerToken(req) {
  const authorization = String(req.get("Authorization") || "");
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashValue(value) {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || "fms-local-otp-secret";
  return crypto.createHmac("sha256", secret).update(String(value)).digest("hex");
}

function createOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function createMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw Object.assign(new Error("SMTP is not configured"), { status: 503 });
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

async function issueOtp({ email, firebaseUid, subject, purpose }) {
  const code = createOtp();
  await prisma.passwordResetOtp.deleteMany({ where: { email, verifiedAt: null } });
  await prisma.passwordResetOtp.create({
    data: {
      email,
      firebaseUid,
      codeHash: hashValue(`${email}:${code}`),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  try {
    await createMailer().sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject,
      text: `FMS ${purpose} OTP: ${code}. This code expires in 10 minutes.`,
      html: `<p>รหัส OTP สำหรับ ${purpose} ของ FMS คือ</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>รหัสนี้หมดอายุภายใน 10 นาที</p>`,
    });
  } catch (error) {
    await prisma.passwordResetOtp.deleteMany({ where: { email, codeHash: hashValue(`${email}:${code}`) } });
    throw error;
  }
}

async function findOtp(email, code) {
  const row = await prisma.passwordResetOtp.findFirst({ where: { email, verifiedAt: null }, orderBy: { createdAt: "desc" } });
  if (!row || row.expiresAt < new Date() || row.attempts >= OTP_MAX_ATTEMPTS) return null;
  const valid = hashValue(`${email}:${code}`) === row.codeHash;
  if (!valid) {
    await prisma.passwordResetOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return null;
  }
  return row;
}

router.post("/session", async (req, res) => {
  const idToken = bearerToken(req);
  if (!idToken) return res.status(401).json({ success: false, message: "Firebase ID token is required" });

  try {
    const firebaseAuth = getFirebaseAuth();
    const claims = await firebaseAuth.verifyIdToken(idToken, true);
    const firebaseUser = await firebaseAuth.getUser(claims.uid);
    const user = await upsertFirebaseUser(firebaseUser);
    const sessionCookie = await firebaseAuth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
    const csrfToken = setSessionCookies(res, sessionCookie);
    return res.json({
      success: true,
      data: { user: { id: user.id, uid: firebaseUser.uid, email: user.email, name: user.name, firstName: user.firstName, lastName: user.lastName, nickname: user.nickname, role: user.role }, csrfToken },
    });
  } catch (error) {
    console.error("Firebase session creation failed:", error.message);
    return res.status(error.status || 503).json({ success: false, message: error.status ? error.message : "Could not establish a secure session" });
  }
});

router.post("/signup/otp/request", async (req, res) => {
  const idToken = bearerToken(req);
  if (!idToken) return res.status(401).json({ success: false, message: "Firebase ID token is required" });
  try {
    const claims = await getFirebaseAuth().verifyIdToken(idToken);
    const firebaseUser = await getFirebaseAuth().getUser(claims.uid);
    const email = normalizeEmail(firebaseUser.email);
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });
    if (firebaseUser.emailVerified) return res.status(400).json({ success: false, message: "Email is already verified" });
    await issueOtp({ email, firebaseUid: firebaseUser.uid, subject: "FMS email verification OTP", purpose: "ยืนยันอีเมล" });
    return res.json({ success: true, message: "OTP sent" });
  } catch (error) {
    console.error("Signup OTP request failed:", error.message);
    return res.status(error.status || 503).json({ success: false, message: "ส่ง OTP ไม่สำเร็จ กรุณาลองใหม่" });
  }
});

router.post("/signup/otp/verify", async (req, res) => {
  const idToken = bearerToken(req);
  const code = String(req.body?.code || "").trim();
  if (!idToken || !/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: "OTP ไม่ถูกต้อง" });
  try {
    const claims = await getFirebaseAuth().verifyIdToken(idToken);
    const firebaseUser = await getFirebaseAuth().getUser(claims.uid);
    const email = normalizeEmail(firebaseUser.email);
    const row = await findOtp(email, code);
    if (!row || row.firebaseUid !== firebaseUser.uid) return res.status(400).json({ success: false, message: "OTP ไม่ถูกต้องหรือหมดอายุ" });
    await getFirebaseAuth().updateUser(firebaseUser.uid, { emailVerified: true });
    await prisma.passwordResetOtp.update({ where: { id: row.id }, data: { verifiedAt: new Date() } });
    return res.json({ success: true, message: "Email verified" });
  } catch (error) {
    console.error("Signup OTP verification failed:", error.message);
    return res.status(error.status || 503).json({ success: false, message: "ยืนยัน OTP ไม่สำเร็จ" });
  }
});

router.post("/password-reset/otp/request", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ success: false, message: "กรุณากรอกอีเมล" });
  try {
    let firebaseUser;
    try { firebaseUser = await getFirebaseAuth().getUserByEmail(email); } catch (_error) { return res.json({ success: true, message: "If the account exists, an OTP has been sent" }); }
    await issueOtp({ email, firebaseUid: firebaseUser.uid, subject: "FMS password reset OTP", purpose: "รีเซ็ตรหัสผ่าน" });
    return res.json({ success: true, message: "OTP sent" });
  } catch (error) {
    console.error("Password reset OTP request failed:", error.message);
    return res.status(error.status || 503).json({ success: false, message: "ส่ง OTP ไม่สำเร็จ กรุณาลองใหม่" });
  }
});

router.post("/password-reset/otp/verify", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();
  if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: "ข้อมูล OTP ไม่ถูกต้อง" });
  try {
    const row = await findOtp(email, code);
    if (!row) return res.status(400).json({ success: false, message: "OTP ไม่ถูกต้องหรือหมดอายุ" });
    const resetToken = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetOtp.update({ where: { id: row.id }, data: { verifiedAt: new Date(), resetTokenHash: hashValue(resetToken), resetTokenExpiresAt: new Date(Date.now() + OTP_TTL_MS) } });
    return res.json({ success: true, resetToken });
  } catch (error) {
    console.error("Password reset OTP verification failed:", error.message);
    return res.status(503).json({ success: false, message: "ยืนยัน OTP ไม่สำเร็จ" });
  }
});

router.post("/password-reset/complete", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const resetToken = String(req.body?.resetToken || "");
  const password = String(req.body?.password || "");
  if (!email || !resetToken || password.length < 6) return res.status(400).json({ success: false, message: "ข้อมูลรีเซ็ตรหัสผ่านไม่ถูกต้อง" });
  try {
    const row = await prisma.passwordResetOtp.findFirst({ where: { email, verifiedAt: { not: null }, resetTokenHash: hashValue(resetToken) }, orderBy: { createdAt: "desc" } });
    if (!row || !row.resetTokenExpiresAt || row.resetTokenExpiresAt < new Date()) return res.status(400).json({ success: false, message: "ลิงก์รีเซ็ตหมดอายุ" });
    await getFirebaseAuth().updateUser(row.firebaseUid, { password });
    await prisma.passwordResetOtp.delete({ where: { id: row.id } });
    return res.json({ success: true, message: "Password updated" });
  } catch (error) {
    console.error("Password reset completion failed:", error.message);
    return res.status(503).json({ success: false, message: "ตั้งรหัสผ่านใหม่ไม่สำเร็จ" });
  }
});

router.get("/session", requireFirebaseSession, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth.userId }, select: { id: true, email: true, name: true, firstName: true, lastName: true, nickname: true, role: true } });
    return res.json({ success: true, data: { user } });
  } catch (error) {
    console.error("Firebase session profile lookup failed:", error.message);
    return res.status(503).json({ success: false, message: "Could not load account profile" });
  }
});

router.post("/session/logout", requireCsrfForUnsafeMethods, (_req, res) => {
  clearSessionCookies(res);
  return res.json({ success: true });
});
module.exports = router;
