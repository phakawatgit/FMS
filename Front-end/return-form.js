const STORAGE_KEY = "fms-borrow-return-records";
const defaultRecords = [];
const records = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return Array.isArray(saved) ? saved.filter((item) => item.item !== "คุณ เพ็ญพิชชา ภาญจนพาณิชย์ (แผนก)") : defaultRecords;
  } catch { return defaultRecords; }
})();
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const params = new URLSearchParams(location.search);
const requestedRecord = params.get("id");
const record = requestedRecord
  ? records.find((item) => String(item.id) === requestedRecord)
  : records.find((item) => String(item.status || "borrowed").toLowerCase() !== "returned");
const borrowedProductsElement = document.getElementById("borrowedProducts");
const returnProductsElement = document.getElementById("returnProducts");
const returnEmptyState = document.getElementById("returnEmptyState");
const returnExportModal = document.getElementById("returnExportModal");
const returnNoticeModal = document.getElementById("returnNoticeModal");
let returnNoticeCloseAction = null;
let returnNoticeConfirmAction = null;
const returnPageElement = document.querySelector(".return-page");
const returnFooterElement = document.querySelector(".return-footer");
const stockItems = (() => {
  try { const items = JSON.parse(localStorage.getItem("fms-stock-records") || "[]"); return Array.isArray(items) ? items : []; }
  catch { return []; }
})();
const normalizeCode = (value) => String(value ?? "").trim().toLowerCase();
const normalizeName = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const findStockItem = (collection, item) => {
  const code = normalizeCode(item?.code || item?.productCode);
  const name = normalizeName(item?.name || item?.productName || item?.item);
  return collection.find((row) => normalizeCode(row.code || row.productCode) === code)
    || collection.find((row) => name && normalizeName(row.name || row.productName) === name);
};

function lockReturnPage(locked) {
  returnPageElement.inert = locked;
  returnFooterElement.inert = locked;
}

function setReturnNotice(message, { tone, title, eyebrow, confirmText, cancelText, onClose, onConfirm }) {
  returnNoticeCloseAction = onClose;
  returnNoticeConfirmAction = onConfirm;
  returnNoticeModal.className = `return-notice-modal is-${tone}`;
  document.getElementById("returnNoticeIcon").textContent = tone === "success" ? "✓" : tone === "error" ? "×" : "!";
  document.getElementById("returnNoticeEyebrow").textContent = eyebrow;
  document.getElementById("returnNoticeTitle").textContent = title;
  document.getElementById("returnNoticeMessage").textContent = message;
  const cancelButton = document.getElementById("cancelReturnNotice");
  cancelButton.hidden = !cancelText;
  if (cancelText) cancelButton.textContent = cancelText;
  document.getElementById("confirmReturnNotice").textContent = confirmText;
  lockReturnPage(true);
  returnNoticeModal.hidden = false;
  document.getElementById("confirmReturnNotice").focus();
}

function showReturnNotice(message, { tone = "warning", title = "ยังบันทึกไม่ได้", eyebrow = "ตรวจสอบข้อมูล", onClose = null } = {}) {
  setReturnNotice(message, { tone, title, eyebrow, confirmText: "ตกลง", cancelText: "", onClose, onConfirm: onClose });
}

function showReturnConfirmation(message, { tone = "warning", title, eyebrow = "ยืนยันการทำรายการ", confirmText = "ยืนยัน", cancelText = "กลับไปแก้ไข", onConfirm, onCancel = null }) {
  setReturnNotice(message, { tone, title, eyebrow, confirmText, cancelText, onClose: onCancel, onConfirm });
}

function closeReturnNotice() {
  returnNoticeModal.hidden = true;
  lockReturnPage(false);
  const action = returnNoticeCloseAction;
  returnNoticeCloseAction = null;
  returnNoticeConfirmAction = null;
  if (action) action();
}

function acceptReturnNotice() {
  returnNoticeModal.hidden = true;
  lockReturnPage(false);
  const action = returnNoticeConfirmAction;
  returnNoticeCloseAction = null;
  returnNoticeConfirmAction = null;
  if (action) action();
}

