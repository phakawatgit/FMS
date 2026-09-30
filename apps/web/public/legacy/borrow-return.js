const STORAGE_KEY = "fms-borrow-return-records";
const defaultRecords = [];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const storedRecords = JSON.parse(window.FMSData.getItem(STORAGE_KEY) || "null");
const records = Array.isArray(storedRecords) ? storedRecords : [];
const page = document.getElementById("borrowPage");
const detailView = document.getElementById("returnDetailView");
const extendBorrowModal = document.getElementById("extendBorrowModal");
const extendDueDate = document.getElementById("extendDueDate");
const calendarGrid = document.getElementById("calendarGrid");
const monthButton = document.getElementById("calendarMonthButton");
const monthLabel = document.getElementById("calendarMonthLabel");
const monthOptions = document.getElementById("calendarMonthOptions");
const yearButton = document.getElementById("calendarYearButton");
const yearLabel = document.getElementById("calendarYearLabel");
const yearOptions = document.getElementById("calendarYearOptions");
const borrowList = document.getElementById("borrowList");
const searchInput = document.getElementById("borrowSearch");
const recordsTitle = document.getElementById("recordsTitle");
const borrowTab = document.getElementById("borrowTab");
const returnTab = document.getElementById("returnTab");
const returnHome = document.getElementById("returnHome");
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthNamesThai = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
let selectedMonth = 8;
let selectedYear = new Date().getFullYear();
let borrowReturnEnglish = false;
const borrowReturnCopy = {
  borrow: ["การยืมยา และเวชภัณฑ์", "Medicine & Medical Supplies Borrowing"],
  return: ["การคืนยา และเวชภัณฑ์", "Medicine & Medical Supplies Return"],
  calendar: ["ปฏิทินการคืน-ยืม", "Borrowing & Return Calendar"],
  records: ["ต่อเวลา และไม่คืน", "Extended & Overdue Items"],
  returnRecords: ["รายการคืนยา และเวชภัณฑ์", "Returned Medicine & Medical Supplies"],
  noResults: ["ไม่พบรายการที่ค้นหา", "No matching records found"],
  due: ["กำหนดคืน", "Due"],
  extension: ["ต่อเวลา", "Extended"],
  overdue: ["เกินกำหนดคืน", "Overdue"],
  returned: ["คืนแล้ว", "Returned"],
  borrowed: ["กำลังยืม", "Borrowed"]
};
const borrowReturnText = (key) => borrowReturnCopy[key]?.[borrowReturnEnglish ? 1 : 0] || key;

