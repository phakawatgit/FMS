const STORAGE_KEY = "fms-borrow-return-records";
const STOCK_KEY = "fms-stock-records";
let historyEnglish = false;
const historyCopy = { borrow: ["รายการยืม", "Borrowing Records"], returned: ["รายการคืน", "Return Records"], combined: ["รายการยืม–คืน", "Borrow & Return History"], empty: ["ยังไม่มีประวัติการยืม–คืนยาและเวชภัณฑ์", "No borrowing or return history yet"], noResults: ["ไม่พบประวัติที่ตรงกับคำค้น", "No matching history found"], borrowWord: ["การยืม", "Borrowing"], returnWord: ["การคืน", "Return"], returnedStatus: ["คืนแล้ว", "Returned"], overdue: ["เกินกำหนด", "Overdue"], complete: ["คืนครบแล้ว", "Completed"], borrowing: ["กำลังยืม", "Borrowed"], details: ["ดูรายละเอียด", "View details"] };
const historyText = (key) => historyCopy[key]?.[historyEnglish ? 1 : 0] || key;
const content = document.getElementById("historyContent");
const searchInput = document.getElementById("searchInput");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const normalize = (value) => String(value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");

function loadBorrowRecords() {
  try { if(window.FMSBorrowHistoryStore)return window.FMSBorrowHistoryStore.read();const value=JSON.parse(FMSStorage.getItem(STORAGE_KEY)||"[]");return Array.isArray(value)?value:[]; } catch(error){console.warn("Borrow and return history could not be read.",error);return[]}
}
function normalizeItems(record) {
  const items = Array.isArray(record.borrowedItems) ? record.borrowedItems : Array.isArray(record.items) ? record.items : [];
  if (items.length) return items.map((item) => ({
    name: item.name || item.productName || item.code || item.productCode || "ยาและเวชภัณฑ์",
    code: item.code || item.productCode || "—",
    quantity: Number(item.quantity ?? item.count) || 0,
    image: item.image || ""
  }));
  return [{ name: record.kind || record.borrower || "ยาและเวชภัณฑ์", code: record.productCode || "—", quantity: Number(record.quantity) || 1 }];
}

function getBorrowTypes(record) {
  const source = record.borrowTypes || record.borrowerType || record.kinds || record.kind || record.borrower || "";
  const values = Array.isArray(source) ? source : String(source).split(/[、,]/);
  return [...new Set(values.map((value) => String(value).trim()).filter((value) => ["กระเป๋าพยาบาล", "ส่วนบุคคล"].includes(value)))];
}

function loanTypeIcon(type) {
  if (type === "กระเป๋าพยาบาล") return '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="15" width="32" height="26" rx="5" fill="#e5f7f4" stroke="currentColor" stroke-width="2.5"/><path d="M17 15v-4a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M24 20v16M16 28h16" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M8 24h8m16 0h8" stroke="currentColor" stroke-width="2.5"/></svg>';
  if (type === "ส่วนบุคคล") return '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="16" r="8" fill="#e8f1ff" stroke="currentColor" stroke-width="2.5"/><path d="M9 40c1.3-8 6.5-12 15-12s13.7 4 15 12" fill="#e8f1ff" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M24 31v8m-4-4h8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';
  return eventIconFallback();
}

function eventIconFallback() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function buildHistoryEvents() {
  const events = [];
  loadBorrowRecords().forEach((record, index) => {
    const borrower = record.fullName || record.name || record.item || "ไม่ระบุชื่อผู้ยืม";
    const id = record.id ?? index;
    events.push({
      type: "borrow",
      id: `borrow-${id}`,
      borrower,
      role: record.role || (Array.isArray(record.roles) ? record.roles.join("、") : "") || record.department || record.branch || "",
      borrowTypes: getBorrowTypes(record),
      date: record.date || record.borrowDate || "ไม่ระบุวันที่",
      items: normalizeItems(record),
      status: String(record.status || "borrowed").toLowerCase(),
      record
    });

    const parentId = `borrow-${id}`;
    const returns = Array.isArray(record.returnHistory) ? record.returnHistory : [];
    if (returns.length) {
      returns.forEach((entry, returnIndex) => events.push({
        type: "return",
        id: `return-${id}-${returnIndex}`,
        parentId,
        borrower,
        role: record.role || (Array.isArray(record.roles) ? record.roles.join("、") : "") || record.department || record.branch || "",
        borrowTypes: getBorrowTypes(record),
        date: entry.date || record.returnedDate || "ไม่ระบุวันที่",
        returnEntry: entry,
        record,
        items: Array.isArray(entry.items) ? entry.items.map((item) => ({
          name: item.name || item.productName || item.code || item.productCode || "ยาและเวชภัณฑ์",
          code: item.code || item.productCode || "—",
          quantity: Number(item.quantity ?? item.count) || 0,
          image: item.image || ""
        })) : []
      }));
    } else if (record.returnedDate) {
      events.push({ type: "return", id: `return-${id}`, parentId, borrower, role: record.role || record.borrowerType || "", date: record.returnedDate, items: normalizeItems(record), record });
    }
  });
  return events;
}

function dateText(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return String(value ?? "");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${String(value)} ${date.toLocaleString("th-TH")} ${day}/${month}/${date.getFullYear()} ${day}/${month}/${date.getFullYear() + 543}`;
}

function displayDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleString("th-TH") : String(value || "ไม่ระบุวันที่");
}

function statusLabel(event) {
  if (event.type === "return") return { label: historyText("returnedStatus"), className: "is-returned" };
  if (event.status === "overdue") return { label: historyText("overdue"), className: "is-overdue" };
  if (event.status === "returned") return { label: historyText("complete"), className: "is-returned" };
  return { label: historyText("borrowing"), className: "is-borrowed" };
}

function eventMarkup(event,index) {
  const status=statusLabel(event),kind=event.type==="borrow"?(historyEnglish?"Borrowing":"ยืม"):(historyEnglish?"Return":"คืน"),panelId=`borrow-event-${String(event.id).replace(/[^a-zA-Z0-9_-]/g,"-")}`;
  const items=event.items.length?event.items.map(item=>{const current=currentStockRecord(item)||item,image=current.image||current.imageUrl||item.image||"",name=current.name||current.productName||item.name,code=current.code||item.code,unit=current.unit||"หน่วย";return `<p>${image?`<img class="history-item-image" src="${escapeHtml(image)}" alt="">`:""}<span class="history-item-copy">${escapeHtml(name)} <span>รหัส ${escapeHtml(code)} · ${escapeHtml(item.quantity)} ${escapeHtml(unit)}</span></span></p>`}).join(""):"<p>ไม่มีรายละเอียดรายการยา</p>";
  const returnMarkup=(event.returnEvents||[]).map(returnEvent=>`<article class="nested-return-record"><div><strong>คืนเมื่อ ${escapeHtml(displayDate(returnEvent.date))}</strong><span>${returnEvent.items.map(item=>`${escapeHtml(item.name)} × ${escapeHtml(item.quantity)}`).join(" · ")}</span></div><button type="button" class="detail-button" data-detail-event-id="${escapeHtml(returnEvent.id)}">ดูรายละเอียดคืน <span aria-hidden="true">›</span></button></article>`).join("");
  const returnsSection=returnMarkup?`<section class="nested-return-history"><h4>ประวัติการคืน (${event.returnEvents.length})</h4>${returnMarkup}</section>`:"";
  const typeBadges=(event.borrowTypes||[]).map(type=>`<span class="borrow-kind-badge ${type==="ส่วนบุคคล"?"is-personal":"is-kit"}">${escapeHtml(type)}</span>`).join("");
  const icon=event.type==="borrow"&&event.borrowTypes?.length?loanTypeIcon(event.borrowTypes[0]):eventIconFallback();
  return `<article class="history-record ${event.type === "borrow" ? "is-borrow-event" : "is-return-event"}"><button class="borrow-history-toggle" type="button" aria-expanded="false" aria-controls="${escapeHtml(panelId)}" data-borrow-event-toggle="${escapeHtml(panelId)}"><span>${event.type==="borrow"?"การยืม":"การคืน"}ครั้งที่ ${index}</span>${event.type==="return"?`<small class="history-toggle-date">วันที่คืน: ${escapeHtml(displayDate(event.date))}</small>`:""}<span class="order-chevron" aria-hidden="true"></span></button><div class="borrow-history-event-detail" id="${escapeHtml(panelId)}" hidden><div class="history-record-head"><span class="history-record-icon ${event.borrowTypes?.[0]==="ส่วนบุคคล"?"is-personal":"is-kit"}" aria-hidden="true">${icon}</span><div><h3>${kind} · ${escapeHtml(event.borrower)}</h3><p class="borrower">${escapeHtml(event.role||"ผู้ยืม")}</p>${typeBadges?`<div class="borrow-type-badges">${typeBadges}</div>`:""}</div><time>${escapeHtml(displayDate(event.date))}</time></div><span class="history-status ${status.className}">${status.label}</span><div class="history-items">${items}</div>${returnsSection}<div class="history-record-actions"><button type="button" class="detail-button" data-detail-event-id="${escapeHtml(event.id)}">ดูรายละเอียด <span aria-hidden="true">›</span></button></div></div></article>`;
}
const detailModal = document.getElementById("borrowDetailModal");
const detailContent = document.getElementById("borrowDetailContent");
let lastDetailTrigger = null;
let lastDetailEventId = null;

function currentStockRecord(item) {
  const code=String(item.code||item.productCode||"").trim().toLocaleLowerCase();
  const name=normalize(item.name||item.productName);
  try{const records=JSON.parse(FMSStorage.getItem(STOCK_KEY)||"[]");if(!Array.isArray(records))return null;return records.find(row=>code&&String(row.code||row.productCode||"").trim().toLocaleLowerCase()===code)||records.find(row=>[row.name,row.productName,row.genericName].some(value=>normalize(value)===name))||null}catch{return null}
}
function detailMarkup(event) {
  const record=event.record||{},status=statusLabel(event),typeLabel=event.type==="borrow"?"รายละเอียดการยืม":"รายละเอียดการคืน",dateLabel=event.type==="borrow"?"วันที่ยืม":"วันที่คืน";
  const dueDate=record.dueDate||record.returnDueDate||record.expectedReturnDate||record.borrowDueDate||record.extendedDue||record.due||"ไม่ระบุ",contact=record.phone||record.telephone||record.contact||"ไม่ระบุ",department=record.department||record.branch||record.faculty||event.role||"ไม่ระบุ",borrowTypeText=(event.borrowTypes||[]).join(" และ ")||"ไม่ระบุประเภท",detailIcon=event.borrowTypes?.length?loanTypeIcon(event.borrowTypes[0]):eventIconFallback();
  const details=event.items.map(item=>{const current=currentStockRecord(item)||item,image=current.image||current.imageUrl||item.image||"",name=current.name||current.productName||item.name||"ยาและเวชภัณฑ์",code=current.code||current.productCode||item.code||"—",unit=current.unit||item.unit||"หน่วย",total=Number(current.total)||0,used=Number(current.used)||0,remaining=current.total!==undefined?Math.max(0,total-used):null;const rows=[["ชื่อสามัญ",current.genericName],["ประเภท",({oral:"ยากิน",topical:"ยาทา",equipment:"เวชภัณฑ์"})[current.category]||current.category],["รูปแบบ",current.form],["ขนาด",current.size],["หน่วยนับ",unit],["จำนวนทั้งหมดในคลังปัจจุบัน",current.total],["ใช้/เบิกในคลังปัจจุบัน",current.used],["คงเหลือในคลังปัจจุบัน",remaining],["วันหมดอายุ",current.expiry],["สรรพคุณ",current.benefit],["อาการที่ใช้",current.symptom],["วิธีใช้",current.usage],["ข้อควรระวัง",current.warning],["สถานะสินค้า",current.status]].filter(([,value])=>value!==undefined&&value!==null&&String(value).trim()!=="");return `<article class="detail-item-card"><div class="detail-item-main">${image?`<img class="detail-item-image" src="${escapeHtml(image)}" alt="รูป ${escapeHtml(name)}">`:'<span class="detail-item-icon" aria-hidden="true">💊</span>'}<div><strong>${escapeHtml(name)}</strong><small>รหัสยา ${escapeHtml(code)}</small></div><b>${escapeHtml(item.quantity)} <small>${escapeHtml(unit)}</small></b></div><p class="detail-item-current">ข้อมูลสินค้าและคลังปัจจุบัน</p><dl>${rows.map(([label,value])=>`<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl></article>`}).join("");
  return `<header class="detail-modal-header"><span class="detail-modal-icon" aria-hidden="true">${detailIcon}</span><div><p>History Borrow and Return</p><h2 id="borrowDetailTitle">${typeLabel}</h2></div><span class="history-status ${status.className}">${status.label}</span></header><div class="detail-person"><span class="detail-avatar" aria-hidden="true">${escapeHtml(String(event.borrower).trim().charAt(0)||"?")}</span><div><small>ผู้${event.type==="borrow"?"ยืม":"คืน"}</small><strong>${escapeHtml(event.borrower)}</strong><span>${escapeHtml(event.role||"ผู้ยืม")}</span></div></div><div class="detail-facts"><div><small>ประเภทการยืม</small><strong>${escapeHtml(borrowTypeText)}</strong></div><div><small>${dateLabel}</small><strong>${escapeHtml(displayDate(event.date))}</strong></div><div><small>กำหนดคืน</small><strong>${escapeHtml(displayDate(dueDate))}</strong></div><div><small>หน่วยงาน</small><strong>${escapeHtml(department)}</strong></div><div><small>รหัสนักศึกษา</small><strong>${escapeHtml(record.studentId||"ไม่ระบุ")}</strong></div><div><small>ติดต่อ</small><strong>${escapeHtml(contact)}</strong></div>${record.activity?`<div><small>กิจกรรม</small><strong>${escapeHtml(record.activity)}</strong></div>`:""}${record.reason?`<div><small>เหตุผล</small><strong>${escapeHtml(record.reason)}</strong></div>`:""}</div><section class="detail-items-section"><div class="detail-items-heading"><h3>รายการยาและรายละเอียดปัจจุบัน</h3><span>${event.items.length} รายการ</span></div>${details||'<p class="detail-empty">ไม่มีรายละเอียดรายการยา</p>'}</section><footer class="detail-modal-footer"><span>รายละเอียดสินค้าอ้างอิงจากคลังปัจจุบัน</span><div class="detail-export-actions"><button type="button" class="detail-export-excel" data-detail-export="excel">Excel</button><button type="button" class="detail-export-pdf" data-detail-export="pdf">PDF</button><button type="button" class="detail-close-button" data-close-borrow-detail>ปิดรายละเอียด</button></div></footer>`;
}function openDetail(event, trigger) {
  if (!event) return;
  lastDetailTrigger = trigger;
  lastDetailEventId = event.id;
  detailContent.innerHTML = detailMarkup(event);
  detailModal.hidden = false;
  document.body.classList.add("borrow-detail-open");
  detailModal.querySelector(".borrow-detail-close").focus();
}

function closeDetail() {
  if (detailModal.hidden) return;
  detailModal.hidden = true;
  lastDetailEventId = null;
  document.body.classList.remove("borrow-detail-open");
  lastDetailTrigger?.focus();
}

content.addEventListener("click",event=>{
 const toggle=event.target.closest("[data-borrow-event-toggle]");if(toggle){const panel=document.getElementById(toggle.dataset.borrowEventToggle),opening=toggle.getAttribute("aria-expanded")!=="true";toggle.setAttribute("aria-expanded",String(opening));panel.hidden=!opening;return}
 const trigger=event.target.closest("[data-detail-event-id]");if(!trigger)return;openDetail(buildHistoryEvents().find(item=>item.id===trigger.dataset.detailEventId),trigger);
});function printBorrowEvent(){document.querySelector(".borrow-detail-print-root")?.remove();const root=document.createElement("section"),dialog=document.querySelector(".borrow-detail-dialog")?.cloneNode(true);if(!dialog)return;root.className="borrow-detail-print-root";root.append(dialog);document.body.append(root);document.body.classList.add("printing-borrow-detail");requestAnimationFrame(()=>window.print())}
function exportBorrowEvent(event){
 const rows=[["ประเภท","ผู้ยืม","บทบาท/หน่วยงาน","ชนิดการยืม","วันที่","กำหนดคืน","สถานะ","ชื่อเล่น","รหัสนักศึกษา","สาขา","เบอร์โทร","กิจกรรม","เหตุผล","ชื่อสินค้า","รหัสสินค้า","จำนวนยืม/คืน","หน่วย","ประเภทสินค้า","รูปแบบ","ขนาด","จำนวนทั้งหมดปัจจุบัน","ใช้/เบิกปัจจุบัน","คงเหลือปัจจุบัน","วันหมดอายุ","สรรพคุณ","วิธีใช้","ข้อควรระวัง"]];
 event.items.forEach(item=>{const p=currentStockRecord(item)||item;rows.push([event.type==="borrow"?"ยืม":"คืน",event.borrower,event.role,(event.borrowTypes||[]).join(" และ "),displayDate(event.date),event.record?.due||event.record?.extendedDue||event.record?.dueDate,statusLabel(event).label,event.record?.nickname,event.record?.studentId,event.record?.branch||event.record?.department,event.record?.phone,event.record?.activity,event.record?.reason,p.name||p.productName||item.name,p.code||item.code,item.quantity,p.unit,p.category,p.form,p.size,p.total,p.used,p.remaining??(Number(p.total||0)-Number(p.used||0)),p.expiry,p.benefit,p.usage,p.warning])});
 const table=rows.map((row,i)=>`<tr>${row.map(value=>`<${i===0?"th":"td"}>${escapeHtml(value??"")}</${i===0?"th":"td"}>`).join("")}</tr>`).join("");
 const html=`<html><head><meta charset="utf-8"><style>body{font-family:Kanit,Arial,sans-serif}table{border-collapse:collapse}th,td{border:1px solid #9bb4c0;padding:7px;vertical-align:top}th{background:#d8efed;color:#164b67}td{mso-number-format:"\\@"}</style></head><body><h2>History Borrow and Return - ${escapeHtml(event.borrower)}</h2><table>${table}</table></body></html>`;
 const url=URL.createObjectURL(new Blob(["\ufeff",html],{type:"application/vnd.ms-excel;charset=utf-8"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=`FMS-borrow-return-${event.type}-${String(event.id).replace(/[^a-zA-Z0-9_-]/g,"-")}.xls`;anchor.click();URL.revokeObjectURL(url);
}
detailModal.addEventListener("click",event=>{const button=event.target.closest("[data-detail-export]");if(button){const current=buildHistoryEvents().find(item=>item.id===lastDetailEventId);if(!current)return;if(button.dataset.detailExport==="excel")exportBorrowEvent(current);else printBorrowEvent();return}if(event.target.closest("[data-close-borrow-detail]"))closeDetail()});document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDetail();
});

function render() {
  const query = normalize(searchInput.value);
  const allEvents = buildHistoryEvents();
  const returnEvents = allEvents.filter((event) => event.type === "return");
  const matches = (event) => normalize(`${event.type === "borrow" ? "ยืม borrow" : "คืน return"} ${event.borrower} ${event.role} ${dateText(event.date)} ${event.items.map((item) => `${item.name} ${item.code} ${item.quantity}`).join(" ")} ${statusLabel(event).label}`).includes(query);
  const events = allEvents.filter((event) => event.type === "borrow").map((event) => ({
    ...event,
    returnEvents: returnEvents.filter((entry) => entry.parentId === event.id),
  })).filter((event) => !query || matches(event) || event.returnEvents.some(matches)).sort((a, b) => {
    const timeA = new Date(a.date).getTime(), timeB = new Date(b.date).getTime();
    return (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA);
  });
  const rows = events.map((event, index) => eventMarkup(event, index + 1)).join("");
  content.innerHTML = rows ? `<section class="history-group"><h2>${historyText("combined")}</h2>${rows}</section>` : `<p class="empty-state">${query ? historyText("noResults") : historyText("empty")}</p>`;
}

searchInput.addEventListener("input", () => {
  document.getElementById("clearSearch").hidden = !searchInput.value;
  render();
});
document.getElementById("historySearchForm").addEventListener("submit", (event) => { event.preventDefault(); render(); });
document.getElementById("clearSearch").addEventListener("click", () => { searchInput.value = ""; document.getElementById("clearSearch").hidden = true; searchInput.focus(); render(); });
document.getElementById("exportExcel").addEventListener("click", () => {
  const rows = [["ประเภท", "ผู้ยืม", "วันที่", "รายการ", "รหัส", "จำนวน"], ...buildHistoryEvents().flatMap((event) => event.items.map((item) => [event.type === "borrow" ? "ยืม" : "คืน", event.borrower, event.date, item.name, item.code, item.quantity]))];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = "FMS-borrow-return-history.csv";
  link.click();
  URL.revokeObjectURL(link.href);
});
document.getElementById("exportPdf").addEventListener("click", () => window.print());
function refreshHistory(){render();if(!detailModal.hidden&&lastDetailEventId){const current=buildHistoryEvents().find(event=>event.id===lastDetailEventId);if(current)detailContent.innerHTML=detailMarkup(current)}}
window.addEventListener("afterprint",()=>{document.body.classList.remove("printing-borrow-detail");document.querySelector(".borrow-detail-print-root")?.remove()});
window.addEventListener("storage", event => { if(!event.key||event.key===STORAGE_KEY||event.key===STOCK_KEY||event.key==="fms-history-borrow-return")refreshHistory(); });
window.addEventListener("focus",refreshHistory);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refreshHistory()});
document.getElementById("notificationButton").addEventListener("click", () => {
  const panel = document.getElementById("notificationPanel");
  panel.hidden = !panel.hidden;
});
function applyHistoryLanguage(isEnglish) {
  historyEnglish = isEnglish;
  document.documentElement.lang = isEnglish ? "en" : "th";
  document.querySelector(".activity-kicker").textContent = isEnglish ? "System Activity" : "ประวัติกิจกรรม";
  document.querySelector(".activity-intro h1").textContent = isEnglish ? "History Borrow & Return" : "ประวัติการยืมและคืน";
  document.querySelector(".history-back span").textContent = isEnglish ? "Back to History Menu" : "กลับไปหน้า History Menu";
  document.querySelector(".history-back").setAttribute("aria-label", isEnglish ? "Back to History Menu" : "กลับไปหน้า History Menu");
  document.querySelector(".catalog-label").textContent = isEnglish ? "BORROW & RETURN" : "ยืมและคืน";
  searchInput.placeholder = isEnglish ? "medicine name or date" : "ค้นหาชื่อยา หรือวันที่";
  searchInput.setAttribute("aria-label", isEnglish ? "Search medicine, borrower, code, or date" : "ค้นหาชื่อยา ผู้ยืม รหัส หรือวันที่");
  document.querySelector("#notificationPanel strong").textContent = isEnglish ? "Notifications" : "การแจ้งเตือน";
  document.querySelector("#notificationPanel p").textContent = isEnglish ? "Viewing medicine borrowing and return history" : "ดูประวัติการยืมและคืนยาและเวชภัณฑ์";
  document.getElementById("languageButton").querySelector("span").textContent = isEnglish ? "English" : "ไทย";
  render();
}
document.getElementById("languageButton").addEventListener("click", () => applyHistoryLanguage(!historyEnglish));


render();
applyHistoryLanguage(false);
