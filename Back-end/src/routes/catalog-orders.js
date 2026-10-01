const router = require('express').Router();
const prisma = require('../lib/prisma');
const { isDeepStrictEqual } = require('node:util');
const { fail, errorHandler } = require('../lib/inventory');
const { audit } = require('../lib/audit');
const { output, include } = require('../lib/catalog');
router.get('/', async (_req, res) => {
  const rows = await prisma.catalogOrder.findMany({ where: { deletedAt: null }, include, orderBy: { sequence: 'desc' } });
  res.set('Cache-Control', 'no-store').json({ success: true, data: rows.map(output) });
});
router.post('/', async (req, res) => {
  const { id, documentTitle, items } = req.body || {};
  if (typeof id !== 'string' || !/^[\w-]{16,100}$/.test(id) || typeof documentTitle !== 'string' || documentTitle.length > 500 || !Array.isArray(items) || !items.length || items.length > 100) throw fail('Invalid order');
  if (items.some(i => !i || typeof i.code !== 'string' || !i.code || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 2147483647)) throw fail('Invalid order items');
  if (new Set(items.map(i => i.code)).size !== items.length) throw fail('Duplicate order items');
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`;
    const old = await tx.catalogOrder.findUnique({ where: { id }, include });
    if (old) {
      if (old.deletedAt || old.documentTitle !== documentTitle || !isDeepStrictEqual(old.items.map(i => i.snapshot), items)) throw fail('Order ID already used with different data', 409);
      return output(old);
    }
    const medicines = await tx.medicine.findMany({ where: { code: { in: items.map(i => i.code) }, active: true }, select: { id: true, code: true } });
    if (medicines.length !== items.length) throw fail('Order contains unavailable products', 409);
    const row = await tx.catalogOrder.create({ data: { id, documentTitle,
      items: { create: items.map((item, index) => ({ position: index + 1, medicineId: medicines.find(m => m.code === item.code).id, code: item.code, quantity: item.quantity, snapshot: item })) }
    }, include });
    await audit(tx, req, 'create', 'CatalogOrder', id, { itemCount: items.length });
    return output(row);
  }, { maxWait: 15000, timeout: 20000 });
  res.status(201).json({ success: true, data: result });
});
router.delete('/:id', async (req, res) => {
  await prisma.$transaction(async tx => {
    const changed = await tx.catalogOrder.updateMany({ where: { id: req.params.id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (changed.count) await audit(tx, req, 'delete', 'CatalogOrder', req.params.id);
  });
  res.json({ success: true, data: { id: req.params.id } });
});
router.use(errorHandler);
module.exports = router;