function updateBorrowReturnLanguage() {
  const heading = page.querySelector(".page-heading h1");
  heading.innerHTML = borrowReturnEnglish
    ? `Medicine &amp; Medical Supplies<br><span>${page.classList.contains("is-return-view") ? "Return" : "Borrowing &amp; Return"}</span>`
    : page.classList.contains("is-return-view")
      ? "ยาและเวชภัณฑ์<br><span>การคืนยา และเวชภัณฑ์</span>"
      : "ยาและเวชภัณฑ์<br><span>การยืมและคืน</span>";
  borrowTab.textContent = borrowReturnText("borrow");
  returnTab.textContent = borrowReturnText("return");
  returnHome.querySelector("span").textContent = borrowReturnEnglish ? "Back to home" : "กลับหน้าหลัก";
  page.querySelector(".calendar-panel h2").textContent = borrowReturnText("calendar");
  recordsTitle.textContent = page.classList.contains("is-return-view") ? borrowReturnText("returnRecords") : borrowReturnText("records");
  searchInput.setAttribute("aria-label", borrowReturnEnglish ? "Search borrowing and return records" : "ค้นหารายการยืม-คืน");
  monthButton.setAttribute("aria-label", borrowReturnEnglish ? "Select month" : "เลือกเดือน");
  yearButton.setAttribute("aria-label", borrowReturnEnglish ? "Select year" : "เลือกปี");
  page.querySelector(".calendar-grid")?.setAttribute("aria-label", borrowReturnEnglish ? "Borrowing and return calendar" : "ปฏิทินการยืมและคืน");
  const legend = page.querySelectorAll(".calendar-legend > span");
  [borrowReturnEnglish ? "Borrowed" : "ยืม", borrowReturnEnglish ? "Extended" : "ต่อเวลา", borrowReturnEnglish ? "Overdue" : "ไม่คืน", borrowReturnEnglish ? "Returned" : "คืนแล้ว"].forEach((text, index) => { if (legend[index]) legend[index].lastChild.textContent = text; });
  page.querySelector(".calendar-week").innerHTML = (borrowReturnEnglish ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."]).map((day) => `<span>${day}</span>`).join("");
  renderMonthOptions();
  renderCalendar();
  renderList();
}

function closeMonthMenu(returnFocus = false) {
  monthOptions.hidden = true;
  monthButton.setAttribute("aria-expanded", "false");
  if (returnFocus) monthButton.focus();
}

function closeYearMenu(returnFocus = false) {
  yearOptions.hidden = true;
  yearButton.setAttribute("aria-expanded", "false");
  if (returnFocus) yearButton.focus();
}

function renderMonthOptions() {
  const months = borrowReturnEnglish ? monthNames : monthNamesThai;
  monthLabel.textContent = months[selectedMonth];
  monthOptions.innerHTML = months.map((month, index) => `<button class="month-option${index === selectedMonth ? " is-selected" : ""}" id="month-option-${index}" type="button" role="option" aria-selected="${index === selectedMonth}" tabindex="-1" data-month="${index}">${month}</button>`).join("");
}

function renderYearOptions() {
  yearLabel.textContent = String(selectedYear);
  const years = Array.from({ length: 21 }, (_, index) => selectedYear - 10 + index);
  yearOptions.innerHTML = years.map((year) => `<button class="month-option${year === selectedYear ? " is-selected" : ""}" type="button" role="option" aria-selected="${year === selectedYear}" tabindex="-1" data-year="${year}">${year}</button>`).join("");
}

function openMonthMenu() {
  closeYearMenu();
  monthOptions.hidden = false;
  monthButton.setAttribute("aria-expanded", "true");
  monthOptions.querySelector(`[data-month="${selectedMonth}"]`)?.focus();
}

function openYearMenu() {
  closeMonthMenu();
  yearOptions.hidden = false;
  yearButton.setAttribute("aria-expanded", "true");
  yearOptions.querySelector(`[data-year="${selectedYear}"]`)?.focus();
}

renderMonthOptions();
renderYearOptions();
monthButton.addEventListener("click", () => monthOptions.hidden ? openMonthMenu() : closeMonthMenu());
monthButton.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    openMonthMenu();
  }
});
monthOptions.addEventListener("click", (event) => {
  const option = event.target.closest("[data-month]");
  if (!option) return;
  selectedMonth = Number(option.dataset.month);
  renderMonthOptions();
  renderCalendar();
  closeMonthMenu(true);
});
monthOptions.addEventListener("keydown", (event) => {
  const options = [...monthOptions.querySelectorAll("[data-month]")];
  const current = options.indexOf(document.activeElement);
  let next = current;
  if (event.key === "ArrowDown") next = (current + 1) % options.length;
  else if (event.key === "ArrowUp") next = (current - 1 + options.length) % options.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = options.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    closeMonthMenu(true);
    return;
  } else return;
  event.preventDefault();
  options[next]?.focus();
});
yearButton.addEventListener("click", () => yearOptions.hidden ? openYearMenu() : closeYearMenu());
yearButton.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); openYearMenu(); }
});
yearOptions.addEventListener("click", (event) => {
  const option = event.target.closest("[data-year]");
  if (!option) return;
  selectedYear = Number(option.dataset.year);
  renderYearOptions();
  renderCalendar();
  closeYearMenu(true);
});
yearOptions.addEventListener("keydown", (event) => {
  const options = [...yearOptions.querySelectorAll("[data-year]")];
  const current = options.indexOf(document.activeElement);
  let next = current;
  if (event.key === "ArrowDown") next = (current + 1) % options.length;
  else if (event.key === "ArrowUp") next = (current - 1 + options.length) % options.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = options.length - 1;
  else if (event.key === "Escape") { event.preventDefault(); closeYearMenu(true); return; }
  else return;
  event.preventDefault();
  options[next]?.focus();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".calendar-picker")) { closeMonthMenu(); closeYearMenu(); }
});

