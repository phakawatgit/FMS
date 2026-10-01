const express = require("express");
const databaseRouter = require("./database");
const infirmaryVisitsRouter = require("./infirmary-visits");
const prisma = require("../lib/prisma");
const authRouter = require("./auth");
const { getFirebaseAuth } = require("../lib/firebase-admin");

const router = express.Router();
router.get('/auth/config', (_req, res) => {
  res.json({ success: true, data: { firebase: {
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyD6eLRN8rU-e7KJMb1Diw_mFNH81pWpzIg',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'fams-7fdff.firebaseapp.com',
    projectId: process.env.FIREBASE_PROJECT_ID || 'fams-7fdff',
    appId: process.env.FIREBASE_APP_ID || '1:636847349725:web:01eaad241d971a2437a034'
  }, emulator: process.env.NODE_ENV !== 'production' && process.env.FIREBASE_AUTH_EMULATOR_HOST ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}` : null } });
});
const { authenticate } = require('../lib/auth');
router.use('/auth', authRouter);
router.use((req, res, next) => {
  if (req.method === 'GET' && (req.path === '/database/health' || /^\/medicines\/[^/]+\/image$/.test(req.path))) return next();
  return authenticate(req, res, next);
});
router.use('/settings', require('./settings'));
router.use('/admin', require('./admin'));
router.get('/auth/me', (req, res) => {
  const { id, email, name, role, active } = req.user;
  res.json({ success: true, data: { id, email, name, role, active } });
});
router.use('/dashboard', require('./dashboard'));
router.use('/catalog-orders', require('./catalog-orders'));
router.use("/medicines", require("./medicines"));
router.use("/loans", require("./loans"));

router.use("/database", databaseRouter);
router.use("/infirmary-visits", infirmaryVisitsRouter);


router.get("/overview", async (_req, res) => {
  try {
    const [users, dutyShifts] = await Promise.all([
      prisma.user.count(),
      prisma.dutyShift.count(),
    ]);

    res.json({
      success: true,
      data: {
        message: "FMS API เชื่อมต่อกับ PostgreSQL แล้ว",
        database: "connected",
        counts: { users, dutyShifts },
        modules: ["stock", "catalog", "infirmary-visit", "borrow-return", "duty-shift"],
      },
    });
  } catch (error) {
    console.error("Overview query failed:", error.message);
    res.status(503).json({
      success: false,
      message: "เชื่อมต่อ PostgreSQL ไม่สำเร็จ",
      database: "disconnected",
    });
  }
});

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function getAuthenticatedEmail(req, res) {
  if (req.user) return req.user.email;
  const token = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    res.status(401).json({ success: false, message: "กรุณาเข้าสู่ระบบใหม่" });
    return null;
  }

  try {
    const decodedToken = await getFirebaseAuth().verifyIdToken(token);
    const email = normalizeEmail(decodedToken.email);
    if (!email) {
      res.status(401).json({ success: false, message: "บัญชีนี้ไม่มีอีเมล" });
      return null;
    }
    return email;
  } catch (error) {
    const notConfigured = error.message === "Firebase Admin credentials are not configured";
    res.status(notConfigured ? 503 : 401).json({
      success: false,
      message: notConfigured ? "ระบบยืนยันตัวตนยังไม่พร้อมใช้งาน" : "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
    });
    return null;
  }
}

router.get("/nurses/me", async (req, res) => {
  const email = await getAuthenticatedEmail(req, res);
  if (!email) return;

  try {
    const nurse = await prisma.nurse.findUnique({ where: { email } });
    if (!nurse) return res.status(404).json({ success: false, message: "ยังไม่มีข้อมูลโปรไฟล์" });
    return res.json({ success: true, data: nurse });
  } catch (error) {
    console.error("Nurse profile read failed:", error.message);
    return res.status(503).json({ success: false, message: "อ่านข้อมูลโปรไฟล์ไม่สำเร็จ" });
  }
});

router.post("/nurses/me", async (req, res) => {
  const email = await getAuthenticatedEmail(req, res);
  if (!email) return;
  const firstName = String(req.body?.firstName || "").trim();
  const lastName = String(req.body?.lastName || "").trim();
  const nickname = String(req.body?.nickname || "").trim();
  const affiliation = String(req.body?.affiliation || "").trim();
  const colorId = String(req.body?.colorId || "").trim();
  if (!firstName || !lastName || firstName.length > 120 || lastName.length > 120 || nickname.length > 120 || affiliation.length > 255 || (colorId && !/^color-(?:[1-9]|[1-4]\d|50)$/.test(colorId))) {
    return res.status(400).json({ success: false, message: "ข้อมูลพยาบาลไม่ถูกต้อง" });
  }

  try {
    const nurse = await prisma.nurse.upsert({
      where: { email },
      create: { email, firstName, lastName, nickname: nickname || null, affiliation: affiliation || null, colorId: colorId || null },
      update: {
        firstName,
        lastName,
        nickname: nickname || null,
        affiliation: affiliation || null,
        colorId: colorId || null,
      },
    });
    return res.json({ success: true, data: nurse });
  } catch (error) {
    console.error("Nurse upsert failed:", error.message);
    return res.status(503).json({ success: false, message: "บันทึกข้อมูลพยาบาลไม่สำเร็จ" });
  }
});

router.get("/duties", async (req, res) => {
  const email = await getAuthenticatedEmail(req, res);
  if (!email) return;

  try {
    const duties = await prisma.dutyShift.findMany({
      include: { user: { select: { email: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    return res.json({
      success: true,
      data: duties.map((duty) => ({
        id: duty.id,
        date: duty.date.toISOString().slice(0, 10),
        colorId: duty.color,
        firstName: duty.firstName,
        lastName: duty.lastName,
        nurseName: `${duty.firstName} ${duty.lastName}`.trim(),
        nickname: duty.nickname,
        affiliation: duty.affiliation,
        email: duty.user.email,
        updatedAt: duty.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Duty shift read failed:", error.message);
    return res.status(503).json({ success: false, message: "อ่านข้อมูลการเข้าเวรไม่สำเร็จ" });
  }
});

router.post("/duties", async (req, res) => {
  const email = await getAuthenticatedEmail(req, res);
  if (!email) return;

  const dateKey = String(req.body?.date || "").trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? new Date(`${dateKey}T00:00:00.000Z`) : null;
  const color = String(req.body?.color || "").trim();
  const firstName = String(req.body?.firstName || "").trim();
  const lastName = String(req.body?.lastName || "").trim();
  const nickname = String(req.body?.nickname || "").trim();
  const affiliation = String(req.body?.affiliation || "").trim();
  if (
    !date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey ||
    !/^color-(?:[1-9]|[1-4]\d|50)$/.test(color) ||
    !firstName || !lastName || firstName.length > 120 || lastName.length > 120 ||
    nickname.length > 120 || affiliation.length > 255
  ) {
    return res.status(400).json({ success: false, message: "ข้อมูลการเข้าเวรไม่ถูกต้อง" });
  }

  try {
    const duty = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${dateKey + ':' + color}, 0))`;
      const user = req.user;
      const uniqueKey = { date_color: { date, color } };
      const existing = await tx.dutyShift.findUnique({ where: uniqueKey });
      if (existing && existing.userId !== user.id && user.role !== 'ADMIN') throw Object.assign(Error('????????????????????????????'), { status: 409 });
      const data = { firstName, lastName, nickname: nickname || null, affiliation: affiliation || null };
      const row = await tx.dutyShift.upsert({ where: uniqueKey, create: { date, color, ...data, userId: user.id }, update: data });
      await require('../lib/audit').audit(tx, req, existing ? 'update' : 'create', 'DutyShift', row.id);
      return row;
    });
    return res.status(201).json({ success: true, data: { id: duty.id } });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error("Duty shift save failed:", error.message);
    return res.status(503).json({ success: false, message: "บันทึกข้อมูลการเข้าเวรไม่สำเร็จ" });
  }
});

router.all(['/legacy-storage', '/legacy-storage/{*path}'], (_req, res) => {
  res.status(410).json({ success: false, message: '??? API ???????????????? legacy storage' });
});
module.exports = router;
