import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { collection, doc, getFirestore, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6eLRN8rU-e7KJMb1Diw_mFNH81pWpzIg",
  authDomain: "fams-7fdff.firebaseapp.com",
  projectId: "fams-7fdff",
  storageBucket: "fams-7fdff.firebasestorage.app",
  messagingSenderId: "636847349725",
  appId: "1:636847349725:web:01eaad241d971a2437a034"
};

// Keep duty data in this browser while the frontend is being developed.
// Change this to true only after Firestore rules have been published.
const USE_FIRESTORE = false;
const LOCAL_DUTY_STORAGE_KEY = "fms-local-duty-records";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const menuGrid = document.getElementById("menuGrid");
const languageInputs = document.querySelectorAll("input[name='language']");
const signOutButton = document.getElementById("signOutButton");
const signOutLabel = document.getElementById("signOutLabel");
const notificationBadge = document.getElementById("notificationBadge");
const notificationButton = document.getElementById("notificationButton");
const notificationPanel = document.getElementById("notificationPanel");
const notificationList = document.getElementById("notificationList");
const notificationSummary = document.getElementById("notificationSummary");
const markNotificationsRead = document.getElementById("markNotificationsRead");
const languageSwitcher = document.querySelector(".language-switcher");
const colorPalette = document.getElementById("colorPalette");
const colorPagination = document.getElementById("colorPagination");
const previousColorPage = document.getElementById("previousColorPage");
const nextColorPage = document.getElementById("nextColorPage");
const dutyForm = document.getElementById("dutyForm");
const dutyStatus = document.getElementById("dutyStatus");
const viewCalendarButton = document.getElementById("viewCalendarButton");
const yearCalendarModal = document.getElementById("yearCalendarModal");
const yearCalendarContent = document.getElementById("yearCalendarContent");
const closeYearCalendar = document.getElementById("closeYearCalendar");
const yearCalendarPicker = document.getElementById("yearCalendarPicker");
const yearCalendarPrevious = document.getElementById("yearCalendarPrevious");
const yearCalendarNext = document.getElementById("yearCalendarNext");
const yearCalendarTrigger = document.getElementById("yearCalendarTrigger");
const yearCalendarValue = document.getElementById("yearCalendarValue");
const yearCalendarOptions = document.getElementById("yearCalendarOptions");
const ADMIN_SESSION_KEY = "fms-admin-session";

function isAdminSession() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY) || "null")?.role === "admin";
  } catch {
    return false;
  }
}

const colors = Array.from({ length: 50 }, (_, index) => ({
  id: `color-${index + 1}`,
  value: `hsl(${Math.round((index * 360) / 50)} 68% ${index % 5 === 0 ? 76 : 82}%)`
}));

