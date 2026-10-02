const STORAGE_KEY = "fms-infirmary-visits";
const list = document.getElementById("visitList");
const searchInput = document.getElementById("searchInput");
const resultCount = document.getElementById("resultCount");
const languageButton = document.getElementById("languageButton");
const notificationButton = document.getElementById("notificationButton");
const notificationPanel = document.getElementById("notificationPanel");
const detailDialog = document.getElementById("visitDetailDialog");
const detailFields = document.getElementById("visitDetailFields");
let activeRecordIndex = null;
let language = "th";

const copy = {
  th: { pageTitle: "ประวัติ · การเข้าใช้ห้องพยาบาล", backMenu: "กลับไปหน้า History Menu", listTitle: "การเข้าใช้ห้องพยาบาล", searchLabel: "ค้นหาชื่อหรือรหัสนักศึกษา", search: "ชื่อ, รหัสนักศึกษา หรือสาขา", count: (n) => `${n} รายการ`, name: "ชื่อ-นามสกุล", nickname: "ชื่อเล่น", visitorType: "ประเภทผู้เข้าใช้", visitorDetail: "รายละเอียดบุคลากร", studentId: "รหัสนักศึกษา", branch: "สาขา", age: "อายุ", gender: "เพศ", blood: "กรุ๊ปเลือด", weight: "น้ำหนัก", height: "ส่วนสูง", symptom: "อาการ", systolic: "ความดันตัวบน (SYS)", diastolic: "ความดันตัวล่าง (DIA)", pulse: "ชีพจร (PR)", medicine: "ยาที่ได้รับ", quantity: "จำนวนยา / หน่วย", status: "สถานะ", hospital: "โรงพยาบาลที่ส่งต่อ", visitedAt: "วันและเวลาที่เข้าใช้", detailEyebrow: "ข้อมูลการเข้าใช้ห้องพยาบาล", detailTitle: "รายละเอียดรายการ", viewDetail: "ดูรายละเอียด", close: "ปิด", internal: "บุคลากรภายใน", external: "บุคลากรภายนอก", normal: "ปกติ", observe: "รอดูอาการ", refer: "ส่งโรงพยาบาล", empty: "ยังไม่มีประวัติการเข้าใช้ห้องพยาบาล", noResults: "ไม่พบรายการที่ตรงกับคำค้น", notifications: "การแจ้งเตือน", notificationMessage: "มีรายการรอดำเนินการ 6 รายการ" },
  en: { pageTitle: "History · Infirmary Visit", backMenu: "Back to History menu", listTitle: "Infirmary visits", searchLabel: "Search by name or student ID", search: "Name, student ID, or department", count: (n) => `${n} records`, name: "Full name", nickname: "Nickname", visitorType: "Visitor type", visitorDetail: "Visitor details", studentId: "Student ID", branch: "Department", age: "Age", gender: "Gender", blood: "Blood type", weight: "Weight", height: "Height", symptom: "Symptoms", systolic: "Systolic pressure (SYS)", diastolic: "Diastolic pressure (DIA)", pulse: "Pulse (PR)", medicine: "Medicine given", quantity: "Quantity", status: "Status", hospital: "Referred hospital", visitedAt: "Visit date and time", detailEyebrow: "Infirmary visit record", detailTitle: "Visit details", viewDetail: "View details", close: "Close", internal: "Internal visitor", external: "External visitor", normal: "Normal", observe: "Observation", refer: "Hospital referral", empty: "There are no infirmary visit records yet.", noResults: "No records match your search.", notifications: "Notifications", notificationMessage: "6 items need attention" }
};

