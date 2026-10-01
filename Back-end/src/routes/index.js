const express = require("express");
const databaseRouter = require("./database");
const prisma = require("../lib/prisma");
const authRouter = require("./auth");
const catalogRouter = require("./catalog");
const borrowRouter = require("./borrow");

const router = express.Router();

router.use("/database", databaseRouter);
router.use("/auth", authRouter);
router.use("/catalog", catalogRouter);
router.use("/borrow-records", borrowRouter);

// Dashboard data is read from the normalized tables; purchase history remains
// in LegacyStorage because the current purchase workflow stores it as a JSON document.
router.get("/dashboard/data", async (req, res) => {
  try {
    const [patients, medicationRows, stock, borrowRows, purchaseHistory] = await Promise.all([
      prisma.patient.findMany({ select: { id: true, name: true, firstName: true, lastName: true, branch: true, faculty: true, gender: true, symptom: true, status: true, hospitalName: true, visitedAt: true, infirmaryHistory: true } }),
      prisma.patientMedication.findMany({ orderBy: { dispensedAt: "asc" } }),
      catalogRouter.listRecords(req),
      prisma.borrowRecord.findMany({ include: { items: { include: { returns: { orderBy: { returnedAt: "asc" } } } } }, orderBy: { borrowedAt: "desc" } }),
      prisma.legacyStorage.findUnique({ where: { key: "fms-history-catalog-orders" }, select: { value: true } }),
    ]);
    const medsByVisit = new Map();
    for (const medication of medicationRows) {
      const rows = medsByVisit.get(medication.visitId) || [];
      rows.push({ code: medication.catalogCode, name: medication.medicineName, quantity: medication.quantity });
      medsByVisit.set(medication.visitId, rows);
    }
    const visits = [];
    for (const patient of patients) {
      const history = Array.isArray(patient.infirmaryHistory) ? patient.infirmaryHistory : [];
      if (history.length) {
        for (const entry of history) {
          const visitId = String(entry.createdAt || entry.visitDate || entry.date || "");
          const medicines = medsByVisit.get(visitId) || entry.medicines || [];
          visits.push({ ...entry, patientId: patient.id, faculty: entry.faculty || patient.faculty || "", branch: entry.branch || patient.branch || "", gender: entry.gender || patient.gender || "", symptom: entry.symptom || patient.symptom || "", status: entry.status || patient.status || "", hospitalName: entry.hospitalName || patient.hospitalName || "", createdAt: entry.createdAt || entry.visitDate || patient.visitedAt?.toISOString() || "", medicines, medicine: medicines.map((item) => item.name).join(", "), quantity: medicines.reduce((sum, item) => sum + item.quantity, 0) });
        }
      } else if (patient.visitedAt) {
        const visitId = patient.visitedAt.toISOString();
        const medicines = medsByVisit.get(visitId) || [];
        visits.push({ ...patient, createdAt: visitId, medicines, medicine: medicines.map((item) => item.name).join(", "), quantity: medicines.reduce((sum, item) => sum + item.quantity, 0) });
      }
    }
    res.json({ success: true, data: { visits, stock, borrowRecords: borrowRows.map(borrowRouter.legacy), purchaseOrders: Array.isArray(purchaseHistory?.value) ? purchaseHistory.value : [] } });
  } catch (error) {
    console.error("Dashboard data query failed:", error.message);
    res.status(503).json({ success: false, message: "Dashboard data could not be loaded" });
  }
});

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

router.get("/nurses", async (_req, res) => {
  try {
    const nurses = await prisma.nurse.findMany({ orderBy: { fullName: "asc" } });
    return res.json({ success: true, data: nurses });
  } catch (error) {
    console.error("Nurse list read failed:", error.message);
    return res.status(503).json({ success: false, message: "อ่านรายชื่อพยาบาลไม่สำเร็จ" });
  }
});

