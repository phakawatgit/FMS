const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const db = require('../src/lib/prisma');
const { getFirebaseAuth } = require('../src/lib/firebase-admin');
(async () => {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Usage: node scripts/set-admin.cjs account@example.com');
  const account = await getFirebaseAuth().getUserByEmail(email);
  if (!account.emailVerified || account.disabled) throw Error('Account must be verified and enabled');
  await db.$transaction(async tx => {
    const user = await tx.user.upsert({ where: { email }, create: { email, firebaseUid: account.uid, name: account.displayName || email, role: 'ADMIN' }, update: { firebaseUid: account.uid, role: 'ADMIN', active: true } });
    await tx.auditLog.create({ data: { action: 'bootstrap-admin', entity: 'User', entityId: user.id, detail: {} } });
  });
  console.log('Admin role assigned to the specified verified Firebase account');
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
