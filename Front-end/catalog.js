const grid = document.getElementById("catalogGrid");
const search = document.getElementById("searchInput");
const menu = document.getElementById("filterMenu");
const active = document.getElementById("activeFilter");
const cartCount = document.getElementById("cartCount");
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
const normalize = value => {
  const category = String(value || "").trim().toLowerCase();
  const categoryMap = {
    oral: "oral",
    "ยา กิน": "oral",
    "ยากิน": "oral",
    "ยารับประทาน": "oral",
    "รับประทาน": "oral",
    topical: "topical",
    "ยา ทา": "topical",
    "ยาทา": "topical",
    "ยาใช้ภายนอก": "topical",
    "ใช้ภายนอก": "topical",
    equipment: "equipment",
    medical: "equipment",
    supplies: "equipment",
    "เวชภัณฑ์": "equipment",
    "อุปกรณ์การแพทย์": "equipment",
    "อุปกรณ์การแพทย์และเวชภัณฑ์": "equipment"
  };
  return categoryMap[category] || category;
};
const records = JSON.parse(localStorage.getItem("fms-stock-records") || "[]");
const medicines = records.map(item => ({ ...item, category: normalize(item.category), total: Number(item.total) || 0, used: Number(item.used) || 0, remaining: Math.max(0, (Number(item.total) || 0) - (Number(item.used) || 0)) }));
let filter = "all";
let cart = JSON.parse(localStorage.getItem("fms-catalog-cart") || "{}");
let catalogEnglish = false;
const catalogLabels = {
  all: ["ทั้งหมด", "All"],
  oral: ["ยารับประทาน", "Oral medicine"],
  topical: ["ยาใช้ภายนอก", "Topical medicine"],
  equipment: ["อุปกรณ์การแพทย์และเวชภัณฑ์", "Medical supplies"],
  add: ["＋ เพิ่มยา", "＋ Add medicine"],
  remaining: ["เหลือ", "Remaining"],
  code: ["รหัสยา", "Code"],
  symptom: ["อาการที่ใช้", "Indications"],
  usage: ["คำแนะนำ", "Usage"],
  noItems: ["ยังไม่มีรายการสินค้าในแคตตาล็อก", "No products in the catalog"]
};
const catalogLabel = key => catalogLabels[key]?.[catalogEnglish ? 1 : 0] || key;
const cartToast = document.createElement("div"); cartToast.className = "cart-toast"; cartToast.setAttribute("role", "status"); document.body.append(cartToast);
let cartToastTimer;
function showCartToast(quantity) { cartToast.textContent = `เพิ่มลงตะกร้าแล้ว จำนวน ${quantity} ชิ้น`; cartToast.classList.add("show"); clearTimeout(cartToastTimer); cartToastTimer = setTimeout(() => cartToast.classList.remove("show"), 1400); }
const quantityModal = document.createElement("div"); quantityModal.className = "quantity-modal-backdrop"; quantityModal.hidden = true; quantityModal.innerHTML = '<section class="quantity-modal" role="dialog" aria-modal="true" aria-labelledby="quantityModalTitle"><button class="quantity-modal-close" type="button" aria-label="ปิด">×</button><h2 id="quantityModalTitle">ระบุจำนวนสินค้าที่ต้องการ</h2><p id="quantityModalProduct"></p><input id="quantityModalInput" type="number" min="1" step="1" value="1" inputmode="numeric"><div class="quantity-modal-options" role="group" aria-label="ตัวเลือกสินค้า"><button type="button" data-modal-option="แผง">แผง</button><button type="button" data-modal-option="ขวด">ขวด</button><button type="button" data-modal-option="กล่อง">กล่อง</button><button type="button" data-modal-option="ลัง">ลัง</button></div><div class="quantity-modal-actions"><button class="quantity-modal-cancel" type="button">ยกเลิก</button><button class="quantity-modal-confirm" type="button">เพิ่มลงตะกร้า</button></div></section>'; document.body.append(quantityModal);
let quantityModalCode = "", quantityModalOption = "แผง";
const quantityModalInput = quantityModal.querySelector("#quantityModalInput");
function openQuantityModal(code) { const item = medicines.find(row => String(row.code) === String(code)); quantityModalCode = code; quantityModalOption = cart[code]?.option || "แผง"; quantityModal.querySelector("#quantityModalProduct").textContent = item?.name || item?.productName || "สินค้า"; quantityModalInput.value = cart[code]?.quantity || 1; quantityModal.querySelectorAll("[data-modal-option]").forEach(button => button.classList.toggle("selected", button.dataset.modalOption === quantityModalOption)); quantityModal.hidden = false; quantityModalInput.focus(); quantityModalInput.select(); }
function closeQuantityModal() { quantityModal.hidden = true; quantityModalCode = ""; }
function confirmQuantityModal() { const quantity = Math.max(1, Number(quantityModalInput.value) || 1); cart[quantityModalCode] = { quantity, option: quantityModalOption }; localStorage.setItem("fms-catalog-cart", JSON.stringify(cart)); updateCartCount(); render(); showCartToast(quantity); closeQuantityModal(); }
quantityModal.querySelectorAll("[data-modal-option]").forEach(button => button.addEventListener("click", () => { quantityModalOption = button.dataset.modalOption; quantityModal.querySelectorAll("[data-modal-option]").forEach(option => option.classList.toggle("selected", option === button)); })); quantityModal.querySelector(".quantity-modal-close").addEventListener("click", closeQuantityModal); quantityModal.querySelector(".quantity-modal-cancel").addEventListener("click", closeQuantityModal); quantityModal.querySelector(".quantity-modal-confirm").addEventListener("click", confirmQuantityModal); quantityModal.addEventListener("click", event => { if (event.target === quantityModal) closeQuantityModal(); }); quantityModalInput.addEventListener("keydown", event => { if (event.key === "Enter") confirmQuantityModal(); if (event.key === "Escape") closeQuantityModal(); });

