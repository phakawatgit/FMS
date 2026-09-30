let target=document.getElementById("detail"),id=new URLSearchParams(location.search).get("id"),record=null,escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
(async function () {
  target.textContent = "กำลังโหลดข้อมูล…";
  try {
    record = await window.infirmaryApi(`/${encodeURIComponent(id)}`);
    if (!record) { target.textContent = "ไม่พบข้อมูลรายการนี้"; return; }
    if (record.visitorType === "บุคคลภายนอก") record.visitorDetailExternal = record.visitorDetail;
    // Keep the existing detail layout and editor after the database load completes.
    for (const name of ["assessment-detail-form-view", "assessment-detail-edit", "assessment-detail-visitor-role", "assessment-detail-status-edit"]) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `./${name}.js?v=2`;
        script.onload = resolve;
        script.onerror = () => reject(new Error("โหลดหน้ารายละเอียดไม่สำเร็จ กรุณารีเฟรช"));
        document.body.append(script);
      });
    }
  } catch (error) { target.textContent = error.message; }
})();
