const ADMIN_OPTIONS_KEY = "fms-admin-options";
const ADMIN_SESSION_KEY = "fms-admin-session";
const COLLECTIONS = [
  ["fms-stock-records", "ยาและเวชภัณฑ์"],
  ["fms-infirmary-visits", "การเข้าห้องพยาบาล"],
  ["fms-infirmary-history", "ประวัติห้องพยาบาล"],
  ["fms-borrow-return-records", "การยืมและคืน"],
  ["fms-history-borrow-return", "ประวัติการยืมและคืน"],
  ["fms-history-catalog-orders", "ประวัติการสั่งซื้อ"],
  ["fms-local-duty-records", "ตารางเข้าเวร"]
];

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? "-").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const read = (key) => window.FMSAdminAudit.read(key);
const save = (key, value) => window.FMSAdminAudit.write(key, value);

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function getOptions() {
  const defaults = {
    faculties: ["หลักสูตรวิศวกรรมศาสตร์", "หลักสูตรเทคโนโลยีการเกษตรและอุตสาหกรรม", "หลักสูตรบริหารธุรกิจและนวัตกรรม"],
    branches: ["เทคโนโลยีสารสนเทศ", "พยาบาลศาสตร์"],
    medicines: []
  };
  let saved = {};
  try { saved = JSON.parse(window.FMSData.getItem(ADMIN_OPTIONS_KEY) || "{}"); } catch {}
  const stockNames = read("fms-stock-records").map((item) => item.name || item.productName || item.genericName).filter(Boolean);
  return {
    faculties: Array.isArray(saved.faculties) && saved.faculties.length ? saved.faculties : defaults.faculties,
    branches: Array.isArray(saved.branches) && saved.branches.length ? saved.branches : defaults.branches,
    medicines: Array.from(new Set([...(saved.medicines || []), ...stockNames]))
  };
}

function renderOverview() {
  $("#databaseRows").innerHTML = COLLECTIONS.map(([key, label]) => {
    const records = read(key);
    const latest = records.map((item) => item.updatedAt || item.createdAt || item.date || item.borrowDate).filter(Boolean).sort().at(-1);
    return `<tr><td>${escapeHtml(label)}</td><td><code>${escapeHtml(key)}</code></td><td>${records.length}</td><td>${formatDate(latest)}</td></tr>`;
  }).join("");
}

function renderOptions() {
  const options = getOptions();
  const labels = { faculties: "หลักสูตร", branches: "สาขา", medicines: "ยา" };
  Object.entries(labels).forEach(([type, label]) => {
    const target = $(`[data-options-list="${type}"]`);
    target.innerHTML = options[type].length
      ? options[type].map((item, index) => `<li><span>${escapeHtml(item)}</span><button type="button" data-remove-option="${type}" data-index="${index}" aria-label="ลบ ${escapeHtml(item)}">×</button></li>`).join("")
      : `<li class="empty-option">ยังไม่มีข้อมูล${label}</li>`;
  });
  save(ADMIN_OPTIONS_KEY, options);
}

function renderActivities() {
  const records = read(window.FMSAdminAudit.ACTIVITY_KEY);
  $("#activityRows").innerHTML = records.length ? records.map((item) => `<tr><td>${escapeHtml(formatDate(item.createdAt))}</td><td><strong>${escapeHtml(item.action)}</strong></td><td>${escapeHtml(item.actor)}</td><td>${escapeHtml(JSON.stringify(item.detail || {}))}</td></tr>`).join("") : `<tr><td colspan="4" class="empty-table">ยังไม่มีประวัติการใช้งาน</td></tr>`;
}

