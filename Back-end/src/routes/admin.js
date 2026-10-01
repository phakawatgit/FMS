const router = require('express').Router();
const db = require('../lib/prisma');
const { adminOnly } = require('../lib/auth');
const { audit } = require('../lib/audit');
const { fail, errorHandler } = require('../lib/inventory');
router.use(adminOnly);
router.get('/users', async (_req, res) => res.json({ success: true, data: await db.user.findMany({ select: { id: true, email: true, name: true, role: true, active: true }, orderBy: { createdAt: 'desc' } }) }));
router.patch('/users/:id', async (req, res) => {
  const { role, active } = req.body || {};
  if (!['ADMIN', 'NURSE'].includes(role) || typeof active !== 'boolean') throw fail('สิทธิ์หรือสถานะบัญชีไม่ถูกต้อง');
  const data = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('fms-admin-roles',0))`;
    const old = await tx.user.findUnique({ where: { id: req.params.id } });
    if (!old) throw fail('ไม่พบบัญชี', 404);
    if (old.active && old.role === 'ADMIN' && (!active || role !== 'ADMIN') && await tx.user.count({ where: { role: 'ADMIN', active: true } }) <= 1) throw fail('ต้องมีผู้ดูแลระบบที่เปิดใช้งานอย่างน้อยหนึ่งคน', 409);
    const user = await tx.user.update({ where: { id: old.id }, data: { role, active }, select: { id: true, email: true, name: true, role: true, active: true } });
    await audit(tx, req, 'permissions', 'User', old.id, { role, active });
    return user;
  });
  res.json({ success: true, data });
});
router.get('/audit', async (req, res) => {
  const take = Number(req.query.limit || 100);
  if (!Number.isInteger(take) || take < 1 || take > 500) throw fail('จำนวนรายการไม่ถูกต้อง');
  const rows = await db.auditLog.findMany({ take, ...(typeof req.query.cursor === 'string' ? { cursor: { id: req.query.cursor }, skip: 1 } : {}), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  res.json({ success: true, data: rows, nextCursor: rows.length === take ? rows.at(-1).id : null });
});
router.use(errorHandler);
module.exports = router;
