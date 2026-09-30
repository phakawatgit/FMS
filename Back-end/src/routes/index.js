const express = require("express");
const databaseRouter = require("./database");
const infirmaryVisitsRouter = require("./infirmary-visits");
const prisma = require("../lib/prisma");
const authRouter = require("./auth");
const { getFirebaseAuth } = require("../lib/firebase-admin");

const router = express.Router();
router.use('/dashboard', require('./dashboard'));
router.use('/catalog-orders', require('./catalog-orders'));
router.use("/medicines", require("./medicines"));
router.use("/loans", require("./loans"));

router.use("/database", databaseRouter);
router.use("/infirmary-visits", infirmaryVisitsRouter);
router.use("/auth", authRouter);

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
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: `${firstName} ${lastName}` },
      update: { name: `${firstName} ${lastName}` },
    });
    const uniqueKey = { date_color: { date, color } };
    const existing = await prisma.dutyShift.findUnique({ where: uniqueKey });
    if (existing && existing.userId !== user.id) {
      return res.status(409).json({ success: false, message: "สีนี้ถูกใช้ในวันที่เลือกแล้ว" });
    }

    const duty = await prisma.dutyShift.upsert({
      where: uniqueKey,
      create: { date, color, firstName, lastName, nickname: nickname || null, affiliation: affiliation || null, userId: user.id },
      update: { firstName, lastName, nickname: nickname || null, affiliation: affiliation || null },
    });
    return res.status(201).json({ success: true, data: { id: duty.id } });
  } catch (error) {
    console.error("Duty shift save failed:", error.message);
    return res.status(503).json({ success: false, message: "บันทึกข้อมูลการเข้าเวรไม่สำเร็จ" });
  }
});

// Shared key/value storage used by the legacy static frontend. This keeps the
// old pages compatible while their localStorage-backed modules are migrated.
const retiredInventoryKeys = new Set(["fms-history-catalog-orders", "fms-stock-records", "fms-infirmary-visits", "fms-infirmary-history", "fms-borrow-return-records"]);
router.get("/legacy-storage", async (_req, res) => {
  try {
    const rows = await prisma.legacyStorage.findMany();
    res.json({ success: true, data: Object.fromEntries(rows.map((row) => [row.key, row.value])) });
  } catch (error) {
    console.error("Legacy storage read failed:", error.message);
    res.status(503).json({ success: false, message: "อ่านข้อมูลส่วนกลางไม่สำเร็จ" });
  }
});

// Migrate an existing browser localStorage in one request. Existing server
// values are kept by default so another device cannot overwrite shared data
// while it is only hydrating its local copy.
router.post("/legacy-storage/bulk", async (req, res) => {
  const data = req.body?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json({ success: false, message: "ข้อมูลส่วนกลางไม่ถูกต้อง" });
  }

  const entries = Object.entries(data)
    .filter(([key]) => String(key).trim() && String(key).length <= 120 && !retiredInventoryKeys.has(String(key).trim()))
    .map(([key, value]) => [String(key).trim(), value]);

  try {
    await prisma.$transaction(async (tx) => {
      for (const [key, value] of entries) {
        await tx.legacyStorage.upsert({
          where: { key },
          create: { key, value: value ?? null },
          update: req.body?.preserveExisting ? {} : { value: value ?? null },
        });
      }
    });
    res.json({ success: true, count: entries.length });
  } catch (error) {
    console.error("Legacy storage bulk write failed:", error.message);
    res.status(503).json({ success: false, message: "บันทึกข้อมูลส่วนกลางไม่สำเร็จ" });
  }
});

router.put("/legacy-storage/:key", async (req, res) => {
  const key = String(req.params.key || "").trim();
  if (retiredInventoryKeys.has(key)) return res.status(409).json({ success: false, message: "ข้อมูลนี้ต้องบันทึกผ่าน API stock/คนไข้/ยืมคืนเท่านั้น" });
  if (!key || key.length > 120) return res.status(400).json({ success: false, message: "คีย์ไม่ถูกต้อง" });
  try {
    const row = await prisma.legacyStorage.upsert({
      where: { key },
      create: { key, value: req.body?.value ?? null },
      update: { value: req.body?.value ?? null },
    });
    res.json({ success: true, data: row });
  } catch (error) {
    console.error("Legacy storage write failed:", error.message);
    res.status(503).json({ success: false, message: "บันทึกข้อมูลส่วนกลางไม่สำเร็จ" });
  }
});

router.delete("/legacy-storage/:key", async (req, res) => {
  if (retiredInventoryKeys.has(String(req.params.key).trim())) return res.status(409).json({ success: false, message: "ประวัติเดิมเก็บไว้สำหรับอ่านเท่านั้น" });
  try {
    await prisma.legacyStorage.delete({ where: { key: String(req.params.key) } });
  } catch (error) {
    if (error.code !== "P2025") throw error;
  }
  res.json({ success: true });
});

module.exports = router;
