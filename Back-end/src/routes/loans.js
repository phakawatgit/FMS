const express = require('express');
const prisma = require('../lib/prisma');
const inv = require('../lib/inventory');
const router = express.Router();
const include = { items: true, returns: { orderBy: { createdAt: 'asc' } } };
const dateText = d => new Date(d).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric' });
function output(row) {
  const remaining = row.items.map(i => ({ ...i, quantity: i.quantity - i.returned })).filter(i => i.quantity);
  return { ...row.details, id: row.id, date: dateText(row.createdAt), due: dateText(row.dueDate), dueDate: row.dueDate, items: remaining, borrowedItems: row.items, status: !remaining.length ? 'returned' : row.dueDate.toISOString().slice(0,10) < inv.today() ? 'overdue' : 'borrowed', returnHistory: row.returns.map(r => ({ date: dateText(r.createdAt), items: r.items })), createdAt: row.createdAt };
}
function due(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw inv.fail('กรุณาระบุวันกำหนดคืน');
  const d = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== value) throw inv.fail('วันกำหนดคืนไม่ถูกต้อง');
  return d;
}
router.get('/', async (_req, res) => {
  const rows = await prisma.loan.findMany({ include, orderBy: { createdAt: 'desc' } });
  res.set('Cache-Control', 'no-store').json({ success: true, data: rows.map(output) });
});
router.post('/', async (req, res) => {
  const result = await inv.atomic(req, async tx => {
    const requested = inv.items(req.body.items);
    if (!requested.length || typeof req.body.details?.fullName !== 'string' || !req.body.details.fullName.trim()) throw inv.fail('กรุณาระบุผู้ยืมและรายการยา');
    const details = {};
    for (const key of ['fullName','nickname','studentId','phone','branch','department','activity','reason','role','borrower','borrowerType','kind']) {
      if (req.body.details[key] != null) {
        if (typeof req.body.details[key] !== 'string' || req.body.details[key].length > 2000) throw inv.fail('ข้อมูลผู้ยืมไม่ถูกต้อง');
        details[key] = req.body.details[key].trim();
      }
    }
    details.item = details.fullName;
    const rows = await inv.lockMedicines(tx, requested.map(i => i.medicineId));
    const loan = await tx.loan.create({ data: { details, dueDate: due(req.body.dueDate) } });
    for (const item of requested) {
      const row = rows.get(item.medicineId); inv.available(row);
      await inv.change(tx, row, { borrowed: row.borrowed + item.quantity }, 'borrow', loan.id, 'ยืมยา/เวชภัณฑ์');
      await tx.loanItem.create({ data: { loanId: loan.id, ...item, name: row.name, code: row.code, unit: row.unit } });
    }
    return output(await tx.loan.findUnique({ where: { id: loan.id }, include }));
  });
  res.status(201).json({ success: true, data: result });
});
async function lockLoan(tx, id) {
  await tx.$queryRaw`SELECT "id" FROM "Loan" WHERE "id" = ${id} FOR UPDATE`;
  const row = await tx.loan.findUnique({ where: { id }, include });
  if (!row) throw inv.fail('ไม่พบใบยืม', 404);
  return row;
}
router.post('/:id/returns', async (req, res) => {
  const result = await inv.atomic(req, async tx => {
    const loan = await lockLoan(tx, req.params.id);
    const requested = inv.items(req.body.items);
    if (!requested.length) throw inv.fail('กรุณาระบุรายการคืน');
    const rows = await inv.lockMedicines(tx, requested.map(i => i.medicineId));
    const snapshots = [];
    for (const item of requested) {
      const original = loan.items.find(i => i.medicineId === item.medicineId);
      if (!original || item.quantity > original.quantity - original.returned) throw inv.fail('จำนวนคืนเกินยอดยืมค้าง', 409);
      const row = rows.get(item.medicineId);
      await inv.change(tx, row, { borrowed: row.borrowed - item.quantity }, 'return', loan.id, 'คืนยา/เวชภัณฑ์');
      await tx.loanItem.update({ where: { id: original.id }, data: { returned: { increment: item.quantity } } });
      snapshots.push({ ...item, name: original.name, code: original.code, unit: original.unit });
    }
    await tx.loanReturn.create({ data: { loanId: loan.id, items: snapshots } });
    return output(await tx.loan.findUnique({ where: { id: loan.id }, include }));
  });
  res.json({ success: true, data: result });
});
router.patch('/:id', async (req, res) => {
  const result = await inv.atomic(req, async tx => {
    const row = await lockLoan(tx, req.params.id);
    const date = due(req.body.dueDate);
    if (!row.items.some(i => i.returned < i.quantity) || date <= row.dueDate) throw inv.fail('วันต่ออายุต้องอยู่หลังกำหนดเดิมและมีรายการค้างคืน');
    const history = Array.isArray(row.details.extensions) ? row.details.extensions : [];
    return output(await tx.loan.update({ where: { id: row.id }, data: { dueDate: date, details: { ...row.details, originalDue: row.details.originalDue || dateText(row.dueDate), extendedDue: dateText(date), extensionDate: dateText(date), extensions: [...history, { before: row.dueDate.toISOString(), after: date.toISOString(), at: new Date().toISOString() }] } }, include }));
  });
  res.json({ success: true, data: result });
});
router.use(inv.errorHandler);
module.exports = router;
