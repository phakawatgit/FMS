const ORDERS_KEY = "fms-history-catalog-orders";
const STOCK_KEY = "fms-stock-records";
const searchInput = document.getElementById("searchInput");
const list = document.getElementById("orderHistoryList");
let historyEnglish = false;
const catalogCopy = {
  back: ["กลับไปหน้า History Menu", "Back to History Menu"],
  catalog: ["คลังสินค้า", "Inventory"],
  noResults: ["ไม่พบประวัติการสั่งซื้อที่ตรงกับคำค้น", "No matching order history found"],
  empty: ["ยังไม่มีประวัติการสั่งซื้อ เมื่อบันทึกคำสั่งซื้อแล้ว รายละเอียดจะแสดงที่นี่", "No order history yet. Details will appear here after an order is saved."],
  order: ["การสั่งซื้อสินค้าครั้งที่", "Order #"],
  view: ["ดูรายละเอียด", "View details"],
  code: ["รหัสสินค้า", "Product code"],
  export: ["ส่งออกคำสั่งซื้อนี้", "Export this order"],
  items: ["รายการสินค้า", "Products"],
  itemDetails: ["รายละเอียดสินค้าที่บันทึกในคำสั่งซื้อนี้", "Product details saved in this order"]
};
const catalogText = (key) => catalogCopy[key]?.[historyEnglish ? 1 : 0] || key;
const localizeCatalogValue = (value) => {
  const text = String(value ?? "");
  if (!historyEnglish) return text;
  const orderMatch = text.match(/การสั่งซื้อสินค้าครั้งที่\s*(\d+)/);
  if (orderMatch) return `Order #${orderMatch[1]}`;
  return ({ "บันทึกคำสั่งซื้อแล้ว": "Order saved", "รอดำเนินการ": "Pending", "กำลังดำเนินการ": "Processing", "เสร็จสิ้น": "Completed", "ยกเลิก": "Cancelled", "ไม่ระบุ": "Not specified", "ยากิน": "Oral medicine", "ยาทา": "Topical medicine", "เวชภัณฑ์": "Medical supplies" })[text] || text;
};
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const normalize = (value) => String(value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
function readArray(key) {
  try {
    const value = JSON.parse(FMSStorage.getItem(key) || "null");
    return Array.isArray(value) ? value : null;
  } catch (error) {
    console.warn(`History Catalog data (${key}) could not be read.`, error);
    return null;
  }
}

function orderSequence(order, fallbackIndex = 0) {
  const match = String(order.title || order.name || "").match(/ครั้งที่\s*(\d+)/);
  return match ? Number(match[1]) : fallbackIndex + 1;
}

function getOrders() {
  return (readArray(ORDERS_KEY) || []).map((order, index) => ({ order, index })).sort((a, b) => orderSequence(a.order, a.index) - orderSequence(b.order, b.index) || new Date(a.order.createdAt || 0) - new Date(b.order.createdAt || 0)).map(({ order }) => order);
}
function imageValue(record) {
  const image = record?.image || record?.imageUrl || record?.imageDataUrl || record?.photo || record?.photoUrl || "";
  if (typeof image === "string") return image;
  return image?.dataUrl || image?.url || image?.src || "";
}

function findCurrentProduct(item) {
  const stock = readArray(STOCK_KEY) || [];
  const code = String(item.code || item.productCode || "").trim().toLocaleLowerCase();
  const name = normalize(item.name || item.productName);
  return stock.find((record) => code && String(record.code || record.productCode || "").trim().toLocaleLowerCase() === code)
    || stock.find((record) => [record.name, record.productName, record.genericName].some((value) => normalize(value) === name))
    || null;
}

function detailRows(order, item, current) {
  const product = current || item;
  const total = current ? Number(current.total) || 0 : null;
  const used = current ? Number(current.used) || 0 : null;
  const remaining = current ? Math.max(0, total - used) : null;
  const category = localizeCatalogValue({ oral: "ยากิน", topical: "ยาทา", equipment: "เวชภัณฑ์" }[product.category] || product.category);
  const rows = [
    ["ชื่อสินค้า", product.name || product.productName || item.name || item.productName],
    ["ชื่อสามัญ", product.genericName],
    ["รหัสสินค้า", product.code || product.productCode || item.code || item.productCode],
    ["ประเภทสินค้า", category],
    ["รูปแบบ", product.form],
    ["ขนาด", product.size],
    ["จำนวนที่สั่ง", `${item.quantity ?? item.count ?? 1} ${item.unit || product.unit || "หน่วย"}`],
    ["ตัวเลือก", item.option || item.variant],
    ["จำนวนในคลังปัจจุบัน", current ? total : null],
    ["เบิก/ใช้ไปปัจจุบัน", current ? used : null],
    ["คงเหลือปัจจุบัน", current ? `${remaining} ${product.unit || "หน่วย"}` : null],
    ["สถานะสินค้า", product.status],
    ["วันหมดอายุ", product.expiry],
    ["สรรพคุณ", product.benefit],
    ["อาการที่ใช้", product.symptom],
    ["วิธีใช้", product.usage],
    ["ข้อควรระวัง", product.warning],
    ["วันที่สั่งซื้อ", order.date || order.createdAt],
    ["ชื่อเอกสารสั่งซื้อ", order.documentTitle],
    ["สถานะคำสั่งซื้อ", order.status]
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");
  const labelMap = { "ชื่อสินค้า": "Product name", "ชื่อสามัญ": "Generic name", "รหัสสินค้า": "Product code", "ประเภทสินค้า": "Category", "รูปแบบ": "Form", "ขนาด": "Size", "จำนวนที่สั่ง": "Quantity ordered", "ตัวเลือก": "Option", "จำนวนในคลังปัจจุบัน": "Current stock", "เบิก/ใช้ไปปัจจุบัน": "Used/issued", "คงเหลือปัจจุบัน": "Current remaining", "สถานะสินค้า": "Product status", "วันหมดอายุ": "Expiry date", "สรรพคุณ": "Benefits", "อาการที่ใช้": "Indications", "วิธีใช้": "Usage", "ข้อควรระวัง": "Precautions", "วันที่สั่งซื้อ": "Order date", "ชื่อเอกสารสั่งซื้อ": "Order document", "สถานะคำสั่งซื้อ": "Order status" };
  return rows.map(([label, value]) => `<div><dt>${escapeHtml(historyEnglish ? (labelMap[label] || label) : label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
}

function productMarkup(order, item, index) {
  const productId = `product-detail-${String(order.id).replace(/[^a-zA-Z0-9_-]/g, "-")}-${index}`;
  const current = findCurrentProduct(item);
  const image = imageValue(current) || imageValue(item);
  const name = item.name || item.productName || current?.name || current?.productName || "รายการสินค้า";
  const code = item.code || item.productCode || current?.code || current?.productCode || "ไม่ระบุรหัส";
  const quantity = item.quantity ?? item.count ?? 1;
  const imageMarkup = image ? `<img src="${escapeHtml(image)}" alt="รูป ${escapeHtml(name)}" loading="lazy">` : '<span aria-hidden="true">📦</span>';
  return `<article class="order-history-product"><button class="product-detail-toggle" type="button" data-product-detail="${escapeHtml(productId)}" aria-expanded="false" aria-controls="${escapeHtml(productId)}"><span class="product-thumb">${imageMarkup}</span><span class="product-summary"><strong>${escapeHtml(name)}</strong><small>${catalogText("code")} ${escapeHtml(code)}</small></span><span class="product-quantity">×${escapeHtml(quantity)}</span><span class="product-chevron" aria-hidden="true"></span></button><div id="${escapeHtml(productId)}" class="product-detail-panel" hidden><p class="product-detail-current">${current ? (historyEnglish ? "Current product and inventory details" : "รายละเอียดสินค้าและสต็อกจากคลังปัจจุบัน") : (historyEnglish ? "Details saved in the order" : "รายละเอียดตามข้อมูลที่บันทึกในรายการสั่งซื้อ")}</p><dl>${detailRows(order, item, current)}</dl></div></article>`;
}

function render() {
  const query = normalize(searchInput.value);
  const visibleOrders = getOrders().filter((order) => normalize(`${order.title || order.name} ${order.date || order.createdAt} ${order.status} ${(order.items || order.products || []).map((item) => `${item.name} ${item.productName} ${item.code} ${item.productCode}`).join(" ")}`).includes(query));
  list.innerHTML = visibleOrders.length ? visibleOrders.map((order, index) => {
    const orderId = order.id || `order-${index}`;
    const items = Array.isArray(order.items) ? order.items : Array.isArray(order.products) ? order.products : [];
    const panelId = `order-detail-${String(orderId).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const date = order.date || order.createdAt || (historyEnglish ? "Date not specified" : "ไม่ระบุวันที่");
    const fallbackTitle = `${catalogText("order")} ${index + 1}`;
    const orderTitle = order.documentTitle ? `${localizeCatalogValue(order.title || order.name || fallbackTitle)} — ${order.documentTitle}` : localizeCatalogValue(order.title || order.name || fallbackTitle);
    return `<article class="order-history-card" data-order-id="${escapeHtml(orderId)}"><button class="order-history-toggle" type="button" aria-expanded="false" aria-controls="${escapeHtml(panelId)}" data-order-detail="${escapeHtml(panelId)}"><span>${escapeHtml(orderTitle)}</span><span class="order-chevron" aria-hidden="true"></span></button><button class="order-delete-button" type="button" data-delete-order="${escapeHtml(orderId)}" aria-label="${historyEnglish ? "Delete order" : "ลบคำสั่งซื้อ"}">${historyEnglish ? "Delete" : "ลบ"}</button><div id="${escapeHtml(panelId)}" class="order-history-detail" hidden><section class="catalog-order-mockup"><div class="order-export-actions"><span>${catalogText("export")}</span><div><button type="button" data-export-order="${escapeHtml(orderId)}" data-export-format="excel">Excel</button><button type="button" data-export-order="${escapeHtml(orderId)}" data-export-format="pdf">PDF</button></div></div><div class="mockup-summary"><div class="mockup-summary-item"><span>${historyEnglish ? "Order date" : "วันที่สั่งซื้อ"}</span><strong>${escapeHtml(date)}</strong></div><div class="mockup-summary-item"><span>${historyEnglish ? "Order status" : "สถานะคำสั่งซื้อ"}</span><strong class="mockup-status">${escapeHtml(localizeCatalogValue(order.status || (historyEnglish ? "Not specified" : "ไม่ระบุ")))}</strong></div><div class="mockup-summary-item"><span>${historyEnglish ? "Total products" : "รายการสินค้าทั้งหมด"}</span><strong>${items.length} ${historyEnglish ? "items" : "รายการ"}</strong></div></div>${order.documentTitle ? `<p class="order-requester">${historyEnglish ? "Document" : "ชื่อเอกสาร"} <strong>${escapeHtml(order.documentTitle)}</strong></p>` : ""}${order.requester || order.department ? `<p class="order-requester">${order.requester ? `${historyEnglish ? "Requester" : "ผู้สั่งซื้อ"} <strong>${escapeHtml(order.requester)}</strong>` : ""}${order.department ? `　${historyEnglish ? "Department" : "หน่วยงาน"} <strong>${escapeHtml(order.department)}</strong>` : ""}</p>` : ""}<div class="mockup-products-heading"><div><strong>${catalogText("items")}</strong><span>${catalogText("itemDetails")}</span></div><span>${items.length} ${historyEnglish ? "items" : "รายการ"}</span></div><div class="order-history-products">${items.length ? items.map((item, itemIndex) => productMarkup(order, item, itemIndex)).join("") : `<p class="empty-order-items">${historyEnglish ? "No products in this order" : "ไม่มีรายการสินค้าในคำสั่งซื้อนี้"}</p>`}</div></section></div></article>`;
  }).join("") : `<p class="empty-state">${query ? catalogText("noResults") : catalogText("empty")}</p>`;
}

function exportOrders(orders){
  const columns=["รายการสั่งซื้อ","วันที่สั่งซื้อ","สถานะ","ชื่อเอกสาร","ชื่อสินค้า","ชื่อสามัญ","รหัสสินค้า","ประเภท","รูปแบบ","ขนาด","ตัวเลือก","จำนวนที่สั่ง","หน่วย","จำนวนในคลังปัจจุบัน","ใช้/เบิกปัจจุบัน","คงเหลือปัจจุบัน","วันหมดอายุ","สรรพคุณ","อาการที่ใช้","วิธีใช้","ข้อควรระวัง"];
  const rows=orders.flatMap(order=>(order.items||order.products||[]).map(item=>{const current=findCurrentProduct(item)||item;return[order.title||order.name,order.date||order.createdAt,order.status,order.documentTitle,current.name||current.productName,item.genericName||current.genericName,item.code||item.productCode||current.code,current.category,current.form,current.size,item.option||item.variant,item.quantity??item.count??1,current.unit,current.total,current.used,current.remaining??(Number(current.total||0)-Number(current.used||0)),current.expiry,current.benefit,current.symptom,current.usage,current.warning]}));
  const tableRows=[columns,...rows].map((row,index)=>`<tr>${row.map(value=>`<${index===0?"th":"td"}>${escapeHtml(value??"")}</${index===0?"th":"td"}>`).join("")}</tr>`).join("");
  const workbook=`<html><head><meta charset="utf-8"><style>body{font-family:Kanit,Arial,sans-serif}table{border-collapse:collapse}th,td{border:1px solid #9bb4c0;padding:7px;vertical-align:top}th{background:#d8efed;color:#164b67}td{mso-number-format:"\\@"}</style></head><body><h2>History Catalog - ประวัติการสั่งซื้อสินค้า</h2><table>${tableRows}</table></body></html>`;
  const url=URL.createObjectURL(new Blob(["\ufeff",workbook],{type:"application/vnd.ms-excel;charset=utf-8"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=`FMS-history-catalog${orders.length===1?`-${orders[0].id||"order"}`:""}.xls`;anchor.click();URL.revokeObjectURL(url);
}
let printTarget=null;
function deleteOrder(orderId) {
  const orders = readArray(ORDERS_KEY) || [];
  const index = orders.findIndex((order, orderIndex) => String(order.id || `order-${orderIndex}`) === String(orderId));
  if (index < 0) return;
  orders.splice(index, 1);
  FMSStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  render();
}
let swipeStartX = 0;
let swipeCard = null;
list.addEventListener("pointerdown", (event) => {
  const card = event.target.closest(".order-history-card");
  if (!card || event.target.closest(".order-delete-button")) return;
  swipeStartX = event.clientX;
  swipeCard = card;
  card.classList.add("is-dragging");
});
document.addEventListener("pointermove", (event) => {
  if (!swipeCard) return;
  const distance = Math.min(0, event.clientX - swipeStartX);
  if (Math.abs(event.clientX - swipeStartX) > 8) event.preventDefault();
  swipeCard.style.transform = `translateX(${Math.max(-110, distance)}px)`;
});
document.addEventListener("pointerup", (event) => {
  if (!swipeCard) return;
  const distance = event.clientX - swipeStartX;
  const card = swipeCard;
  card.classList.remove("is-dragging");
  card.style.transform = "";
  if (distance < -60) {
    card.classList.add("is-swipe-ready");
  }
  swipeCard = null;
});
document.addEventListener("pointercancel", () => {
  if (!swipeCard) return;
  swipeCard.classList.remove("is-dragging");
  swipeCard.style.transform = "";
  swipeCard = null;
});
list.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-order]");
  if (!deleteButton) return;
  deleteOrder(deleteButton.dataset.deleteOrder);
});
list.addEventListener("click",(event)=>{
  const exportButton=event.target.closest("[data-export-order]");
  if(exportButton){const order=getOrders().find((item,index)=>String(item.id||`order-${index}`)===exportButton.dataset.exportOrder);if(!order)return;if(exportButton.dataset.exportFormat==="excel")exportOrders([order]);else{printTarget=exportButton.dataset.exportOrder;window.print()}return}
  const productButton=event.target.closest("[data-product-detail]");
  if(productButton){const panel=document.getElementById(productButton.dataset.productDetail),opening=productButton.getAttribute("aria-expanded")!=="true";productButton.setAttribute("aria-expanded",String(opening));panel.hidden=!opening;return}
  const orderButton=event.target.closest("[data-order-detail]");
  if(!orderButton)return;
  const panel=document.getElementById(orderButton.dataset.orderDetail),opening=orderButton.getAttribute("aria-expanded")!=="true";orderButton.setAttribute("aria-expanded",String(opening));panel.hidden=!opening;
});searchInput.addEventListener("input", () => {
  document.getElementById("clearSearch").hidden = !searchInput.value;
  render();
});
document.getElementById("historySearchForm").addEventListener("submit", (event) => { event.preventDefault(); render(); });
document.getElementById("clearSearch").addEventListener("click", (event) => { searchInput.value = ""; event.currentTarget.hidden = true; searchInput.focus(); render(); });
document.getElementById("exportExcel").addEventListener("click",()=>exportOrders(getOrders()));
const printState=[];
window.addEventListener("beforeprint",()=>{printState.length=0;document.querySelectorAll(".order-history-detail,.product-detail-panel").forEach(panel=>{printState.push([panel,panel.hidden]);panel.hidden=false});document.querySelectorAll(".order-history-card").forEach(card=>{const excluded=printTarget!==null&&card.dataset.orderId!==printTarget;card.classList.toggle("print-excluded",excluded);if(!excluded)printState.push([card,null])})});
window.addEventListener("afterprint",()=>{printState.forEach(([element,hidden])=>{if(typeof hidden==="boolean")element.hidden=hidden});document.querySelectorAll(".print-excluded").forEach(card=>card.classList.remove("print-excluded"));printState.length=0;printTarget=null});
document.getElementById("exportPdf").addEventListener("click",()=>{printTarget=null;window.print()});document.getElementById("notificationButton").addEventListener("click", () => { const panel = document.getElementById("notificationPanel"); panel.hidden = !panel.hidden; });
function applyCatalogHistoryLanguage(isEnglish) {
  historyEnglish = isEnglish;
  document.documentElement.lang = isEnglish ? "en" : "th";
  document.querySelector(".activity-kicker").textContent = isEnglish ? "System Activity" : "ประวัติกิจกรรม";
  document.querySelector(".activity-intro h1").textContent = isEnglish ? "Tracking & History" : "คลังยาและเวชภัณฑ์";
  document.querySelector(".history-back span").textContent = catalogText("back");
  document.querySelector(".history-back").setAttribute("aria-label", catalogText("back"));
  document.querySelector(".catalog-label-text").textContent = catalogText("catalog");
  searchInput.placeholder = isEnglish ? "name, date" : "ชื่อสินค้า, วันที่";
  searchInput.setAttribute("aria-label", isEnglish ? "Search order history" : "ค้นหาประวัติการสั่งซื้อ");
  document.querySelector("#notificationPanel strong").textContent = isEnglish ? "Notifications" : "การแจ้งเตือน";
  document.querySelector("#notificationPanel p").textContent = isEnglish ? "Viewing product order history" : "กำลังดูประวัติการสั่งซื้อสินค้า";
  document.getElementById("languageButton").querySelector("span").textContent = isEnglish ? "English" : "ไทย";
  render();
}
document.getElementById("languageButton").addEventListener("click", (event) => {
  applyCatalogHistoryLanguage(!historyEnglish);
});
window.addEventListener("storage", (event) => { if (!event.key || event.key === STOCK_KEY || event.key === ORDERS_KEY) render(); });
window.addEventListener("focus", render);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") render(); });

render();
applyCatalogHistoryLanguage(false);
