if (record) {
  target.classList.toggle("is-normal", record.status === "normal");
  const value = (key) => escapeHtml(record[key] || "");
  const field = (key, label, span = "") => `<label class="${span}"><span>${label}</span><input readonly value="${value(key)}" /></label>`;
  const status = { observe: "รอดูอาการ", normal: "ปกติ", refer: "ส่งโรงพยาบาล" }[record.status] || "-";
  const visitor = record.visitorType === "guest" ? "guest" : "student";
  const visitorText = visitor === "guest" ? "บุคลากรภายนอก" : "บุคลากรภายใน";
  const staffName = (kind) => {
    if (kind === "responsible" && !record.responsibleFromDutyShift) return "ไม่พบข้อมูลเข้าเวร";
    const name = kind === "entered" ? record.enteredByName : record.responsibleName;
    const nickname = kind === "entered" ? record.enteredByNickname : record.responsibleNickname;
    return name ? `${name}${nickname ? ` (${nickname})` : ""}` : "-";
  };
  target.innerHTML = `<h2>${escapeHtml([record.firstName, record.lastName].filter(Boolean).join(" ") || "ไม่ระบุชื่อ")}</h2>
    <p class="date">บันทึกเมื่อ ${record.createdAt ? new Date(record.createdAt).toLocaleString("th-TH") : "-"}</p>
    <div class="detail-visitor"><span class="${visitor}">${visitorText}</span></div>
    <div class="detail-form-grid">
      ${field("firstName", "ชื่อ", "wide")}${field("lastName", "นามสกุล", "wide")}${field("nickname", "ชื่อเล่น")}
      ${field("age", "อายุ")}${field("studentId", "รหัสนักศึกษา")}${field("branch", "สาขา")}
      ${field("gender", "เพศ")}${field("blood", "กรุ๊ปเลือด")}${field("weight", "น้ำหนัก")}${field("height", "ส่วนสูง")}
      ${field("symptom", "อาการ", "wide")}
      <div class="detail-vitals"><strong>ผลการวัดความดัน</strong>${field("sys", "SYS")}${field("dia", "DIA")}${field("pr", "PR")}</div>
      ${field("medicine", "ยาที่ได้รับ", "half")}${field("quantity", "จำนวนยา / หน่วย", "half")}
      <div class="detail-staff"><strong>ผู้บันทึก:</strong> ${escapeHtml(staffName("entered"))}</div>
      <div class="detail-staff"><strong>ผู้รับผิดชอบตามเวรในวันนั้น:</strong> ${escapeHtml(staffName("responsible"))}</div>
      <div class="detail-status">สถานะ: ${status}${record.hospitalName ? ` · ${escapeHtml(record.hospitalName)}` : ""}</div>
    </div>`;
}