let deletedCategory = "all";
function getDeletedCategory(collection = "") {
  const key = String(collection).toLowerCase();
  if (key.includes("stock")) return "stock";
  if (key.includes("catalog")) return "catalog";
  if (key.includes("infirmary")) return "infirmary";
  if (key.includes("borrow")) return "borrow";
  if (key.includes("duty")) return "duty";
  return "other";
}
function getDeletedCategoryLabel(category) {
  return { stock: "คลังยา", catalog: "แคตตาล็อก", infirmary: "การเข้าห้องพยาบาล", borrow: "การยืมและคืน", duty: "ตารางเข้าเวร", other: "อื่น ๆ" }[category] || "อื่น ๆ";
}
function renderDeleted() {
  const records = read(window.FMSAdminAudit.DELETED_KEY).filter((item) => deletedCategory === "all" || getDeletedCategory(item.collection) === deletedCategory);
  $("#deletedRows").innerHTML = records.length ? records.map((item) => { const category = getDeletedCategory(item.collection); return `<tr><td>${escapeHtml(formatDate(item.deletedAt))}</td><td><span class="deleted-menu-badge is-${category}">${escapeHtml(getDeletedCategoryLabel(category))}</span></td><td>${escapeHtml(item.collection)}</td><td>${escapeHtml(item.record?.name || item.record?.productName || item.record?.email || item.record?.id || item.record?.value || "ข้อมูลรายการ")}</td><td>${escapeHtml(item.reason)}</td></tr>`; }).join("") : `<tr><td colspan="5" class="empty-table">ยังไม่มีข้อมูลที่ถูกลบในประเภทนี้</td></tr>`;
}

function renderAll() {
  const options = getOptions();
  const databaseRecords = COLLECTIONS.reduce((sum, [key]) => sum + read(key).length, 0);
  $("#summaryCollections").textContent = databaseRecords;
  $("#summaryRecords").textContent = Object.values(options).reduce((sum, values) => sum + values.length, 0);
  $("#summaryActivities").textContent = read(window.FMSAdminAudit.ACTIVITY_KEY).length;
  $("#summaryDeleted").textContent = read(window.FMSAdminAudit.DELETED_KEY).length;
  renderOverview();
  renderOptions();
  renderActivities();
  renderDeleted();
}

$("#optionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const type = form.get("type");
  const value = String(form.get("value") || "").trim();
  if (!value) return;
  const options = getOptions();
  if (!options[type].includes(value)) options[type].push(value);
  save(ADMIN_OPTIONS_KEY, options);
  window.FMSAdminAudit.log("option-created", { type, value });
  event.currentTarget.reset();
  renderAll();
});

const optionTypeSelect = $("#optionTypeSelect");
const optionTypeButton = $("#optionTypeButton");
const optionTypeMenu = optionTypeSelect.querySelector(".admin-select-menu");
optionTypeButton.addEventListener("click", () => {
  const isOpen = !optionTypeMenu.hidden;
  optionTypeMenu.hidden = isOpen;
  optionTypeButton.setAttribute("aria-expanded", String(!isOpen));
});
optionTypeMenu.addEventListener("click", (event) => {
  const option = event.target.closest("[data-option-type]");
  if (!option) return;
  $("#optionTypeValue").value = option.dataset.optionType;
  $("#optionTypeLabel").textContent = option.textContent;
  optionTypeMenu.querySelectorAll("[data-option-type]").forEach((item) => item.setAttribute("aria-selected", String(item === option)));
  optionTypeMenu.hidden = true;
  optionTypeButton.setAttribute("aria-expanded", "false");
});
document.addEventListener("click", (event) => {
  if (!optionTypeSelect.contains(event.target)) {
    optionTypeMenu.hidden = true;
    optionTypeButton.setAttribute("aria-expanded", "false");
  }
});

$("#optionsGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-option]");
  if (!button) return;
  const type = button.dataset.removeOption;
  const options = getOptions();
  const [removed] = options[type].splice(Number(button.dataset.index), 1);
  save(ADMIN_OPTIONS_KEY, options);
  window.FMSAdminAudit.logDeleted(`admin-options.${type}`, { value: removed }, "admin-deleted-option");
  renderAll();
});

document.querySelectorAll("[data-panel]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-panel]").forEach((item) => item.classList.toggle("is-active", item === button));
  document.querySelectorAll(".admin-panel").forEach((panel) => panel.hidden = panel.id !== button.dataset.panel);
}));
document.querySelectorAll("[data-deleted-category]").forEach((button) => button.addEventListener("click", () => {
  deletedCategory = button.dataset.deletedCategory;
  document.querySelectorAll("[data-deleted-category]").forEach((item) => item.classList.toggle("is-active", item === button));
  renderDeleted();
}));

document.querySelector("#backMenuButton").addEventListener("click", () => window.location.replace("./menu.html"));
let session = null;
try { session = JSON.parse(window.FMSData.getItem(ADMIN_SESSION_KEY) || "null"); } catch {}
if (session?.role !== "admin") window.location.replace("./index.html");
renderAll();
