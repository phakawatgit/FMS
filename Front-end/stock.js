const savedStock = JSON.parse(FMSStorage.getItem("fms-stock-records") || "[]");
const medicines = savedStock.map((record) => ({
  name: record.name || record.productName || "รายการยาใหม่",
  thai: record.genericName ? `(${record.genericName})` : "",
  code: record.code || "ไม่มีรหัส",
  category: normalizeStockCategory(record.category),
  icon: record.image ? `<img src="${record.image}" alt="${record.name || "รูปยา"}">` : "💊",
  used: Number(record.used) || 0,
  remaining: Number(record.remaining) || 0,
  total: Number(record.total) || 0,
}));
const grid = document.getElementById("stockGrid");
const search = document.getElementById("searchInput");
let filter = "all";

function normalizeStockCategory(value) {
  return ({ "ยากิน": "oral", "ยาทา": "topical", "เวชภัณฑ์": "equipment", oral: "oral", topical: "topical", equipment: "equipment" })[String(value || "").trim().toLowerCase()] || "oral";
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function recordIndexFor(item) {
  return savedStock.findIndex((record) => String(record.code || "") === String(item.code || "") ||
    String(record.name || record.productName || "") === String(item.name || ""));
}
function render() {
  const query = search.value.trim().toLowerCase();
  const rows = medicines.filter((item) => (filter === "all" || item.category === filter) &&
    `${item.name} ${item.thai} ${item.code}`.toLowerCase().includes(query));
  grid.innerHTML = rows.length ? rows.map((item) => `<article class="medicine-card" data-code="${escapeHtml(item.code)}">
    <div class="medicine-image">${item.icon}</div><div class="medicine-info"><h2>${escapeHtml(item.name)}<br>${escapeHtml(item.thai)}</h2>
    <p>รหัสยา: ${escapeHtml(item.code)}</p><p>อาการที่ใช้: บรรเทาอาการทั่วไป<br>คำแนะนำ: รับประทานตามฉลากยา</p><span class="stock-label">คงคลัง:</span>
    <div class="stock-values"><div class="stock-box total"><span>ทั้งหมด</span><strong>${item.total}</strong><button type="button" data-field="total" data-delta="-1" aria-label="ลดทั้งหมด">−</button><button type="button" data-field="total" data-delta="1" aria-label="เพิ่มทั้งหมด">＋</button></div>
    <div class="stock-box used"><span>ใช้ไป</span><strong>${item.used}</strong><button type="button" data-field="used" data-delta="-1" aria-label="ลดที่ใช้ไป">−</button><button type="button" data-field="used" data-delta="1" aria-label="เพิ่มที่ใช้ไป">＋</button></div>
    <div class="stock-box remaining"><span>เหลือ</span><strong>${item.remaining}</strong><button type="button" data-field="remaining" data-delta="-1" aria-label="ลดที่เหลือ">−</button><button type="button" data-field="remaining" data-delta="1" aria-label="เพิ่มที่เหลือ">＋</button></div></div></div>
    <div class="card-management-actions"><button type="button" class="card-action edit" data-management="edit" aria-label="แก้ไข ${escapeHtml(item.name)}" title="แก้ไขรายการ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 16.5-.7 3.2 3.2-.7L18.8 8.7a2.1 2.1 0 0 0-3-3L5.5 16.5Z"/><path d="m14.7 7.3 2 2"/></svg></button>
    <button type="button" class="card-action delete" data-management="delete" aria-label="ลบ ${escapeHtml(item.name)}" title="ลบรายการ"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg></button></div></article>`).join("") : "<p>ยังไม่มีรายการยา</p>";
}
function openDeleteDialog(itemName) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "fms-confirm-overlay";
    overlay.innerHTML = `<section class="fms-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="fmsConfirmTitle"><div class="fms-confirm-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 7h10v12H7z"/><path d="M5 7h14M9 7V4h6v3M10 11v5M14 11v5"/></svg></div><div class="fms-confirm-content"><p class="fms-confirm-eyebrow">ยืนยันการลบรายการ</p><h2 id="fmsConfirmTitle">ต้องการลบรายการนี้หรือไม่?</h2><p>รายการ <strong>${escapeHtml(itemName || "นี้")}</strong> จะถูกลบออกจากคลังยา</p></div><div class="fms-confirm-actions"><button type="button" class="fms-confirm-cancel">ยกเลิก</button><button type="button" class="fms-confirm-delete">ลบรายการ</button></div></section>`;
    document.body.append(overlay);
    const finish = (value) => { overlay.remove(); resolve(value); };
    overlay.querySelector(".fms-confirm-cancel").addEventListener("click", () => finish(false));
    overlay.querySelector(".fms-confirm-delete").addEventListener("click", () => finish(true));
    overlay.addEventListener("click", (event) => { if (event.target === overlay) finish(false); });
    overlay.querySelector(".fms-confirm-cancel").focus();
  });
}
grid.addEventListener("click", async (event) => {
  const action = event.target.closest("button[data-management]");
  const fieldButton = event.target.closest("button[data-field]");
  const card = event.target.closest(".medicine-card");
  if (!card) return;
  event.preventDefault(); event.stopPropagation();
  const item = medicines.find((row) => String(row.code) === String(card.dataset.code));
  if (fieldButton) {
    if (!item || fieldButton.dataset.field === "remaining") return;
    const field = fieldButton.dataset.field;
    item[field] = Math.max(0, (Number(item[field]) || 0) + Number(fieldButton.dataset.delta));
    item.remaining = Math.max(0, item.total - item.used);
    const record = savedStock[recordIndexFor(item)];
    if (record) { record[field] = item[field]; record.remaining = item.remaining; }
    FMSStorage.setItem("fms-stock-records", JSON.stringify(savedStock)); render(); return;
  }
  if (!action) { if (item) location.href = `./stock-detail.html?code=${encodeURIComponent(item.code)}`; return; }
  const index = item ? recordIndexFor(item) : -1;
  if (!item || index < 0 || !savedStock[index]) return;
  if (action.dataset.management === "edit") {
    FMSStorage.setItem("fms-edit-stock-record", JSON.stringify(savedStock[index]));
    FMSStorage.setItem("fms-edit-stock-code", String(savedStock[index].code || item.code || ""));
    location.href = `./stock-add.html?edit=${encodeURIComponent(savedStock[index].code || item.code || "")}`; return;
  }
  if (await openDeleteDialog(savedStock[index].name || savedStock[index].productName || "นี้")) {
    window.FMSAdminAudit?.logDeleted("fms-stock-records", savedStock[index], "user-deleted-stock");
    savedStock.splice(index, 1); medicines.splice(medicines.indexOf(item), 1);
    FMSStorage.setItem("fms-stock-records", JSON.stringify(savedStock)); render();
  }
});
const filterConfig = ["all", "oral", "topical", "equipment"];
document.querySelectorAll(".filter").forEach((button, index) => {
  button.dataset.filter = filterConfig[index]; button.textContent = ["ทั้งหมด", "ยากิน", "ยาทา", "เวชภัณฑ์"][index];
  button.addEventListener("click", () => {
    if (document.body.dataset.category && button.dataset.filter === "all") { location.href = "./stock.html"; return; }
    if (document.body.dataset.category && button.dataset.filter !== document.body.dataset.category) { location.href = `./stock-${button.dataset.filter}.html`; return; }
    document.querySelector(".filter.active")?.classList.remove("active"); button.classList.add("active"); filter = button.dataset.filter; render();
  });
});
search.addEventListener("input", render);
document.getElementById("addButton")?.addEventListener("click", () => { location.href = "./stock-add.html"; });
document.getElementById("notificationButton")?.addEventListener("click", () => { const panel = document.getElementById("notificationPanel"); panel.hidden = !panel.hidden; });
document.getElementById("closeNotification")?.addEventListener("click", () => { document.getElementById("notificationPanel").hidden = true; });
document.getElementById("exportExcel")?.addEventListener("click", () => {
  const csv = ["Name,Code,Category,Total,Used,Remaining", ...medicines.map((item) => [item.name, item.code, item.category, item.total, item.used, item.remaining].join(","))].join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
  link.download = "fms-stock.csv"; link.click(); URL.revokeObjectURL(link.href);
});
document.getElementById("exportPdf")?.addEventListener("click", () => window.print());
function applyStockLanguage() {
  const en = document.documentElement.lang === "en";
  document.querySelector(".page-heading h1").innerHTML = en ? "Medicine & Medical<br>Supplies Inventory" : "Medicine & Medical<br>Supplies Inventory";
  document.getElementById("addButton").textContent = en ? "＋ Add medicine" : "＋ เพิ่มยา";
  document.getElementById("searchInput").placeholder = "name, date";
  document.querySelectorAll(".filter").forEach((button, index) => { button.textContent = (en ? ["All", "Oral", "Topical", "Medical supplies"] : ["ทั้งหมด", "ยากิน", "ยาทา", "เวชภัณฑ์"])[index]; });
  document.querySelectorAll(".medicine-info").forEach((card) => {
    const paragraphs = card.querySelectorAll("p");
    if (paragraphs[0]) paragraphs[0].textContent = `${en ? "Code" : "รหัสยา"}: ${paragraphs[0].textContent.split(":").slice(1).join(":").trim()}`;
    if (paragraphs[1]) paragraphs[1].innerHTML = `${en ? "Use" : "อาการที่ใช้"}: ${en ? "For general symptoms" : "บรรเทาอาการทั่วไป"}<br>${en ? "Advice" : "คำแนะนำ"}: ${en ? "Take as directed on the label" : "รับประทานตามฉลากยา"}`;
    const labels = card.querySelectorAll(".stock-box span");
    ["Total", "Used", "Remaining"].forEach((label, index) => { if (labels[index]) labels[index].textContent = en ? label : ["ทั้งหมด", "ใช้ไป", "เหลือ"][index]; });
    const stockLabel = card.querySelector(".stock-label");
    if (stockLabel) stockLabel.textContent = en ? "Stock:" : "คงคลัง:";
  });
  document.querySelector("#languageButton span").textContent = en ? "English" : "ไทย";
}
document.getElementById("languageButton")?.addEventListener("click", () => { document.documentElement.lang = document.documentElement.lang === "en" ? "th" : "en"; applyStockLanguage(); });
const categoryPage = document.body.dataset.category;
if (categoryPage) { filter = categoryPage; document.querySelector(`.filter[data-filter="${categoryPage}"]`)?.classList.add("active"); }
render();
applyStockLanguage();