function normalizeNurseName(value) {
  return String(value || "")
    .trim()
    .replace(/^(?:นางสาว|น\.ส\.|นาง|นาย)\s*/, "")
    .replace(/\s+/g, " ");
}

router.post("/nurses", async (req, res) => {
  const firstName = String(req.body?.firstName || "").trim();
  const lastName = String(req.body?.lastName || "").trim();
  const nickname = String(req.body?.nickname || "").trim();
  const affiliation = String(req.body?.affiliation || "").trim();
  if (!firstName || !lastName || firstName.length > 120 || lastName.length > 120 || nickname.length > 120 || affiliation.length > 255) {
    return res.status(400).json({ success: false, message: "ข้อมูลพยาบาลไม่ถูกต้อง" });
  }

  const fullName = `${firstName} ${lastName}`;
  try {
    const knownNurses = await prisma.nurse.findMany({ select: { fullName: true } });
    const canonicalNurse = knownNurses.find((nurse) => normalizeNurseName(nurse.fullName) === normalizeNurseName(fullName));
    const canonicalFullName = canonicalNurse?.fullName ?? fullName;
    const nurse = await prisma.nurse.upsert({
      where: { fullName: canonicalFullName },
      create: { fullName: canonicalFullName, nickname: nickname || null, affiliation: affiliation || null },
      update: {
        ...(nickname ? { nickname } : {}),
        ...(affiliation ? { affiliation } : {}),
      },
    });
    return res.json({ success: true, data: nurse });
  } catch (error) {
    console.error("Nurse upsert failed:", error.message);
    return res.status(503).json({ success: false, message: "บันทึกข้อมูลพยาบาลไม่สำเร็จ" });
  }
});

