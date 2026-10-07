const form=document.getElementById("visitForm"),languageButton=document.getElementById("languageButton"),noticeButton=document.getElementById("noticeButton"),notificationPanel=document.getElementById("notificationPanel"),closeNotifications=document.getElementById("closeNotifications"),visitorOptions=[...document.querySelectorAll(".visitor-option")],visitorDetail=document.getElementById("visitorDetail"),statusChecks=[...document.querySelectorAll(".status input")],referralHospital=document.getElementById("referralHospitalField"),message=document.getElementById("formMessage");let language="th",visitorType="";
const text={th:{title:"บันทึกการเข้าห้องพยาบาล",typeInfo:"รอบระเบียบ",historyLink:"ดูประวัติ",formTitle:"ฟอร์มการเข้าใช้ห้องพยาบาล",student:"บุคลากรภายใน",studentHint:"เช่น อาจารย์, นักศึกษา",guest:"บุคลากรภายนอก",guestHint:"เช่น ผู้รับเหมา, ผู้มาติดต่อ",firstName:"ชื่อ",lastName:"นามสกุล",nickname:"ชื่อเล่น",age:"อายุ",studentId:"รหัสนักศึกษา",branch:"สาขา",gender:"เพศ",blood:"กรุ๊ปเลือด",weight:"น้ำหนัก",height:"ส่วนสูง",symptom:"อาการ",vitals:"ผลการวัดความดัน",medicine:"ยาที่ได้รับ",quantity:"จำนวนยา /หน่วย",status:"สถานะ",normal:"ปกติ",observe:"รอดูอาการ",refer:"ส่งโรงพยาบาล",cancel:"ยกเลิก",save:"บันทึก",saved:"บันทึกข้อมูลการเข้าห้องพยาบาลเรียบร้อย"},en:{title:"Infirmary Visit",typeInfo:"Visit type",historyLink:"View history",formTitle:"Infirmary visit form",student:"Internal visitor",studentHint:"e.g. teacher, student",guest:"External visitor",guestHint:"e.g. contractor, visitor",firstName:"First name",lastName:"Last name",nickname:"Nickname",age:"Age",studentId:"Student ID",branch:"Department",gender:"Gender",blood:"Blood type",weight:"Weight",height:"Height",symptom:"Symptoms",vitals:"Vital signs",medicine:"Medicine given",quantity:"Medicine quantity",status:"Status",normal:"Normal",observe:"Observation",refer:"Hospital referral",cancel:"Cancel",save:"Save",saved:"Infirmary visit saved"}};
function renderLanguage(){const t=text[language];document.documentElement.lang=language;document.querySelectorAll("[data-i18n]").forEach(el=>el.textContent=t[el.dataset.i18n]);languageButton.querySelector("span").textContent=language==="th"?"ไทย":"English"}
noticeButton.addEventListener("click",()=>{notificationPanel.hidden=!notificationPanel.hidden;noticeButton.setAttribute("aria-expanded",String(!notificationPanel.hidden))});closeNotifications.addEventListener("click",()=>{notificationPanel.hidden=true;noticeButton.setAttribute("aria-expanded","false")});
const statusColors={normal:"#2f9e55",observe:"#e99a1f",refer:"#db4545"};function updateStatusColor(current){if(current.checked){statusChecks.forEach(item=>{if(item!==current)item.checked=false});form.style.setProperty("--status-shadow",statusColors[current.value])}else{form.style.setProperty("--status-shadow","#c5c6ca")}const isRefer=current.checked&&current.value==="refer",hospitalInput=referralHospital.querySelector("input");referralHospital.hidden=!isRefer;hospitalInput.disabled=!isRefer;hospitalInput.required=isRefer;if(isRefer)hospitalInput.focus()}statusChecks.forEach(item=>item.addEventListener("change",()=>updateStatusColor(item)));
function syncReferralHospital(){const refer=statusChecks.find(item=>item.value==="refer"),hospitalInput=referralHospital.querySelector("input"),isRefer=refer.checked;referralHospital.hidden=!isRefer;referralHospital.style.display=isRefer?"block":"none";hospitalInput.disabled=!isRefer;hospitalInput.required=isRefer;if(isRefer)hospitalInput.focus()}form.querySelector(".status").after(referralHospital);form.addEventListener("click",event=>{if(event.target.closest(".status label"))setTimeout(syncReferralHospital,0)});statusChecks.forEach(item=>item.addEventListener("change",syncReferralHospital));
form.addEventListener("reset",()=>setTimeout(()=>{form.style.setProperty("--status-shadow","#c5c6ca");const hospitalInput=referralHospital.querySelector("input");referralHospital.hidden=true;referralHospital.style.display="none";hospitalInput.disabled=true;hospitalInput.required=false},0));
visitorOptions.forEach(option=>option.querySelector(".visitor-check").addEventListener("change",event=>{const checked=event.target.checked;visitorOptions.forEach(item=>{const selected=item===option&&checked;item.querySelector(".visitor-check").checked=selected;item.classList.toggle("is-selected",selected)});visitorType=checked?option.dataset.type:"";visitorDetail.disabled=!checked;visitorDetail.name=visitorType==="guest"?"visitorDetailExternal":"visitorDetail";visitorDetail.placeholder=visitorType==="guest"?"เช่น ผู้รับเหมา, ผู้มาติดต่อ":visitorType==="student"?"เช่น อาจารย์, นักศึกษา":"เลือกประเภทบุคลากรก่อน";if(!checked)visitorDetail.value="";document.querySelector("[name=studentId]").disabled=visitorType==="guest";document.querySelector("[name=studentId]").placeholder=visitorType==="guest"?"ไม่จำเป็น":""}));
languageButton.addEventListener("click",()=>{language=language==="th"?"en":"th";renderLanguage()});document.getElementById("cancelButton").addEventListener("click",()=>{message.textContent="";visitorType="";visitorOptions.forEach(item=>{item.classList.remove("is-selected");item.querySelector(".visitor-check").checked=false});visitorDetail.disabled=true;visitorDetail.value="";visitorDetail.placeholder="เลือกประเภทบุคลากรก่อน"});form.addEventListener("submit",event=>{event.preventDefault();if(!visitorType){message.textContent=language==="th"?"กรุณาเลือกประเภทบุคลากรก่อนบันทึก":"Please select a visitor type before saving";message.style.color="#c43a3a";return}const selectedStatus=statusChecks.find(item=>item.checked)?.value;if(!selectedStatus){message.textContent=language==="th"?"กรุณาเลือกสถานะก่อนบันทึก":"Please select a status before saving";message.style.color="#c43a3a";return}const record={...Object.fromEntries(new FormData(form)),visitorType,createdAt:new Date().toISOString()};const records=JSON.parse(FMSStorage.getItem("fms-infirmary-visits")||"[]");records.unshift(record);FMSStorage.setItem("fms-infirmary-visits",JSON.stringify(records));window.location.href=selectedStatus==="observe"?"./pending-assessment.html":"./infirmary-visit-history.html"});renderLanguage();
// PDF/Excel fallback for the infirmary visit detail page.
document.querySelectorAll(".topbar .export").forEach((button) => button.addEventListener("click", () => window.print()));