const translations = {
  th: {
    today: "วันนี้", viewCalendar: "ดูปฏิทิน", dutyShift: "การเข้าเวร", calendarLabel: "ปฏิทินเดือนปัจจุบัน", sun: "อา", mon: "จ", tue: "อ", wed: "พ", thu: "พฤ", fri: "ศ", sat: "ส", notifications: "การแจ้งเตือน", markAllRead: "อ่านทั้งหมด", changeLanguage: "เปลี่ยนภาษา", dutyOverview: "ภาพรวมการเข้าเวร", chooseColor: "เลือกแถบสี", choosePersonalColor: "เลือกสีประจำตัว", previousColorPage: "สีหน้าก่อนหน้า", nextColorPage: "สีหน้าถัดไป", dutyRecord: "บันทึกการเข้าเวร", dutyHint: "กรอกข้อมูลให้ครบเพื่อบันทึกเวรของคุณ", firstName: "ชื่อ", lastName: "นามสกุล", nickname: "ชื่อเล่น", affiliation: "สังกัด", firstNamePlaceholder: "เช่น สมใจ", lastNamePlaceholder: "เช่น ใจดี", nicknamePlaceholder: "ไม่บังคับ", affiliationPlaceholder: "เช่น ห้องพยาบาล", saveDuty: "บันทึก", yearCalendarTitle: "ปฏิทินเวรประจำปี", yearCalendarLegend: "จุดสีแสดงวันที่มีพยาบาลเข้าเวร", selectYear: "เลือกปี", previousYear: "ปีก่อนหน้า", nextYear: "ปีถัดไป", closeCalendar: "ปิดปฏิทิน", workspace: "พื้นที่ทำงาน", menu: "เมนู", menuHint: "จัดการงานปฐมพยาบาลและยาได้ในที่เดียว", signOut: "ออกจากระบบ", colorRequired: "กรุณาเลือกสีประจำตัว", saved: "บันทึกการเข้าเวรแล้ว", colorLocked: "สีนี้ถูกใช้โดยพยาบาลคนอื่นแล้ว", saveError: "บันทึกไม่สำเร็จ กรุณาลองใหม่",
    cards: [["Dashboard and Report", "แดชบอร์ดและรายงาน", "5.png"], ["Infirmary Visit", "บันทึกการเข้าห้องพยาบาล", "6.png"], ["Stock", "คลังยาและเวชภัณฑ์", "7.png"], ["Catalog", "แคตตาล็อกการสั่งซื้อ", "8.png"], ["Borrow and Return", "ระบบการยืม-คืน", "9.png"], ["Duty Shift", "ระบบการเข้าเวร", "10.png"], ["System Activity Log", "ประวัติกิจกรรมระบบ", "11.png"]], setting: ["Setting", "จัดการการตั้งค่าระบบสำหรับ Admin", "icon setting.png"]
  },
  en: {
    today: "Today", viewCalendar: "View calendar", dutyShift: "Duty shift", calendarLabel: "Current month calendar", sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", notifications: "Notifications", markAllRead: "Mark all read", changeLanguage: "Change language", dutyOverview: "Duty overview", chooseColor: "Choose a color", choosePersonalColor: "Choose a personal color", previousColorPage: "Previous color page", nextColorPage: "Next color page", dutyRecord: "Duty shift record", dutyHint: "Complete the details to record your duty shift", firstName: "First name", lastName: "Last name", nickname: "Nickname", affiliation: "Affiliation", firstNamePlaceholder: "e.g. Somchai", lastNamePlaceholder: "e.g. Jaidee", nicknamePlaceholder: "Optional", affiliationPlaceholder: "e.g. Infirmary", saveDuty: "Save", yearCalendarTitle: "Annual duty calendar", yearCalendarLegend: "Colored dots show days with an assigned nurse", selectYear: "Select year", previousYear: "Previous year", nextYear: "Next year", closeCalendar: "Close calendar", workspace: "Workspace", menu: "Menu", menuHint: "Manage first aid and medicine in one place", signOut: "Log Out", colorRequired: "Please choose your color", saved: "Duty shift saved", colorLocked: "This color is already assigned to another nurse", saveError: "Could not save. Please try again",
    cards: [["Dashboard and Report", "Dashboard and reports", "5.png"], ["Infirmary Visit", "Infirmary visit record", "6.png"], ["Stock", "Medicine and supply stock", "7.png"], ["Catalog", "Medicine ordering catalog", "8.png"], ["Borrow and Return", "Borrow and return records", "9.png"], ["Duty Shift", "Duty shift schedule", "10.png"], ["System Activity Log", "System activity history", "11.png"]], setting: ["Settings", "Manage system settings for Admin", "icon setting.png"]
  }
};

let language = "th";
let selectedColor = null;
let currentColorPage = 0;
const viewDate = new Date();
const YEAR_CALENDAR_START = 2026;
let yearCalendarYear = Math.max(viewDate.getFullYear(), YEAR_CALENDAR_START);
let colorLocks = new Map();
let dutyRecords = new Map();
let notificationsMarkedRead = false;

function loadLocalDutyRecords() {
  try {
    const records = JSON.parse(localStorage.getItem(LOCAL_DUTY_STORAGE_KEY) || "[]");
    dutyRecords = new Map();
    records.forEach((record) => {
      if (!record.date) return;
      if (!dutyRecords.has(record.date)) dutyRecords.set(record.date, []);
      dutyRecords.get(record.date).push(record);
    });
  } catch {
    dutyRecords = new Map();
  }
}

