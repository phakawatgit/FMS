const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const db = require('../src/lib/prisma');
const references = require('./reference-data.json');
(async () => {
  await db.$transaction(async tx => {
    for (const entry of references) {
      const faculty = await tx.faculty.upsert({ where: { code: entry.code }, create: { code: entry.code, name: entry.name }, update: {} });
      for (const name of entry.branches) await tx.branch.upsert({ where: { facultyId_name: { facultyId: faculty.id, name } }, create: { facultyId: faculty.id, name }, update: {} });
    }
  });
  console.log('Reference data seeded from existing form options; existing settings preserved');
})().catch(e => { console.error(e.code || e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
