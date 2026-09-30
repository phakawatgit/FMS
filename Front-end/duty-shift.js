import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6eLRN8rU-e7KJMb1Diw_mFNH81pWpzIg",
  authDomain: "fams-7fdff.firebaseapp.com",
  projectId: "fams-7fdff",
  storageBucket: "fams-7fdff.firebasestorage.app",
  messagingSenderId: "636847349725",
  appId: "1:636847349725:web:01eaad241d971a2437a034"
};

const DUTY_KEY = "fms-local-duty-records";
const API_BASE = window.FMS_API_URL || `${location.protocol}//${location.hostname}:4000`;
const DUTY_PROFILE_KEY = "fms-duty-profiles";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const monthSelect = document.getElementById("calendarMonth");
const yearSelect = document.getElementById("calendarYear");
const calendarGrid = document.getElementById("calendarGrid");
const palette = document.getElementById("colorPalette");
const pageDots = document.getElementById("colorPagination");
const dutyForm = document.getElementById("dutyForm");
const dutyStatus = document.getElementById("dutyStatus");
const recordList = document.getElementById("dutyRecordList");
const recordSearch = document.getElementById("recordSearch");
const colors = Array.from({ length: 50 }, (_, index) => ({
  id: `color-${index + 1}`,
  value: `hsl(${Math.round(index * 360 / 50)} 68% ${index % 5 === 0 ? 70 : 78}%)`
}));
const copy = {
  th: { title: "ตารางเวรและการเข้าเวร", calendar: "การเข้าเวร", details: "รายละเอียดการเข้าเวร", latest: "ล่าสุด", noRecords: "ยังไม่มีข้อมูลการเข้าเวร", first: "ชื่อ", last: "นามสกุล", nickname: "ชื่อเล่น", affiliation: "สังกัด", save: "บันทึกเวร", chooseColor: "กรุณาเลือกสีประจำตัว", saved: "บันทึกการเข้าเวรแล้ว", excel: "Excel", pdf: "PDF", today: "วันนี้", date: "วันที่บันทึก", search: "ค้นหาชื่อ, วันที่" },
  en: { title: "Duty Shift Scheduling & Attendance", calendar: "Duty Shift", details: "Duty Shift Details", latest: "Latest", noRecords: "No duty records yet", first: "First name", last: "Last name", nickname: "Nickname", affiliation: "Affiliation", save: "Save shift", chooseColor: "Please choose your color", saved: "Duty shift saved", excel: "Excel", pdf: "PDF", today: "Today", date: "Selected date", search: "Search name, date" }
};

let language = "th";
let currentUser = null;
const ADMIN_SESSION_KEY = "fms-admin-session";

function hasAdminSession() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "null")?.role === "admin";
  } catch {
    return false;
  }
}
let selectedColor = null;
let colorPage = 0;
let selectedDate = new Date();
let records = readRecords();

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function readRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(DUTY_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((record) => record?.date) : [];
  } catch { return []; }
}

