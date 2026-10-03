const express = require("express");
const prisma = require("../lib/prisma");
const router = express.Router();
const legacyKey = "fms-stock-records";
const imageDataPattern = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/i;
const textFields = ["name", "productName", "genericName", "category", "form", "size", "unit", "status", "benefit", "symptom", "usage", "warning"];

function serialize(row, req) {
  const image = row.imageUrl?.startsWith("/api/")
    ? `${req.protocol}://${req.get("host")}${row.imageUrl}`
    : row.imageUrl || (row.imageData ? `${req.protocol}://${req.get("host")}/api/catalog/${encodeURIComponent(row.code)}/image` : "");
  return {
    code: row.code, name: row.name, productName: row.productName || "", genericName: row.genericName || "",
    category: row.category, form: row.form || "", size: row.size || "", unit: row.unit,
    total: row.total, used: row.used, remaining: row.remaining, status: row.status,
    benefit: row.benefit || "", symptom: row.symptom || "", usage: row.usage || "", warning: row.warning || "",
    expiry: row.expiry ? row.expiry.toISOString().slice(0, 10) : "", image, imageUrl: image,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

async function listRecords(req) {
  const rows = await prisma.catalog.findMany({ orderBy: [{ createdAt: "desc" }, { code: "asc" }] });
  return rows.map((row) => serialize(row, req));
}

function normalize(input, req) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("invalid record");
  const record = {};
  for (const field of textFields) {
    const value = input[field] == null ? "" : String(input[field]).trim();
    const max = { name: 200, productName: 200, genericName: 200, category: 80, form: 120, size: 120, unit: 40, status: 40 }[field] || 10000;
    if (value.length > max) throw new Error("field too long");
    record[field] = value || null;
  }
  record.code = String(input.code || "").trim();
  if (!record.code || record.code.length > 80 || !record.name || !record.category) throw new Error("required field missing");
  record.unit ||= "unit";
  record.status ||= "ปกติ";
  for (const field of ["total", "used", "remaining"]) {
    const number = Number(input[field] ?? 0);
    if (!Number.isSafeInteger(number) || number < 0) throw new Error("invalid inventory amount");
    record[field] = number;
  }
  record.used = Math.min(record.used, record.total);
  record.remaining = Math.max(0, record.total - record.used);
  const expiry = String(input.expiry || "").trim();
  if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) throw new Error("invalid expiry");
  record.expiry = expiry ? new Date(`${expiry}T00:00:00.000Z`) : null;
  const image = String(input.image || input.imageUrl || "").trim();
  const dataMatch = imageDataPattern.exec(image);
  const localImageRoute = `/api/catalog/${encodeURIComponent(record.code)}/image`;
  const localImageUrl = req ? `${req.protocol}://${req.get("host")}${localImageRoute}` : localImageRoute;
  if (dataMatch) {
    const bytes = Buffer.from(dataMatch[2], "base64");
    if (bytes.length > 5 * 1024 * 1024) throw new Error("image too large");
    record.imageData = bytes;
    record.imageMimeType = `image/${dataMatch[1].toLowerCase()}`;
    record.imageUrl = localImageUrl;
  } else if (image) {
    let url;
    try { url = new URL(image); } catch { throw new Error("image must be a URL"); }
    if (!['http:', 'https:'].includes(url.protocol) || url.href.length > 2048) throw new Error("image must be an HTTP URL");
    record.imageUrl = url.pathname === localImageRoute ? localImageUrl : url.href;
    record.imageData = null;
    record.imageMimeType = null;
  } else {
    record.imageUrl = null;
    record.imageData = null;
    record.imageMimeType = null;
  }
  return record;
}

async function syncRecords(records, req) {
  if (!Array.isArray(records) || records.length > 5000) throw new Error("invalid catalog list");
  const normalized = records.map((record) => normalize(record, req));
  if (new Set(normalized.map((item) => item.code)).size !== normalized.length) throw new Error("duplicate catalog code");
  return prisma.$transaction(async (tx) => {
    for (const item of normalized) {
      const { code, ...data } = item;
      if (item.imageUrl && item.imageUrl.endsWith(`/api/catalog/${encodeURIComponent(code)}/image`)) {
        const existing = await tx.catalog.findUnique({ where: { code }, select: { imageData: true, imageMimeType: true } });
        if (existing?.imageData && !data.imageData) {
          data.imageData = existing.imageData;
          data.imageMimeType = existing.imageMimeType;
        }
      }
      await tx.catalog.upsert({ where: { code }, create: { code, ...data }, update: data });
    }
    if (normalized.length) await tx.catalog.deleteMany({ where: { code: { notIn: normalized.map((item) => item.code) } } });
    else await tx.catalog.deleteMany();
    return tx.catalog.findMany({ orderBy: [{ createdAt: "desc" }, { code: "asc" }] });
  }, { maxWait: 10000, timeout: 30000 });
}

