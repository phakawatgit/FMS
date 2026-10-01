import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.status(200).json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check database query failed:", error);
    response.status(500).json({
      status: "error",
      db: "disconnected",
      timestamp: new Date().toISOString(),
      error:
        process.env.NODE_ENV === "production"
          ? "Database connection failed"
          : error instanceof Error
            ? error.message
            : "Database connection failed",
    });
  }
});

export default router;
