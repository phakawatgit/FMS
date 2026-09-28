const STOCK_KEY = "fms-stock-records";
const DISPENSE_KEY = "fms-infirmary-visits";

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn(`History data (${key}) could not be read.`, error);
    return [];
  }
}

function parseExpiry(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  const thaiDate = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (thaiDate) {
    const year = Number(thaiDate[3]) > 2400 ? Number(thaiDate[3]) - 543 : Number(thaiDate[3]);
    const date = new Date(year, Number(thaiDate[2]) - 1, Number(thaiDate[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getStockImage(stock) {
  const value = stock.image || stock.imageUrl || stock.imageDataUrl || stock.imageData || stock.imageBase64 || stock.productImage || stock.photoUrl || stock.photo || stock.pictureUrl || stock.picture || stock.img;
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return value.dataUrl || value.url || value.src || value.data || "";
  return "";
}

function getCurrentStockHistory() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return readArray(STOCK_KEY).flatMap((stock) => {
    const total = Math.max(0, Number(stock.total) || 0);
    const used = Math.max(0, Number(stock.used) || 0);
    const remaining = Math.max(0, total - used);
    const expiry = parseExpiry(stock.expiry);
    const daysToExpiry = expiry ? Math.ceil((expiry.getTime() - today.getTime()) / 86400000) : null;
    const threshold = Math.max(0, Number(stock.threshold ?? stock.lowStockThreshold) || 10);
    const base = {
      name: stock.name || stock.productName || "รายการยา",
      thai: stock.genericName || "",
      code: stock.code || "—",
      image: getStockImage(stock),
      total,
      used,
      remaining,
      unit: stock.unit || "หน่วย",
      category: stock.category || "ไม่ระบุ",
      expiry: stock.expiry || "",
      threshold,
      description: stock.benefit || stock.symptom || "ข้อมูลจากคลังยาปัจจุบัน"
    };
    const groups = [];
    if (daysToExpiry !== null && daysToExpiry < 0) groups.push({ group: "ยาหมดอายุ", date: stock.expiry });
    else if (daysToExpiry !== null && daysToExpiry <= 30) groups.push({ group: "ยาใกล้หมดอายุอีก 1 เดือน", date: stock.expiry });
    if (remaining === 0) groups.push({ group: "ยาหมดสต็อก", date: "" });
    else if (remaining <= threshold) groups.push({ group: "ยาที่ใกล้หมดสต็อก", date: "" });
    return groups.map((entry) => ({ ...base, ...entry }));
  });
}

let records = [];
let historyEnglish = false;
const historyCopy = {
  menu: ["คลังสินค้า", "Inventory"],
  dispense: ["ประวัติการจ่ายยา", "Dispensing History"],
  status: ["สถานะยา", "Medicine Status"],
  details: ["ประวัติการจ่ายยา", "Dispensing History"],
  noResults: ["ไม่พบข้อมูลที่ตรงกับคำค้น", "No matching records found"],
  empty: ["ยังไม่มีรายการยาหมดสต็อก ใกล้หมดสต็อก หรือใกล้หมดอายุในคลังปัจจุบัน", "No out-of-stock, low-stock, or expiring medicines"],
  code: ["รหัสยา", "Code"],
  remaining: ["คงเหลือ", "Remaining"],
  detail: ["ดูรายละเอียด", "View details"]
  ,noDispense: ["ยังไม่มีประวัติการจ่ายยา", "No dispensing history yet"]
};
const historyText = (key) => historyCopy[key]?.[historyEnglish ? 1 : 0] || key;
const list = document.getElementById("historyList");
const search = document.getElementById("searchInput");
const dispenseHistory = document.getElementById("dispenseHistory");
const dispenseList = document.getElementById("dispenseList");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const normalizeSearch = (value) => String(value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");

function dateSearchText(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return [date.toLocaleString("th-TH"), date.toLocaleDateString("th-TH"), `${day}/${month}/${date.getFullYear() + 543}`, `${day}/${month}/${date.getFullYear()}`, date.toISOString()].join(" ");
}

function renderStockHistory() {
  records = getCurrentStockHistory();
  const query = normalizeSearch(search.value);
  const matches = records.filter((item) => normalizeSearch(`${item.name} ${item.thai} ${item.code} ${item.group} ${item.date}`).includes(query));
  const groups = [...new Set(records.map((item) => item.group))];
  list.innerHTML = groups.map((group) => {
    const items = matches.filter((item) => item.group === group);
    if (!items.length) return "";
    const headingClass = group === "ยาหมดอายุ" ? "is-expired" : group === "ยาหมดสต็อก" ? "is-out" : group === "ยาที่ใกล้หมดสต็อก" ? "is-low" : group === "ยาใกล้หมดอายุอีก 1 เดือน" ? "is-near-expiry" : "";
    const groupLabels = { "ยาหมดอายุ": historyEnglish ? "Expired medicines" : group, "ยาใกล้หมดอายุอีก 1 เดือน": historyEnglish ? "Expiring within 1 month" : group, "ยาหมดสต็อก": historyEnglish ? "Out of stock" : group, "ยาที่ใกล้หมดสต็อก": historyEnglish ? "Low stock" : group };
    const heading = group === "ยาหมดอายุ" && items[0].date ? `${groupLabels[group]} <small>(${escapeHtml(items[0].date)})</small>` : groupLabels[group] || group;
    return `<section class="history-section"><h2 class="${headingClass}">${heading}</h2>${items.map((item) => `<article class="stock-record"><div class="product-image">${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy">` : '<span class="product-image-placeholder" aria-label="ยังไม่มีรูปยา">💊</span>'}</div><div class="stock-record-copy"><h3>${escapeHtml(item.name)}${item.thai ? ` (${escapeHtml(item.thai)})` : ""}</h3><p>${historyText("code")}: ${escapeHtml(item.code)} · ${historyText("remaining")} ${escapeHtml(item.remaining)} ${escapeHtml(item.unit)}</p></div><button class="stock-detail-open" type="button" data-history-index="${records.indexOf(item)}">${historyText("detail")} <span aria-hidden="true">›</span></button></article>`).join("")}</section>`;
  }).join("") || (query ? `<p class="empty-state">${historyText("noResults")}</p>` : `<p class="empty-state">${historyText("empty")}</p>`);
}

const detailModal = document.getElementById("stockDetailModal");
const detailContent = document.getElementById("stockDetailContent");
let lastDetailTrigger = null;

function statusDetails(record) {
  return {
    total: record.total ?? 0,
    used: record.used ?? 0,
    remaining: record.remaining ?? 0,
    unit: record.unit || "เม็ด",
    category: record.category || "ยาสามัญประจำบ้าน",
    expiry: record.expiry || record.date || "ไม่ระบุ",
    threshold: record.threshold ?? 10,
    description: record.description || "ข้อมูลสถานะจากคลังยาปัจจุบัน"
  };
}

function openStockDetail(record, trigger) {
  if (!record) return;
  const detail = statusDetails(record);
  const isExpired = record.group === "ยาหมดอายุ";
  const statusText = isExpired ? "หมดอายุแล้ว" : record.group === "ยาใกล้หมดอายุอีก 1 เดือน" ? "ใกล้หมดอายุ" : record.group === "ยาหมดสต็อก" ? "หมดสต็อก" : record.group === "ยาที่ใกล้หมดสต็อก" ? "ใกล้หมดสต็อก" : "ปกติ";
  const statusLabel = isExpired ? (historyEnglish ? "Expired" : "หมดอายุแล้ว") : record.group === "ยาหมดสต็อก" ? (historyEnglish ? "Out of stock" : "หมดสต็อก") : record.group === "ยาที่ใกล้หมดสต็อก" ? (historyEnglish ? "Low stock" : "ใกล้หมดสต็อก") : (historyEnglish ? "Expiring soon" : "ใกล้หมดอายุ");
  detailContent.innerHTML = `<div class="detail-header"><span class="detail-eyebrow">${historyEnglish ? "Medicine status details" : "รายละเอียดสถานะยา"}</span><h2 id="stockDetailTitle">${escapeHtml(record.name)} <span>(${escapeHtml(record.thai)})</span></h2><span class="detail-status-badge ${isExpired || record.group === "ยาหมดสต็อก" ? "is-alert" : ""}">${statusLabel}</span></div><div class="detail-body"><p class="detail-description">${escapeHtml(detail.description)}</p><dl class="detail-grid"><div><dt>${historyText("code")}</dt><dd>${escapeHtml(record.code)}</dd></div><div><dt>${historyEnglish ? "Category" : "ประเภท"}</dt><dd>${escapeHtml(detail.category)}</dd></div><div><dt>${historyEnglish ? "Total" : "จำนวนทั้งหมด"}</dt><dd>${escapeHtml(detail.total)} ${escapeHtml(detail.unit)}</dd></div><div><dt>${historyEnglish ? "Used/Issued" : "ใช้/เบิกแล้ว"}</dt><dd>${escapeHtml(detail.used)} ${escapeHtml(detail.unit)}</dd></div><div><dt>${historyText("remaining")}</dt><dd>${escapeHtml(detail.remaining)} ${escapeHtml(detail.unit)}</dd></div><div><dt>${historyEnglish ? "Low-stock alert threshold" : "จุดแจ้งเตือนสต็อกต่ำ"}</dt><dd>${escapeHtml(detail.threshold)} ${escapeHtml(detail.unit)}</dd></div><div><dt>${historyEnglish ? "Expiry date" : "วันหมดอายุ"}</dt><dd>${escapeHtml(detail.expiry || (historyEnglish ? "Not specified" : "ไม่ระบุ"))}</dd></div></dl><p class="detail-note"><strong>${historyEnglish ? "Status group" : "กลุ่มสถานะ"}:</strong> ${escapeHtml(record.group)}</p></div><div class="detail-actions"><button type="button" data-close-detail>${historyEnglish ? "Close details" : "ปิดรายละเอียด"}</button></div>`;
  detailModal.hidden = false;
  lastDetailTrigger = trigger;
  detailModal.querySelector(".detail-close").focus();
}

function closeStockDetail() {
  detailModal.hidden = true;
  lastDetailTrigger?.focus();
}

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-index]");
  if (!button) return;
  openStockDetail(records[Number(button.dataset.historyIndex)], button);
});
detailModal.addEventListener("click", (event) => {
  if (event.target.closest("[data-close-detail]")) closeStockDetail();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !detailModal.hidden) closeStockDetail();
});

function getDispenseRecords() {
  const stockItems = readArray(STOCK_KEY);
  const records = readArray(DISPENSE_KEY).filter((record) => {
      const medicine = String(record.medicine || record.medicineName || "").trim();
      return medicine && !["เลือกยา", "select medicine"].includes(medicine.toLocaleLowerCase());
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return records.map((record) => {
    const code = String(record.medicineCode || record.productCode || record.medicineId || record.code || "").trim().toLocaleLowerCase();
    const cleanMedicineName = (value) => normalizeSearch(value)
      .replace(/\([^)]*\)/g, " ")
      .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|เม็ด|แคปซูล)\b/gi, " ")
      .replace(/\s+/g, " ").trim();
    const name = cleanMedicineName(record.medicine || record.medicineName || record.drugName);
    const medicine = stockItems.find((item) => code && [item.code, item.productCode, item.id].some((value) => String(value || "").trim().toLocaleLowerCase() === code))
      || stockItems.find((item) => {
        const stockNames = [item.name, item.productName, item.genericName, item.medicineName, item.displayName, item.code, item.productCode].map(cleanMedicineName).filter(Boolean);
        return stockNames.some((stockName) => stockName === name || (Math.min(stockName.length, name.length) >= 5 && (stockName.startsWith(name) || name.startsWith(stockName) || stockName.includes(name) || name.includes(stockName))));
      });
    return { ...record, medicineImage: record.medicineImage || record.image || medicine?.image || medicine?.imageUrl || medicine?.imageData || medicine?.imageBase64 || medicine?.photo || medicine?.photoUrl || "" };
  });
}

function renderDispenseHistory() {
  const query = normalizeSearch(search.value);
  const records = getDispenseRecords().filter((record) => {
    const recipient = [record.firstName, record.lastName].filter(Boolean).join(" ");
    return normalizeSearch(`${record.medicine || record.medicineName} ${recipient} ${record.quantity} ${dateSearchText(record.createdAt)}`).includes(query);
  });
  dispenseList.innerHTML = records.length ? records.map((record, index) => {
    const recipient = [record.firstName, record.lastName].filter(Boolean).join(" ") || "ไม่ระบุชื่อผู้รับบริการ";
    const quantity = record.quantity ? `${escapeHtml(record.quantity)} หน่วย` : "ไม่ระบุจำนวน";
    const date = record.createdAt ? new Date(record.createdAt).toLocaleString("th-TH") : "ไม่ระบุวันที่";
    const medicineName = record.medicine || record.medicineName || "รายการยา";
    const medicineVisual = record.medicineImage
      ? `<img src="${escapeHtml(record.medicineImage)}" alt="${escapeHtml(medicineName)}">`
      : '<span aria-hidden="true">💊</span>';
    return `<article class="dispense-record"><div class="dispense-icon ${record.medicineImage ? "has-image" : "is-placeholder"}">${medicineVisual}</div><div class="dispense-details"><h3>${escapeHtml(medicineName)}</h3><p><strong>${historyEnglish ? "Recipient:" : "ผู้รับบริการ:"}</strong> ${escapeHtml(recipient)}</p><p><strong>${historyEnglish ? "Quantity:" : "จำนวน:"}</strong> ${quantity}</p></div><time>${escapeHtml(date)}</time><button class="dispense-detail-open" type="button" data-dispense-index="${index}">${historyText("detail")} <span aria-hidden="true">›</span></button></article>`;
  }).join("") : `<p class="empty-state">${historyText("noDispense")}</p>`;
}

function openDispenseDetail(record, trigger) {
  if (!record) return;
  const recipient = [record.firstName, record.lastName].filter(Boolean).join(" ") || "ไม่ระบุชื่อผู้รับบริการ";
  const date = record.createdAt ? new Date(record.createdAt).toLocaleString("th-TH") : "ไม่ระบุวันที่";
  const detailRows = [
    ["ชื่อผู้รับบริการ", recipient],
    ["ประเภทผู้รับบริการ", record.visitorDetail || record.visitorType || "ไม่ระบุ"],
    ["รหัสนักศึกษา", record.studentId || "ไม่ระบุ"],
    ["สาขา", record.branch || "ไม่ระบุ"],
    ["จำนวนที่จ่าย", record.quantity ? `${record.quantity} หน่วย` : "ไม่ระบุจำนวน"],
    ["วันที่และเวลา", date]
  ];
  const translatedRows = historyEnglish ? [["Recipient", recipient], ["Recipient type", record.visitorDetail || record.visitorType || "Not specified"], ["Student ID", record.studentId || "Not specified"], ["Department", record.branch || "Not specified"], ["Quantity dispensed", record.quantity ? `${record.quantity} units` : "Not specified"], ["Date and time", date]] : detailRows;
  detailContent.innerHTML = `<div class="detail-header"><span class="detail-eyebrow">${historyEnglish ? "Dispensing details" : "รายละเอียดการจ่ายยา"}</span><h2 id="stockDetailTitle">${escapeHtml(record.medicine || record.medicineName || "รายการยา")}</h2><span class="detail-status-badge">${historyEnglish ? "Dispensed" : "จ่ายยาแล้ว"}</span></div><div class="detail-body"><p class="detail-description">${historyEnglish ? "Data from the latest service history" : "ข้อมูลจากประวัติผู้รับบริการล่าสุด"}</p><dl class="detail-grid">${translatedRows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl><p class="detail-note"><strong>${historyEnglish ? "Symptoms:" : "อาการ:"}</strong> ${escapeHtml(record.symptom || (historyEnglish ? "Not specified" : "ไม่ได้ระบุอาการ"))}</p></div><div class="detail-actions"><button type="button" data-close-detail>${historyEnglish ? "Close details" : "ปิดรายละเอียด"}</button></div>`;
  detailModal.hidden = false;
  lastDetailTrigger = trigger;
  detailModal.querySelector(".detail-close").focus();
}

dispenseList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-dispense-index]");
  if (!button) return;
  const query = normalizeSearch(search.value);
  const visibleRecords = getDispenseRecords().filter((record) => {
    const recipient = [record.firstName, record.lastName].filter(Boolean).join(" ");
    return normalizeSearch(`${record.medicine || record.medicineName} ${recipient} ${record.quantity} ${dateSearchText(record.createdAt)}`).includes(query);
  });
  openDispenseDetail(visibleRecords[Number(button.dataset.dispenseIndex)], button);
});

