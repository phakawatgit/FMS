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

router.post("/signup-otp", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const firebaseUid = String(req.body?.firebaseUid || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !firebaseUid) {
    return res.status(400).json({ success: false, message: "ข้อมูลสมัครสมาชิกไม่ถูกต้อง" });
  }

  try {
    const firebaseUser = await getFirebaseAuth().getUser(firebaseUid);
    if (normalizeEmail(firebaseUser.email) !== email) {
      return res.status(400).json({ success: false, message: "อีเมลไม่ตรงกับบัญชีที่สมัคร" });
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    await prisma.passwordResetOtp.deleteMany({ where: { email } });
    await prisma.passwordResetOtp.create({
      data: {
        email,
        firebaseUid,
        codeHash: hash(otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    await getMailer().sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "FMS Account Verification OTP",
      text: `รหัส OTP สำหรับยืนยันบัญชี FMS คือ ${otp} รหัสนี้หมดอายุภายใน 5 นาที`,
      html: `<p>รหัส OTP สำหรับยืนยันบัญชี FMS คือ</p><h1 style="letter-spacing:6px">${otp}</h1><p>รหัสนี้หมดอายุภายใน 5 นาที</p>`,
    });
    return res.json({ success: true, message: "ส่ง OTP ไปยังอีเมลแล้ว" });
  } catch (error) {
    console.error("Signup OTP failed:", error.message);
    return res.status(503).json({ success: false, message: "ไม่สามารถส่ง OTP ได้ กรุณาตรวจสอบการตั้งค่าอีเมล" });
  }
});

router.post("/verify-signup-otp", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const firebaseUid = String(req.body?.firebaseUid || "").trim();
  const otp = String(req.body?.otp || "").trim();
  const record = await prisma.passwordResetOtp.findFirst({ where: { email, firebaseUid }, orderBy: { createdAt: "desc" } });
  if (!record || record.verifiedAt || record.expiresAt < new Date() || record.attempts >= MAX_ATTEMPTS) {
    return res.status(400).json({ success: false, message: "OTP หมดอายุหรือไม่ถูกต้อง" });
  }
  if (hash(otp) !== record.codeHash) {
    await prisma.passwordResetOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return res.status(400).json({ success: false, message: "OTP ไม่ถูกต้อง" });
  }
  await getFirebaseAuth().updateUser(firebaseUid, { emailVerified: true });
  await prisma.passwordResetOtp.delete({ where: { id: record.id } });
  return res.json({ success: true, message: "ยืนยันอีเมลสำเร็จ" });
});

router.post("/forgot-password", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "กรุณากรอกอีเมลให้ถูกต้อง" });
  }

  try {
    const firebaseUser = await getFirebaseAuth().getUserByEmail(email);
    const otp = String(crypto.randomInt(100000, 1000000));
    await prisma.passwordResetOtp.deleteMany({ where: { email } });
    await prisma.passwordResetOtp.create({
      data: {
        email,
        firebaseUid: firebaseUser.uid,
        codeHash: hash(otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    await getMailer().sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "FMS Password Reset OTP",
      text: `รหัส OTP สำหรับเปลี่ยนรหัสผ่าน FMS คือ ${otp} รหัสนี้หมดอายุภายใน 5 นาที`,
      html: `<p>รหัส OTP สำหรับเปลี่ยนรหัสผ่าน FMS คือ</p><h1 style="letter-spacing:6px">${otp}</h1><p>รหัสนี้หมดอายุภายใน 5 นาที</p>`,
    });

    return res.json({ success: true, message: "ส่ง OTP ไปยังอีเมลแล้ว" });
  } catch (error) {
    console.error("Forgot password failed:", error.message);
    return res.status(503).json({ success: false, message: "ไม่สามารถส่ง OTP ได้ กรุณาตรวจสอบการตั้งค่าอีเมลหรืออีเมลผู้ใช้" });
  }
});

router.post("/verify-otp", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const otp = String(req.body?.otp || "").trim();
  const record = await prisma.passwordResetOtp.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
  if (!record || record.verifiedAt || record.expiresAt < new Date() || record.attempts >= MAX_ATTEMPTS) {
    return res.status(400).json({ success: false, message: "OTP หมดอายุหรือไม่ถูกต้อง" });
  }
  if (hash(otp) !== record.codeHash) {
    await prisma.passwordResetOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return res.status(400).json({ success: false, message: "OTP ไม่ถูกต้อง" });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetOtp.update({
    where: { id: record.id },
    data: { verifiedAt: new Date(), resetTokenHash: hash(resetToken), resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });
  return res.json({ success: true, resetToken, message: "ยืนยัน OTP สำเร็จ" });
});

router.post("/reset-password", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const resetToken = String(req.body?.resetToken || "");
  const password = String(req.body?.password || "");
  if (password.length < 6) return res.status(400).json({ success: false, message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });

  const record = await prisma.passwordResetOtp.findFirst({
    where: { email, resetTokenHash: hash(resetToken), verifiedAt: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (!record || !record.resetTokenExpiresAt || record.resetTokenExpiresAt < new Date()) {
    return res.status(400).json({ success: false, message: "คำขอเปลี่ยนรหัสผ่านหมดอายุ กรุณาขอ OTP ใหม่" });
  }

  try {
    await getFirebaseAuth().updateUser(record.firebaseUid, { password });
    await prisma.passwordResetOtp.delete({ where: { id: record.id } });
    return res.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  } catch (error) {
    console.error("Password reset failed:", error.message);
    return res.status(503).json({ success: false, message: "เปลี่ยนรหัสผ่านไม่สำเร็จ" });
  }
});

module.exports = router;