router.get("/", async (req, res) => {
  try { return res.json({ success: true, data: await listRecords(req) }); }
  catch (error) {
    console.error("Catalog read failed:", error.message);
    return res.status(503).json({ success: false, message: "อ่านรายการ Catalog ไม่สำเร็จ" });
  }
});

// Any signed-in staff member can add a new catalog item. Existing items and
// stock quantities remain protected by the admin-only full-list update route.
router.post("/", async (req, res) => {
  try {
    const data = normalize(req.body?.record, req);
    const codeMatch = /^(.*?)(\d+)$/.exec(data.code);
    let code = data.code;
    let created;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        created = await prisma.catalog.create({ data: { ...data, code } });
        break;
      } catch (error) {
        if (error.code !== "P2002" || !codeMatch) throw error;
        const existingCodes = await prisma.catalog.findMany({
          where: { code: { startsWith: codeMatch[1] } },
          select: { code: true },
        });
        const maxNumber = existingCodes.reduce((max, item) => {
          const match = /^(.*?)(\d+)$/.exec(item.code);
          return match?.[1] === codeMatch[1] ? Math.max(max, Number(match[2])) : max;
        }, Number(codeMatch[2]));
        code = `${codeMatch[1]}${String(maxNumber + 1).padStart(codeMatch[2].length, "0")}`;
      }
    }

    if (!created) return res.status(409).json({ success: false, message: "สร้างรหัสยาไม่สำเร็จ กรุณาลองอีกครั้ง" });
    return res.status(201).json({ success: true, data: serialize(created, req) });
  } catch (error) {
    const invalidInput = ["invalid record", "field too long", "required field missing", "invalid inventory amount", "invalid expiry", "image must be a URL", "image must be an HTTP URL", "image too large"].includes(error.message);
    if (!invalidInput) console.error("Catalog create failed:", error.message);
    const status = invalidInput ? 400 : error.code === "P2002" ? 409 : 503;
    return res.status(status).json({
      success: false,
      message: status === 400 ? "ข้อมูล Catalog ไม่ถูกต้อง" : status === 409 ? "รหัสยานี้มีอยู่แล้ว กรุณาลองอีกครั้ง" : "บันทึก Catalog ไม่สำเร็จ",
    });
  }
});

router.put("/", async (req, res) => {
  try {
    const rows = await syncRecords(req.body?.records, req);
    return res.json({ success: true, data: rows.map((row) => serialize(row, req)) });
  } catch (error) {
    const status = ["invalid record", "field too long", "required field missing", "invalid inventory amount", "invalid expiry", "image must be a URL", "image must be an HTTP URL", "image too large", "invalid catalog list", "duplicate catalog code"].includes(error.message) ? 400 : 503;
    console.error("Catalog write failed:", error.message);
    return res.status(status).json({ success: false, message: status === 400 ? "ข้อมูล Catalog ไม่ถูกต้อง" : "บันทึก Catalog ไม่สำเร็จ" });
  }
});

router.get("/:code/image", async (req, res) => {
  // Product photos are served by the API on a different local port than the UI.
  // Allow the browser to embed this public image response across that origin boundary.
  res.set("Cross-Origin-Resource-Policy", "cross-origin");
  try {
    const item = await prisma.catalog.findUnique({ where: { code: req.params.code }, select: { imageData: true, imageMimeType: true, imageUrl: true } });
    if (!item) return res.sendStatus(404);
    if (item.imageData) {
      res.set("Content-Type", item.imageMimeType || "application/octet-stream");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(Buffer.from(item.imageData));
    }
    if (item.imageUrl) return res.redirect(302, item.imageUrl);
    return res.sendStatus(404);
  } catch (error) {
    console.error("Catalog image read failed:", error.message);
    return res.sendStatus(503);
  }
});

router.listRecords = listRecords;
router.syncRecords = syncRecords;
router.serialize = serialize;
module.exports = router;
