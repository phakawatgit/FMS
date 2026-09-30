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

const auth = getAuth(initializeApp(firebaseConfig));
const cardsTarget = document.getElementById("activityCards");
let language = "th";

const languageButton = document.getElementById("languageButton");
if (languageButton) {
  Object.assign(languageButton.style, {
    background: "#fff",
    color: "#214967",
    border: "0",
    borderRadius: "8px",
    width: "88px",
    minWidth: "88px",
    height: "34px",
    padding: "0 10px",
    boxShadow: "none"
  });
}

const activities = [
  { title: "History · Infirmary Visit", description: { th: "ประวัติการเข้าห้องพยาบาล", en: "Infirmary visit history" }, image: "6.png", href: "./infirmary-visit-history.html", tone: "orange", storageKeys: ["fms-infirmary-visits"], filter: (record) => ["normal", "refer"].includes(record.status) },
  { title: "History · Stock", description: { th: "ประวัติคลังยาและเวชภัณฑ์", en: "Medicine inventory history" }, image: "7.png", href: "./history-stock.html", tone: "orange", storageKeys: ["fms-stock-records", "fms-infirmary-visits"], filter: (record, key) => key !== "fms-infirmary-visits" || Boolean(record.medicine && !["เลือกยา", "select medicine"].includes(String(record.medicine).toLocaleLowerCase())) },
  { title: "History · Catalog", description: { th: "ประวัติการสั่งซื้อสินค้า", en: "Catalog order history" }, image: "8.png", href: "./history-catalog.html", tone: "orange", storageKeys: ["fms-history-catalog-orders"] },
  { title: "History · Borrow and Return", description: { th: "ประวัติการยืม–คืน", en: "Borrow and return history" }, image: "9.png", href: "./borrow-return-history.html", tone: "orange", storageKeys: ["fms-borrow-return-records", "fms-history-borrow-return"] },
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function readRecords(key) {
  try {
    const records = JSON.parse(window.FMSData.getItem(key) || "[]");
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function getActivitySummary(activity) {
  const records = activity.storageKeys.flatMap((key) => readRecords(key)
    .filter((record) => !activity.filter || activity.filter(record, key))
    .map((record) => ({ record, key })));
  const latest = records
    .map(({ record }) => record.createdAt || record.updatedAt || record.date || record.borrowDate || record.orderDate || record.completedAt)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b - a)[0];
  return { count: records.length, latest };
}

function formatActivityDescription(activity) {
  const summary = getActivitySummary(activity);
  const countText = language === "th" ? `${summary.count} รายการ` : `${summary.count} ${summary.count === 1 ? "record" : "records"}`;
  const latestText = summary.latest
    ? new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", { dateStyle: "medium" }).format(summary.latest)
    : (language === "th" ? "ยังไม่มีข้อมูล" : "No records yet");
  return `${activity.description[language]} · ${countText} · ${latestText}`;
}

function renderCards() {
  cardsTarget.innerHTML = activities.map((activity) => `<a class="activity-card is-${activity.tone}" href="${activity.href}"><span class="activity-visual"><img src="./assets/${activity.image}" alt="" loading="lazy"></span><span class="activity-caption"><strong>${activity.title}</strong><span>${escapeHtml(formatActivityDescription(activity))}</span></span></a>`).join("");
}

function exportCategories() {
  const rows = [["System", "Description", "Page"], ...activities.map((item) => [item.title, item.description[language].replace(/[()]/g, ""), new URL(item.href, location.href).href])];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "FMS-system-activity-categories.csv";
  link.click();
  URL.revokeObjectURL(url);
}

renderCards();
document.getElementById("exportExcel").addEventListener("click", exportCategories);
document.getElementById("exportPdf").addEventListener("click", () => window.print());
document.getElementById("languageButton").addEventListener("click", () => {
  language = language === "th" ? "en" : "th";
  document.documentElement.lang = language;
  document.getElementById("languageLabel").textContent = language === "th" ? "English" : "ไทย";
  document.getElementById("pageTitle").textContent = language === "th" ? "ประวัติ" : "History";
  document.getElementById("activityKicker").textContent = language === "th" ? "พนักงาน" : "STAFF";
  document.getElementById("activityDescription").textContent = language === "th" ? "จัดการข้อมูลผู้ป่วยและเจ้าหน้าที่ที่เกี่ยวข้อง" : "Manage patient and staff information";
  renderCards();
});

const notificationPanel = document.getElementById("notificationPanel");
const notificationButton = document.getElementById("notificationButton");
notificationButton.addEventListener("click", () => { notificationPanel.hidden = !notificationPanel.hidden; });
document.getElementById("closeNotification").addEventListener("click", () => { notificationPanel.hidden = true; });
document.addEventListener("click", (event) => {
  if (!notificationPanel.hidden && !notificationPanel.contains(event.target) && !notificationButton.contains(event.target)) notificationPanel.hidden = true;
});

onAuthStateChanged(auth, (user) => { if (!user) window.location.href = "./index.html"; });

window.addEventListener("storage", renderCards);
window.addEventListener("focus", renderCards);