function parseDate(value) {
  const [day, month, rawYear] = String(value || "").split(/[/-]/).map(Number);
  if (!Number.isFinite(day) || !Number.isFinite(month)) return null;
  const year = Number.isFinite(rawYear) ? (rawYear > 2400 ? rawYear - 543 : rawYear < 100 ? rawYear + 2500 - 543 : rawYear) : selectedYear;
  return { day, month: month - 1, year };
}

function renderCalendar() {
  const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
  const dayCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const eventMap = new Map();
  const addEvent = (date, type) => {
    const parsed = parseDate(date);
    if (!parsed || parsed.year !== selectedYear || parsed.month !== selectedMonth || parsed.day < 1 || parsed.day > dayCount) return;
    const events = eventMap.get(parsed.day) || [];
    events.push(type);
    eventMap.set(parsed.day, events);
  };
  records.forEach((record) => {
    addEvent(record.date, "borrow");
    const status = String(record.status || "").toLowerCase();
    addEvent(record.due, status === "returned" ? "returned" : status === "overdue" ? "overdue" : "due");
    addEvent(record.extendedDue || record.extensionDate, "due");
  });

  const cells = [];
  for (let blank = 0; blank < firstDay; blank += 1) cells.push('<span class="calendar-day empty" aria-hidden="true"></span>');
  for (let day = 1; day <= dayCount; day += 1) {
    const events = eventMap.get(day) || [];
    const dots = events.map((type) => `<i class="calendar-marker marker-${type}" aria-hidden="true"></i>`).join("");
    cells.push(`<span class="calendar-day${events.length ? " has-events" : ""}" aria-label="${day}"><span class="calendar-day-number">${day}</span>${dots ? `<span class="calendar-markers">${dots}</span>` : ""}</span>`);
  }
  calendarGrid.innerHTML = cells.join("");
}

function iconFor(kind) {
  if (kind === "ส่วนบุคคล") {
    return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m17 8 4 30m10-30-4 30M14 41l5-1m9 1-5-1" fill="none" stroke="#8d9697" stroke-width="2.3" stroke-linecap="round"/><path d="M13 12h9m4 0h9M17 18l6-2m8 2-6-2" fill="none" stroke="#e49b3d" stroke-width="2.4" stroke-linecap="round"/><path d="M19 10v8m10-8v8" fill="none" stroke="#a7afb0" stroke-width="1.7" stroke-linecap="round"/></svg>';
  }
  return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 13h24a4 4 0 0 1 4 4v23H8V17a4 4 0 0 1 4-4Z" fill="#f6f4ef" stroke="#aaa79f" stroke-width="2"/><path d="M18 13V9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" fill="none" stroke="#e45450" stroke-width="3"/><circle cx="24" cy="27" r="9" fill="#ec524d"/><path d="M22 21h4v4h4v4h-4v4h-4v-4h-4v-4h4Z" fill="#fff"/></svg>';
}

