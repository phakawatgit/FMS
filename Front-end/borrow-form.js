let borrowFormEnglish = false;
const records=JSON.parse(FMSStorage.getItem("fms-stock-records")||"[]"),grid=document.getElementById("productGrid"),search=document.getElementById("productSearch"),selectedProductCount=document.getElementById("selectedProductCount"),selectedProducts=JSON.parse(FMSStorage.getItem("fms-borrow-products")||"{}"),esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
function render(){selectedProductCount.textContent=Object.values(selectedProducts).filter(item=>(Number(item.quantity)||0)>0).length;const query=search.value.trim().toLowerCase(),items=records.filter(item=>(item.name||item.productName||"").toLowerCase().includes(query));grid.innerHTML=items.length?items.map(item=>{const code=String(item.code),selected=selectedProducts[code],remaining=Math.max(0,(Number(item.total)||0)-(Number(item.used)||0));return`<article class="product-card ${selected?"is-selected":""}" data-product-code="${esc(code)}">${item.image?`<img src="${item.image}" alt="${esc(item.name||item.productName)}">`:`<div class="product-image">รูปภาพสินค้า</div>`}<button class="product-favorite ${selected?"selected":""}" type="button" data-favorite="${esc(code)}" aria-label="เลือกสินค้า">${selected?"★":"☆"}</button><div class="product-info"><strong>${esc(item.name||item.productName||"รายการยา")}</strong><small>รหัสยา: ${esc(item.code)}</small><div>อาการที่ใช้: ${esc(item.symptom||"บรรเทาอาการทั่วไป")}</div><div class="stock-row"><span>ทั้งหมด<br>${item.total||0}</span><span>ใช้/เบิก<br>${item.used||0}</span></div><b class="remaining">เหลือ<br>${remaining}</b><label class="borrow-quantity">จำนวน<input type="number" min="1" value="${selected?.quantity||1}" data-product-quantity="${esc(code)}" ${selected?"":"disabled"}></label></div></article>`}).join(""):"<p>ไม่พบรายการสินค้า</p>"}
function saveSelection(){FMSStorage.setItem("fms-borrow-products",JSON.stringify(selectedProducts))}search.addEventListener("input",render);grid.addEventListener("click",event=>{const button=event.target.closest("[data-favorite]");if(!button)return;const code=button.dataset.favorite;if(selectedProducts[code])delete selectedProducts[code];else selectedProducts[code]={quantity:1};saveSelection();render()});grid.addEventListener("input",event=>{const input=event.target.closest("[data-product-quantity]");if(!input)return;const code=input.dataset.productQuantity;if(selectedProducts[code]){selectedProducts[code].quantity=Math.max(1,Number(input.value)||1);saveSelection()}});document.getElementById("cancelBorrow").addEventListener("click",()=>location.href="./borrow-return.html");document.getElementById("borrowForm").addEventListener("submit",event=>{event.preventDefault();saveBorrowDraft();document.getElementById("borrowSavedModal").hidden=false});render();
function saveBorrowDraft(){const formElement=document.getElementById("borrowForm"),data=Object.fromEntries(new FormData(formElement));data.roles=[...formElement.querySelectorAll('input[name="role"]:checked')].map(input=>input.value);data.items=[...formElement.querySelectorAll('input[name="item"]:checked')].map(input=>input.value);data.role=data.roles[0]||"";data.item=data.items.join("、");data.borrowDate=new Date().toISOString();data.products=selectedProducts;FMSStorage.setItem("fms-borrow-form",JSON.stringify(data))}document.getElementById("selectedProductIndicator")?.addEventListener("click",()=>{saveBorrowDraft();location.href="./borrow-selected.html"});document.getElementById("borrowSavedClose")?.addEventListener("click",()=>document.getElementById("borrowSavedModal").hidden=true);document.getElementById("borrowSavedDismiss")?.addEventListener("click",()=>document.getElementById("borrowSavedModal").hidden=true);document.getElementById("borrowSavedModal")?.addEventListener("click",event=>{if(event.target.id==="borrowSavedModal")event.target.hidden=true});
const dueDateInput = document.getElementById("dueDateInput");
const toDateInputValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
function setDefaultDueDate() {
  const personal = [...document.querySelectorAll('input[name="item"]:checked')].some((input) => input.value === "ส่วนบุคคล");
  const date = new Date();
  date.setDate(date.getDate() + (personal ? 90 : 7));
  dueDateInput.min = toDateInputValue(new Date());
  dueDateInput.value = toDateInputValue(date);
}
setDefaultDueDate();
document.getElementById("borrowForm").addEventListener("change", (event) => {
  if (event.target.matches('input[name="item"]')) setDefaultDueDate();
});
(() => {
  const topbar = document.querySelector("header.topbar");
  if (!topbar) return;
  topbar.classList.add("dashboard-topbar");
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "./dashboard-topbar.css?v=3";
  document.head.appendChild(stylesheet);
})();
// Shared topbar actions for the borrow form page.
document.querySelectorAll(".topbar .export").forEach((button) => button.addEventListener("click", () => window.print()));
function setFieldLabel(selector, text) {
  const label = document.querySelector(selector);
  if (label?.firstChild?.nodeType === Node.TEXT_NODE) label.firstChild.nodeValue = `${text}`;
}
function applyBorrowFormLanguage(isEnglish) {
  borrowFormEnglish = isEnglish;
  document.documentElement.lang = isEnglish ? "en" : "th";
  const borrowHeading = document.querySelector(".borrow-form-page > h1");
  if (borrowHeading) borrowHeading.innerHTML = isEnglish
    ? "Medicine &amp; Medical Supplies<br><span>Borrowing</span>"
    : "การยืมยา และเวชภัณฑ์";
  document.querySelector(".borrow-form-back span").textContent = isEnglish ? "Back to Borrowing & Return" : "กลับหน้าการยืม-คืน";
  document.querySelector(".form-section h2").textContent = isEnglish ? "Borrowing Agreement" : "สัญญาการยืมคืน";
  document.querySelectorAll('.check-row label').forEach((label, index) => { label.lastChild.textContent = (isEnglish ? ["Teacher", "Student", "Internal staff"] : ["อาจารย์", "นักศึกษา", "บุคลากรภายใน"])[index]; });
  ["Full name", "Nickname", "Student ID", "Department", "Phone number"].forEach((text, index) => setFieldLabel(`.form-grid label:nth-child(${index + 1})`, isEnglish ? text : ["ชื่อ-นามสกุล", "ชื่อเล่น", "รหัสนักศึกษา", "สาขา", "เบอร์โทรศัพท์"][index]));
  const branch = document.querySelector('select[name="branch"]');
  if (branch) { branch.options[0].textContent = isEnglish ? "Select department" : "เลือกสาขา"; branch.options[1].textContent = isEnglish ? "Information Technology" : "เทคโนโลยีสารสนเทศ"; branch.options[2].textContent = isEnglish ? "Nursing" : "พยาบาลศาสตร์"; }
  const dateLabel = document.querySelector(".return-date-field");
  if (dateLabel?.firstChild?.nodeType === Node.TEXT_NODE) dateLabel.firstChild.nodeValue = isEnglish ? "Return date" : "วันกำหนดคืนยา และเวชภัณฑ์";
  document.querySelectorAll(".borrow-choice > label").forEach((label, index) => {
    const text = isEnglish ? ["Nursing bag ", "Personal "][index] : ["กระเป๋าพยาบาล ", "ส่วนบุคคล "][index];
    if (label.firstChild?.nodeType === Node.TEXT_NODE) label.firstChild.nodeValue = text;
  });
  document.querySelector('input[name="activity"]').placeholder = isEnglish ? "Activity requiring the nursing bag" : "ชื่อกิจกรรมที่ต้องใช้กระเป๋าพยาบาล";
  document.querySelector('input[name="reason"]').placeholder = isEnglish ? "Symptoms or details" : "อาการหรือรายละเอียด";
  document.querySelectorAll(".borrow-warning").forEach((warning, index) => { warning.innerHTML = isEnglish ? (index === 0 ? "⚠️ Nursing bag return policy<br>Please return the nursing bag within 7 days after borrowing. For an extension, contact the infirmary 1–2 days in advance." : "⚠️ Medical supplies return policy<br>Borrowed supplies must be returned within 3 months. For an extension, contact the infirmary 1–2 weeks in advance.") : (index === 0 ? "⚠️ กำหนดการคืนกระเป๋าพยาบาล<br>กรุณาส่งคืนกระเป๋าพยาบาลภายใน 7 วันหลังจากวันที่ยืม หากต้องการยืมต่อ กรุณาติดต่อห้องพยาบาลล่วงหน้า 1–2 วันก่อนวันครบกำหนดคืน" : "⚠️ กำหนดการคืนเวชภัณฑ์และอุปกรณ์พยาบาล<br>เวชภัณฑ์หรืออุปกรณ์พยาบาลที่ยืมจะต้องส่งคืนภายใน 3 เดือนนับจากวันที่ยืม หากจำเป็นต้องยืมต่อ กรุณาติดต่อห้องพยาบาลล่วงหน้า 1–2 สัปดาห์ก่อนถึงกำหนดคืน"); });
  document.querySelector(".product-heading h2").textContent = isEnglish ? "Medicines & Medical Supplies" : "ยา และเวชภัณฑ์";
  document.querySelector("#productSearch").setAttribute("aria-label", isEnglish ? "Search products" : "ค้นหารายการสินค้า");
  document.querySelector("#productSearch").placeholder = "name, date";
  document.querySelector("#borrowSavedTitle").textContent = isEnglish ? "Borrowing agreement saved" : "บันทึกสัญญาการยืมคืนแล้ว";
  document.querySelector("#borrowSavedTitle + p").textContent = isEnglish ? "Your information has been saved successfully." : "ข้อมูลของคุณถูกบันทึกเรียบร้อยแล้ว";
  document.querySelector("#borrowSavedClose").textContent = isEnglish ? "OK" : "ตกลง";
  document.querySelectorAll(".product-card").forEach((card) => {
    const info = card.querySelector(".product-info");
    if (!info) return;
    const small = info.querySelector("small"); if (small) small.textContent = `${isEnglish ? "Code" : "รหัสยา"}: ${small.textContent.split(": ").slice(1).join(": ")}`;
    const detail = info.querySelector("div"); if (detail) detail.textContent = `${isEnglish ? "Indications" : "อาการที่ใช้"}: ${detail.textContent.split(": ").slice(1).join(": ")}`;
    const stock = info.querySelectorAll(".stock-row span"); if (stock[0]) stock[0].firstChild.textContent = isEnglish ? "Total" : "ทั้งหมด"; if (stock[1]) stock[1].firstChild.textContent = isEnglish ? "Used/Issued" : "ใช้/เบิก";
    const remaining = info.querySelector(".remaining"); if (remaining) remaining.firstChild.textContent = isEnglish ? "Remaining" : "เหลือ";
    const quantity = info.querySelector(".borrow-quantity"); if (quantity?.firstChild?.nodeType === Node.TEXT_NODE) quantity.firstChild.nodeValue = isEnglish ? "Quantity" : "จำนวน";
  });
}
document.querySelector(".topbar .language")?.addEventListener("click", () => {
  applyBorrowFormLanguage(document.documentElement.lang !== "en");
});