function saveLocalDutyRecords() {
  const records = Array.from(dutyRecords.values()).flat();
  localStorage.setItem(LOCAL_DUTY_STORAGE_KEY, JSON.stringify(records));
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDutyTooltip(record) {
  const nickname = record.nickname?.trim() || record.nurseName || (language === "th" ? "ไม่ระบุชื่อเล่น" : "No nickname");
  const recordedAt = record.updatedAt || record.createdAt;
  const parsedDate = recordedAt ? new Date(recordedAt) : null;
  const time = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(parsedDate)
    : (language === "th" ? "ไม่ระบุเวลา" : "Time unavailable");
  return language === "th" ? `ชื่อเล่น: ${nickname}\nบันทึกเมื่อ: ${time}` : `Nickname: ${nickname}\nRecorded: ${time}`;
}

function escapeAttribute(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]));
}

function setNotificationCount(count) {
  const safeCount = Math.max(0, Number(count) || 0);
  notificationBadge.textContent = safeCount > 99 ? "99+" : String(safeCount);
  notificationBadge.hidden = safeCount === 0;
}

function getDateLabel(daysFromToday) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function getNotifications() {
  return window.FMSNotifications?.getAll(language) || [];
}

function renderNotifications() {
  const notifications = getNotifications();
  notificationList.innerHTML = notifications.map((item) => `<article class="notification-item is-${item.level}${notificationsMarkedRead ? " is-read" : ""}"><span class="notification-item-dot" aria-hidden="true"></span><div><h4>${item.title}</h4><p>${item.detail}</p></div></article>`).join("");
  notificationSummary.textContent = notificationsMarkedRead
    ? (language === "th" ? "อ่านแล้วทั้งหมด" : "All caught up")
    : (language === "th" ? `${notifications.length} รายการที่ต้องดำเนินการ` : `${notifications.length} items need attention`);
  markNotificationsRead.textContent = language === "th" ? "อ่านทั้งหมด" : "Mark all read";
  setNotificationCount(notificationsMarkedRead ? 0 : notifications.length);
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const monthTitle = document.getElementById("monthTitle");
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = getDateKey(new Date());
  monthTitle.textContent = new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", { month: "long", year: "numeric" }).format(viewDate);
  grid.innerHTML = "";
  for (let i = 0; i < firstDay; i += 1) grid.appendChild(document.createElement("span"));
  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = document.createElement("div");
    const date = getDateKey(new Date(year, month, day));
    cell.className = `calendar-cell${date === todayKey ? " is-today" : ""}`;
    const number = document.createElement("span");
    number.textContent = day;
    cell.appendChild(number);
    const dots = document.createElement("div");
    dots.className = "calendar-dots";
    (dutyRecords.get(date) || []).forEach((record) => {
      const dot = document.createElement("span");
      dot.className = "calendar-duty-dot";
      dot.style.backgroundColor = record.colorValue;
      const tooltip = getDutyTooltip(record);
      dot.dataset.tooltip = tooltip;
      dot.setAttribute("aria-label", tooltip);
      dots.appendChild(dot);
    });
    cell.appendChild(dots);
    grid.appendChild(cell);
  }
}

function getCalendarDots(date) {
  const savedRecords = dutyRecords.get(date) || [];
  if (savedRecords.length) return savedRecords.slice(0, 3).map((record) => record.colorValue || "#315dd4");
  const day = Number(date.slice(-2));
  const month = Number(date.slice(5, 7));
  if ((day * 3 + month) % 11 === 0) return ["#f49a73", "#6d92ed"];
  if ((day + month * 2) % 7 === 0) return ["#59b890"];
  return [];
}

function renderYearCalendar() {
  const todayKey = getDateKey(new Date());
  const locale = language === "th" ? "th-TH" : "en-US";
  const weekdays = language === "th" ? ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] : ["S", "M", "T", "W", "T", "F", "S"];
  renderYearCalendarPicker();
  const year = yearCalendarYear;
  yearCalendarContent.innerHTML = [year].map((year) => {
    const months = Array.from({ length: 12 }, (_, month) => {
      const monthName = new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(year, month, 1));
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const emptyDays = Array.from({ length: firstDay }, () => "<span></span>").join("");
      const days = Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const date = getDateKey(new Date(year, month, day));
        const records = dutyRecords.get(date) || [];
        const dots = records.length
          ? records.slice(0, 3).map((record) => { const tooltip = escapeAttribute(getDutyTooltip(record)); return `<i data-tooltip="${tooltip}" aria-label="${tooltip}" style="background:${record.colorValue || "#315dd4"}"></i>`; }).join("")
          : getCalendarDots(date).map((color) => `<i style="background:${color}"></i>`).join("");
        return `<span class="mini-day${date === todayKey ? " is-today" : ""}">${day}<span class="mini-dots">${dots}</span></span>`;
      }).join("");
      return `<section class="mini-month"><h4>${monthName}</h4><div class="mini-weekdays">${weekdays.map((day) => `<span>${day}</span>`).join("")}</div><div class="mini-days">${emptyDays}${days}</div></section>`;
    }).join("");
    return `<section class="year-block"><h3>${year}</h3><div class="year-months">${months}</div></section>`;
  }).join("");
}