function escapeHtml(value) {
  return String(value ?? "-").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function getRecords() {
  try {
    const records = JSON.parse(FMSStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(records) ? records.filter((record) => ["normal", "refer"].includes(record.status)) : [];
  } catch {
    return [];
  }
}

function getVisitorKind(record) {
  if (record.visitorType === "guest" || record.visitorDetailExternal) return "external";
  return "internal";
}

function formatVisitDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatStaffName(record, kind) {
  if (kind === "responsible" && !record.responsibleFromDutyShift) return language === "th" ? "ไม่พบข้อมูลเข้าเวร" : "No duty record";
  const name = kind === "entered" ? record.enteredByName : record.responsibleName;
  const nickname = kind === "entered" ? record.enteredByNickname : record.responsibleNickname;
  return name ? `${name}${nickname ? ` (${nickname})` : ""}` : "-";
}

function populateDetails(record) {
  const t = copy[language];
  const visitorKind = getVisitorKind(record);
  const status = record.status ? (t[record.status] || record.status) : "-";
  const rows = [
    [t.name, [record.firstName, record.lastName].filter(Boolean).join(" ") || "-"],
    [t.nickname, record.nickname],
    [t.visitorType, t[visitorKind]],
    [t.visitorDetail, record.visitorDetailExternal || record.visitorDetail],
    [t.studentId, record.studentId],
    [t.branch, record.branch],
    [t.age, record.age],
    [t.gender, record.gender],
    [t.blood, record.blood],
    [t.weight, record.weight],
    [t.height, record.height],
    [t.symptom, record.symptom],
    [t.systolic, record.sys],
    [t.diastolic, record.dia],
    [t.pulse, record.pr],
    [t.medicine, record.medicine],
    [t.quantity, record.quantity],
    [t.status, status],
    [t.hospital, record.hospitalName],
    [t.visitedAt, formatVisitDate(record.createdAt)],
    [language === "th" ? "ผู้บันทึก" : "Entered by", formatStaffName(record, "entered")],
    [language === "th" ? "ผู้รับผิดชอบตามเวรในวันนั้น" : "Responsible nurse on duty", formatStaffName(record, "responsible")]
  ];
  document.getElementById("visitDetailTitle").textContent = t.detailTitle;
  detailFields.innerHTML = rows.map(([label, value]) => `<div class="visit-detail-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong></div>`).join("");
}

function showDetails(index) {
  const record = getRecords()[index];
  if (!record) return;
  activeRecordIndex = index;
  populateDetails(record);
  if (!detailDialog.open) detailDialog.showModal();
}

function render() {
  const t = copy[language];
  const query = searchInput.value.trim().toLocaleLowerCase(language === "th" ? "th-TH" : "en-US");
  const records = getRecords().map((record, index) => ({ record, index })).filter(({ record }) => {
    const searchable = [record.firstName, record.lastName, record.nickname, record.studentId, record.branch, record.visitorDetail, record.visitorDetailExternal]
      .filter(Boolean).join(" ").toLocaleLowerCase(language === "th" ? "th-TH" : "en-US");
    return searchable.includes(query);
  });

  resultCount.textContent = t.count(records.length);
  if (!records.length) {
    list.innerHTML = `<div class="empty-state">${getRecords().length ? t.noResults : t.empty}</div>`;
    return;
  }

  list.innerHTML = records.map(({ record, index }) => {
    const name = [record.firstName, record.lastName].filter(Boolean).join(" ") || "-";
    const visitorKind = getVisitorKind(record);
    const visitorLabel = t[visitorKind];
    const id = visitorKind === "external" ? (record.visitorDetailExternal || record.studentId || "-") : (record.studentId || "-");
    return `<article class="visit-card">
      <div class="visit-details">
        <p><strong>${t.name}:</strong> ${escapeHtml(name)}</p>
        <p><strong>${t.studentId}:</strong> ${escapeHtml(id)}</p>
        <p><strong>${t.branch}:</strong> ${escapeHtml(record.branch || "-")}</p>
        <p><strong>${language === "th" ? "ผู้บันทึก" : "Entered by"}:</strong> ${escapeHtml(formatStaffName(record, "entered"))}</p>
        <p><strong>${language === "th" ? "ผู้รับผิดชอบตามเวร" : "Responsible nurse on duty"}:</strong> ${escapeHtml(formatStaffName(record, "responsible"))}</p>
        ${record.nickname ? `<p><strong>${language === "th" ? "ชื่อเล่น" : "Nickname"}:</strong> ${escapeHtml(record.nickname)}</p>` : ""}
      </div>
      <div class="visit-side">
        <button class="visit-view-btn" type="button" data-record-index="${index}" aria-label="${t.viewDetail}" title="${t.viewDetail}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
        <span class="visit-type${visitorKind === "external" ? " is-external" : ""}">${visitorLabel}</span>
      </div>
    </article>`;
  }).join("");
}

function renderLanguage() {
  const t = copy[language];
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (t[key]) element.textContent = t[key];
  });
  searchInput.placeholder = t.search;
  languageButton.querySelector("span").textContent = language === "th" ? "ไทย" : "English";
  notificationButton.setAttribute("aria-label", t.notifications);
  document.getElementById("closeNotification").setAttribute("aria-label", t.close);
  document.getElementById("closeVisitDetail").setAttribute("aria-label", t.close);
  render();
  if (activeRecordIndex !== null && detailDialog.open) populateDetails(getRecords()[activeRecordIndex] || {});
}

function exportCsv() {
  const records = getRecords();
  const fields = ["firstName", "lastName", "nickname", "studentId", "branch", "visitorType", "visitorDetail", "visitorDetailExternal", "symptom", "createdAt"];
  const rows = [["First name", "Last name", "Nickname", "Student ID", "Department", "Visitor type", "Visitor detail", "External visitor detail", "Symptoms", "Visited at"], ...records.map((record) => fields.map((field) => record[field] || ""))];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "FMS-infirmary-visit-history.csv";
  link.click();
  URL.revokeObjectURL(url);
}

searchInput.addEventListener("input", render);
list.addEventListener("click", (event) => {
  const button = event.target.closest(".visit-view-btn");
  if (button) showDetails(Number(button.dataset.recordIndex));
});
document.getElementById("closeVisitDetail").addEventListener("click", () => detailDialog.close());
detailDialog.addEventListener("close", () => { activeRecordIndex = null; });
detailDialog.addEventListener("click", (event) => { if (event.target === detailDialog) detailDialog.close(); });
languageButton.addEventListener("click", () => { language = language === "th" ? "en" : "th"; renderLanguage(); });
document.getElementById("exportExcel").addEventListener("click", exportCsv);
document.getElementById("exportPdf").addEventListener("click", () => window.print());
notificationButton.addEventListener("click", () => {
  notificationPanel.hidden = !notificationPanel.hidden;
  notificationButton.setAttribute("aria-expanded", String(!notificationPanel.hidden));
});
document.getElementById("closeNotification").addEventListener("click", () => {
  notificationPanel.hidden = true;
  notificationButton.setAttribute("aria-expanded", "false");
});
document.addEventListener("click", (event) => {
  if (!notificationPanel.hidden && !notificationPanel.contains(event.target) && !notificationButton.contains(event.target)) {
    notificationPanel.hidden = true;
    notificationButton.setAttribute("aria-expanded", "false");
  }
});
window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY) render(); });

renderLanguage();
