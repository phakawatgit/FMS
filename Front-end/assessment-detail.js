const target = document.getElementById("detail");
const id = new URLSearchParams(location.search).get("id");
const record = JSON.parse(FMSStorage.getItem("fms-infirmary-visits") || "[]").find((item) => item.createdAt === id);
const escapeHtml = (value) => String(value || "-").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
}[char]));

if (!record) {
  target.className = "empty";
  target.textContent = "ไม่พบข้อมูลรายการนี้";
} else {
  const staff = (kind) => {
    if (kind === "responsible" && !record.responsibleFromDutyShift) return "ไม่พบข้อมูลเข้าเวร";
    const name = kind === "entered" ? record.enteredByName : record.responsibleName;
    const nickname = kind === "entered" ? record.enteredByNickname : record.responsibleNickname;
    return name ? `${name}${nickname ? ` (${nickname})` : ""}` : "-";
  };
  const facultyNames = { engineering: "หลักสูตรวิศวกรรมศาสตร์", agriculture: "หลักสูตรเทคโนโลยีการเกษตรและวิทยาศาสตร์", business: "หลักสูตรบริหารธุรกิจและนวัตกรรม" };
  const fields = [
    ["ชื่อ-นามสกุล", [record.firstName, record.lastName].filter(Boolean).join(" ")],
    ["ชื่อเล่น", record.nickname], ["อายุ", record.age && `${record.age} ปี`],
    ["รหัสนักศึกษา", record.studentId], ["หลักสูตร", facultyNames[record.faculty] || record.faculty], ["สาขา", record.branch], ["เพศ", record.gender],
    ["กรุ๊ปเลือด", record.blood], ["น้ำหนัก", record.weight && `${record.weight} กก.`],
    ["ส่วนสูง", record.height && `${record.height} ซม.`], ["อาการ", record.symptom],
    ["ยา", record.medicine], ["จำนวนยา", record.quantity],
    ["สถานะ", { observe: "รอดูอาการ", normal: "ปกติ", refer: "ส่งโรงพยาบาล" }[record.status]],
    ["โรงพยาบาล", record.hospitalName], ["ผู้บันทึก", staff("entered")],
    ["ผู้รับผิดชอบตามเวรในวันนั้น", staff("responsible")],
  ];
  target.innerHTML = `<h2>${escapeHtml([record.firstName, record.lastName].filter(Boolean).join(" ") || "ไม่ระบุชื่อ")}</h2>
    <p class="date">บันทึกเมื่อ ${record.createdAt ? new Date(record.createdAt).toLocaleString("th-TH") : "-"}</p>
    <dl class="detail-grid">${fields.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
}