function renderYearCalendarPicker() {
  yearCalendarValue.textContent = String(yearCalendarYear);
  const isAtFirstYear = yearCalendarYear === YEAR_CALENDAR_START;
  yearCalendarPrevious.disabled = isAtFirstYear;
  yearCalendarPrevious.setAttribute("aria-disabled", String(isAtFirstYear));
  // Keep 2026 as the first available year and keep adding future years as the
  // selected year moves forward. There is intentionally no upper limit.
  const lastYear = Math.max(yearCalendarYear + 4, YEAR_CALENDAR_START + 4);
  const years = Array.from({ length: lastYear - YEAR_CALENDAR_START + 1 }, (_, index) => YEAR_CALENDAR_START + index);
  yearCalendarOptions.innerHTML = years.map((year) => `<button class="year-calendar-option${year === yearCalendarYear ? " is-selected" : ""}" type="button" role="option" aria-selected="${year === yearCalendarYear}" data-year="${year}">${year}${year === yearCalendarYear ? '<span aria-hidden="true">✓</span>' : ""}</button>`).join("");
}

function closeYearCalendarPicker() {
  yearCalendarOptions.hidden = true;
  yearCalendarTrigger.setAttribute("aria-expanded", "false");
}

function openYearCalendarPicker() {
  yearCalendarOptions.hidden = false;
  yearCalendarTrigger.setAttribute("aria-expanded", "true");
  yearCalendarOptions.querySelector(".is-selected")?.focus();
}

function changeYearCalendar(year) {
  yearCalendarYear = Math.max(YEAR_CALENDAR_START, Number(year));
  closeYearCalendarPicker();
  renderYearCalendar();
  yearCalendarTrigger.focus();
}

function openYearCalendar() {
  yearCalendarYear = Math.max(new Date().getFullYear(), YEAR_CALENDAR_START);
  renderYearCalendar();
  yearCalendarModal.hidden = false;
  document.body.style.overflow = "hidden";
  closeYearCalendar.focus();
}

function hideYearCalendar() {
  yearCalendarModal.hidden = true;
  document.body.style.overflow = "";
  viewCalendarButton.focus();
}

function renderPalette() {
  const pageSize = 20;
  const pageCount = Math.ceil(colors.length / pageSize);
  const pageColors = colors.slice(currentColorPage * pageSize, (currentColorPage + 1) * pageSize);
  const t = translations[language];
  colorPalette.innerHTML = pageColors.map((color) => {
    const lock = colorLocks.get(color.id);
    const lockedByOther = lock && lock.uid !== auth.currentUser?.uid;
    const classes = `color-choice${selectedColor === color.id ? " is-selected" : ""}${lockedByOther ? " is-locked" : ""}`;
    return `<button class="${classes}" type="button" data-color="${color.id}" style="background:${color.value}" aria-label="${color.id}" ${lockedByOther ? "disabled" : ""}></button>`;
  }).join("");
  colorPalette.querySelectorAll(".color-choice").forEach((button) => button.addEventListener("click", () => { selectedColor = button.dataset.color; renderPalette(); }));
  colorPagination.setAttribute("aria-label", t.choosePersonalColor);
  colorPagination.innerHTML = Array.from({ length: pageCount }, (_, page) => `<button class="color-page-dot${page === currentColorPage ? " is-active" : ""}" type="button" role="tab" aria-label="${t.choosePersonalColor} ${page + 1}" aria-selected="${page === currentColorPage}"></button>`).join("");
  colorPagination.querySelectorAll(".color-page-dot").forEach((button, page) => button.addEventListener("click", () => { currentColorPage = page; renderPalette(); }));
  previousColorPage.disabled = currentColorPage === 0;
  nextColorPage.disabled = currentColorPage === pageCount - 1;
}