function readProfiles() {
  try {
    const saved = JSON.parse(localStorage.getItem(DUTY_PROFILE_KEY) || "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch { return {}; }
}

// Use the Firebase uid as the primary identity and email as a fallback. The
// fallback is useful for older records created before email was stored.
function getUserKey(user = currentUser) {
  return String(user?.uid || user?.email || "").trim();
}

function belongsToUser(record, user = currentUser) {
  const userKey = getUserKey(user);
  const email = String(user?.email || "").trim().toLowerCase();
  if (!userKey && !email) return false;
  const recordUid = String(record?.uid || "").trim();
  const recordEmail = String(record?.email || record?.userEmail || record?.accountEmail || "").trim().toLowerCase();
  return recordUid === userKey || (email && (recordEmail === email || recordUid.toLowerCase() === email));
}

function restoreCurrentUserProfile(user = currentUser) {
  const email = String(user?.email || "").trim().toLowerCase();
  const profiles = readProfiles();
  const savedProfile = profiles[email] || profiles[getUserKey(user)] || null;
  const previous = records
    .filter((record) => belongsToUser(record, user))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0];
  if (!previous && !savedProfile) {
    selectedColor = null;
    return;
  }
  const profile = savedProfile || previous;
  selectedColor = profile.colorId || previous?.colorId || null;
  document.getElementById("nurseFirstName").value = profile.firstName || previous?.firstName || "";
  document.getElementById("nurseLastName").value = profile.lastName || previous?.lastName || "";
  document.getElementById("nurseNickname").value = profile.nickname || previous?.nickname || "";
  document.getElementById("nurseAffiliation").value = profile.affiliation || previous?.affiliation || "";
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(key, locale = language === "th" ? "th-TH" : "en-GB") {
  const date = parseDateKey(key);
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function getDutyTooltip(record) {
  const nickname = record.nickname?.trim() || (language === "th" ? "ไม่ระบุ" : "Not provided");
  const person = record.nurseName || [record.firstName, record.lastName].filter(Boolean).join(" ") || (language === "th" ? "ไม่ระบุชื่อ" : "Name unavailable");
  const timestamp = record.updatedAt || record.createdAt;
  const parsed = timestamp ? new Date(timestamp) : null;
  const time = parsed && !Number.isNaN(parsed.getTime())
    ? new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(parsed)
    : (language === "th" ? "ไม่ระบุเวลา" : "Time unavailable");
  return language === "th"
    ? `ผู้เข้าเวร: ${person}\nชื่อเล่น: ${nickname}\nวันที่: ${formatDate(record.date)}\nเวลา: ${time} น.`
    : `On duty: ${person}\nNickname: ${nickname}\nDate: ${formatDate(record.date)}\nTime: ${time}`;
}

function populateMonths() {
  const today = new Date();
  const startYear = today.getFullYear();
  const endYear = startYear + 9;
  const months = getMonthOptions();
  const years = Array.from({ length: endYear - startYear + 1 }, (_, index) => ({ value: String(startYear + index), label: String(startYear + index) }));
  monthSelect.value = String(today.getMonth() + 1);
  yearSelect.value = String(today.getFullYear());
  renderCustomPicker("month", months, monthSelect.value);
  renderCustomPicker("year", years, yearSelect.value);
}

function getMonthOptions() {
  const locale = language === "th" ? "th-TH" : "en-US";
  return Array.from({ length: 12 }, (_, month) => ({ value: String(month + 1), label: new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2020, month, 1)) }));
}

function renderCustomPicker(name, options, selectedValue) {
  const list = document.getElementById(`${name}Options`);
  const valueLabel = document.getElementById(`${name}Value`);
  const selected = options.find((option) => option.value === selectedValue);
  valueLabel.textContent = selected?.label || "";
  list.innerHTML = options.map((option) => `<button class="custom-picker-option${option.value === selectedValue ? " is-selected" : ""}" type="button" role="option" aria-selected="${option.value === selectedValue}" data-picker="${name}" data-value="${escapeHtml(option.value)}">${escapeHtml(option.label)}${option.value === selectedValue ? '<span aria-hidden="true">✓</span>' : ""}</button>`).join("");
}

function closeCustomPickers(focusName = null) {
  ["month", "year"].forEach((name) => {
    document.getElementById(`${name}Options`).hidden = true;
    document.getElementById(`${name}Trigger`).setAttribute("aria-expanded", "false");
  });
  if (focusName) document.getElementById(`${focusName}Trigger`).focus();
}

function openCustomPicker(name, focusSelected = false) {
  closeCustomPickers();
  const list = document.getElementById(`${name}Options`);
  document.getElementById(`${name}Trigger`).setAttribute("aria-expanded", "true");
  list.hidden = false;
  if (focusSelected) (list.querySelector(".is-selected") || list.querySelector("[role=option]"))?.focus();
}

function setupCustomPickers() {
  ["month", "year"].forEach((name) => {
    const trigger = document.getElementById(`${name}Trigger`);
    const list = document.getElementById(`${name}Options`);
    const input = name === "month" ? monthSelect : yearSelect;
    trigger.addEventListener("click", () => list.hidden ? openCustomPicker(name) : closeCustomPickers());
    trigger.addEventListener("keydown", (event) => {
      if (["ArrowDown", "Enter", " "].includes(event.key)) { event.preventDefault(); openCustomPicker(name, true); }
    });
    list.addEventListener("click", (event) => {
      const option = event.target.closest("[data-value]");
      if (!option) return;
      input.value = option.dataset.value;
      renderCustomPicker(name, Array.from(list.querySelectorAll("[data-value]")).map((item) => ({ value: item.dataset.value, label: item.firstChild.textContent.trim() })), input.value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById(`${name}Trigger`).focus();
      closeCustomPickers();
    });
    list.addEventListener("keydown", (event) => {
      const options = Array.from(list.querySelectorAll("[role=option]"));
      const index = options.indexOf(document.activeElement);
      if (event.key === "Escape") { event.preventDefault(); closeCustomPickers(name); }
      else if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length]?.focus(); }
      else if (event.key === "Home" || event.key === "End") { event.preventDefault(); (event.key === "Home" ? options[0] : options.at(-1))?.focus(); }
    });
  });
  document.addEventListener("click", (event) => { if (!event.target.closest(".custom-picker")) closeCustomPickers(); });
}

