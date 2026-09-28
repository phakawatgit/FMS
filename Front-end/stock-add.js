const form = document.getElementById("medicineForm");
const imageInput = document.getElementById("imageInput");
const preview = document.getElementById("imagePreview");
const message = document.getElementById("message");
const nameInput = form.elements.name;
const codeInput = form.elements.code;
const returnToCatalog = new URLSearchParams(location.search).get("from") === "catalog";
const editSnapshot = (() => {
  try { return JSON.parse(localStorage.getItem("fms-edit-stock-record") || "null"); } catch { return null; }
})();
const editParams = new URLSearchParams(location.search);
const requestedEditCode = editParams.get("edit") || editParams.get("code") || localStorage.getItem("fms-edit-stock-code") || editSnapshot?.code || "";
const editCode = String(requestedEditCode).trim();
let storedRecords = [];
try {
  storedRecords = JSON.parse(localStorage.getItem("fms-stock-records") || "[]");
} catch {
  storedRecords = [];
}
const normalizeCode = value => String(value ?? "").trim().toLowerCase();
const editRecord = editCode
  ? storedRecords.find(item => normalizeCode(item.code) === normalizeCode(editCode) || normalizeCode(item.name) === normalizeCode(editCode) || normalizeCode(item.productName) === normalizeCode(editCode)) || editSnapshot || null
  : editSnapshot;