const medicationList = document.getElementById("medicationList");
const addMedicationButton = document.getElementById("addMedicationButton");
function readStockMedicines() {
  try {
    const records = JSON.parse(FMSStorage.getItem("fms-stock-records") || "[]");
    return records.filter((record) => record.code).map((record) => ({
      code: String(record.code),
      name: String(record.name || record.productName || record.genericName || record.code),
      unit: String(record.unit || "หน่วย"),
      remaining: Math.max(0, Number(record.remaining) || 0),
    }));
  } catch {
    return [];
  }
}
function createMedicationRow(selectedCode = "", quantity = "") {
  const row = document.createElement("div");
  row.className = "medication-row";
  const medicineField = document.createElement("label");
  medicineField.className = "medication-field";
  const medicineLabel = document.createElement("span");
  medicineLabel.textContent = language === "th" ? "ยา" : "Medicine";
  const select = document.createElement("select");
  select.dataset.medicineCode = "true";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = language === "th" ? "เลือกยา" : "Select medicine";
  select.append(placeholder);
  const medicines = readStockMedicines();
  for (const medicine of medicines) {
    const option = document.createElement("option");
    option.value = medicine.code;
    option.textContent = `${medicine.name} · ${language === "th" ? "เหลือ" : "left"} ${medicine.remaining} ${medicine.unit}`;
    option.disabled = medicine.remaining < 1;
    select.append(option);
  }
  select.value = selectedCode;
  medicineField.append(medicineLabel, select);

  const quantityField = document.createElement("label");
  quantityField.className = "medication-field";
  const quantityLabel = document.createElement("span");
  quantityLabel.textContent = language === "th" ? "จำนวน" : "Quantity";
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.step = "1";
  input.inputMode = "numeric";
  input.placeholder = "0";
  input.value = quantity;
  input.dataset.medicineQuantity = "true";
  quantityField.append(quantityLabel, input);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "medication-remove";
  remove.dataset.removeMedication = "true";
  remove.textContent = language === "th" ? "ลบ" : "Remove";
  row.append(medicineField, quantityField, remove);
  return row;
}
function renderMedicineOptions() {
  if (!medicationList) return;
  const rows = [...medicationList.querySelectorAll(".medication-row")].map((row) => ({
    code: row.querySelector("[data-medicine-code]").value,
    quantity: row.querySelector("[data-medicine-quantity]").value,
  }));
  medicationList.replaceChildren(...(rows.length ? rows : [{ code: "", quantity: "" }]).map((row) => createMedicationRow(row.code, row.quantity)));
  addMedicationButton.textContent = language === "th" ? "＋ เพิ่มยา" : "＋ Add medicine";
}
renderMedicineOptions();
form.addEventListener("reset", () => setTimeout(() => medicationList.replaceChildren(createMedicationRow()), 0));
addMedicationButton.addEventListener("click", () => {
  if (medicationList.children.length >= 50) return;
  const row = createMedicationRow();
  medicationList.append(row);
  row.querySelector("select").focus();
});
medicationList.addEventListener("click", (event) => {
  if (!event.target.matches("[data-remove-medication]")) return;
  event.target.closest(".medication-row").remove();
  if (!medicationList.children.length) medicationList.append(createMedicationRow());
});
const isVisitorAccount = (() => {
  try { return JSON.parse(sessionStorage.getItem("fms-admin-session") || "null")?.role === "visitor"; }
  catch { return false; }
})();
if (isVisitorAccount) {
  form.querySelectorAll("input, select, textarea, button").forEach((control) => { control.disabled = true; });
  message.textContent = language === "th" ? "บัญชี Visitor ดูข้อมูลได้อย่างเดียว ไม่สามารถกรอกหรือบันทึกข้อมูลคนไข้ได้" : "Visitor accounts can view records but cannot enter or save patient data.";
  message.style.color = "#555";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}