function renderCalendar() {
  const year = Number(yearSelect.value);
  const month = Number(monthSelect.value);
  if (!year || !month) return;
  const firstDay = new Date(year, month - 1, 1).getDay();
  const dayCount = new Date(year, month, 0).getDate();
  const todayKey = getDateKey(new Date());
  const cells = Array.from({ length: firstDay }, () => '<span class="calendar-blank" aria-hidden="true"></span>');
  for (let day = 1; day <= dayCount; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dutyRecords = records.filter((record) => record.date === date);
    const dots = dutyRecords.map((record) => {
      const tooltip = getDutyTooltip(record);
      return `<i class="calendar-duty-dot" tabindex="0" role="img" data-tooltip="${escapeHtml(tooltip)}" aria-label="${escapeHtml(tooltip)}" style="background:${escapeHtml(record.colorValue || "#315dd4")}"></i>`;
    }).join("");
    const classes = ["calendar-cell", date === todayKey ? "is-today" : "", date === getDateKey(selectedDate) ? "is-selected" : ""].filter(Boolean).join(" ");
    cells.push(`<button class="${classes}" type="button" role="gridcell" aria-label="${escapeHtml(formatDate(date))}" aria-pressed="${date === getDateKey(selectedDate)}" data-date="${date}"><span>${day}</span><span class="calendar-dots">${dots}</span></button>`);
  }
  calendarGrid.innerHTML = cells.join("");
  document.getElementById("selectedDateLabel").textContent = formatDate(getDateKey(selectedDate));
}

function renderPalette() {
  const pageSize = 20;
  const pageCount = Math.ceil(colors.length / pageSize);
  const visibleColors = colors.slice(colorPage * pageSize, (colorPage + 1) * pageSize);
  palette.innerHTML = visibleColors.map((color) => {
    const usedByOther = records.some((record) => record.colorId === color.id && !belongsToUser(record));
    return `<button class="color-choice${selectedColor === color.id ? " is-selected" : ""}${usedByOther ? " is-locked" : ""}" type="button" data-color="${color.id}" style="background:${color.value}" aria-label="${color.id}" title="${color.id}" ${usedByOther ? "disabled" : ""}></button>`;
  }).join("");
  pageDots.innerHTML = Array.from({ length: pageCount }, (_, index) => `<button class="color-page-dot${index === colorPage ? " is-active" : ""}" type="button" aria-label="Palette page ${index + 1}" aria-pressed="${index === colorPage}" data-page="${index}"></button>`).join("");
  document.getElementById("previousColorPage").disabled = colorPage === 0;
  document.getElementById("nextColorPage").disabled = colorPage === pageCount - 1;
  document.getElementById("selectedColorPreview").style.background = colors.find((color) => color.id === selectedColor)?.value || "#dce8f6";
}

function renderRecords() {
  const query = recordSearch.value.trim().toLocaleLowerCase();
  const visibleRecords = [...records].sort((a, b) => b.date.localeCompare(a.date) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).filter((record) => {
    const text = `${record.nurseName || ""} ${record.nickname || ""} ${record.affiliation || ""} ${record.date || ""}`.toLocaleLowerCase();
    return !query || text.includes(query);
  });
  document.getElementById("recordCount").textContent = `${visibleRecords.length}`;
  document.getElementById("emptyRecords").hidden = visibleRecords.length > 0;
  recordList.innerHTML = visibleRecords.length ? visibleRecords.map((record) => {
    const time = record.updatedAt && !Number.isNaN(new Date(record.updatedAt).getTime())
      ? new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date(record.updatedAt))
      : "—";
    return `<article class="duty-record-card"><time datetime="${escapeHtml(record.date)}">${escapeHtml(formatDate(record.date))}</time><div class="duty-record-main"><span class="duty-record-person"><i style="background:${escapeHtml(record.colorValue || "#315dd4")}"></i><span><strong>${escapeHtml(record.nurseName || "—")}</strong>${record.nickname ? ` (${escapeHtml(record.nickname)})` : ""}${record.affiliation ? ` · ${escapeHtml(record.affiliation)}` : ""}</span></span><span class="duty-record-time">${language === "th" ? "เข้าเวร" : "On duty"} ${escapeHtml(time)}${language === "th" ? " น." : ""}</span></div></article>`;
  }).join("") : "";
  if (!visibleRecords.length && query) recordList.innerHTML = `<p class="duty-record-empty">${language === "th" ? "ไม่พบรายการที่ค้นหา" : "No matching records found"}</p>`;
}