function renderList() {
  const query = searchInput.value.trim().toLowerCase();
  const isReturnView = page.classList.contains("is-return-view");
  const sourceRecords = isReturnView
    ? records.filter((record) => {
        const status = String(record.status || "").toLowerCase();
        const isReturned = status === "returned" || Boolean(record.returnedDate) || Array.isArray(record.returnHistory) && record.returnHistory.length > 0 || (Array.isArray(record.items) && record.items.length === 0);
        return !isReturned;
      })
    : records.filter((record) => {
        const status = String(record.status || "").toLowerCase();
        const isExtended = Boolean(record.extensionDate || (record.extendedDue && record.extendedDue !== record.due));
        const isReturned = status === "returned" || Boolean(record.returnedDate) || Array.isArray(record.returnHistory) && record.returnHistory.length > 0 || (Array.isArray(record.items) && record.items.length === 0);
        return !isReturned && (status === "overdue" || isExtended);
      });
  const visibleRecords = sourceRecords.filter((record) => !query || `${record.item} ${record.borrower} ${record.kind} ${record.due} ${record.status}`.toLowerCase().includes(query));
  if (!visibleRecords.length) {
    borrowList.innerHTML = `<p class="empty-state">${borrowReturnText("noResults")}</p>`;
    return;
  }
  borrowList.innerHTML = visibleRecords.map((record) => {
    const kind = record.kind || record.borrower || "รายการยืม";
    const status = String(record.status || "").toLowerCase();
    const isExtended = Boolean(record.extensionDate || (record.extendedDue && record.extendedDue !== record.due));
    const statusText = status === "overdue" ? borrowReturnText("overdue") : status === "returned" ? borrowReturnText("returned") : "";
    const dueLabel = `${borrowReturnText("due")}: ${escapeHtml(record.due || "—")}`;
    const extensionText = record.extensionDate || (record.extendedDue && record.extendedDue !== record.due ? record.extendedDue : "");
    return `<article class="borrow-card kind-${kind === "ส่วนบุคคล" ? "personal" : "nurse"} ${status === "overdue" ? "is-overdue" : status === "returned" ? "is-returned" : isExtended ? "is-due" : "is-pending"}">
      <span class="record-icon" aria-hidden="true">${iconFor(kind)}</span>
      <div class="borrow-record-main">
        <div class="borrow-record-meta"><span>${dueLabel}</span>${extensionText ? `<span>${borrowReturnText("extension")}: ${escapeHtml(extensionText)}</span>` : ""}${statusText ? `<span class="borrow-status">${statusText}</span>` : ""}</div>
        <h3>${escapeHtml(record.item || record.borrower || "รายการยืม")}</h3>
        <span class="borrow-kind ${kind === "ส่วนบุคคล" ? "personal" : "travel"}">${escapeHtml(kind)}</span>
      </div>
      <button class="borrow-details-button" data-return="${escapeHtml(record.id)}" type="button" aria-label="ดูรายละเอียด"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
    </article>`;
  }).join("");
}