function render() {
  const view = new URLSearchParams(location.search).get("view") || location.hash.slice(1) || "dispense-history";
  const showingDispenses = view === "dispense-history";
  const selectedOption = document.getElementById("selectedOption");
  selectedOption.hidden = showingDispenses;
  document.getElementById("selectedOptionLabel").textContent = showingDispenses ? "ประวัติการจ่ายยา" : "สถานะยา";
  dispenseHistory.hidden = !showingDispenses;
  document.getElementById("stockHistory").hidden = showingDispenses;
  if (showingDispenses) renderDispenseHistory();
  else renderStockHistory();
}

document.getElementById("stockMenuButton").addEventListener("click", (event) => {
  const menu = document.getElementById("stockMenu");
  menu.hidden = !menu.hidden;
  event.currentTarget.setAttribute("aria-expanded", String(!menu.hidden));
});
document.getElementById("stockMenu").addEventListener("click", (event) => {
  if (!event.target.closest("a")) return;
  const menu = document.getElementById("stockMenu");
  menu.hidden = true;
  document.getElementById("stockMenuButton").setAttribute("aria-expanded", "false");
});
document.getElementById("selectedOption").addEventListener("click", () => {
  const showingDispenses = (new URLSearchParams(location.search).get("view") || location.hash.slice(1) || "dispense-history") === "dispense-history";
  if (showingDispenses) {
    location.href = "./history-stock.html?view=stock-status";
    return;
  }
  location.href = "./history-stock.html?view=dispense-history";
});
document.addEventListener("click", (event) => {
  const menu = document.getElementById("stockMenu");
  const button = document.getElementById("stockMenuButton");
  if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }
});
search.addEventListener("input", () => {
  document.getElementById("clearSearch").hidden = !search.value;
  render();
});
document.getElementById("historySearchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  render();
});
document.getElementById("clearSearch").addEventListener("click", () => {
  search.value = "";
  document.getElementById("clearSearch").hidden = true;
  search.focus();
  render();
});
window.addEventListener("hashchange", render);
window.addEventListener("storage", (event) => {
  if (!event.key || event.key === STOCK_KEY || event.key === DISPENSE_KEY) render();
});
window.addEventListener("focus", render);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") render();
});