function renderLanguage() {
  const text = copy[language];
  document.documentElement.lang = language;
  document.querySelector(".duty-page-heading h1").innerHTML = language === "th" ? "ตารางเวรและการเข้าเวร" : "Duty Shift Scheduling &amp;<br class=\"mobile-break\"> Attendance";
  document.getElementById("calendarTitle").textContent = text.calendar;
  document.getElementById("recentTitle").textContent = text.details;
  document.querySelector(".recent-list-heading h3").textContent = text.latest;
  document.getElementById("emptyRecords").textContent = text.noRecords;
  document.getElementById("nurseFirstName").previousElementSibling.textContent = text.first;
  document.getElementById("nurseLastName").previousElementSibling.textContent = text.last;
  document.getElementById("nurseNickname").previousElementSibling.textContent = text.nickname;
  document.getElementById("nurseAffiliation").previousElementSibling.textContent = text.affiliation;
  document.getElementById("dutyFormTitle").textContent = language === "th" ? "บันทึกการเข้าเวร" : "Record a duty shift";
  document.getElementById("colorPickerTitle").textContent = language === "th" ? "เลือกสีประจำตัว" : "Choose your color";
  document.getElementById("previousColorPage").setAttribute("aria-label", language === "th" ? "สีก่อนหน้า" : "Previous colors");
  document.getElementById("nextColorPage").setAttribute("aria-label", language === "th" ? "สีถัดไป" : "Next colors");
  document.querySelector(".schedule-button").textContent = text.save;
  document.querySelector(".record-search input").placeholder = text.search;
  document.querySelector("#recordSearch").setAttribute("aria-label", text.search);
  document.querySelector(".week-row").innerHTML = (language === "th" ? ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).map((day) => `<span>${day}</span>`).join("");
  renderCustomPicker("month", getMonthOptions(), monthSelect.value);
  document.querySelector(".selected-date-label").firstChild.textContent = `${text.date}: `;
  document.getElementById("languageLabel").textContent = language === "th" ? "ไทย" : "English";
  renderCalendar();
  renderRecords();
}

function saveLocalRecord(record) {
  records = records.filter((item) => !(belongsToUser(item, currentUser) && item.date === record.date));
  records.push(record);
  localStorage.setItem(DUTY_KEY, JSON.stringify(records));

  const profileKey = String(currentUser?.email || getUserKey(currentUser) || "").trim().toLowerCase();
  if (profileKey) {
    const profiles = readProfiles();
    profiles[profileKey] = {
      uid: record.uid,
      email: record.email,
      colorId: record.colorId,
      colorValue: record.colorValue,
      firstName: record.firstName,
      lastName: record.lastName,
      nickname: record.nickname,
      affiliation: record.affiliation,
      updatedAt: record.updatedAt,
    };
    localStorage.setItem(DUTY_PROFILE_KEY, JSON.stringify(profiles));
  }
}

