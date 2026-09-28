const express = require("express");
const databaseRouter = require("./database");
const prisma = require("../lib/prisma");
const authRouter = require("./auth");

const router = express.Router();

router.use("/database", databaseRouter);
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

// Shared key/value storage used by the legacy static frontend. This keeps the
// old pages compatible while their localStorage-backed modules are migrated.
router.get("/legacy-storage", async (_req, res) => {
  try {
    const rows = await prisma.legacyStorage.findMany();
    res.json({ success: true, data: Object.fromEntries(rows.map((row) => [row.key, row.value])) });
  } catch (error) {
    console.error("Legacy storage read failed:", error.message);
    res.status(503).json({ success: false, message: "อ่านข้อมูลส่วนกลางไม่สำเร็จ" });
  }
});

router.put("/legacy-storage/:key", async (req, res) => {
  const key = String(req.params.key || "").trim();
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
  try {
    await prisma.legacyStorage.delete({ where: { key: String(req.params.key) } });
  } catch (error) {
    if (error.code !== "P2025") throw error;
  }
  res.json({ success: true });
});

module.exports = router;