function renderLanguage() {
  const t = translations[language];
  document.documentElement.lang = language;
  document.body.classList.toggle("is-thai", language === "th");
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t[element.dataset.i18n]; });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => { element.placeholder = t[element.dataset.i18nPlaceholder]; });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => { element.setAttribute("aria-label", t[element.dataset.i18nAriaLabel]); });
  signOutLabel.textContent = t.signOut;
  const cards = isAdminSession() ? [...t.cards, [t.setting[0], t.setting[1], t.setting[2]]] : t.cards;
  menuGrid.innerHTML = cards.map(([title, description, image]) => `<div class="col-12 col-sm-6 col-lg-4 col-xl-3"><a class="menu-card d-block text-decoration-none" href="${title === "Dashboard and Report" ? "./dashboard.html" : title === "Infirmary Visit" ? "./infirmary-visit.html" : title === "Borrow and Return" ? "./borrow-return.html" : title === "Duty Shift" ? "./duty-shift.html" : title === "System Activity Log" ? "./system-activity.html" : title === "Setting" || title === "Settings" || title === "ตั้งค่า" ? "./admin-settings.html" : "#"}"><img src="./assets/${image}" alt="${title}" /><div class="menu-card-body"><h3>${title}</h3><p>${description}</p></div></a></div>`).join("");
  renderCalendar();
  renderPalette();
  renderNotifications();
}

async function saveDutyRecord(event) {
  event.preventDefault();
  const t = translations[language];
  const user = auth.currentUser || (isAdminSession() ? { uid: "admin" } : null);
  if (!user) return;
  const firstName = document.getElementById("nurseFirstName").value.trim();
  const lastName = document.getElementById("nurseLastName").value.trim();
  if (!selectedColor) { dutyStatus.textContent = t.colorRequired; return; }
  const color = colors.find((item) => item.id === selectedColor);
  const nurseName = `${firstName} ${lastName}`.trim();
  const date = getDateKey(new Date());
  const lockRef = doc(db, "nurseColorLocks", color.id);
  const dutyRef = doc(db, "dutyRecords", `${date}_${user.uid}`);
  const dutyRecord = {
    uid: user.uid,
    nurseName,
    firstName,
    lastName,
    nickname: document.getElementById("nurseNickname").value.trim(),
    affiliation: document.getElementById("nurseAffiliation").value.trim(),
    colorId: color.id,
    colorValue: color.value,
    date,
    updatedAt: new Date().toISOString()
  };
  dutyStatus.textContent = "...";
  if (!USE_FIRESTORE) {
    const recordsForToday = dutyRecords.get(date) || [];
    const otherRecords = recordsForToday.filter((record) => record.uid !== user.uid);
    dutyRecords.set(date, [...otherRecords, dutyRecord]);
    saveLocalDutyRecords();
    renderCalendar();
    dutyStatus.textContent = t.saved;
    return;
  }
  try {
    await runTransaction(db, async (transaction) => {
      const lockSnapshot = await transaction.get(lockRef);
      const existingLock = lockSnapshot.data();
      if (existingLock && existingLock.uid !== user.uid) throw new Error("color-locked");
      transaction.set(lockRef, { uid: user.uid, nurseName, colorId: color.id, updatedAt: new Date().toISOString() });
      transaction.set(dutyRef, dutyRecord);
    });
    const recordsForToday = dutyRecords.get(date) || [];
    const otherRecords = recordsForToday.filter((record) => record.uid !== user.uid);
    dutyRecords.set(date, [...otherRecords, dutyRecord]);
    renderCalendar();
    dutyStatus.textContent = t.saved;
  } catch (error) {
    dutyStatus.textContent = error.message === "color-locked"
      ? t.colorLocked
      : error.code === "permission-denied"
        ? (language === "th" ? "Firestore Rules ยังไม่อนุญาต กรุณา Publish Rules ก่อน" : "Firestore Rules denied access. Publish the Firestore Rules first.")
        : t.saveError;
  }
}