async function saveDuty(event) {
  event.preventDefault();
  if (!currentUser) return;
  const firstName = document.getElementById("nurseFirstName").value.trim();
  const lastName = document.getElementById("nurseLastName").value.trim();
  if (!selectedColor) { dutyStatus.textContent = copy[language].chooseColor; return; }
  const color = colors.find((item) => item.id === selectedColor);
  const record = {
    uid: getUserKey(currentUser),
    email: currentUser.email || "",
    nurseName: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    nickname: document.getElementById("nurseNickname").value.trim(),
    affiliation: document.getElementById("nurseAffiliation").value.trim(),
    colorId: color.id,
    colorValue: color.value,
    date: getDateKey(selectedDate),
    updatedAt: new Date().toISOString()
  };
  let savedToDatabase = false;
  try {
    const response = await fetch(`${API_BASE}/api/nurses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: record.firstName,
        lastName: record.lastName,
        nickname: record.nickname,
        affiliation: record.affiliation,
      }),
    });
    if (!response.ok) throw new Error("Nurse data could not be saved");
    savedToDatabase = true;
  } catch (error) {
    console.error("Nurse data sync failed:", error);
  }
  saveLocalRecord(record);
  dutyStatus.textContent = savedToDatabase
    ? `${copy[language].saved} · ${formatDate(record.date)}`
    : `${copy[language].saved} · ${language === "th" ? "บันทึกข้อมูลในฐานข้อมูลไม่สำเร็จ" : "Database sync failed"}`;
  renderCalendar();
  renderPalette();
  renderRecords();
}

function exportExcel() {
  const rows = [...records].sort((a, b) => a.date.localeCompare(b.date)).map((record) => `<tr><td>${escapeHtml(formatDate(record.date))}</td><td>${escapeHtml(record.nurseName || "")}</td><td>${escapeHtml(record.nickname || "")}</td><td>${escapeHtml(record.affiliation || "")}</td><td>${escapeHtml(record.updatedAt ? new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" }).format(new Date(record.updatedAt)) : "")}</td></tr>`).join("");
  const html = `<html><head><meta charset="utf-8"></head><body><h2>Duty Shift Attendance</h2><table border="1"><thead><tr><th>วันที่</th><th>ชื่อ-นามสกุล</th><th>ชื่อเล่น</th><th>สังกัด</th><th>เวลา</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const url = URL.createObjectURL(new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "FMS-duty-shift.xls"; link.click(); URL.revokeObjectURL(url);
}

populateMonths();
setupCustomPickers();
renderCalendar();
renderPalette();
renderRecords();
renderLanguage();
const changeCalendarMonth = () => { const year = Number(yearSelect.value); const month = Number(monthSelect.value); selectedDate = new Date(year, month - 1, 1); renderCalendar(); };
monthSelect.addEventListener("change", changeCalendarMonth);
yearSelect.addEventListener("change", changeCalendarMonth);
calendarGrid.addEventListener("click", (event) => { const cell = event.target.closest("[data-date]"); if (!cell) return; selectedDate = parseDateKey(cell.dataset.date); renderCalendar(); });
palette.addEventListener("click", (event) => { const button = event.target.closest("[data-color]"); if (!button || button.disabled) return; selectedColor = button.dataset.color; renderPalette(); });
pageDots.addEventListener("click", (event) => { const button = event.target.closest("[data-page]"); if (!button) return; colorPage = Number(button.dataset.page); renderPalette(); });
document.getElementById("previousColorPage").addEventListener("click", () => { if (colorPage > 0) { colorPage -= 1; renderPalette(); } });
document.getElementById("nextColorPage").addEventListener("click", () => { if (colorPage < 2) { colorPage += 1; renderPalette(); } });
dutyForm.addEventListener("submit", saveDuty);
recordSearch.addEventListener("input", renderRecords);
document.getElementById("exportExcel").addEventListener("click", exportExcel);
document.getElementById("exportPdf").addEventListener("click", () => window.print());
document.getElementById("languageButton").addEventListener("click", () => { language = language === "th" ? "en" : "th"; renderLanguage(); });
const notificationPanel = document.getElementById("notificationPanel");
document.getElementById("notificationButton").addEventListener("click", () => { notificationPanel.hidden = !notificationPanel.hidden; });
document.getElementById("closeNotification").addEventListener("click", () => { notificationPanel.hidden = true; });
document.addEventListener("click", (event) => { if (!notificationPanel.hidden && !notificationPanel.contains(event.target) && !document.getElementById("notificationButton").contains(event.target)) notificationPanel.hidden = true; });
document.getElementById("calendarGrid").addEventListener("keydown", (event) => { if (event.key === "Escape") document.activeElement.blur(); });
window.addEventListener("storage", (event) => {
  if (![DUTY_KEY, DUTY_PROFILE_KEY].includes(event.key)) return;
  records = readRecords();
  restoreCurrentUserProfile();
  renderCalendar();
  renderPalette();
  renderRecords();
});

onAuthStateChanged(auth, (user) => {
  if (hasAdminSession()) {
    currentUser = { uid: "admin", displayName: "Admin" };
    records = readRecords();
    restoreCurrentUserProfile();
    renderPalette();
    renderCalendar();
    renderRecords();
    return;
  }
  if (!user) { window.location.href = "./index.html"; return; }
  currentUser = user;
  records = readRecords();
  restoreCurrentUserProfile(user);
  renderPalette();
  renderCalendar();
  renderRecords();
});
