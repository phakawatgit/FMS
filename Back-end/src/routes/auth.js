const crypto = require("crypto");
const express = require("express");
const nodemailer = require("nodemailer");
const prisma = require("../lib/prisma");
const { getFirebaseAuth } = require("../lib/firebase-admin");

const router = express.Router();
const OTP_TTL_MS = 5 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP credentials are not configured");
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

router.post("/forgot-password", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "กรุณากรอกอีเมลให้ถูกต้อง" });
  }

  try {
    const firebaseUser = await getFirebaseAuth().getUserByEmail(email);
    const otp = String(crypto.randomInt(100000, 1000000));
    await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email + ':reset'},0))`;
    const recent = await tx.passwordResetOtp.findFirst({ where: { email, createdAt: { gt: new Date(Date.now() - 60000) } } });
    if (recent) throw Object.assign(Error('??????????????????????????????'), { status: 429 });
    await tx.passwordResetOtp.deleteMany({ where: { email } });
    await tx.passwordResetOtp.create({
      data: {
        email,
        firebaseUid: firebaseUser.uid,
        codeHash: hash(otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    }, { maxWait: 15000, timeout: 20000 });

    await getMailer().sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "FMS Password Reset OTP",
      text: `รหัส OTP สำหรับเปลี่ยนรหัสผ่าน FMS คือ ${otp} รหัสนี้หมดอายุภายใน 5 นาที`,
      html: `<p>รหัส OTP สำหรับเปลี่ยนรหัสผ่าน FMS คือ</p><h1 style="letter-spacing:6px">${otp}</h1><p>รหัสนี้หมดอายุภายใน 5 นาที</p>`,
    });

    return res.json({ success: true, message: "ส่ง OTP ไปยังอีเมลแล้ว" });
  } catch (error) {
    if (error.status) return res.status(error.status).json({success:false,message:error.message});
    console.error("Forgot password failed:", error.code || "provider-unavailable");
    return res.status(503).json({ success: false, message: "ไม่สามารถส่ง OTP ได้ กรุณาตรวจสอบการตั้งค่าอีเมลหรืออีเมลผู้ใช้" });
  }
});

router.post('/verify-otp', async (req, res) => {
  const email = normalizeEmail(req.body?.email), otp = String(req.body?.otp || '').trim();
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email + ':reset'},0))`;
    const record = await tx.passwordResetOtp.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } });
    if (!record || record.verifiedAt || record.expiresAt < new Date() || record.attempts >= MAX_ATTEMPTS) return null;
    if (hash(otp) !== record.codeHash) {
      await tx.passwordResetOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      return null;
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    await tx.passwordResetOtp.update({ where: { id: record.id }, data: { verifiedAt: new Date(), resetTokenHash: hash(resetToken), resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) } });
    return resetToken;
  }, { maxWait: 15000, timeout: 20000 });
  if (!result) return res.status(400).json({ success: false, message: 'OTP ?????????????????????' });
  res.json({ success: true, resetToken: result, message: '?????? OTP ??????' });
});
router.post('/reset-password', async (req, res) => {
  const email = normalizeEmail(req.body?.email), resetToken = String(req.body?.resetToken || ''), password = String(req.body?.password || '');
  if (password.length < 6 || password.length > 4096) return res.status(400).json({ success: false, message: '??????????????????????? 6 ????????' });
  const reset = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email + ':reset'},0))`;
    const record = await tx.passwordResetOtp.findFirst({ where: { email, resetTokenHash: hash(resetToken), verifiedAt: { not: null } }, orderBy: { createdAt: 'desc' } });
    if (!record || !record.resetTokenExpiresAt || record.resetTokenExpiresAt < new Date()) return false;
    await getFirebaseAuth().updateUser(record.firebaseUid, { password });
    await getFirebaseAuth().revokeRefreshTokens(record.firebaseUid);
    await tx.passwordResetOtp.delete({ where: { id: record.id } });
    await tx.auditLog.create({ data: { action: 'password-reset', entity: 'Account', detail: {} } });
    return true;
  }, { maxWait: 15000, timeout: 20000 });
  res.status(reset ? 200 : 400).json({ success: reset, message: reset ? '?????????????????????' : '?????????????????????????' });
});
module.exports = router;
