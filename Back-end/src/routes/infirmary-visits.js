const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();
const inv = require("../lib/inventory");
const visitStatuses = new Set(["normal", "observe", "refer"]);

function readText(value, maxLength, required = false) {
  if (value === undefined || value === null) return required ? undefined : null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if ((!text && required) || text.length > maxLength) return undefined;
  return text || null;
}

function readNumber(value, integer, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > maximum || (integer && !Number.isInteger(number))) return NaN;
  return number;
}

function validateVisit(req, res, next) {
  const body = req.body || {};
  // Accept old open forms during the transition; persist only the canonical values.
  const visitorType = ({student:'บุคคลภายใน',guest:'บุคคลภายนอก',internal:'บุคคลภายใน',external:'บุคคลภายนอก'})[body.visitorType] || body.visitorType;
  const status = body.status;
  const firstName = readText(body.firstName, 120, true);
  const lastName = readText(body.lastName, 120, true);
  const symptom = readText(body.symptom, 10000, true);
  const textFields = {
    visitorDetail: readText(body.visitorDetailExternal ?? body.visitorDetail, 160),
    nickname: readText(body.nickname, 120),
    studentId: readText(body.studentId, 40),
    faculty: readText(body.faculty, 32),
    branch: readText(body.branch, 255),
    hospitalName: readText(body.hospitalName, 200),
  };
  const numbers = {
    age: readNumber(body.age, true, 150),
    weight: readNumber(body.weight, false, 500),
    height: readNumber(body.height, true, 300),
    sys: readNumber(body.sys, true, 400),
    dia: readNumber(body.dia, true, 300),
    pr: readNumber(body.pr, true, 300),
  };

  if (
    !["บุคคลภายใน", "บุคคลภายนอก"].includes(visitorType) ||
    !visitStatuses.has(status) ||
    !firstName || !lastName || !symptom ||
    Object.values(textFields).some((value) => value === undefined) ||
    Object.values(numbers).some(Number.isNaN)
  ) {
    return res.status(400).json({ success: false, message: "ข้อมูลการเข้าใช้ห้องพยาบาลไม่ถูกต้อง" });
  }

  const data = {
    visitorType,
    ...textFields,
    firstName,
    lastName,
    age: numbers.age,
    gender: ["ชาย", "หญิง", "Male", "Female"].includes(body.gender) ? body.gender : null,
    blood: ["A", "B", "AB", "O"].includes(body.blood) ? body.blood : null,
    weight: numbers.weight,
    height: numbers.height,
    symptom,
    sys: numbers.sys,
    dia: numbers.dia,
    pr: numbers.pr,
    status,
  };

  if (status === "refer" && !data.hospitalName) {
    return res.status(400).json({ success: false, message: "กรุณาระบุชื่อโรงพยาบาลที่ส่งต่อ" });
  }

  if (status !== "refer") data.hospitalName = null;

  req.visitData = data;
  next();
}

router.get("/", async (_req, res) => {
  const visits = await prisma.infirmaryVisit.findMany({ include: inv.include, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  res.set("Cache-Control", "no-store").json({ success: true, data: visits });
});
router.get("/:id", async (req, res) => {
  const visit = await prisma.infirmaryVisit.findUnique({ where: { id: req.params.id }, include: inv.include });
  if (!visit) throw inv.fail("ไม่พบรายการ", 404);
  res.set("Cache-Control", "no-store").json({ success: true, data: visit });
});
router.post("/", validateVisit, async (req, res) => {
  const result = await inv.atomic(req, async tx => {
    const visit = await tx.infirmaryVisit.create({ data: req.visitData });
    await inv.dispense(tx, visit, req.body.dispensations === undefined ? [] : req.body.dispensations);
    return tx.infirmaryVisit.findUnique({ where: { id: visit.id }, include: inv.include });
  });
  res.status(201).json({ success: true, data: result });
});
router.patch("/:id", (req, res, next) => {
  if (Object.keys(req.body || {}).some(key => !["status", "hospitalName"].includes(key))) return validateVisit(req, res, next);
  next();
}, async (req, res) => {
  const result = await inv.atomic(req, async tx => {
    await tx.$queryRaw`SELECT "id" FROM "InfirmaryVisit" WHERE "id" = ${req.params.id} FOR UPDATE`;
    const visit = await tx.infirmaryVisit.findUnique({ where: { id: req.params.id }, include: inv.include });
    if (!visit) throw inv.fail("ไม่พบรายการ", 404);
    const status = req.body.status;
    const hospitalName = readText(req.body.hospitalName, 200);
    if (!visitStatuses.has(status) || hospitalName === undefined || status === "refer" && !hospitalName) throw inv.fail("สถานะหรือโรงพยาบาลไม่ถูกต้อง");
    if (req.body.dispensations !== undefined) {
      const requested = inv.items(req.body.dispensations);
      await inv.dispense(tx, visit, requested);
    }
    const data = req.visitData || { status, hospitalName: status === "refer" ? hospitalName : null };
    return tx.infirmaryVisit.update({ where: { id: visit.id }, data, include: inv.include });
  });
  res.json({ success: true, data: result });
});
router.use(inv.errorHandler);
module.exports = router;