function updateCartCount() { const count = Object.values(cart).filter(item => (Number(item.quantity) || 0) > 0).length; cartCount.textContent = count > 99999 ? "100000+" : count; cartCount.classList.toggle("wide", count >= 10); }
function render() {
  const query = search.value.trim().toLowerCase();
  const list = medicines.filter(item => (filter === "all" || item.category === filter) && `${item.name || ""} ${item.productName || ""} ${item.code || ""}`.toLowerCase().includes(query));
  grid.innerHTML = list.length ? list.map(item => `<article class="catalog-card" data-detail-code="${escapeHtml(item.code)}" tabindex="0" role="link"><div class="catalog-image">${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}">` : "<span>💊</span>"}<i>›</i></div><div class="catalog-info"><h2>${escapeHtml(item.name || item.productName || (catalogEnglish ? "Medicine" : "รายการยา"))}</h2><p>${escapeHtml(item.genericName || "")}</p><p>${catalogLabel("code")}: ${escapeHtml(item.code || (catalogEnglish ? "No code" : "ไม่มีรหัส"))}</p><p class="description">${catalogLabel("symptom")}: ${escapeHtml(item.symptom || (catalogEnglish ? "General relief" : "บรรเทาอาการทั่วไป"))}<br>${catalogLabel("usage")}: ${escapeHtml(item.usage || (catalogEnglish ? "Use as directed on the label" : "รับประทานตามฉลากยา"))}</p><div class="order-row"><strong>${catalogLabel("remaining")} ${item.remaining}</strong><button type="button" data-code="${escapeHtml(item.code)}" data-delta="-1">−</button><span>${cart[item.code]?.quantity || 0}/100</span><button type="button" data-code="${escapeHtml(item.code)}" data-delta="1">＋</button><small>${escapeHtml(item.unit || "Unit")}</small></div><button class="cart-add" type="button" data-add="${escapeHtml(item.code)}" data-code="${escapeHtml(item.code)}"><svg class="catalog-cart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h2l1.6 8.2a2 2 0 0 0 2 1.6h6.8a2 2 0 0 0 1.9-1.4L20 8H6.6"/><path d="M9 19.5h.01M17 19.5h.01"/></svg></button></div></article>`).join("") : `<p class="empty">${catalogLabel("noItems")}</p>`;
}
function setFilter(value, label) { filter = value; active.textContent = label; active.hidden = false; menu.querySelectorAll("button[data-filter]").forEach(button => button.classList.toggle("active", button.dataset.filter === value)); menu.hidden = true; render(); }
menu.addEventListener("click", event => { const button = event.target.closest("button[data-filter]"); if (button) setFilter(button.dataset.filter, button.textContent.replace("● ", "")); });
document.getElementById("filterToggle").addEventListener("click", () => { menu.hidden = !menu.hidden; });
search.addEventListener("input", render);
document.getElementById("addButton").addEventListener("click", () => { location.href = "./stock-add.html?from=catalog"; });
document.querySelector(".cart-button")?.addEventListener("click", () => { location.href = "./catalog-cart.html"; });
menu.querySelector('button[data-filter="all"]')?.classList.add("active");
grid.addEventListener("click", event => {
  const card = event.target.closest(".catalog-card[data-detail-code]");
  if (card && !event.target.closest("button")) {
    location.href = `./catalog-detail.html?code=${encodeURIComponent(card.dataset.detailCode)}`;
    return;
  }
  const add = event.target.closest("button[data-add]");
  if (add) { event.preventDefault(); event.stopPropagation(); openQuantityModal(add.dataset.code); return; }
  const change = event.target.closest("button[data-code]");
  const code = (add || change)?.dataset.code;
  if (!code) return;
  cart[code] = cart[code] || { quantity: 0 };
  cart[code].quantity = Math.max(0, cart[code].quantity + (add ? 1 : Number(change.dataset.delta)));
  if (!cart[code].quantity) delete cart[code];
  localStorage.setItem("fms-catalog-cart", JSON.stringify(cart));
  updateCartCount();
  render();
  if (add) showCartToast(cart[code]?.quantity || 0);
});
grid.addEventListener("keydown", event => {
  const card = event.target.closest(".catalog-card[data-detail-code]");
  if (card && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    location.href = `./catalog-detail.html?code=${encodeURIComponent(card.dataset.detailCode)}`;
  }
});
function applyCatalogLanguage(isEnglish) {
  catalogEnglish = isEnglish;
  document.documentElement.lang = isEnglish ? "en" : "th";
  document.getElementById("addButton").textContent = catalogLabel("add");
  document.getElementById("filterToggle").setAttribute("aria-label", isEnglish ? "Open filters" : "เปิดตัวกรอง");
  document.querySelectorAll("#filterMenu button[data-filter]").forEach(button => { button.textContent = `● ${catalogLabel(button.dataset.filter)}`; });
  active.textContent = catalogLabel(filter);
  render();
}
document.querySelector(".language")?.addEventListener("click", () => { applyCatalogLanguage(document.documentElement.lang !== "en"); });
updateCartCount();
render();
const bellButton=document.querySelector(".bell"),languageButton=document.querySelector(".language");if(bellButton)bellButton.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 17h12l-1.4-2.2V10a4.6 4.6 0 0 0-9.2 0v4.8L6 17Zm4 2a2 2 0 0 0 4 0"/></svg><b>6</b>';if(languageButton)languageButton.innerHTML='<span>ไทย</span>';
const stockHeaderActions=document.querySelector(".actions");if(stockHeaderActions){stockHeaderActions.innerHTML='<a class="menu-button" href="./menu.html" aria-label="กลับไปหน้าเมนู"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx=".7"/><rect x="14" y="3" width="7" height="7" rx=".7"/><rect x="3" y="14" width="7" height="7" rx=".7"/><rect x="14" y="14" width="7" height="7" rx=".7"/></svg></a><button id="exportExcel" class="export excel" type="button">Excel</button><button id="exportPdf" class="export pdf" type="button">PDF</button><button id="notificationButton" class="bell" type="button" aria-label="การแจ้งเตือน"><svg viewBox="0 0 24 24"><path d="M6 17h12l-1.4-2.2V10a4.6 4.6 0 0 0-9.2 0v4.8L6 17Zm4 2a2 2 0 0 0 4 0"/></svg><b>6</b></button><button id="languageButton" class="language" type="button"><span>ไทย</span></button>'};document.getElementById("languageButton")?.addEventListener("click",()=>{applyCatalogLanguage(document.documentElement.lang!=="en");});document.getElementById("exportPdf")?.addEventListener("click",()=>window.print());
const stockNotification=document.createElement("aside");stockNotification.id="notificationPanel";stockNotification.className="notification-panel";stockNotification.hidden=true;stockNotification.innerHTML='<button id="closeNotification" type="button">×</button><strong>การแจ้งเตือน</strong><p>มีรายการยาใกล้หมดอายุและสต็อกต่ำ</p>';document.body.append(stockNotification);document.getElementById("notificationButton")?.addEventListener("click",()=>{stockNotification.hidden=!stockNotification.hidden});document.getElementById("closeNotification")?.addEventListener("click",()=>{stockNotification.hidden=true});
document.head.insertAdjacentHTML("beforeend","<style>.notification-panel{position:fixed;z-index:10;right:1rem;top:4.5rem;width:min(20rem,calc(100vw - 2rem));padding:1rem;border:1px solid #91b2ff;border-radius:.7rem;background:#fff;box-shadow:0 .8rem 2rem #0003}.notification-panel button{float:right;border:0;background:transparent;font-size:1.2rem;cursor:pointer}.notification-panel p{margin:.5rem 0 0;color:#71809b}</style>");document.getElementById("exportExcel")?.addEventListener("click",()=>{const csv=["Name,Code,Category,Total,Used,Remaining",...records.map(item=>[item.name||item.productName||"",item.code||"",item.category||"",item.total||0,item.used||0,Math.max(0,(Number(item.total)||0)-(Number(item.used)||0))].join(","))].join("\n"),link=document.createElement("a");link.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv"}));link.download="fms-catalog.csv";link.click();URL.revokeObjectURL(link.href)});

document.head.insertAdjacentHTML("beforeend", '<link rel="stylesheet" href="./dashboard-topbar.css?v=1">');
document.querySelector(".topbar")?.classList.add("dashboard-topbar");
