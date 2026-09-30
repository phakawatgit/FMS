const visitForm = document.getElementById("visitForm");
const visitApiBase = window.FMS_API_URL || `${location.protocol}//${location.hostname}:4000`;

visitForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();

  const message = document.getElementById("formMessage");
  const selectedVisitor = document.querySelector(".visitor-check:checked");
  const status = document.querySelector('.status input:checked')?.value;
  if (!selectedVisitor || !status) {
    message.textContent = !selectedVisitor
      ? "กรุณาเลือกประเภทบุคลากรก่อนบันทึก"
      : "กรุณาเลือกสถานะก่อนบันทึก";
    message.style.color = "#c43a3a";
    return;
  }

  const record = {
    ...Object.fromEntries(new FormData(visitForm)),
    visitorType: selectedVisitor.closest(".visitor-option").dataset.type,
    status,
    createdAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${visitApiBase}/api/infirmary-visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "บันทึกข้อมูลไม่สำเร็จ");

    record.id = result.data.id;
    record.createdAt = result.data.createdAt;
    let records = [];
    try {
      const storedRecords = JSON.parse(localStorage.getItem("fms-infirmary-visits") || "[]");
      if (Array.isArray(storedRecords)) records = storedRecords;
    } catch {
      records = [];
    }
    records.unshift(record);
    localStorage.setItem("fms-infirmary-visits", JSON.stringify(records));
    window.location.href = status === "observe" ? "./pending-assessment.html" : "./infirmary-visit-history.html";
  } catch (error) {
    message.textContent = error.message || "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองอีกครั้ง";
    message.style.color = "#c43a3a";
  }
}, true);