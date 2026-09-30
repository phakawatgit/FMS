const { createHash } = require('node:crypto');
const prisma = require('./prisma');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const include = { dispensations: true };
function items(value) {
  if (!Array.isArray(value) || value.length > 100) throw fail('รายการยาไม่ถูกต้อง');
  const seen = new Set();
  return value.map(item => {
    if (!item || typeof item.medicineId !== 'string' || !item.medicineId || seen.has(item.medicineId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647) throw fail('เลือกยาไม่ซ้ำและระบุจำนวนเต็มบวก');
    seen.add(item.medicineId);
    return { medicineId: item.medicineId, quantity: item.quantity };
  });
}
async function atomic(req, work) {
  const key = req.get('Idempotency-Key');
  if (!key || !/^[\w-]{16,100}$/.test(key)) throw fail('กรุณาส่งรหัสคำขอเพื่อป้องกันการบันทึกซ้ำ');
  const fingerprint = createHash('sha256').update(req.method + req.originalUrl + JSON.stringify(req.body)).digest('hex');
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    const old = await tx.inventoryRequest.findUnique({ where: { id: key } });
    if (old) {
      if (old.fingerprint !== fingerprint) throw fail('รหัสคำขอนี้ใช้กับข้อมูลอื่นแล้ว', 409);
      return old.result;
    }
    const result = JSON.parse(JSON.stringify(await work(tx)));
    await tx.inventoryRequest.create({ data: { id: key, fingerprint, result } });
    return result;
  }, { maxWait: 15000, timeout: 20000 });
}
async function lockMedicines(tx, ids) {
  const records = new Map();
  for (const id of [...new Set(ids)].sort()) {
    const rows = await tx.$queryRaw`SELECT * FROM "Medicine" WHERE "id" = ${id} FOR UPDATE`;
    if (!rows.length) throw fail('ไม่พบรายการยาในคลัง', 404);
    records.set(id, rows[0]);
  }
  return records;
}
const counts = row => ({ total: row.total, used: row.used, manualUsed: row.manualUsed, dispensed: row.dispensed, borrowed: row.borrowed, remaining: row.total - row.used });
async function change(tx, row, data, source, sourceId, reason) {
  const next = { ...row, ...data };
  next.used = next.manualUsed + next.dispensed + next.borrowed;
  if (![next.total, next.used, next.manualUsed, next.dispensed, next.borrowed].every(n => Number.isInteger(n) && n >= 0 && n <= 2147483647) || next.used > next.total) throw fail(`สต็อก ${row.name} ไม่เพียงพอหรือยอดปรับไม่ถูกต้อง (คงเหลือ ${row.total - row.used} ${row.unit || 'หน่วย'})`, 409);
  const saved = await tx.medicine.update({ where: { id: row.id }, data: { ...data, used: next.used } });
  await tx.stockMovement.create({ data: { medicineId: row.id, source, sourceId, reason, before: counts(row), after: counts(saved) } });
  return saved;
}
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function available(row) {
  if (!row.active || !row.unit || (row.expiry && row.expiry.toISOString().slice(0, 10) < today())) throw fail(`ยา ${row.name} เลิกใช้งาน หมดอายุ หรือยังไม่ได้กำหนดหน่วย`, 409);
}
async function dispense(tx, visit, requested) {
  const next = items(requested);
  const old = visit.dispensations || [];
  const rows = await lockMedicines(tx, [...old, ...next].map(i => i.medicineId));
  const snapshots = [];
  for (const [id, row] of rows) {
    const before = old.find(i => i.medicineId === id);
    const after = next.find(i => i.medicineId === id);
    const delta = (after?.quantity || 0) - (before?.quantity || 0);
    if (delta > 0) available(row);
    if (delta) await change(tx, row, { dispensed: row.dispensed + delta }, 'infirmary', visit.id, 'บันทึก/แก้ไขการจ่ายยา');
    if (after) snapshots.push({ medicineId: id, quantity: after.quantity, name: before?.name || row.name, code: before?.code || row.code, unit: before?.unit || row.unit });
  }
  await tx.dispensation.deleteMany({ where: { visitId: visit.id } });
  if (snapshots.length) await tx.dispensation.createMany({ data: snapshots.map(i => ({ ...i, visitId: visit.id })) });
}
function errorHandler(error, _req, res, _next) {
  const status = error.status || (error.code === 'P2025' ? 404 : 503);
  if (status === 503) console.error('Inventory operation failed:', error.code || error.message);
  res.status(status).json({ success: false, message: error.status ? error.message : status === 404 ? 'ไม่พบรายการ' : 'บันทึกฐานข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง' });
}
module.exports = { fail, items, atomic, lockMedicines, change, available, dispense, include, errorHandler, counts, today };