// Persist the legacy infirmary form as patient and visit rows without requiring
// a login or nurse account. Keep the legacy list in the same transaction for
// the existing history pages.
router.post("/infirmary-visits", async (req, res) => {
  const input = req.body?.record;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return res.status(400).json({ success: false, message: "ข้อมูลผู้ป่วยไม่ถูกต้อง" });
  }

  const text = (key, max = 10_000) => {
    const value = input[key] == null ? "" : String(input[key]).trim();
    return value.length <= max ? value : null;
  };
  const firstName = text("firstName", 100);
  const lastName = text("lastName", 100);
  const symptom = text("symptom");
  const sourceRecordId = text("createdAt", 120);
  const status = text("status", 30);
  const visitedAt = sourceRecordId ? new Date(sourceRecordId) : null;
  if (!firstName || !lastName || !symptom || !sourceRecordId || !visitedAt || Number.isNaN(visitedAt.getTime()) || !["normal", "observe", "refer"].includes(status)) {
    return res.status(400).json({ success: false, message: "กรุณาตรวจสอบชื่อ อาการ สถานะ และเวลาบันทึก" });
  }

  const optionalLimits = { studentId: 80, visitorType: 30, age: 20, nickname: 120, branch: 120, gender: 40, blood: 10, weight: 20, height: 20, sys: 12, dia: 12, pr: 12, medicine: 200, quantity: 40, hospitalName: 200, faculty: 120, visitorDetail: 200 };
  const values = {};
  for (const [key, max] of Object.entries(optionalLimits)) {
    values[key] = text(key, max);
    if (values[key] === null) return res.status(400).json({ success: false, message: "ข้อมูลผู้ป่วยบางช่องยาวเกินกำหนด" });
  }
  const record = Object.fromEntries(["firstName", "lastName", "createdAt", "symptom", "status", ...Object.keys(optionalLimits)].map((key) => [key, input[key] == null ? "" : String(input[key]).trim()]));
  const patientName = `${firstName} ${lastName}`;
  const studentId = values.studentId || null;
  if (patientName.length > 200) return res.status(400).json({ success: false, message: "ชื่อผู้ป่วยยาวเกินกำหนด" });
  const age = values.age ? Number(values.age) : null;
  const weight = values.weight || null;
  const height = values.height || null;
  if (age !== null && (!Number.isInteger(age) || age < 0 || age > 150)) {
    return res.status(400).json({ success: false, message: "อายุต้องเป็นจำนวนเต็มระหว่าง 0 ถึง 150 ปี" });
  }
  if ([weight, height].some((value) => value !== null && !/^\d{1,5}(?:\.\d{1,2})?$/.test(value))) {
    return res.status(400).json({ success: false, message: "น้ำหนักและส่วนสูงต้องเป็นตัวเลขไม่เกินทศนิยม 2 ตำแหน่ง" });
  }
  if (input.medications !== undefined && !Array.isArray(input.medications)) {
    return res.status(400).json({ success: false, message: "รายการยาที่จ่ายไม่ถูกต้อง" });
  }
  const rawMedications = Array.isArray(input.medications)
    ? input.medications
    : values.medicine && !["เลือกยา", "select medicine"].includes(values.medicine.toLocaleLowerCase())
      ? [{ name: values.medicine, quantity: values.quantity }]
      : [];
  if (!Array.isArray(rawMedications) || rawMedications.length > 50) {
    return res.status(400).json({ success: false, message: "รายการยาที่จ่ายไม่ถูกต้อง" });
  }
  const medicationMap = new Map();
  for (const item of rawMedications) {
    const code = String(item?.code || "").trim();
    const medicineName = String(item?.name || "").trim();
    const quantity = Number(item?.quantity);
    if ((!code && !medicineName) || !Number.isSafeInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกยาและระบุจำนวนเต็มมากกว่า 0" });
    }
    const key = code ? `code:${code.toLocaleLowerCase()}` : `name:${medicineName.toLocaleLowerCase()}`;
    const previous = medicationMap.get(key);
    medicationMap.set(key, { code, name: medicineName, quantity: quantity + (previous?.quantity || 0) });
  }
  const requestedMedications = Array.from(medicationMap.values());
  if (requestedMedications.some((item) => !Number.isSafeInteger(item.quantity))) {
    return res.status(400).json({ success: false, message: "จำนวนยารวมเกินค่าที่รองรับ" });
  }
  record.medicines = [];
  record.medicine = "";
  record.quantity = "";
  const patientCreate = {
    studentId,
    name: patientName,
    firstName,
    lastName,
    nickname: values.nickname || null,
    age,
    faculty: values.faculty && values.faculty !== "all" ? values.faculty : null,
    branch: values.branch && values.branch !== "all" ? values.branch : null,
    visitorType: values.visitorType || null,
    visitorDetail: values.visitorDetail || null,
    gender: values.gender && values.gender !== "เลือก" ? values.gender : null,
    blood: values.blood && values.blood !== "เลือก" ? values.blood : null,
    weight,
    height,
    symptom,
    sys: values.sys || null,
    dia: values.dia || null,
    pr: values.pr || null,
    status,
    hospitalName: values.hospitalName || null,
    visitedAt,
  };
  const profileUpdate = Object.fromEntries(
    Object.entries(patientCreate).filter(([key, value]) => key !== "studentId" && value !== null && value !== ""),
  );

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.legacyStorage.upsert({
        where: { key: "fms-infirmary-visits" },
        create: { key: "fms-infirmary-visits", value: [] },
        update: {},
      });
      await tx.$queryRaw`SELECT "key" FROM "LegacyStorage" WHERE "key" = 'fms-infirmary-visits' FOR UPDATE`;
      const previous = await tx.legacyStorage.findUnique({ where: { key: "fms-infirmary-visits" }, select: { value: true } });
      const records = Array.isArray(previous?.value) ? previous.value : [];
      const existingIndex = records.findIndex((item) => item?.createdAt === sourceRecordId);

      const existingMedicationRows = await tx.patientMedication.findMany({ where: { visitId: sourceRecordId }, select: { catalogCode: true, quantity: true } });
      const resolvedMedications = [];
      for (const requested of requestedMedications) {
        let matches;
        if (requested.code) {
          const found = await tx.catalog.findUnique({ where: { code: requested.code } });
          matches = found ? [found] : [];
        } else {
          matches = await tx.catalog.findMany({
            where: {
              OR: ["name", "productName", "genericName"].map((field) => ({ [field]: { equals: requested.name, mode: "insensitive" } })),
            },
          });
        }
        if (!matches.length) throw Object.assign(new Error("Catalog medicine not found"), { httpStatus: 400 });
        if (matches.length > 1) throw Object.assign(new Error("Catalog medicine name is ambiguous"), { httpStatus: 409 });
        const catalogItem = matches[0];
        resolvedMedications.push({
          catalogId: catalogItem.id,
          catalogCode: catalogItem.code,
          medicineName: catalogItem.name,
          unit: catalogItem.unit,
          total: catalogItem.total,
          quantity: requested.quantity,
        });
      }
      record.medicines = resolvedMedications.map(({ catalogCode, medicineName, unit, quantity }) => ({ code: catalogCode, name: medicineName, unit, quantity }));
      record.medicine = resolvedMedications.map((item) => item.medicineName).join(", ");
      record.quantity = resolvedMedications.map((item) => `${item.quantity} ${item.unit}`).join(", ");

      if (existingMedicationRows.length) {
        const previousQuantities = new Map(existingMedicationRows.map((item) => [item.catalogCode, item.quantity]));
        if (previousQuantities.size !== resolvedMedications.length || resolvedMedications.some((item) => previousQuantities.get(item.catalogCode) !== item.quantity)) {
          throw Object.assign(new Error("Visit medications changed after dispensing"), { httpStatus: 409 });
        }
      }

      // A repeated visit ID with persisted medication rows must not dispense twice.
      if (!existingMedicationRows.length) {
        for (const medication of resolvedMedications) {
          const updated = await tx.catalog.updateMany({
            where: { id: medication.catalogId, remaining: { gte: medication.quantity } },
            data: { used: { increment: medication.quantity }, remaining: { decrement: medication.quantity } },
          });
          if (updated.count !== 1) throw Object.assign(new Error("Insufficient catalog stock"), { httpStatus: 409 });
          const afterDispensing = await tx.catalog.findUnique({ where: { id: medication.catalogId }, select: { id: true, total: true, remaining: true } });
          const lowStockLimit = Math.max(1, Math.ceil(afterDispensing.total * 0.2));
          await tx.catalog.update({
            where: { id: medication.catalogId },
            data: { status: afterDispensing.remaining === 0 ? "หมด" : afterDispensing.remaining <= lowStockLimit ? "ใกล้หมด" : "ปกติ" },
          });
        }
      }
      const existingPatient = studentId
        ? await tx.patient.findFirst({ where: { studentId }, orderBy: { updatedAt: "desc" } })
        : null;
      const history = Array.isArray(existingPatient?.infirmaryHistory) ? [...existingPatient.infirmaryHistory] : [];
      const historyIndex = history.findIndex((item) => item?.createdAt === sourceRecordId);
      if (historyIndex >= 0) history[historyIndex] = record;
      else history.push(record);

      const patientData = {
        ...profileUpdate,
        symptom,
        sys: values.sys || null,
        dia: values.dia || null,
        pr: values.pr || null,
        status,
        hospitalName: values.hospitalName || null,
        visitedAt,
        infirmaryHistory: history,
      };
      const patient = existingPatient
        ? await tx.patient.update({ where: { id: existingPatient.id }, data: patientData })
        : await tx.patient.create({ data: { ...patientCreate, infirmaryHistory: history } });

      if (!existingMedicationRows.length && resolvedMedications.length) {
        await tx.patientMedication.createMany({
          data: resolvedMedications.map((medication) => ({
            patientId: patient.id,
            catalogId: medication.catalogId,
            visitId: sourceRecordId,
            catalogCode: medication.catalogCode,
            medicineName: medication.medicineName,
            quantity: medication.quantity,
            dispensedAt: visitedAt,
          })),
        });
      }
      if (existingIndex >= 0) records[existingIndex] = record;
      else records.unshift(record);
      await tx.legacyStorage.upsert({
        where: { key: "fms-infirmary-visits" },
        create: { key: "fms-infirmary-visits", value: records },
        update: { value: records },
      });
      return { patientId: patient.id, records };
    }, { maxWait: 10_000, timeout: 15_000 });
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Infirmary visit persistence failed:", error.message);
    const statusCode = error.httpStatus || 503;
    return res.status(statusCode).json({ success: false, message: statusCode === 409 ? "Catalog stock is insufficient or the medicine name is ambiguous" : statusCode === 400 ? "Selected medicine or dispense quantity is invalid" : "Patient visit could not be saved" });
  }
});

