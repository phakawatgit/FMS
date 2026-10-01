const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const prisma = require('../src/lib/prisma');
const { medicineImageUrl } = require('../src/lib/image-url');
(async () => {
  const rows = await prisma.$transaction(async tx => {
    // Serialize with image uploads. Never change stock counters or image bytes.
    const medicines = await tx.$queryRaw`SELECT "id", "imageType", ("imageData" IS NOT NULL) AS "hasImage" FROM "Medicine" ORDER BY "id" FOR UPDATE`;
    for (const row of medicines) {
      const imageUrl = row.hasImage && row.imageType ? medicineImageUrl(row.id) : null;
      await tx.$executeRaw`UPDATE "Medicine" SET "imageUrl" = ${imageUrl} WHERE "id" = ${row.id}`;
    }
    return medicines.length;
  }, { maxWait: 15000, timeout: 60000 });
  console.log(`Updated image URLs for ${rows} medicines; image bytes and stock unchanged`);
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
