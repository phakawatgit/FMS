const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();
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

router.post("/", async (req, res) => {
  const body = req.body || {};
  const visitorType = body.visitorType;
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
    medicine: readText(body.medicine, 160),
    hospitalName: readText(body.hospitalName, 200),
  };
  const numbers = {
    age: readNumber(body.age, true, 150),
    weight: readNumber(body.weight, false, 500),
    height: readNumber(body.height, true, 300),
    sys: readNumber(body.sys, true, 400),
    dia: readNumber(body.dia, true, 300),
    pr: readNumber(body.pr, true, 300),
    quantity: readNumber(body.quantity, true, 10000),
  };

  if (
    !["student", "guest"].includes(visitorType) ||
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
    quantity: numbers.quantity,
    status,
  };

  if (status === "refer" && !data.hospitalName) {
    return res.status(400).json({ success: false, message: "กรุณาระบุชื่อโรงพยาบาลที่ส่งต่อ" });
  }

  try {
    const visit = await prisma.infirmaryVisit.create({ data });
    return res.status(201).json({ success: true, data: visit });
  } catch (error) {
    console.error("Infirmary visit create failed:", error.message);
    return res.status(503).json({ success: false, message: "บันทึกข้อมูลลงฐานข้อมูลไม่สำเร็จ" });
  }
});

router.patch("/:id", async (req, res) => {
  const status = req.body?.status;
  const hospitalName = req.body?.hospitalName === undefined ? undefined : readText(req.body.hospitalName, 200);
  if (!visitStatuses.has(status) || (req.body?.hospitalName !== undefined && !hospitalName) || (status === "refer" && !hospitalName)) {
    return res.status(400).json({ success: false, message: "สถานะการเข้าใช้ห้องพยาบาลไม่ถูกต้อง" });
  }

  try {
    const visit = await prisma.infirmaryVisit.update({
      where: { id: req.params.id },
      data: { status, ...(hospitalName === undefined ? {} : { hospitalName }) },
    });
    return res.json({ success: true, data: visit });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ success: false, message: "ไม่พบรายการเข้าใช้ห้องพยาบาล" });
    console.error("Infirmary visit update failed:", error.message);
    return res.status(503).json({ success: false, message: "แก้ไขข้อมูลในฐานข้อมูลไม่สำเร็จ" });
  }
});

module.exports = router;