const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;

const prisma = globalForPrisma.__fmsPrisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__fmsPrisma = prisma;
}

module.exports = prisma;
