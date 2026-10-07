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
  try { saved = JSON.parse(FMSStorage.getItem(ADMIN_OPTIONS_KEY) || "{}"); } catch {}
  const stockNames = window.FMSAdminSettingsData?.stockNames || read("fms-stock-records").map((item) => item.name || item.productName || item.genericName).filter(Boolean);
  return {
    faculties: Array.isArray(saved.faculties) && saved.faculties.length ? saved.faculties : defaults.faculties,
    branches: Array.isArray(saved.branches) && saved.branches.length ? saved.branches : defaults.branches,
    medicines: Array.from(new Set([...(saved.medicines || []), ...stockNames]))
  };
}

function renderOverview() {
  const latestTime = (record) => {
    const value = record.updatedAt || record.createdAt || record.completedAt || record.borrowedAt || record.date || record.borrowDate;
    const timestamp = value ? new Date(value).getTime() : 0;
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  const bootstrapSummaries = window.FMSAdminSettingsData?.summaries;
  const rows = COLLECTIONS.map(([key, label]) => {
    const records = read(key);
    const summary = bootstrapSummaries?.[key];
    const latest = summary?.latestAt ? new Date(summary.latestAt).getTime() : records.reduce((time, record) => Math.max(time, latestTime(record)), 0);
    return { key, label, count: summary?.count ?? records.length, latest };
  }).sort((a, b) => b.latest - a.latest || a.label.localeCompare(b.label));
  $("#databaseRows").innerHTML = rows.map(({ key, label, count, latest }) =>
    `<tr><td>${escapeHtml(label)}</td><td><code>${escapeHtml(key)}</code></td><td>${count}</td><td>${formatDate(latest || "")}</td></tr>`
  ).join("");
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
}

function renderActivities() {
  const records = read(window.FMSAdminAudit.ACTIVITY_KEY).sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
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
  const records = read(window.FMSAdminAudit.DELETED_KEY).filter((item) => deletedCategory === "all" || getDeletedCategory(item.collection) === deletedCategory).sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0));
  $("#deletedRows").innerHTML = records.length ? records.map((item) => { const category = getDeletedCategory(item.collection); return `<tr><td>${escapeHtml(formatDate(item.deletedAt))}</td><td><span class="deleted-menu-badge is-${category}">${escapeHtml(getDeletedCategoryLabel(category))}</span></td><td>${escapeHtml(item.collection)}</td><td>${escapeHtml(item.record?.name || item.record?.productName || item.record?.email || item.record?.id || item.record?.value || "ข้อมูลรายการ")}</td><td>${escapeHtml(item.reason)}</td></tr>`; }).join("") : `<tr><td colspan="5" class="empty-table">ยังไม่มีข้อมูลที่ถูกลบในประเภทนี้</td></tr>`;
}

function renderAll() {
  const options = getOptions();
  const databaseRecords = window.FMSAdminSettingsData?.totalRecords ?? COLLECTIONS.reduce((sum, [key]) => sum + read(key).length, 0);
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
  if (button.dataset.panel === "usersPanel") loadUsers();
}));