languageInputs.forEach((input) => input.addEventListener("change", () => { language = input.value; renderLanguage(); }));
window.addEventListener("storage", (event) => {
  if (event.key !== LOCAL_DUTY_STORAGE_KEY) return;
  loadLocalDutyRecords();
  renderCalendar();
  if (!yearCalendarModal.hidden) renderYearCalendar();
});
languageSwitcher.addEventListener("click", (event) => { event.preventDefault(); const next = language === "th" ? "en" : "th"; document.querySelector(`input[name='language'][value='${next}']`).checked = true; language = next; renderLanguage(); });
dutyForm.addEventListener("submit", saveDutyRecord);
notificationButton.addEventListener("click", () => { notificationPanel.hidden = !notificationPanel.hidden; });
markNotificationsRead.addEventListener("click", () => { notificationsMarkedRead = true; renderNotifications(); });
document.addEventListener("click", (event) => { if (!notificationPanel.hidden && !notificationPanel.contains(event.target) && !notificationButton.contains(event.target)) notificationPanel.hidden = true; });
viewCalendarButton.addEventListener("click", openYearCalendar);
closeYearCalendar.addEventListener("click", hideYearCalendar);
yearCalendarModal.querySelector("[data-close-calendar]").addEventListener("click", hideYearCalendar);
yearCalendarTrigger.addEventListener("click", () => yearCalendarOptions.hidden ? openYearCalendarPicker() : closeYearCalendarPicker());
yearCalendarPrevious.addEventListener("click", () => changeYearCalendar(yearCalendarYear - 1));
yearCalendarNext.addEventListener("click", () => changeYearCalendar(yearCalendarYear + 1));
yearCalendarOptions.addEventListener("click", (event) => {
  const option = event.target.closest("[data-year]");
  if (option) changeYearCalendar(option.dataset.year);
});
yearCalendarOptions.addEventListener("keydown", (event) => {
  const options = Array.from(yearCalendarOptions.querySelectorAll("[role=option]"));
  const index = options.indexOf(document.activeElement);
  if (event.key === "Escape") { event.preventDefault(); closeYearCalendarPicker(); yearCalendarTrigger.focus(); }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length]?.focus(); }
});
document.addEventListener("click", (event) => { if (!event.target.closest("#yearCalendarPicker")) closeYearCalendarPicker(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !yearCalendarModal.hidden) hideYearCalendar(); });
previousColorPage.addEventListener("click", () => { if (currentColorPage > 0) { currentColorPage -= 1; renderPalette(); } });
nextColorPage.addEventListener("click", () => { if (currentColorPage < Math.ceil(colors.length / 20) - 1) { currentColorPage += 1; renderPalette(); } });
signOutButton.addEventListener("click", () => {
  localStorage.removeItem(ADMIN_SESSION_KEY);
  signOut(auth).finally(() => { window.location.href = "./index.html"; });
});

onAuthStateChanged(auth, (user) => {
  if (isAdminSession()) {
    loadLocalDutyRecords();
    renderPalette();
    renderCalendar();
    return;
  }
  if (!user) { window.location.href = "./index.html"; return; }
  if (!USE_FIRESTORE) {
    loadLocalDutyRecords();
    renderPalette();
    renderCalendar();
    return;
  }
  onSnapshot(collection(db, "nurseColorLocks"), (snapshot) => { colorLocks = new Map(snapshot.docs.map((item) => [item.id, item.data()])); renderPalette(); }, (error) => { if (error.code === "permission-denied") dutyStatus.textContent = language === "th" ? "Firestore Rules ยังไม่อนุญาต กรุณา Publish Rules ก่อน" : "Firestore Rules denied access. Publish the Firestore Rules first."; });
  onSnapshot(collection(db, "dutyRecords"), (snapshot) => { dutyRecords = new Map(); snapshot.docs.forEach((item) => { const record = item.data(); if (!dutyRecords.has(record.date)) dutyRecords.set(record.date, []); dutyRecords.get(record.date).push(record); }); renderCalendar(); }, (error) => { if (error.code === "permission-denied") dutyStatus.textContent = language === "th" ? "Firestore Rules ยังไม่อนุญาต กรุณา Publish Rules ก่อน" : "Firestore Rules denied access. Publish the Firestore Rules first."; });
});

loadLocalDutyRecords();
renderCalendar();
renderLanguage();
renderNotifications();
menuGrid.addEventListener("click", (event) => {
  const card = event.target.closest(".menu-card");
  if (card && card.querySelector("h3")?.textContent === "Stock") {
    event.preventDefault();
    window.location.href = "./stock.html";
  }
});
document.addEventListener("click",event=>{const card=event.target.closest(".menu-card");if(card&&card.querySelector("h3")?.textContent==="Catalog"){event.preventDefault();window.location.href="./catalog.html"}});
