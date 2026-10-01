import "dotenv/config";
import cors from "cors";
import express from "express";
import { disconnectPrisma, prisma } from "./lib/prisma.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import healthRouter from "./routes/health.js";
import visitRouter from "./routes/visit.route.js";

const app = express();
const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/api/health", healthRouter);
app.use("/api/visits", visitRouter);
app.use(errorHandler);

const server = app.listen(port, async () => {
  try {
    await prisma.$connect();
    console.info("FMS API database status: connected");
  } catch (error) {
    console.error("FMS API database status: disconnected", error);
  }
  console.info(`FMS API listening on :${port}`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; shutting down FMS API.`);

  const closeServer = new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  try {
    await closeServer;
  } catch (error) {
    console.error("Failed to close the HTTP server cleanly:", error);
  }

  try {
    await disconnectPrisma();
  } catch (error) {
    console.error("Failed to disconnect Prisma cleanly:", error);
    process.exitCode = 1;
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void shutdown(signal));
}