function renderReturnDetail(record) {
  const status = String(record.status || "borrowed").toLowerCase();
  const statusLabel = status === "returned" ? "คืนแล้ว" : status === "overdue" ? "เกินกำหนดคืน" : "กำลังยืม";
  const name = record.fullName || record.name || record.item || "ไม่ระบุชื่อผู้ยืม";
  const category = record.kind || record.borrower || "ยาและเวชภัณฑ์";
  let stockItems = [];
  try { stockItems = JSON.parse(window.FMSData.getItem("fms-stock-records") || "[]"); } catch { stockItems = []; }
  const sourceItems = Array.isArray(record.items) ? record.items : Array.isArray(record.medications) ? record.medications : null;
  const products = sourceItems || (record.products && typeof record.products === "object"
    ? Object.entries(record.products).map(([code, value]) => {
        const stock = stockItems.find((item) => String(item.code) === String(code));
        return { name: value.name || value.productName || stock?.name || stock?.productName || code, code, quantity: value.quantity ?? value.count ?? 1 };
      })
    : [{ name: record.borrower || record.kind || "ยาและเวชภัณฑ์", code: record.productCode || "—", quantity: record.quantity ?? "—" }]);
  const itemsMarkup = products.length ? products.map((item) => {
    const productName = typeof item === "string" ? item : item.name || item.productName || item.item || "ยาและเวชภัณฑ์";
    const code = typeof item === "string" ? "—" : item.code || item.productCode || "—";
    const quantity = typeof item === "string" ? "—" : item.quantity ?? item.count ?? "—";
    return `<article class="return-detail-item"><span class="return-detail-item-icon" aria-hidden="true">＋</span><div><strong>${escapeHtml(productName)}</strong><small>รหัสรายการ ${escapeHtml(code)}</small></div><span class="return-detail-quantity">${escapeHtml(quantity)} <small>ชิ้น</small></span></article>`;
  }).join("") : '<p class="return-detail-empty">ไม่มีข้อมูลรายการยาและเวชภัณฑ์</p>';

  detailView.innerHTML = `
    <div class="return-detail-shell">
      <div class="return-detail-page-heading"><h2>Medicine &amp; Medical Supplies<br><span>Borrowing &amp; Return</span></h2></div>
      <div class="return-detail-topline"><button class="return-detail-back" type="button" data-detail-back><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7M7 12h14"/></svg><span>กลับไปยังรายการ</span></button><span class="return-detail-status ${status === "returned" ? "is-returned" : status === "overdue" ? "is-overdue" : "is-borrowed"}"><i></i>${statusLabel}</span></div>
      <header class="return-detail-hero"><span class="return-detail-hero-icon" aria-hidden="true">${iconFor(category)}</span><div><p>รายละเอียดการยืม–คืน</p><h1 id="returnDetailTitle">${escapeHtml(name)}</h1><span class="return-detail-category">${escapeHtml(category)}</span></div></header>
      <section class="return-detail-info" aria-label="ข้อมูลการยืม"><div><span>ผู้ยืม</span><strong>${escapeHtml(name)}</strong></div><div><span>ประเภทผู้ยืม</span><strong>${escapeHtml(record.role || record.borrowerType || record.department || "—")}</strong></div><div><span>วันที่ยืม</span><strong>${escapeHtml(record.date || record.borrowDate || "—")}</strong></div><div><span>กำหนดคืน</span><strong>${escapeHtml(record.due || "—")}</strong></div>${record.returnedDate ? `<div><span>วันที่คืน</span><strong>${escapeHtml(record.returnedDate)}</strong></div>` : ""}</section>
      <section class="return-detail-products"><div class="return-detail-section-heading"><div><p>รายการที่ยืม</p><h2>ยาและเวชภัณฑ์</h2></div><span>${products.length} รายการ</span></div><div class="return-detail-item-list">${itemsMarkup}</div></section>
      <footer class="return-detail-actions"><button class="return-detail-extend" type="button" data-detail-extend ${status === "returned" ? "disabled" : ""}>ต่อเวลาการยืม</button><button class="return-detail-return" type="button" data-detail-return ${status === "returned" ? "disabled" : ""}>${status === "returned" ? "คืนแล้ว" : "คืนยา และเวชภัณฑ์"}</button></footer>
    </div>`;
  detailView.dataset.recordId = String(record.id);
  page.hidden = true;
  detailView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeReturnDetail() {
  detailView.hidden = true;
  page.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openExtendBorrowModal(record) {
  const [day, month, year] = String(record.due || "").split(/[/-]/);
  const rawYear = Number(year);
  const gregorianYear = rawYear > 2400 ? rawYear - 543 : rawYear > 0 && rawYear < 100 ? rawYear + 1957 : rawYear;
  extendDueDate.value = day && month && gregorianYear ? `${String(gregorianYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
  document.getElementById("extendRegisteredDate").textContent = new Date().toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
  extendBorrowModal.dataset.recordId = String(record.id);
  extendBorrowModal.hidden = false;
  extendDueDate.focus();
}

function closeExtendBorrowModal() {
  extendBorrowModal.hidden = true;
}

function showBorrowView() {
  window.location.href = "./borrow-form.html";
}

function setBorrowReturnMenuVisibility(isVisible) {
  document.querySelectorAll("header.topbar .menu-button, header.topbar .menu-link").forEach((button) => {
    button.style.setProperty("display", isVisible ? "inline-flex" : "none", "important");
  });
}

function showReturnView() {
  page.classList.add("is-return-view");
  document.body.classList.add("is-return-view");
  setBorrowReturnMenuVisibility(false);
  page.querySelector(".page-heading h1").innerHTML = borrowReturnEnglish ? "Medicine &amp; Medical Supplies<br><span>Return</span>" : "ยาและเวชภัณฑ์<br><span>การคืนยา และเวชภัณฑ์</span>";
  returnTab.classList.add("active");
  borrowTab.classList.remove("active");
  recordsTitle.textContent = borrowReturnText("returnRecords");
  if (borrowReturnEnglish) updateBorrowReturnLanguage();
  renderList();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showHomeView() {
  page.classList.remove("is-return-view");
  document.body.classList.remove("is-return-view");
  setBorrowReturnMenuVisibility(true);
  page.querySelector(".page-heading h1").innerHTML = borrowReturnEnglish ? "Medicine &amp; Medical Supplies<br><span>Borrowing &amp; Return</span>" : "ยาและเวชภัณฑ์<br><span>การยืมและคืน</span>";
  returnTab.classList.add("active");
  borrowTab.classList.remove("active");
  recordsTitle.textContent = borrowReturnText("records");
  if (borrowReturnEnglish) updateBorrowReturnLanguage();
  renderCalendar();
  renderList();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

borrowTab.addEventListener("click", showBorrowView);
returnTab.addEventListener("click", showReturnView);
returnHome.addEventListener("click", showHomeView);
searchInput.addEventListener("input", renderList);
borrowList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-return]");
  if (!button) return;
  const record = records.find((item) => String(item.id) === button.dataset.return);
  if (record) renderReturnDetail(record);
});
detailView.addEventListener("click", (event) => {
  if (event.target.closest("[data-detail-back]")) {
    closeReturnDetail();
    return;
  }
  const recordId = detailView.dataset.recordId;
  const record = records.find((item) => String(item.id) === recordId);
  if (!record) return;
  if (event.target.closest("[data-detail-extend]")) {
    openExtendBorrowModal(record);
  }
  if (event.target.closest("[data-detail-return]")) {
    window.location.href = `./return-form.html?id=${encodeURIComponent(record.id)}`;
  }
});
document.getElementById("cancelExtendBorrow").addEventListener("click", closeExtendBorrowModal);
extendBorrowModal.addEventListener("click", (event) => {
  if (event.target === extendBorrowModal) closeExtendBorrowModal();
});
document.getElementById("extendBorrowForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!extendDueDate.value) {
    extendDueDate.reportValidity();
    return;
  }
  const record = records.find((item) => String(item.id) === extendBorrowModal.dataset.recordId);
  if (!record) return;
  const button=event.target.querySelector('[type="submit"]');
  if(button.disabled)return;button.disabled=true;
  try {
    const saved=await FMSData.request('loans', `/${encodeURIComponent(record.id)}`, {method:'PATCH',body:JSON.stringify({dueDate:extendDueDate.value})});
    Object.assign(record,saved);closeExtendBorrowModal();renderList();renderReturnDetail(record);
  } catch(error) {alert(error.message);} finally {button.disabled=false;}

});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !extendBorrowModal.hidden) closeExtendBorrowModal();
});
document.getElementById("exportPdf").addEventListener("click", () => window.print());
document.getElementById("exportExcel").addEventListener("click", () => {
  const headers = ["ผู้ยืม", "รายการ", "กำหนดคืน", "ต่อเวลา", "สถานะ"];
  const rows = records.map((record) => [record.item, record.kind || record.borrower, record.due, record.extendedDue || record.extensionDate || "", record.status]);
  const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = "FMS-borrow-return.csv";
  link.click();
  URL.revokeObjectURL(link.href);
});

renderCalendar();
renderList();

const languageButton = document.querySelector(".topbar .language");
languageButton?.addEventListener("click", () => {
  borrowReturnEnglish = document.documentElement.lang !== "en";
  document.documentElement.lang = borrowReturnEnglish ? "en" : "th";
  const label = languageButton.querySelector("span");
  if (label) label.textContent = borrowReturnEnglish ? "English" : "ไทย";
  updateBorrowReturnLanguage();
});
updateBorrowReturnLanguage();
