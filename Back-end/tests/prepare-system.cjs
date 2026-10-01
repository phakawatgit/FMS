const path = require('node:path');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
(async () => {
  const source = new PrismaClient();
  try {
    const found = await source.$queryRaw`SELECT 1 FROM pg_database WHERE datname = 'fms_system_test'`;
    if (!found.length) await source.$executeRawUnsafe('CREATE DATABASE fms_system_test');
  } finally { await source.$disconnect(); }
  const url = new URL(process.env.DATABASE_URL); url.pathname = '/fms_system_test';
  const env = { ...process.env, DATABASE_URL: url.href, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIREBASE_PROJECT_ID: 'demo-fms', PORT: '4016', PUBLIC_API_URL: 'http://127.0.0.1:4016' };
  const run = args => { const result = spawnSync(process.execPath, args, { cwd: path.join(__dirname, '..'), env, stdio: 'inherit', windowsHide: true }); if (result.status) throw Error('Preparation failed'); };
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  run(['scripts/seed-reference-data.cjs']);
  console.log('Test database fms_system_test prepared; existing application database untouched');
})().catch(e => { console.error(e.code || e.message); process.exitCode = 1; });