function normalizeProducts(source) {
  if (Array.isArray(source.items) && source.items.length) {
    return source.items.map((item) => ({
      name: stockItems.find((stock) => normalizeCode(stock.code) === normalizeCode(item.code || item.productCode))?.name || item.name || item.productName || item.item || "ยาและเวชภัณฑ์",
      code: item.code || item.productCode || "—",
      image: stockItems.find((stock) => normalizeCode(stock.code) === normalizeCode(item.code || item.productCode))?.image || item.image || "",
      quantity: Math.max(0, Number(item.quantity ?? item.count) || 0),
    }));
  }
  if (source.products && typeof source.products === "object" && !Array.isArray(source.products)) {
    return Object.entries(source.products).map(([code, item]) => {
      const stock = stockItems.find((row) => normalizeCode(row.code) === normalizeCode(code));
      return { name: stock?.name || stock?.productName || item.name || item.productName || code, code, image: stock?.image || item.image || "", quantity: Math.max(0, Number(item.quantity ?? item.count) || 0) };
    });
  }
  return [{ name: source.borrower || source.kind || "ยาและเวชภัณฑ์", code: source.productCode || "—", image: "", quantity: Math.max(1, Number(source.quantity) || 1) }];
}

function productCard(item, index, isReturnForm) {
  const image = item.image
    ? `<img class="return-product-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
    : '<span class="return-product-placeholder">ยา / เวชภัณฑ์</span>';
  if (!isReturnForm) {
    return `<article class="return-product-card borrowed-product-card">${image}<div class="return-product-name"><strong>${escapeHtml(item.name)}</strong><small>รหัสยา: ${escapeHtml(item.code)}</small></div><span class="return-product-quantity">จำนวน <b>${item.quantity}</b></span></article>`;
  }
  return `<article class="return-product-card"><input type="checkbox" data-return-check="${index}" aria-label="เลือกคืน ${escapeHtml(item.name)}">${image}<div class="return-product-name"><strong>${escapeHtml(item.name)}</strong><small>รหัสยา: ${escapeHtml(item.code)} · คงค้าง ${item.quantity}</small></div><label class="return-product-quantity">คืนจำนวน<input type="number" min="0" max="${item.quantity}" value="0" inputmode="numeric" data-return-quantity="${index}" aria-label="จำนวนที่คืน ${escapeHtml(item.name)}"></label></article>`;
}

function renderReturnPage() {
  if (!record || String(record.status || "borrowed").toLowerCase() === "returned") {
    document.getElementById("returnBorrowerDetails").hidden = true;
    document.querySelectorAll(".return-products-section").forEach((section) => { section.hidden = true; });
    returnEmptyState.hidden = false;
    document.getElementById("returnStatus").textContent = record ? "คืนครบแล้ว" : "ไม่มีรายการค้างคืน";
    document.getElementById("submitReturn").disabled = true;
    return;
  }
  const products = normalizeProducts(record);
  const originallyBorrowed = (Array.isArray(record.borrowedItems) ? record.borrowedItems : products).map((item) => {
    const stock = stockItems.find((row) => normalizeCode(row.code) === normalizeCode(item.code || item.productCode));
    return { ...item, name: stock?.name || stock?.productName || item.name || item.productName || "ยาและเวชภัณฑ์", image: stock?.image || item.image || "" };
  });
  const status = String(record.status || "borrowed").toLowerCase();
  const name = record.fullName || record.name || record.item || "ไม่ระบุชื่อผู้ยืม";
  const returnHeading = document.querySelector(".return-sheet-heading");
  returnHeading?.classList.remove("is-borrowed", "is-overdue", "is-returned");
  returnHeading?.classList.add(status === "overdue" ? "is-overdue" : status === "returned" ? "is-returned" : "is-borrowed");
  document.getElementById("returnStatus").textContent = status === "overdue" ? "เกินกำหนดคืน" : "กำลังยืม";
  document.getElementById("returnBorrowerDetails").innerHTML = `
    <div class="return-detail-field wide"><b>ผู้ยืม:</b> ${escapeHtml(name)}</div>
    <div class="return-detail-field"><b>ชื่อเล่น:</b> ${escapeHtml(record.nickname || "—")}</div>
    <div class="return-detail-field"><b>รหัสนักศึกษา:</b> ${escapeHtml(record.studentId || "—")}</div>
    <div class="return-detail-field"><b>สาขา:</b> ${escapeHtml(record.department || record.branch || "—")}</div>
    <div class="return-detail-field"><b>เบอร์โทรศัพท์:</b> ${escapeHtml(record.phone || "—")}</div>
    <div class="return-detail-field"><b>ต้องการยืม:</b> ${escapeHtml(record.borrowerType || record.kind || record.borrower || "—")}</div>
    <div class="return-detail-field"><b>สถานะผู้ยืม:</b> ${escapeHtml(record.role || (Array.isArray(record.roles) ? record.roles.join("、") : "—") || "—")}</div>
    <div class="return-detail-field"><b>ชื่อกิจกรรม:</b> ${escapeHtml(record.activity || "—")}</div>
    <div class="return-detail-field"><b>เหตุผล/รายละเอียด:</b> ${escapeHtml(record.reason || "—")}</div>
    <div class="return-detail-field"><b>ยืมวันที่:</b> ${escapeHtml(record.date || "—")}</div>
    <div class="return-detail-field"><b>กำหนดคืน:</b> ${escapeHtml(record.due || "—")}</div>`;
  borrowedProductsElement.innerHTML = originallyBorrowed.map((item, index) => productCard(item, index, false)).join("");
  returnProductsElement.innerHTML = products.map((item, index) => productCard(item, index, true)).join("");
  returnEmptyState.hidden = true;
}

document.getElementById("cancelReturn").addEventListener("click", () => {
  showReturnConfirmation("ต้องการยกเลิกการคืนยาและเวชภัณฑ์หรือไม่?", {
    title: "ยืนยันการยกเลิก",
    confirmText: "ยกเลิกรายการ",
    onConfirm: () => { location.href = "./borrow-return.html"; },
  });
});
returnProductsElement.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-return-check]");
  if (checkbox) {
    const quantity = returnProductsElement.querySelector(`[data-return-quantity="${checkbox.dataset.returnCheck}"]`);
    if (!checkbox.checked && quantity) quantity.value = "0";
    if (checkbox.checked && quantity) quantity.focus();
  }
});
returnProductsElement.addEventListener("input", (event) => {
  const input = event.target.closest("[data-return-quantity]");
  if (!input) return;
  const max = Number(input.max) || 0;
  input.value = String(Math.max(0, Math.min(max, Math.floor(Number(input.value) || 0))));
  const checkbox = returnProductsElement.querySelector(`[data-return-check="${input.dataset.returnQuantity}"]`);
  if (checkbox) checkbox.checked = Number(input.value) > 0;
});
function saveReturn(returnedItems, currentStock, stockReturns, products) {
  const returnDate = new Date().toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (!Array.isArray(record.borrowedItems)) record.borrowedItems = products.map(({ name, code, image, quantity }) => ({ name, code, image, quantity }));
  const remainingItems = returnedItems.map(({ returned, ...item }) => ({ ...item, quantity: Math.max(0, item.quantity - returned) })).filter((item) => item.quantity > 0);
  record.returnHistory = Array.isArray(record.returnHistory) ? record.returnHistory : [];
  record.returnHistory.push({ date: returnDate, items: returnedItems.filter((item) => item.returned > 0).map(({ returned, ...item }) => ({ ...item, quantity: returned })) });
  if (record.stockCommitted) {
    stockReturns.forEach(({ item, stock }) => {
      stock.used = Math.max(0, (Number(stock.used) || 0) - item.returned);
      stock.remaining = Math.max(0, (Number(stock.total) || 0) - stock.used);
    });
    localStorage.setItem("fms-stock-records", JSON.stringify(currentStock));
  }
  const wasOverdue = String(record.status || "").toLowerCase() === "overdue";
  record.items = remainingItems;
  record.status = remainingItems.length ? (wasOverdue ? "overdue" : "borrowed") : "returned";
  if (!remainingItems.length) record.returnedDate = returnDate;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  window.FMSBorrowHistoryStore?.save(records);
  window.location.href = "./borrow-return-history.html";
}

document.getElementById("submitReturn").addEventListener("click", () => {
  if (!record) return;
  const products = normalizeProducts(record);
  const returnedItems = products.map((item, index) => ({ ...item, returned: Number(returnProductsElement.querySelector(`[data-return-quantity="${index}"]`)?.value) || 0 }));
  if (!returnedItems.some((item) => item.returned > 0)) { showReturnNotice("กรุณาระบุจำนวนยาและเวชภัณฑ์ที่นำมาคืน"); return; }
  let currentStock = [];
  try { const savedStock = JSON.parse(localStorage.getItem("fms-stock-records") || "[]"); if (Array.isArray(savedStock)) currentStock = savedStock; } catch {}
  const stockReturns = returnedItems.filter((item) => item.returned > 0).map((item) => ({ item, stock: findStockItem(currentStock, item) }));
  if (record.stockCommitted && stockReturns.some(({ stock }) => !stock)) {
    showReturnNotice("ไม่พบยาและเวชภัณฑ์บางรายการในคลัง จึงยังบันทึกการคืนไม่ได้", { tone: "error", title: "ไม่พบข้อมูลในคลัง", eyebrow: "บันทึกการคืนไม่สำเร็จ" });
    return;
  }
  const itemCount = returnedItems.filter((item) => item.returned > 0).length;
  showReturnConfirmation(`ยืนยันส่งคืนยาและเวชภัณฑ์จำนวน ${itemCount} รายการหรือไม่?`, {
    tone: "success",
    title: "ยืนยันการส่งคืน",
    eyebrow: "ตรวจสอบก่อนบันทึก",
    confirmText: "ส่งคืนและบันทึก",
    onConfirm: () => saveReturn(returnedItems, currentStock, stockReturns, products),
  });
});

document.getElementById("confirmReturnNotice").addEventListener("click", acceptReturnNotice);
document.getElementById("cancelReturnNotice").addEventListener("click", closeReturnNotice);
document.getElementById("closeReturnNotice").addEventListener("click", closeReturnNotice);
returnNoticeModal.addEventListener("click", (event) => { if (event.target === returnNoticeModal) closeReturnNotice(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !returnNoticeModal.hidden) closeReturnNotice(); });

function closeReturnExport() { returnExportModal.hidden = true; }
function openReturnExport() { returnExportModal.hidden = false; }
document.getElementById("openReturnExport").addEventListener("click", openReturnExport);
document.querySelectorAll(".topbar .export").forEach((button) => button.addEventListener("click", openReturnExport));
returnExportModal.addEventListener("click", (event) => { if (event.target === returnExportModal) closeReturnExport(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !returnExportModal.hidden) closeReturnExport(); });
document.getElementById("returnExportPdf").addEventListener("click", () => { closeReturnExport(); window.print(); });
document.getElementById("returnExportExcel").addEventListener("click", () => {
  if (!record) { closeReturnExport(); showReturnNotice("ไม่มีข้อมูลรายการคืนสำหรับส่งออก", { tone: "error", title: "ไม่มีข้อมูลส่งออก", eyebrow: "ส่งออกไฟล์ไม่ได้" }); return; }
  const currentItems = normalizeProducts(record);
  const borrowedItems = Array.isArray(record.borrowedItems) ? record.borrowedItems : currentItems;
  const borrowerName = record.fullName || record.name || record.item || "—";
  const borrowerFields = [
    ["ชื่อ-นามสกุล", borrowerName],
    ["ชื่อเล่น", record.nickname || "—"],
    ["ประเภทผู้ยืม", record.role || (Array.isArray(record.roles) ? record.roles.join("、") : "—") || "—"],
    ["รหัสนักศึกษา/บุคลากร", record.studentId || "—"],
    ["สาขา/หน่วยงาน", record.department || record.branch || "—"],
    ["เบอร์โทรศัพท์", record.phone || "—"],
    ["ประเภทการยืม", record.borrowerType || record.kind || record.borrower || "—"],
    ["ชื่อกิจกรรม", record.activity || "—"],
    ["เหตุผล/รายละเอียด", record.reason || "—"],
    ["วันที่ยืม", record.date || record.borrowDate || "—"],
    ["กำหนดคืน", record.due || "—"],
    ["วันที่คืน/ส่งคืน", record.returnedDate || new Date().toLocaleDateString("th-TH")],
  ];
  const borrowerRows = borrowerFields.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("");
  const rows = currentItems.map((item, index) => {
    const borrowed = borrowedItems.find((row) => normalizeCode(row.code || row.productCode) === normalizeCode(item.code)) || borrowedItems[index] || item;
    const returned = Number(returnProductsElement.querySelector(`[data-return-quantity="${index}"]`)?.value) || 0;
    return `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.code)}</td><td>${Number(borrowed.quantity) || 0}</td><td>${returned}</td><td>${Math.max(0, item.quantity - returned)}</td></tr>`;
  }).join("");
  const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#123b56}h2{color:#01406d}table{border-collapse:collapse;width:100%;margin-bottom:18px}th,td{border:1px solid #9aa5b1;padding:8px;text-align:left;vertical-align:top}th{background:#e6f3f3}.borrower-table{width:min(100%,720px)}.borrower-table th{width:210px}</style></head><body><h2>รายงานการคืนยาและเวชภัณฑ์</h2><table class="borrower-table"><tbody>${borrowerRows}</tbody></table><table><thead><tr><th>รายการยาและเวชภัณฑ์</th><th>รหัส</th><th>ยืม</th><th>คืนครั้งนี้</th><th>คงค้างหลังคืน</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "FMS-return-report.xls";
  link.click();
  URL.revokeObjectURL(url);
  closeReturnExport();
});

renderReturnPage();