let selectedImageData = "";
let selectedImagePromise = Promise.resolve("");

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
imageInput.setAttribute("accept", ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp");

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;
  const extension = file.name.split(".").pop().toLowerCase();
  const allowedExtensions = ["jpg", "jpeg", "png", "webp"];
  if (!allowedImageTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
    imageInput.value = "";
    selectedImageData = "";
    selectedImagePromise = Promise.resolve("");
    preview.textContent = "รองรับเฉพาะ JPG, PNG และ WEBP";
    message.textContent = "กรุณาเลือกไฟล์ JPG, PNG หรือ WEBP";
    message.style.color = "#cf3434";
    return;
  }
  selectedImagePromise = new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const source = new Image();
      source.onload = () => {
        const maxSize = 1200;
        const scale = Math.min(1, maxSize / Math.max(source.naturalWidth, source.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
        canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
        selectedImageData = canvas.toDataURL("image/jpeg", 0.82);
        preview.innerHTML = `<img src="${selectedImageData}" alt="ตัวอย่างรูปยา">`;
        message.textContent = "";
        resolve(selectedImageData);
      };
      source.onerror = reject;
      source.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
});

form.addEventListener("reset", () => setTimeout(() => {
  selectedImageData = "";
  selectedImagePromise = Promise.resolve("");
  preview.textContent = "รูปภาพยา";
  message.textContent = "";
}, 0));

const thaiMedicineNames = {
  "ยาพารา": "paracetamol", "พาราเซตามอล": "paracetamol", "พารา": "paracetamol",
  "ยาแก้ไอ": "cough", "ยาอมแก้เจ็บคอ": "lozenge", "ยาลดกรด": "antacid",
  "ผงเกลือแร่": "ors", "เบต้าดีน": "betadine", "แอม็อกซีซิลลิน": "amoxicillin",
  "อะม็อกซีซิลลิน": "amoxicillin", "ไอบูโพรเฟน": "ibuprofen", "เอทานอล": "ethanol",
  "โออาร์เอส": "ors"
};

function getCodePrefix(value) {
  const raw = value.trim();
  const isEnglish = /^[a-z]/i.test(raw);
  const mapped = (thaiMedicineNames[raw] || raw.replace(/[^a-z]/gi, "")).toLowerCase();
  const first = (mapped || "medicine").charAt(0);
  if (isEnglish) return first.toUpperCase();
  if (/^[เแโใไฤฦ]/.test(raw)) return ({ a: "A", e: "E", i: "I", o: "O", u: "U" }[first] || first.toUpperCase());
  return first.toLowerCase();
}

function getNextMedicineNumber() {
  return Math.max(1, Number(localStorage.getItem("fms-stock-code-sequence")) || 1);
}

function updateMedicineCode() {
  codeInput.value = nameInput.value.trim()
    ? `${getCodePrefix(nameInput.value)}${String(getNextMedicineNumber()).padStart(7, "0")}`
    : "";
}

codeInput.readOnly = true;
nameInput.addEventListener("input", updateMedicineCode);
updateMedicineCode();

if (editRecord) {
  Object.entries(editRecord).forEach(([key, value]) => {
    const field = form.elements[key];
    if (field && key !== "image") field.value = value ?? "";
  });
  codeInput.value = editRecord.code || editCode;
  if (editRecord.image) {
    selectedImageData = editRecord.image;
    preview.innerHTML = `<img src="${editRecord.image}" alt="ตัวอย่างรูปยา">`;
  }
  document.title = "FMS | แก้ไขยา";
  document.querySelector(".form-heading h1")?.replaceChildren("แก้ไขยา");
  document.getElementById("formDescription")?.replaceChildren("แก้ไขข้อมูลสินค้าที่บันทึกไว้");
  document.querySelector(".eyebrow")?.replaceChildren("EDIT MEDICINE");
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.textContent = "บันทึกการแก้ไข";
  const clearButton = document.getElementById("clearButton");
  if (clearButton) clearButton.hidden = true;
  localStorage.removeItem("fms-edit-stock-code");
  localStorage.removeItem("fms-edit-stock-record");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!nameInput.value.trim()) {
    message.textContent = "กรุณากรอกชื่อยา";
    nameInput.focus();
    return;
  }
  try {
    const image = await selectedImagePromise;
    const number = getNextMedicineNumber();
    if (editRecord) codeInput.value = editRecord.code || editCode;
    else codeInput.value = `${getCodePrefix(nameInput.value)}${String(number).padStart(7, "0")}`;
    const total = Number(form.elements.total.value) || 0;
    const used = Number(form.elements.used.value) || 0;
    form.elements.remaining.value = Math.max(0, total - used);
    const data = Object.fromEntries(new FormData(form));
    // This is the single source of truth for both Catalog and Stock.
    // Store numeric inventory values so both screens render the same data.
    data.total = total;
    data.used = Math.min(used, total);
    data.remaining = Math.max(0, data.total - data.used);
    data.status = data.remaining === 0
      ? "หมด"
      : data.remaining <= Math.max(1, Math.ceil(data.total * 0.2))
        ? "ใกล้หมด"
        : "ปกติ";
    data.image = image || selectedImageData || "";
    data.createdAt = editRecord?.createdAt || new Date().toISOString();
    const records = JSON.parse(localStorage.getItem("fms-stock-records") || "[]");
    if (editRecord) {
      const index = records.findIndex((item) => normalizeCode(item.code) === normalizeCode(editCode));
      if (index >= 0) records[index] = { ...records[index], ...data, code: editRecord.code || editCode };
      else records.unshift(data);
    } else records.unshift(data);
    localStorage.setItem("fms-stock-records", JSON.stringify(records));
    localStorage.setItem("fms-stock-code-sequence", String(number + 1));
    localStorage.setItem("fms-stock-filter", "all");
    localStorage.removeItem("fms-edit-stock-code");
    localStorage.removeItem("fms-edit-stock-record");
    message.style.color = "#16823b";
    message.textContent = editRecord ? "แก้ไขรายการยาเรียบร้อยแล้ว" : "บันทึกรายการยาเรียบร้อยแล้ว";
    setTimeout(() => {
      location.href = returnToCatalog ? "./catalog.html?updated=1" : "./stock.html?updated=1";
    }, 300);
  } catch {
    message.textContent = "ไม่สามารถอ่านรูปภาพได้ กรุณาเลือกรูปใหม่อีกครั้ง";
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
