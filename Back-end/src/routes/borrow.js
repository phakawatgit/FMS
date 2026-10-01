const express = require("express");
const prisma = require("../lib/prisma");
const router = express.Router();

function legacy(record) {
  const returns = record.items.flatMap((item) => item.returns.map((entry) => ({
    date: entry.returnedAt.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }),
    items: [{ name: item.itemName, productName: item.itemName, code: item.catalogCode, quantity: entry.quantity, condition: entry.condition, note: entry.note }],
  })));
  const items = record.items.map((item) => ({ name: item.itemName, productName: item.itemName, code: item.catalogCode, quantity: item.quantityBorrowed - item.quantityReturned }));
  const borrowedItems = record.items.map((item) => ({ name: item.itemName, productName: item.itemName, code: item.catalogCode, quantity: item.quantityBorrowed }));
  const fmt = (date) => date.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric" });
  return { id: record.id, item: record.borrowerName, fullName: record.borrowerName, borrower: record.borrowTypes[0] || "", kind: record.borrowTypes[0] || "", borrowerType: record.borrowTypes.join("、"), date: fmt(record.borrowedAt), due: fmt(record.dueAt), status: record.status === "RETURNED" ? "returned" : record.status === "PARTIALLY_RETURNED" ? "borrowed" : "borrowed", role: record.roles.join("、"), roles: record.roles, department: record.branch || "", branch: record.branch || "", nickname: record.nickname || "", studentId: record.studentId || "", phone: record.phone || "", activity: record.activity || "", reason: record.reason || "", items, borrowedItems, returnHistory: returns, returnedDate: record.returnedAt ? fmt(record.returnedAt) : "", stockCommitted: true };
}
const include = { items: { include: { returns: { orderBy: { returnedAt: "asc" } } } } };
router.get("/", async (_req, res) => {
  try { const rows = await prisma.borrowRecord.findMany({ include, orderBy: { borrowedAt: "desc" } }); res.json({ success: true, data: rows.map(legacy) }); }
  catch (error) { console.error("Borrow records read failed:", error.message); res.status(503).json({ success: false, message: "Borrow records could not be read" }); }
});
router.post("/", async (req, res) => {
  const input = req.body || {};
  const name = String(input.fullName || "").trim();
  const dueAt = new Date(`${input.dueDate || ""}T00:00:00.000Z`);
  const items = Array.isArray(input.items) ? input.items : [];
  if (!name || name.length > 200 || Number.isNaN(dueAt.getTime()) || !items.length) return res.status(400).json({ success: false, message: "Borrower, due date and items are required" });
  try {
    const record = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const requested of items) {
        const code = String(requested.code || "").trim(); const quantity = Number(requested.quantity);
        if (!code || !Number.isSafeInteger(quantity) || quantity < 1) throw Object.assign(new Error("Invalid item or quantity"), { httpStatus: 400 });
        const catalog = await tx.catalog.findUnique({ where: { code } });
        if (!catalog) throw Object.assign(new Error("Catalog item not found"), { httpStatus: 404 });
        const update = await tx.catalog.updateMany({ where: { id: catalog.id, remaining: { gte: quantity } }, data: { used: { increment: quantity }, remaining: { decrement: quantity } } });
        if (update.count !== 1) throw Object.assign(new Error("Insufficient stock"), { httpStatus: 409 });
        rows.push({ catalogId: catalog.id, catalogCode: catalog.code, itemName: catalog.name, unit: catalog.unit, quantityBorrowed: quantity });
      }
      return tx.borrowRecord.create({ data: { borrowerName: name, nickname: String(input.nickname || "").slice(0,120) || null, studentId: String(input.studentId || "").slice(0,80) || null, branch: String(input.branch || "").slice(0,120) || null, phone: String(input.phone || "").slice(0,40) || null, roles: Array.isArray(input.roles) ? input.roles : [], borrowTypes: Array.isArray(input.borrowTypes) ? input.borrowTypes : [], activity: input.activity || null, reason: input.reason || null, dueAt, items: { create: rows } }, include });
    }, { maxWait: 10000, timeout: 20000 });
    res.status(201).json({ success: true, data: legacy(record) });
  } catch (error) { console.error("Borrow save failed:", error.message); res.status(error.httpStatus || 503).json({ success: false, message: error.httpStatus ? error.message : "Borrow record could not be saved" }); }
});
router.post("/:id/returns", async (req, res) => {
  const returns = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!returns.length) return res.status(400).json({ success: false, message: "Return items are required" });
  try {
    const record = await prisma.$transaction(async (tx) => {
      const current = await tx.borrowRecord.findUnique({ where: { id: req.params.id }, include });
      if (!current) throw Object.assign(new Error("Borrow record not found"), { httpStatus: 404 });
      for (const requested of returns) {
        const item = current.items.find((row) => row.catalogCode === String(requested.code)); const quantity = Number(requested.quantity);
        if (!item || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > item.quantityBorrowed - item.quantityReturned) throw Object.assign(new Error("Return quantity exceeds outstanding quantity"), { httpStatus: 409 });
        const updatedItem = await tx.borrowItem.updateMany({ where: { id: item.id, quantityReturned: { lte: item.quantityBorrowed - quantity } }, data: { quantityReturned: { increment: quantity } } });
        if (updatedItem.count !== 1) throw Object.assign(new Error("Return quantity exceeds outstanding quantity"), { httpStatus: 409 });
        await tx.borrowReturn.create({ data: { borrowItemId: item.id, quantity, condition: requested.condition ? String(requested.condition).slice(0,120) : null, note: requested.note ? String(requested.note).slice(0,10000) : null } });
        if (item.catalogId) await tx.catalog.update({ where: { id: item.catalogId }, data: { used: { decrement: quantity }, remaining: { increment: quantity } } });
      }
      const after = await tx.borrowRecord.findUnique({ where: { id: req.params.id }, include });
      const complete = after.items.every((item) => item.quantityReturned === item.quantityBorrowed);
      const hasReturns = after.items.some((item) => item.quantityReturned > 0);
      return tx.borrowRecord.update({ where: { id: after.id }, data: { status: complete ? "RETURNED" : hasReturns ? "PARTIALLY_RETURNED" : "BORROWED", returnedAt: complete ? new Date() : null }, include });
    }, { maxWait: 10000, timeout: 20000 });
    res.json({ success: true, data: legacy(record) });
  } catch (error) { console.error("Borrow return save failed:", error.message); res.status(error.httpStatus || 503).json({ success: false, message: error.httpStatus ? error.message : "Borrow return could not be saved" }); }
});
module.exports = router;
router.legacy = legacy;
