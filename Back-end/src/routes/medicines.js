const express = require("express");
const sharp = require("sharp");
const { randomUUID } = require("node:crypto");
const prisma = require("../lib/prisma");
const router = express.Router();
const inv = require("../lib/inventory");
// Allow cold local PostgreSQL connections and queued writers to acquire a
// transaction; Prisma's 2-second default can expire during connection setup.
const transactionOptions = { maxWait: 15000, timeout: 10000 };
const select = Object.fromEntries(["manualUsed", "dispensed", "borrowed", "active", "id", "code", "name", "productName", "genericName", "category", "form", "size", "unit", "benefit", "symptom", "usage", "warning", "total", "used", "expiry", "imageType", "createdAt", "updatedAt"].map(key => [key, true]));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function output(row) {
  const { imageType, ...data } = row;
  const remaining = row.total - row.used;
  return { ...data, expiry: row.expiry?.toISOString().slice(0, 10) || "", remaining, lowStockThreshold: Math.max(1, Math.ceil(row.total * 0.2)),
    status: remaining === 0 ? "หมด" : remaining <= Math.max(1, Math.ceil(row.total * 0.2)) ? "ใกล้หมด" : "ปกติ",
    image: imageType ? `/api/medicines/${row.id}/image?v=${row.updatedAt.getTime()}` : "" };
}
function prefix(name) {
  const mapped = { "ยาพารา":"paracetamol", "พาราเซตามอล":"paracetamol", "พารา":"paracetamol", "ยาแก้ไอ":"cough", "ยาอมแก้เจ็บคอ":"lozenge", "ยาลดกรด":"antacid", "ผงเกลือแร่":"ors", "เบต้าดีน":"betadine", "แอม็อกซีซิลลิน":"amoxicillin", "อะม็อกซีซิลลิน":"amoxicillin", "ไอบูโพรเฟน":"ibuprofen", "เอทานอล":"ethanol", "โออาร์เอส":"ors" };
  const first = (mapped[name] || name.replace(/[^a-z]/gi, "") || "medicine")[0];
  return /^[a-zเแโใไฤฦ]/i.test(name) ? first.toUpperCase() : first.toLowerCase();
}
async function validate(body, partial = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw fail("ข้อมูลยาไม่ถูกต้อง");
  const data = {};
  for (const key of ["name", "productName", "genericName", "form", "size", "unit", "benefit", "symptom", "usage", "warning"]) {
    if (partial && body[key] === undefined) continue;
    const value = body[key] ?? "";
    const max = ["benefit", "symptom", "usage", "warning"].includes(key) ? 10000 : ["form", "size", "unit"].includes(key) ? 120 : 255;
    if (typeof value !== "string" || value.trim().length > max || key === "name" && !value.trim()) throw fail(`ข้อมูล ${key} ไม่ถูกต้อง`);
    data[key] = value.trim() || null;
  }
  if (!partial || body.category !== undefined) {
    if (!["oral", "topical", "equipment"].includes(body.category)) throw fail("กรุณาเลือกประเภทยา");
    data.category = body.category;
  }
  for (const key of ["total", "used"]) {
    if (partial && body[key] === undefined) continue;
    const value = body[key] === "" || body[key] === undefined ? 0 : body[key];
    if (!["number", "string"].includes(typeof value) || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 2147483647) throw fail("จำนวนต้องเป็นจำนวนเต็มตั้งแต่ศูนย์");
    data[key] = Number(value);
  }
  if (!partial || body.expiry !== undefined) {
    if (body.expiry == null || body.expiry === "") data.expiry = null;
    else {
      const value = body.expiry;
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fail("วันหมดอายุไม่ถูกต้อง");
      const date = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw fail("วันหมดอายุไม่ถูกต้อง");
      data.expiry = date;
    }
  }
  if (body.image !== undefined) {
    if (body.image === null || body.image === "") { data.imageData = null; data.imageType = null; }
    else {
      if (typeof body.image !== "string") throw fail("รูปภาพไม่ถูกต้อง");
      const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.image);
      if (!match) throw fail("รองรับเฉพาะ JPG, PNG และ WEBP");
      const bytes = Buffer.from(match[2], "base64");
      if (bytes.length > 2 * 1024 * 1024) throw fail("รูปภาพหลังย่อต้องไม่เกิน 2 MiB", 413);
      try {
        const image = sharp(bytes, { limitInputPixels: 16000000, failOn: "warning" });
        const meta = await image.metadata();
        if (meta.format !== match[1] || (meta.pages || 1) !== 1) throw Error("Invalid image");
        data.imageData = await image.rotate().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
        if (data.imageData.length > 2 * 1024 * 1024) throw Error("Image too large");
        data.imageType = "image/jpeg";
      } catch { throw fail("อ่านรูปภาพไม่ได้ กรุณาเลือกภาพใหม่"); }
    }
  }
  return data;
}
function inventory(data) { if (data.used > data.total) throw fail("จำนวนใช้/เบิกต้องไม่เกินจำนวนทั้งหมด"); }
router.get("/movements", async (_req, res) => {
  const rows = await prisma.stockMovement.findMany({ include: { medicine: { select: { name: true, code: true, unit: true } } }, orderBy: { createdAt: "desc" } });
  res.set("Cache-Control", "no-store").json({ success: true, data: rows });
});
router.get("/", async (_req, res) => {
  const rows = await prisma.medicine.findMany({ select, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  res.set("Cache-Control", "no-store").json({ success: true, data: rows.map(output) });
});
router.get("/:id/image", async (req, res) => {
  const row = await prisma.medicine.findUnique({ where: { id: req.params.id }, select: { imageData: true, imageType: true } });
  if (!row?.imageData) throw fail("ไม่พบรูปภาพ", 404);
  res.set("Cross-Origin-Resource-Policy", "cross-origin").set("Cache-Control", "no-cache").type(row.imageType).send(Buffer.from(row.imageData));
});
router.get("/:id", async (req, res) => {
  const row = await prisma.medicine.findFirst({ where: { OR: [{ id: req.params.id }, { code: req.params.id }] }, select });
  if (!row) throw fail("ไม่พบรายการยา", 404);
  res.json({ success: true, data: output(row) });
});
router.post("/", async (req, res) => {
  const result = await inv.atomic(req, async tx => {
    const data = await validate(req.body); inventory(data);
    if (!data.unit) throw fail("กรุณาระบุหน่วยสต็อก");
    const created = await tx.medicine.create({ data: { ...data, manualUsed: data.used, code: `pending-${randomUUID()}` } });
    const row = await tx.medicine.update({ where: { id: created.id }, data: { code: `${prefix(data.name)}${String(created.sequence).padStart(7, "0")}` } });
    await tx.stockMovement.create({ data: { medicineId: row.id, source: "opening", reason: "ยอดตั้งต้น", before: { total: 0, used: 0, manualUsed: 0, dispensed: 0, borrowed: 0, remaining: 0 }, after: inv.counts(row) } });
    return output(Object.fromEntries(Object.keys(select).map(k => [k, row[k]])));
  });
  res.status(201).json({ success: true, data: result });
});
async function update(req, build) {
  return inv.atomic(req, async tx => {
    const row = (await inv.lockMedicines(tx, [req.params.id])).get(req.params.id);
    const data = await build(row);
    if (data.unit !== undefined && (!data.unit || row.unit && data.unit !== row.unit && await tx.stockMovement.count({ where: { medicineId: row.id } }))) throw fail("รายการนี้มีประวัติแล้ว หากเปลี่ยนหน่วยกรุณาสร้างรายการยาใหม่");
    const stockChange = (data.total !== undefined && data.total !== row.total) || (data.used !== undefined && data.used !== row.used);
    if (stockChange && (typeof req.body.reason !== 'string' || !req.body.reason.trim() || req.body.reason.length > 2000)) throw fail("กรุณาระบุเหตุผลการปรับสต็อก");
    if (data.used !== undefined) { data.manualUsed = data.used - row.dispensed - row.borrowed; delete data.used; }
    const saved = stockChange ? await inv.change(tx, row, data, "manual", null, req.body.reason.trim()) : await tx.medicine.update({ where: { id: row.id }, data: { ...data } });
    return output(Object.fromEntries(Object.keys(select).map(k => [k, saved[k]])));
  });
}
router.patch("/:id/inventory", async (req, res) => {
  const { field, delta } = req.body || {};
  if (!["total", "used"].includes(field) || ![-1, 1].includes(delta)) throw fail("การปรับจำนวนไม่ถูกต้อง");
  const data = await update(req, row => ({ [field]: row[field] + delta }));
  res.json({ success: true, data });
});
router.patch("/:id", async (req, res) => {
  const data = await update(req, () => validate(req.body, true));
  res.json({ success: true, data });
});
router.delete("/:id", async (req, res) => {
  const data = await update(req, () => ({ active: false }));
  res.json({ success: true, data });
});
router.use(inv.errorHandler);
module.exports = router;
