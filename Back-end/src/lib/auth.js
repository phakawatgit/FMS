const prisma = require('./prisma');
const { getFirebaseAuth } = require('./firebase-admin');
async function authenticate(req, res, next) {
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' });
  let decoded;
  try { decoded = await getFirebaseAuth().verifyIdToken(token, true); }
  catch (error) {
    const unavailable = error.message.includes('not configured');
    return res.status(unavailable ? 503 : 401).json({ success: false, message: unavailable ? 'ระบบยืนยันตัวตนยังไม่พร้อม' : 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
  const email = String(decoded.email || '').trim().toLowerCase();
  if (!email) return res.status(401).json({ success: false, message: 'บัญชีต้องมีอีเมล' });
  try {
    req.user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
    if (!req.user) req.user = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))`;
      let user = await tx.user.findUnique({ where: { firebaseUid: decoded.uid } });
      if (!user) {
        const old = await tx.user.findUnique({ where: { email } });
        // Existing privileged accounts can only be linked to a verified email.
        if (old && (!decoded.email_verified || old.firebaseUid)) throw Object.assign(Error('ยืนยันอีเมลก่อนเชื่อมบัญชีเดิม'), { status: 403 });
        user = old ? await tx.user.update({ where: { id: old.id }, data: { firebaseUid: decoded.uid } })
          : await tx.user.create({ data: { firebaseUid: decoded.uid, email, name: decoded.name || email, role: 'NURSE' } });
      }
      return user;
    }, { maxWait: 15000, timeout: 20000 });
    if (!req.user.active) return res.status(403).json({ success: false, message: 'บัญชีถูกระงับการใช้งาน' });
    req.firebase = decoded;
    next();
  } catch (error) { next(error); }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'เฉพาะผู้ดูแลระบบ' });
  next();
}
module.exports = { authenticate, adminOnly };
