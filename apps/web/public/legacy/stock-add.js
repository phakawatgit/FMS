(async function () {
const form = document.getElementById("medicineForm");
const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("imagePreview");
const message = document.getElementById("message");
const params = new URLSearchParams(location.search);
const returnToCatalog = params.get("from") === "catalog";
const editId = params.get("edit") || params.get("code");
const submit = form.querySelector('[type="submit"]');
let editRecord = null, selectedImageData, saving = false, imageError = "";
let selectedImagePromise = Promise.resolve();
let imageVersion = 0;
form.elements.unit.required = true;
form.elements.code.readOnly = true;
form.elements.code.placeholder = "ระบบออกรหัสเมื่อบันทึก";
form.elements.remaining.readOnly = true;
form.elements.status.disabled = true;
function updateInventory() {
  const total = Number(form.elements.total.value), used = Number(form.elements.used.value);
  const remaining = total - used;
  form.elements.remaining.value = Math.max(0, remaining);
  form.elements.status.value = remaining <= 0 ? "หมด" : remaining <= Math.max(1, Math.ceil(total * .2)) ? "ใกล้หมด" : "ปกติ";
  form.elements.status.dispatchEvent(new Event("change"));
}
["total", "used"].forEach(key => form.elements[key].addEventListener("input", updateInventory));
function showImage(source) {
  preview.replaceChildren();
  if (source) { const image = document.createElement("img"); image.src = source; image.alt = "รูปภาพยา"; preview.append(image); }
  else preview.textContent = "รูปภาพยา";
}
imageInput.accept = "image/jpeg,image/png,image/webp";
imageInput.addEventListener("change", () => {
  const version = ++imageVersion;
  const file = imageInput.files[0];
  imageError = "";
  if (!file) return;
  selectedImagePromise = (async () => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("รองรับเฉพาะ JPG, PNG และ WEBP");
    const url = URL.createObjectURL(file);
    try {
      const source = new Image(); source.src = url; await source.decode();
      const scale = Math.min(1, 1200 / Math.max(source.naturalWidth, source.naturalHeight));
      const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(source.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
      canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", .82);
      if (atob(data.split(",")[1]).length > 2 * 1024 * 1024) throw new Error("รูปภาพหลังย่อต้องไม่เกิน 2 MiB");
      if (version === imageVersion) { selectedImageData = data; showImage(data); message.textContent = ""; }
    } finally { URL.revokeObjectURL(url); }
  })().catch(error => { if (version === imageVersion) { imageError = error.message || "อ่านรูปภาพไม่ได้"; message.textContent = imageError; } });
});
form.addEventListener("reset", () => setTimeout(() => {
  imageVersion++; selectedImageData = undefined; imageError = ""; selectedImagePromise = Promise.resolve();
  showImage(""); message.textContent = ""; updateInventory();
}, 0));
submit.disabled = true;
try {
  if (editId) {
    editRecord = await MedicineAPI.request(`/${encodeURIComponent(editId)}`);
    for (const [key, value] of Object.entries(editRecord)) {
      if (form.elements[key] && key !== "image") { form.elements[key].value = value ?? ""; form.elements[key].dispatchEvent(new Event("change")); }
    }
    form.elements.unit.readOnly = Boolean(editRecord.unit);
    const componentNote = document.createElement('p');
    componentNote.textContent = `ปรับมือ ${editRecord.manualUsed} · จ่ายคนไข้ ${editRecord.dispensed} · ยืมค้าง ${editRecord.borrowed} — การปรับยอดใช้รวมจะเปลี่ยนเฉพาะส่วนปรับมือ`;
    form.elements.used.closest('label').append(componentNote);
    showImage(editRecord.image);
    document.getElementById("formTitle").textContent = "แก้ไขยา";
    document.getElementById("formDescription").textContent = "แก้ไขข้อมูลสินค้าที่บันทึกไว้";
    submit.textContent = "บันทึกการแก้ไข"; document.getElementById("clearButton").hidden = true;
  }
  submit.disabled = false;
} catch (error) { message.textContent = error.message; MedicineAPI.error(error); }
updateInventory();
form.addEventListener("submit", async event => {
  event.preventDefault(); if (saving || submit.disabled) return;
  saving = true;
  const data = Object.fromEntries(new FormData(form));
  delete data.code; delete data.remaining; delete data.status;
  const controls = [...form.querySelectorAll("input,textarea,button,select")].map(control => [control, control.disabled]);
  controls.forEach(([control]) => control.disabled = true);
  message.style.color = "#cf3434"; message.textContent = "กำลังบันทึก…";
  try {
    await selectedImagePromise;
    if (imageError) throw new Error(imageError);
    if (selectedImageData !== undefined) data.image = selectedImageData;
    if(editRecord) {
      const countChanged = ['total','used'].some(k => Number(data[k]) !== editRecord[k]);
      if(countChanged) {data.reason = prompt('เหตุผลการปรับสต็อก'); if(!data.reason?.trim()) throw Error('กรุณาระบุเหตุผลการปรับสต็อก');}
      else {delete data.total;delete data.used;}
      if(data.unit === editRecord.unit) delete data.unit;
    }
    await MedicineAPI.request(editRecord ? `/${encodeURIComponent(editRecord.id)}` : "", { method: editRecord ? "PATCH" : "POST", body: JSON.stringify(data) });
    location.href = returnToCatalog ? "./catalog.html?updated=1" : "./stock.html?updated=1";
  } catch (error) {
    message.textContent = error.message;
    saving = false; controls.forEach(([control, disabled]) => control.disabled = disabled);
  }
});
document.querySelector(".language")?.addEventListener("click", () => {
  const english = document.documentElement.lang !== "en";
  document.documentElement.lang = english ? "en" : "th";
  document.querySelector(".language span").textContent = english ? "English" : "ไทย";
});

document.querySelectorAll('.stock-input input[type="number"]').forEach((input) => {
  input.addEventListener("focus", () => {
    if (input.value === "0") input.select();
  });
});
const universalBell=document.getElementById("notificationButton"),universalPanel=document.getElementById("notificationPanel");universalBell?.addEventListener("click",()=>{universalPanel.hidden=!universalPanel.hidden});document.getElementById("closeNotification")?.addEventListener("click",()=>{universalPanel.hidden=true});
const returnPath=returnToCatalog?"./catalog.html":"./stock.html";const backStock=document.querySelector(".back-stock");backStock?.setAttribute("href",returnPath);backStock?.setAttribute("data-return",returnToCatalog?"catalog":"stock");document.querySelector(".cancel")?.addEventListener("click",()=>{location.href=returnPath});

// PDF/Excel fallback for the stock detail page.
document.querySelectorAll(".topbar .export").forEach((button) => button.addEventListener("click", () => window.print()));

})().catch(MedicineAPI.error);