const facultyBranchScript = document.createElement("script");
facultyBranchScript.src = "./borrow-form-faculty-branch.js?v=2";
document.body.appendChild(facultyBranchScript);
const facultyBranchStyles = document.createElement("link");
facultyBranchStyles.rel = "stylesheet";
facultyBranchStyles.href = "./borrow-form-faculty-branch.css?v=2";
document.head.appendChild(facultyBranchStyles);

// Remove selections for products that no longer exist in the current stock list,
// then count only selected products currently shown in this form.
const availableProductCodes = new Set(records.map((item) => String(item.code || "")));
Object.keys(selectedProducts).forEach((code) => {
  if (!availableProductCodes.has(String(code))) delete selectedProducts[code];
});
saveSelection();
render();

const lowStockStyles = document.createElement("style");
lowStockStyles.textContent = `.borrow-form-page .remaining.is-low-stock{background:#fff3b0!important;color:#a06a00!important}.borrow-form-page .remaining.is-out-of-stock{background:#ffe2e2!important;color:#c13e3e!important}`;
document.head.appendChild(lowStockStyles);
function updateStockWarnings() {
  grid.querySelectorAll(".product-card").forEach((card) => {
    const code = card.dataset.productCode;
    const item = records.find((row) => String(row.code || "") === String(code));
    const remainingElement = card.querySelector(".remaining");
    if (!item || !remainingElement) return;
    const total = Math.max(0, Number(item.total) || 0);
    const used = Math.max(0, Number(item.used) || 0);
    const remaining = Math.max(0, total - used);
    remainingElement.classList.toggle("is-low-stock", remaining > 0 && remaining <= Math.max(5, total * .2));
    remainingElement.classList.toggle("is-out-of-stock", remaining === 0);
  });
}
const originalBorrowRender = render;
render = () => { originalBorrowRender(); updateStockWarnings(); if (borrowFormEnglish) applyBorrowFormLanguage(true); };
render();
const borrowPageHeading = document.querySelector(".borrow-form-page > h1");
if (borrowPageHeading) applyBorrowFormLanguage(false);