const apiBase = window.FMS_API_URL || "";
const csrfCookie = () => document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("fms_csrf="))?.slice("fms_csrf=".length) || "";
async function adminApi(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (options.method && !["GET", "HEAD"].includes(options.method)) headers["X-FMS-CSRF"] = decodeURIComponent(csrfCookie());
  const response = await fetch(`${apiBase}${path}`, { ...options, headers, credentials: "include" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถดำเนินการได้");
  return result.data;
}

async function loadUsers() {
  const rows = $("#userRows");
  const message = $("#usersMessage");
  rows.innerHTML = `<tr><td colspan="4" class="empty-table">กำลังโหลดบัญชีผู้ใช้...</td></tr>`;
  message.textContent = "";
  try {
    const users = await adminApi("/api/users");
    rows.innerHTML = users.length ? users.map((user) => `<tr data-user-id="${escapeHtml(user.id)}"><td>${escapeHtml(user.name || "-")}</td><td>${escapeHtml(user.email)}</td><td>${({ ADMIN: "Admin", NURSE: "Nurse", VISITOR: "Visitor" })[user.role] || "Visitor"}</td><td><div class="role-controls"><select aria-label="สิทธิ์ของ ${escapeHtml(user.email)}"><option value="VISITOR" ${user.role === "VISITOR" ? "selected" : ""}>Visitor</option><option value="NURSE" ${user.role === "NURSE" ? "selected" : ""}>Nurse</option><option value="ADMIN" ${user.role === "ADMIN" ? "selected" : ""}>Admin</option></select><button type="button" data-save-role>บันทึก</button></div></td></tr>`).join("") : `<tr><td colspan="4" class="empty-table">ยังไม่มีบัญชีผู้ใช้</td></tr>`;
  } catch (error) {
    rows.innerHTML = `<tr><td colspan="4" class="empty-table">โหลดบัญชีผู้ใช้ไม่สำเร็จ</td></tr>`;
    message.textContent = error.message;
    message.classList.add("is-error");
  }
}

$("#userRows").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-role]");
  if (!button) return;
  const row = button.closest("tr[data-user-id]");
  const role = row.querySelector("select").value;
  const message = $("#usersMessage");
  button.disabled = true;
  message.classList.remove("is-error");
  try {
    await adminApi(`/api/users/${encodeURIComponent(row.dataset.userId)}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
    message.textContent = "บันทึกสิทธิ์ผู้ใช้เรียบร้อยแล้ว";
    await loadUsers();
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("is-error");
  } finally {
    button.disabled = false;
  }
});
document.querySelectorAll("[data-deleted-category]").forEach((button) => button.addEventListener("click", () => {
  deletedCategory = button.dataset.deletedCategory;
  document.querySelectorAll("[data-deleted-category]").forEach((item) => item.classList.toggle("is-active", item === button));
  renderDeleted();
}));

document.querySelector("#backMenuButton").addEventListener("click", () => window.location.replace("./menu.html"));
window.addEventListener("fms-admin-settings-ready", () => {
  renderAll();
  if (!$("#usersPanel").hidden) loadUsers();
});
const notificationButton = document.querySelector("#notificationButton");
const notificationPanel = document.querySelector("#notificationPanel");
const closeNotification = document.querySelector("#closeNotification");
const notificationBadge = document.querySelector("#notificationBadge");
const notificationList = document.querySelector("#notificationList");
const escapeNotificationText = (value) => String(value ?? "");
function renderNotifications() {
  const notifications = window.FMSNotifications?.getAll(document.documentElement.lang === "en" ? "en" : "th") || [];
  notificationBadge.textContent = notifications.length > 99 ? "99+" : String(notifications.length);
  notificationBadge.hidden = notifications.length === 0;
  notificationButton.setAttribute("aria-label", notifications.length ? `การแจ้งเตือน ${notifications.length} รายการ` : "การแจ้งเตือน");
  notificationList.replaceChildren();
  if (!notifications.length) {
    const empty = document.createElement("p");
    empty.className = "admin-notification-empty";
    empty.textContent = "ไม่มีรายการแจ้งเตือน";
    notificationList.append(empty);
    return;
  }
  notifications.forEach((item) => {
    const article = document.createElement("article");
    article.className = "admin-notification-item";
    article.innerHTML = `<span aria-hidden="true"></span><div><strong></strong><p></p></div>`;
    article.querySelector("strong").textContent = escapeNotificationText(item.title);
    article.querySelector("p").textContent = escapeNotificationText(item.detail);
    notificationList.append(article);
  });
}
const setNotificationVisibility = (isOpen) => {
  notificationPanel.hidden = !isOpen;
  notificationButton.setAttribute("aria-expanded", String(isOpen));
};
notificationButton.addEventListener("click", () => setNotificationVisibility(notificationPanel.hidden));
closeNotification.addEventListener("click", () => setNotificationVisibility(false));
document.addEventListener("click", (event) => {
  if (!notificationPanel.hidden && !notificationPanel.contains(event.target) && !notificationButton.contains(event.target)) setNotificationVisibility(false);
});
renderNotifications();
let session = null;
try { session = JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || "null"); } catch {}
if (session?.role !== "admin") window.location.replace("./index.html");
renderAll();
