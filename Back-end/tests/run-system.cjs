const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const url = new URL(process.env.DATABASE_URL); url.pathname = '/fms_system_test';
process.env.DATABASE_URL = url.href;
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_PROJECT_ID = 'demo-fms';
process.env.TEST_API_URL = 'http://127.0.0.1:4016/api';
process.env.WEB_URL ||= 'http://localhost:3000';
process.env.BROWSER_CHANNEL ||= 'msedge';
const db = require('../src/lib/prisma');
const { getFirebaseAuth } = require('../src/lib/firebase-admin');
let server, account;
async function child(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, args, { cwd: path.join(__dirname, '..'), env, stdio: 'inherit', windowsHide: true });
    p.on('error', reject); p.on('exit', code => code ? reject(Error(`${args.at(-1)} failed (${code})`)) : resolve());
  });
}
(async () => {
  try {
    process.env.TEST_AUTH_EMAIL = `system-${randomUUID()}@example.test`;
    process.env.TEST_AUTH_PASSWORD = randomUUID();
    const signup = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.TEST_AUTH_EMAIL, password: process.env.TEST_AUTH_PASSWORD, returnSecureToken: true }) });
    account = await signup.json(); if (!signup.ok) throw Error('Auth Emulator signup failed');
    process.env.TEST_AUTH_TOKEN = account.idToken;
    await getFirebaseAuth().updateUser(account.localId, { emailVerified: true });
    await db.user.create({ data: { firebaseUid: account.localId, email: process.env.TEST_AUTH_EMAIL, name: 'System test admin', role: 'ADMIN' } });
    server = spawn(process.execPath, ['src/server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: '4016', PUBLIC_API_URL: 'http://127.0.0.1:4016' }, stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true });
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(process.env.TEST_API_URL + '/health')).ok) break; } catch {}
      if (i === 99) throw Error('Test API unavailable');
      await new Promise(r => setTimeout(r, 100));
    }
    const tests = process.argv.slice(2);
    for (const name of tests.length ? tests : ['system-persistence', 'inventory-relations', 'inventory-browser', 'dashboard', 'infirmary-persistence', 'medicine-persistence']) {
      if (!/^[a-z-]+$/.test(name)) throw Error('Invalid test name');
      console.log(`RUN ${name} (isolated database + Auth Emulator)`);
      await child(['--require', './tests/auth-test.cjs', `tests/${name}.cjs`]);
    }
  } finally {
    if (server && server.exitCode === null) { const done = new Promise(r => server.once('exit', r)); server.kill(); await done; }
    if (account?.localId) {
      await db.nurse.deleteMany({ where: { email: process.env.TEST_AUTH_EMAIL } });
      await db.user.deleteMany({ where: { firebaseUid: account.localId } });
      await getFirebaseAuth().deleteUser(account.localId);
    }
    await db.$disconnect();
  }
})().catch(e => { console.error(e.code || e.message); process.exitCode = 1; });