function exportCsv() {
  const isDispenseHistory = (new URLSearchParams(location.search).get("view") || location.hash.slice(1) || "dispense-history") === "dispense-history";
  const dispenseRecords = isDispenseHistory ? getDispenseRecords() : [];
  const rows = isDispenseHistory
    ? [["ชื่อยา", "ผู้รับบริการ", "จำนวน", "วันที่"], ...dispenseRecords.map((item) => [item.medicine || item.medicineName || "", [item.firstName, item.lastName].filter(Boolean).join(" "), item.quantity || "", item.createdAt || ""])]
    : [["กลุ่ม", "ชื่อยา", "ชื่อภาษาไทย", "รหัสยา", "วันที่"], ...records.map((item) => [item.group, item.name, item.thai, item.code, item.date])];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = isDispenseHistory ? "dispense-history.csv" : "history-stock.csv";
  link.click();
  URL.revokeObjectURL(url);
}
document.getElementById("exportCsv").addEventListener("click", exportCsv);
document.getElementById("exportPdf").addEventListener("click", () => window.print());

const panel = document.getElementById("notificationPanel");
function applyHistoryLanguage(isEnglish) {
  historyEnglish = isEnglish;
  document.documentElement.lang = isEnglish ? "en" : "th";
  document.getElementById("activityKicker").textContent = isEnglish ? "System Activity" : "ประวัติกิจกรรม";
  document.getElementById("pageTitle").textContent = isEnglish ? "Tracking & History" : "คลังยาและเวชภัณฑ์";
  document.querySelector(".history-back span").textContent = isEnglish ? "Back to History Menu" : "กลับไปหน้า History Menu";
  document.querySelector(".menu-label").textContent = historyText("menu");
  document.querySelector(".stock-nav").setAttribute("aria-label", isEnglish ? "History menu" : "เมนูประวัติ");
  document.querySelectorAll("#stockMenu a")[0].textContent = historyText("dispense");
  document.querySelectorAll("#stockMenu a")[1].textContent = isEnglish ? "Borrowing & Return History" : "ประวัติการยืม-คืน";
  document.getElementById("selectedOptionLabel").textContent = new URLSearchParams(location.search).get("view") === "stock-status" ? historyText("status") : historyText("dispense");
  document.querySelector("#dispenseHistory h2").textContent = historyText("details");
  search.placeholder = isEnglish ? "name, date" : "ชื่อยา, วันที่";
  search.setAttribute("aria-label", isEnglish ? "Search medicine, code, recipient, or date" : "ค้นหาชื่อยา รหัสยา ผู้รับบริการ หรือวันที่");
  panel.querySelector("strong").textContent = isEnglish ? "Notifications" : "การแจ้งเตือน";
  panel.querySelector("p").textContent = isEnglish ? "Inventory history is ready to view" : "ประวัติคลังสินค้าพร้อมใช้งาน";
  document.getElementById("languageLabel").textContent = isEnglish ? "English" : "ไทย";
  render();
}
document.getElementById("notificationButton").addEventListener("click", () => { panel.hidden = !panel.hidden; });
document.getElementById("languageButton").addEventListener("click", (event) => {
  applyHistoryLanguage(!historyEnglish);
});

render();
applyHistoryLanguage(false);