// Shared key/value storage used by the static frontend as its persistent store.
router.get("/legacy-storage", async (_req, res) => {
  try {
    const rows = await prisma.legacyStorage.findMany();
    const data = Object.fromEntries(rows.filter((row) => row.key !== "fms-stock-records").map((row) => [row.key, row.value]));
    data["fms-stock-records"] = await catalogRouter.listRecords(_req);
    const borrowRows = await prisma.borrowRecord.findMany({ include: { items: { include: { returns: { orderBy: { returnedAt: "asc" } } } } }, orderBy: { borrowedAt: "desc" } });
    data["fms-borrow-return-records"] = borrowRows.map(borrowRouter.legacy);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Legacy storage read failed:", error.message);
    res.status(503).json({ success: false, message: "อ่านข้อมูลส่วนกลางไม่สำเร็จ" });
  }
});

// Import existing frontend data without replacing keys already on the server.
router.post("/legacy-storage/bulk", async (req, res) => {
  const data = req.body?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json({ success: false, message: "ข้อมูลส่วนกลางไม่ถูกต้อง" });
  }

  const entries = Object.entries(data)
    .filter(([key]) => String(key).trim() && String(key).length <= 120)
    .map(([key, value]) => [String(key).trim(), value]);

  try {
    await prisma.$transaction(async (tx) => {
      for (const [key, value] of entries) {
        if (key === "fms-stock-records") continue;
        await tx.legacyStorage.upsert({
          where: { key },
          create: { key, value: value ?? null },
          update: req.body?.preserveExisting ? {} : { value: value ?? null },
        });
      }
    });
    const stockEntry = entries.find(([key]) => key === "fms-stock-records");
    if (stockEntry) await catalogRouter.syncRecords(stockEntry[1]);
    res.json({ success: true, count: entries.length });
  } catch (error) {
    console.error("Legacy storage bulk write failed:", error.message);
    res.status(503).json({ success: false, message: "บันทึกข้อมูลส่วนกลางไม่สำเร็จ" });
  }
});

router.put("/legacy-storage/:key", async (req, res) => {
  const key = String(req.params.key || "").trim();
  if (!key || key.length > 120) return res.status(400).json({ success: false, message: "คีย์ไม่ถูกต้อง" });
  try {
    if (key === "fms-stock-records") {
      const rows = await catalogRouter.syncRecords(req.body?.value);
      return res.json({ success: true, data: rows.map((row) => catalogRouter.serialize(row, req)) });
    }
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
  if (String(req.params.key) === "fms-stock-records") {
    try { await catalogRouter.syncRecords([]); return res.json({ success: true }); }
    catch (error) {
      console.error("Catalog clear failed:", error.message);
      return res.status(503).json({ success: false, message: "ลบรายการ Catalog ไม่สำเร็จ" });
    }
  }
  try {
    await prisma.legacyStorage.delete({ where: { key: String(req.params.key) } });
  } catch (error) {
    if (error.code !== "P2025") throw error;
  }
  res.json({ success: true });
});

module.exports = router;