// Save the visit and all medication lines in one database transaction.
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!visitorType) {
    message.textContent = "กรุณาเลือกประเภทบุคลากรก่อนบันทึก";
    message.style.color = "#c43a3a";
    return;
  }
  const selectedStatus = statusChecks.find((item) => item.checked)?.value;
  if (!selectedStatus) {
    message.textContent = "กรุณาเลือกสถานะก่อนบันทึก";
    message.style.color = "#c43a3a";
    return;
  }
  const medicinesByCode = new Map(readStockMedicines().map((item) => [item.code, item]));
  const medications = [];
  for (const row of medicationList.querySelectorAll(".medication-row")) {
    const code = row.querySelector("[data-medicine-code]").value;
    const rawQuantity = row.querySelector("[data-medicine-quantity]").value;
    if (!code && !rawQuantity) continue;
    const quantity = Number(rawQuantity);
    const medicine = medicinesByCode.get(code);
    if (!medicine || !Number.isSafeInteger(quantity) || quantity <= 0) {
      message.textContent = "กรุณาเลือกยาและระบุจำนวนเต็มมากกว่า 0 ในแต่ละรายการ";
      message.style.color = "#c43a3a";
      return;
    }
    const existing = medications.find((item) => item.code === code);
    if (existing) existing.quantity += quantity;
    else medications.push({ code, name: medicine.name, unit: medicine.unit, quantity });
  }
  const record = {
    ...Object.fromEntries(new FormData(form)),
    visitorType,
    createdAt: new Date().toISOString(),
    medications,
    medicine: medications.map((item) => item.name).join(", "),
    quantity: medications.map((item) => `${item.quantity} ${item.unit}`).join(", "),
  };
  const saveButton = form.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  message.textContent = "กำลังบันทึกข้อมูล...";
  message.style.color = "#555";
  try {
    await FMSStorage.saveInfirmaryVisit(record);
    window.location.href = selectedStatus === "observe" ? "./pending-assessment.html" : "./infirmary-visit-history.html";
  } catch {
    message.textContent = "บันทึกไม่สำเร็จ ข้อมูลยังไม่ได้รับการยืนยันในฐานข้อมูล กรุณาลองอีกครั้ง";
    message.style.color = "#c43a3a";
    saveButton.disabled = false;
  }
}, true);

window.addEventListener("storage", (event) => { if (event.key === "fms-stock-records") renderMedicineOptions(); });
window.addEventListener("focus", renderMedicineOptions);
languageButton.addEventListener("click", () => setTimeout(renderMedicineOptions, 0));
