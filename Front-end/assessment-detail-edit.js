if (record && record.status === "observe") {
  const fields = [
    ["firstName", "ชื่อ", "wide"], ["lastName", "นามสกุล", "wide"],
    ["nickname", "ชื่อเล่น"], ["age", "อายุ"], ["studentId", "รหัสนักศึกษา"],
    ["faculty", "หลักสูตร", "", "faculty"], ["branch", "สาขา", "", "branch"],
    ["gender", "เพศ", "", "gender"], ["blood", "กรุ๊ปเลือด", "", "blood"],
    ["weight", "น้ำหนัก (กก.)"], ["height", "ส่วนสูง (ซม.)"],
    ["symptom", "อาการ", "wide", "textarea"], ["medicine", "ยาที่ได้รับ", "half", "select"],
    ["quantity", "จำนวนยา / หน่วย", "half"],
  ];
  const button = document.createElement("button");
  button.className = "edit-button";
  button.type = "button";
  button.textContent = "แก้ไขข้อมูล";
  target.append(button);

  button.addEventListener("click", () => {
    if (target.querySelector(".edit-panel")) return;

    const stock = JSON.parse(FMSStorage.getItem("fms-stock-records") || "[]");
    const visits = JSON.parse(FMSStorage.getItem("fms-infirmary-visits") || "[]");
    const medicineNames = [...new Set(stock.map((item) => item.name || item.productName || item.genericName).filter(Boolean))];
    const currentMedicine = String(record.medicine || "").trim();
    if (currentMedicine && !medicineNames.includes(currentMedicine)) medicineNames.unshift(currentMedicine);
    const choices = {
      faculty: [
        { value: "engineering", label: "หลักสูตรวิศวกรรมศาสตร์" },
        { value: "agriculture", label: "หลักสูตรเทคโนโลยีการเกษตรและวิทยาศาสตร์" },
        { value: "business", label: "หลักสูตรบริหารธุรกิจและนวัตกรรม" },
      ],
      branch: [...new Set(visits.map((item) => item.branch).filter(Boolean))],
      gender: ["ชาย", "หญิง"],
      blood: ["A", "B", "AB", "O"],
      medicine: medicineNames,
    };
    const placeholders = { faculty: "เลือกหลักสูตร", branch: "เลือกสาขา", gender: "เลือกเพศ", blood: "เลือกกรุ๊ปเลือด", medicine: "เลือกยา" };
    ["branch", "gender", "blood"].forEach((key) => {
      const current = String(record[key] || "").trim();
      if (current && !choices[key].includes(current)) choices[key].unshift(current);
    });

    const panel = document.createElement("form");
    panel.className = "edit-panel";
    const visitorType = record.visitorType || "student";
    panel.innerHTML = `<h3>แก้ไขข้อมูลผู้รับบริการ</h3>
      <div class="visitor-summary">
        <label><input type="radio" name="visitorType" value="student" ${visitorType === "student" ? "checked" : ""}/> บุคลากรภายใน</label>
        <label><input type="radio" name="visitorType" value="guest" ${visitorType === "guest" ? "checked" : ""}/> บุคลากรภายนอก</label>
      </div>
      <div class="edit-grid">${fields.map(([key, label, span, type]) => {
        const className = span || "";
        const value = escapeHtml(record[key] ?? "");
        if (type === "textarea") return `<label class="${className}">${label}<textarea name="${key}">${value}</textarea></label>`;
        if (["select", "faculty", "branch", "gender", "blood"].includes(type)) {
          const options = choices[type] || medicineNames;
          const selected = String(record[key] || "").trim();
          const optionValues = options.map((option) => typeof option === "string" ? { value: option, label: option } : option);
          if (selected && !optionValues.some((option) => option.value === selected)) optionValues.unshift({ value: selected, label: selected });
          return `<label class="${className}">${label}<span class="edit-select-wrap"><select name="${key}" aria-label="${label}"><option value="">${placeholders[type] || "เลือกยา"}</option>${optionValues.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select><svg class="edit-select-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.75 7.5 4.25 4.25 4.25-4.25"/></svg></span></label>`;
        }
        return `<label class="${className}">${label}<input name="${key}" value="${value}" /></label>`;
      }).join("")}
        <div class="vitals-edit"><strong>ผลการวัดความดัน</strong><label>SYS<input name="sys" value="${escapeHtml(record.sys || "")}" /></label><label>DIA<input name="dia" value="${escapeHtml(record.dia || "")}" /></label><label>PR<input name="pr" value="${escapeHtml(record.pr || "")}" /></label></div>
        <div class="status-readonly">สถานะ: รอดูอาการ</div>
      </div>
      <div class="edit-actions"><button type="button">ยกเลิก</button><button type="submit">บันทึกการแก้ไข</button></div>`;
    button.after(panel);
    panel.querySelector("button[type=button]").addEventListener("click", () => panel.remove());
    panel.addEventListener("submit", (event) => {
      event.preventDefault();
      const updates = Object.fromEntries(new FormData(panel));
      const records = JSON.parse(FMSStorage.getItem("fms-infirmary-visits") || "[]");
      const index = records.findIndex((item) => item.createdAt === record.createdAt);
      if (index < 0) return;
      records[index] = { ...records[index], ...updates };
      FMSStorage.setItem("fms-infirmary-visits", JSON.stringify(records));
      location.reload();
    });
  });
}
