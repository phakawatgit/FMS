const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

router.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, database: "postgresql", status: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    res.status(503).json({ success: false, database: "postgresql", status: "disconnected" });
  }
});

module.exports = router;
