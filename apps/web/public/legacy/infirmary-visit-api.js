(function () {
  const form = document.getElementById("visitForm");
  const message = document.getElementById("formMessage");
  const buttons = [...form.querySelectorAll("button[type=submit], button[type=reset]")];
  let saving = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving) return;
    const visitor = form.querySelector(".visitor-check:checked");
    const status = form.querySelector(".status input:checked")?.value;
    message.style.color = "#c43a3a";
    if (!visitor || !status) {
      message.textContent = !visitor ? "กรุณาเลือกประเภทบุคลากรก่อนบันทึก" : "กรุณาเลือกสถานะก่อนบันทึก";
      return;
    }
    const record = { ...Object.fromEntries(new FormData(form)), visitorType: visitor.closest(".visitor-option").dataset.type === 'external' ? 'บุคคลภายนอก' : 'บุคคลภายใน', status };
    saving = true;
    buttons.forEach(button => { button.disabled = true; });
    message.textContent = "กำลังบันทึก…";
    try {
      await window.visitDispensingReady;
      record.dispensations = window.visitDispensing.read();
      const saved = await window.infirmaryApi("", { method: "POST", body: JSON.stringify(record) });
      if (!saved.id) throw new Error("ระบบไม่ยืนยันรายการที่บันทึก กรุณาตรวจสอบประวัติ");
      window.location.href = saved.status === "observe" ? "./pending-assessment.html" : "./infirmary-visit-history.html";
    } catch (error) {
      message.textContent = error.message;
      saving = false;
      buttons.forEach(button => { button.disabled = false; });
    }
  });
})();
