const router = require('express').Router();
const db = require('../lib/prisma');
const { adminOnly } = require('../lib/auth');
const { audit } = require('../lib/audit');
const { fail, errorHandler } = require('../lib/inventory');
router.get('/', async (_req, res) => {
  const faculties = await db.faculty.findMany({ include: { branches: { orderBy: { name: 'asc' } } }, orderBy: { name: 'asc' } });
  res.set('Cache-Control', 'no-store').json({ success: true, data: { faculties } });
});
router.post('/:kind', adminOnly, async (req, res) => {
  const { kind } = req.params, { name, code, facultyId } = req.body || {};
  if (!['faculties', 'branches'].includes(kind) || typeof name !== 'string' || !name.trim() || name.length > 255) throw fail('ข้อมูลตั้งค่าไม่ถูกต้อง');
  if (kind === 'faculties' && (typeof code !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(code))) throw fail('รหัสหลักสูตรไม่ถูกต้อง');
  const data = await db.$transaction(async tx => {
    let row;
    if (kind === 'faculties') row = await tx.faculty.create({ data: { name: name.trim(), code } });
    else {
      if (typeof facultyId !== 'string' || !await tx.faculty.findFirst({ where: { id: facultyId, active: true } })) throw fail('กรุณาเลือกหลักสูตรที่เปิดใช้งาน');
      row = await tx.branch.create({ data: { name: name.trim(), facultyId } });
    }
    await audit(tx, req, 'create', kind, row.id);
    return row;
  });
  res.status(201).json({ success: true, data });
});
router.patch('/:kind/:id', adminOnly, async (req, res) => {
  const model = { faculties: 'faculty', branches: 'branch' }[req.params.kind];
  const { active } = req.body || {};
  if (!model || typeof active !== 'boolean' || Object.keys(req.body).some(k => k !== 'active')) throw fail('ข้อมูลตั้งค่าไม่ถูกต้อง');
  const data = await db.$transaction(async tx => {
    const row = await tx[model].update({ where: { id: req.params.id }, data: { active } });
    await audit(tx, req, active ? 'activate' : 'deactivate', req.params.kind, row.id);
    return row;
  });
  res.json({ success: true, data });
});
router.use((err, req, res, next) => err.code === 'P2002' ? res.status(409).json({ success: false, message: 'ชื่อหรือรหัสนี้มีอยู่แล้ว' }) : next(err));
router.use(errorHandler);
module.exports = router;
