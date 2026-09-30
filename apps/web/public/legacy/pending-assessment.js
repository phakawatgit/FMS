const list = document.getElementById("assessmentList");
let allRecords = [];
let saving = false;
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
function render() {
  const records = allRecords.filter(record => record.status === "observe");
  list.innerHTML = records.length ? records.map(record => `<article class="assessment-card" data-id="${escapeHtml(record.id)}">
    <h2>${escapeHtml([record.firstName, record.lastName].filter(Boolean).join(" "))}</h2>
    <time>${escapeHtml(new Date(record.createdAt).toLocaleString("th-TH"))}</time><p>อาการ ${escapeHtml(record.symptom)}</p>
    <div class="status"><label><input type="checkbox" value="normal"><i></i>ปกติ</label><label><input type="checkbox" value="observe" checked><i></i>รอดูอาการ</label><label><input type="checkbox" value="refer"><i></i>ส่งโรงพยาบาล</label></div>
    <div class="hospital-entry"><input type="text" placeholder="ระบุชื่อโรงพยาบาล" aria-label="ชื่อโรงพยาบาล"><button type="button">บันทึกส่งต่อ</button></div>
    <p class="save-error" role="alert"></p></article>`).join("") : '<div class="empty">ยังไม่มีรายการรอประเมิน</div>';
}
async function loadVisits() {
  list.textContent = "กำลังโหลดข้อมูล…";
  try { allRecords = await window.infirmaryApi(); render(); }
  catch (error) { list.innerHTML = `<div class="empty">${escapeHtml(error.message)} <button type="button" data-retry>ลองอีกครั้ง</button></div>`; }
}
async function updateRecord(card, changes) {
  if (saving) return;
  saving = true;
  const controls = [...list.querySelectorAll("input,button")];
  controls.forEach(control => { control.disabled = true; });
  card.querySelector(".save-error").textContent = "กำลังบันทึก…";
  try {
    const saved = await window.infirmaryApi(`/${encodeURIComponent(card.dataset.id)}`, { method: "PATCH", body: JSON.stringify({ ...changes }) });
    allRecords = allRecords.map(record => record.id === saved.id ? saved : record);
    render();
  } catch (error) {
    card.querySelector(".save-error").textContent = error.message;
    card.querySelectorAll('.status input').forEach(input => { input.checked = input.value === "observe"; });
  } finally {
    saving = false;
    controls.forEach(control => { control.disabled = false; });
  }
}
list.addEventListener("change", event => {
  const input = event.target;
  if (!input.matches(".status input") || saving) return;
  const card = input.closest(".assessment-card");
  const hospital = card.querySelector(".hospital-entry");
  card.querySelectorAll(".status input").forEach(check => { if (check !== input) check.checked = false; });
  if (input.value === "normal" && input.checked) updateRecord(card, { status: "normal" });
  else {
    hospital.classList.toggle("is-open", input.value === "refer" && input.checked);
    if (input.value === "refer" && input.checked) hospital.querySelector("input").focus();
    if (!input.checked) card.querySelector('[value="observe"]').checked = true;
  }
});
list.addEventListener("click", event => {
  if (event.target.closest("[data-retry]")) { loadVisits(); return; }
  if (!event.target.matches(".hospital-entry button")) return;
  const card = event.target.closest(".assessment-card");
  const field = card.querySelector(".hospital-entry input");
  if (!field.value.trim()) { field.focus(); return; }
  updateRecord(card, { status: "refer", hospitalName: field.value.trim() });
});
loadVisits();
