const list = document.getElementById("assessmentList");
const allRecords = JSON.parse(FMSStorage.getItem("fms-infirmary-visits") || "[]");
const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
}[char]));
const save = () => FMSStorage.setItem("fms-infirmary-visits", JSON.stringify(allRecords));
const updateRecord = (id, changes) => {
  const record = allRecords.find((item) => item.createdAt === id);
  if (!record) return;
  Object.assign(record, changes);
  save();
};

function staffLabel(record, kind) {
  if (kind === "responsible" && !record.responsibleFromDutyShift) return "ไม่พบข้อมูลเข้าเวร";
  const name = kind === "entered" ? record.enteredByName : record.responsibleName;
  const nickname = kind === "entered" ? record.enteredByNickname : record.responsibleNickname;
  return name ? `${name}${nickname ? ` (${nickname})` : ""}` : "-";
}

function render() {
  const records = allRecords.filter((record) => record.status === "observe");
  list.innerHTML = records.length ? records.map((record) => {
    const name = escapeHtml([record.firstName, record.lastName].filter(Boolean).join(" ") || "ไม่ระบุชื่อ");
    const symptom = escapeHtml(record.symptom || "ไม่ระบุอาการ");
    const when = record.createdAt ? new Date(record.createdAt).toLocaleString("th-TH") : "";
    return `<article class="assessment-card" data-id="${escapeHtml(record.createdAt)}">
      <h2>${name}</h2><time>${escapeHtml(when)}</time><p>อาการ ${symptom}</p>
      <p>ผู้บันทึก: ${escapeHtml(staffLabel(record, "entered"))}</p>
      <p>ผู้รับผิดชอบตามเวร: ${escapeHtml(staffLabel(record, "responsible"))}</p>
      <div class="status"><label><input type="checkbox" value="normal" /><i></i>ปกติ</label><label><input type="checkbox" value="observe" checked /><i></i>รอดูอาการ</label><label><input type="checkbox" value="refer" /><i></i>ส่งโรงพยาบาล</label></div>
      <div class="hospital-entry"><input type="text" placeholder="ระบุชื่อโรงพยาบาล" aria-label="ชื่อโรงพยาบาล" /><button type="button">บันทึกส่งต่อ</button></div>
    </article>`;
  }).join("") : '<div class="empty">ยังไม่มีรายการรอประเมิน</div>';
}

list.addEventListener("change", (event) => {
  const input = event.target;
  if (!input.matches(".status input")) return;
  const card = input.closest(".assessment-card");
  const checks = [...card.querySelectorAll(".status input")];
  const hospital = card.querySelector(".hospital-entry");
  checks.forEach((check) => { if (check !== input) check.checked = false; });
  if (input.value === "normal" && input.checked) {
    updateRecord(card.dataset.id, { status: "normal" });
    render();
  } else if (input.value === "refer" && input.checked) {
    hospital.classList.add("is-open");
    hospital.querySelector("input").focus();
  } else if (input.value === "observe") {
    hospital.classList.remove("is-open");
  }
});

list.addEventListener("click", (event) => {
  if (!event.target.matches(".hospital-entry button")) return;
  const card = event.target.closest(".assessment-card");
  const field = card.querySelector(".hospital-entry input");
  const hospitalName = field.value.trim();
  if (!hospitalName) { field.focus(); return; }
  updateRecord(card.dataset.id, { status: "refer", hospitalName });
  render();
});

render();
