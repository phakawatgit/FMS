require("dotenv").config({ path: require("node:path").resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const prisma = require("./lib/prisma");
const healthRouter = require("./routes/health");
const apiRouter = require("./routes/index");
const { requireCsrfForUnsafeMethods, requireFirebaseSession } = require("./middleware/firebase-session");

const app = express();
const initialNurseNames = [
  "นางศิริวรรณ คงบุญแก้ว",
  "นางสุกัญญา มนธรรมสกุล",
  "นายณัฐพล นาคบุตร",
  "น.ส.นารีนุช เพ็ชรเวช",
  "น.ส.เจนจิรา เกิดกอบ",
  "น.ส.มนธยา จูบุญส่ง",
  "น.ส.ปัญญาพร ปิยะวัฒน์",
  "น.ส.ฤทัยรัตน์ อุ่นนอง",
  "น.ส.พรพิมล วิเชียรรัตน์",
  "น.ส.ปริมมา เสาวรส",
];

app.disable("x-powered-by");
app.use(helmet());
const allowedOrigins = new Set([
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
]);
app.use(cors({
  origin(origin, callback) {
    const isLocalDevelopmentOrigin = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):\d+$/.test(origin || "");
    if (!origin || allowedOrigins.has(origin) || isLocalDevelopmentOrigin) {
      return callback(null, true);
    }
    return callback(new Error("CORS origin is not allowed"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/", (_req, res) => {
  res.json({ name: "FMS API", status: "running", version: "1.0.0" });
});

app.use("/api/health", healthRouter);
app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/auth/") || req.path === "/database/health") return next();
  return requireFirebaseSession(req, res, () => requireCsrfForUnsafeMethods(req, res, next));
});
app.use("/api", apiRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "ไม่พบเส้นทาง API นี้" });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
});

function startServer() {
  const port = Number(process.env.PORT || 4000);
  return prisma.nurse.createMany({
    data: initialNurseNames.map((fullName) => ({ fullName })),
    skipDuplicates: true,
  }).then(() => {
    return app.listen(port, () => console.log(`FMS API listening on http://localhost:${port}`));
  }).catch((error) => {
    console.error("Nurse seed failed:", error);
    process.exit(1);
  });
}

if (require.main === module) startServer();

module.exports = { app, startServer };
