(async function () {
const target=document.getElementById("detail");const code=new URLSearchParams(location.search).get("code");const records=await MedicineAPI.list();const record=records.find(item=>String(item.code||"")===String(code||""));const escapeHtml=value=>String(value??"-").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));if(!record){target.innerHTML="<h1>ไม่พบข้อมูลรายการยา</h1>"}else{const image=record.image?`<img src="${record.image}" alt="${escapeHtml(record.name)}">`:`<span class="empty-image">รูปภาพยา</span>`;const remaining=Math.max(0,(Number(record.total)||0)-(Number(record.used)||0));target.innerHTML=`<h1>${escapeHtml(record.name||record.productName)}${record.genericName?`<br><span>(${escapeHtml(record.genericName)})</span>`:""}</h1><div class="detail-image">${image}</div><div class="details"><p><b>รายละเอียดของยา</b></p><p><strong>ชื่อสินค้า:</strong> ${escapeHtml(record.productName)}</p><p><strong>ชื่อสามัญ:</strong> ${escapeHtml(record.genericName)}</p><p><strong>ประเภท:</strong> ${escapeHtml({oral:"ยากิน",topical:"ยาทา",equipment:"เวชภัณฑ์"}[record.category]||record.category)}</p><p><strong>รหัสยา:</strong> ${escapeHtml(record.code)}</p><p><strong>รูปแบบ:</strong> ${escapeHtml(record.form)}</p><p><strong>ขนาด:</strong> ${escapeHtml(record.size)}</p><p><strong>หน่วยนับ:</strong> ${escapeHtml(record.unit)}</p><p><strong>สรรพคุณ:</strong> ${escapeHtml(record.benefit)}</p><p><strong>อาการที่ใช้:</strong> ${escapeHtml(record.symptom)}</p><p><strong>วิธีใช้โดยทั่วไป:</strong> ${escapeHtml(record.usage)}</p><p><strong>ข้อควรระวัง:</strong> ${escapeHtml(record.warning)}</p><p><strong>สถานะสินค้า:</strong> ${escapeHtml(record.status)}</p><p><strong>วันหมดอายุ:</strong> ${escapeHtml(record.expiry)}</p></div><h2>คงคลัง:</h2><p data-stock-components>ปรับมือ ${record.manualUsed} · จ่ายคนไข้ ${record.dispensed} · ยืมค้าง ${record.borrowed} ${escapeHtml(record.unit)}</p><div class="inventory"><div class="total"><label>ทั้งหมด</label><strong>${record.total||0}</strong></div><div class="used"><label>ใช้/เบิก</label><strong>${record.used||0}</strong></div><div class="remaining"><label>เหลือ</label><strong>${remaining}</strong></div></div><div class="detail-actions"><button type="button" onclick="history.back()">Cancel</button><button type="button" onclick="location.href='./stock.html'">Save</button></div>`}
if (record) {
  let busy = false;
  const inventory = document.querySelector(".inventory");
  const statusLine = [...target.querySelectorAll(".details p")].find(p => p.textContent.startsWith("สถานะสินค้า:"));
  function renderCounts() {
    target.querySelector("[data-stock-components]").textContent = `ปรับมือ ${record.manualUsed} · จ่ายคนไข้ ${record.dispensed} · ยืมค้าง ${record.borrowed} ${record.unit || "หน่วย"}`;
    for (const key of ["total", "used", "remaining"]) inventory.querySelector(`.${key} strong`).textContent = record[key];
    if (statusLine) statusLine.textContent = `สถานะสินค้า: ${record.status}`;
  }
  async function saveCount(path, data) {
    if (busy) { renderCounts(); return; }
    const reason = prompt("เหตุผลการปรับสต็อก");
    if (!reason?.trim()) { renderCounts(); return; }
    data.reason = reason;
    busy = true;
    const controls = [...target.querySelectorAll("button")];
    controls.forEach(button => button.disabled = true);
    inventory.querySelectorAll('[contenteditable]').forEach(value => value.contentEditable = "false");
    try { Object.assign(record, await MedicineAPI.request(path, { method: "PATCH", body: JSON.stringify(data) })); }
    catch (error) { MedicineAPI.error(error); }
    finally {
      renderCounts(); busy = false; controls.forEach(button => button.disabled = false);
      inventory.querySelectorAll('.total strong,.used strong').forEach(value => value.contentEditable = "true");
    }
  }
  for (const field of ["total", "used"]) {
    const box = inventory.querySelector(`.${field}`), value = box.querySelector("strong");
    box.insertAdjacentHTML("beforeend", `<button class="quantity minus" type="button" data-field="${field}" data-delta="-1">−</button><button class="quantity plus" type="button" data-field="${field}" data-delta="1">＋</button>`);
    value.contentEditable = "true"; value.setAttribute("role", "spinbutton"); value.setAttribute("aria-label", field === "total" ? "จำนวนทั้งหมด" : "จำนวนที่ใช้ไป");
    value.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); value.blur(); } });
    value.addEventListener("blur", () => {
      if (busy) return;
      const text = value.textContent.trim();
      if (!/^\d+$/.test(text)) { MedicineAPI.error(new Error("จำนวนต้องเป็นจำนวนเต็มตั้งแต่ศูนย์")); renderCounts(); return; }
      if (Number(text) !== record[field]) saveCount(`/${encodeURIComponent(record.id)}`, { [field]: Number(text) });
    });
  }
  inventory.addEventListener("click", event => {
    const button = event.target.closest("button[data-field]");
    if (button && !busy) saveCount(`/${encodeURIComponent(record.id)}/inventory`, { field: button.dataset.field, delta: Number(button.dataset.delta) });
  });
}
const detailMenu=document.querySelector(".menu-button"),detailBell=document.querySelector(".bell"),detailLanguage=document.querySelector(".language");if(detailMenu)detailMenu.innerHTML='<svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7M8 12h12"/></svg>';if(detailBell)detailBell.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 17h12l-1.4-2.2V10a4.6 4.6 0 0 0-9.2 0v4.8L6 17Zm4 2a2 2 0 0 0 4 0"/></svg>';if(detailLanguage)detailLanguage.innerHTML='<span>ไทย</span>';
const universalBell=document.getElementById("notificationButton"),universalPanel=document.getElementById("notificationPanel");universalBell?.addEventListener("click",()=>{universalPanel.hidden=!universalPanel.hidden});document.getElementById("closeNotification")?.addEventListener("click",()=>{universalPanel.hidden=true});
// Export and language actions for the stock detail page.
document.querySelectorAll(".topbar .export").forEach((button) => button.addEventListener("click", () => window.print()));
document.querySelector(".topbar .language")?.addEventListener("click", () => {
  const english = document.documentElement.lang !== "en"; document.documentElement.lang = english ? "en" : "th";
  document.querySelector(".topbar .language span").textContent = english ? "English" : "ไทย";
});

if (record) {
  const openDetailDeleteDialog = () => new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "fms-confirm-overlay";
    overlay.innerHTML = `<section class="fms-confirm-dialog" role="dialog" aria-modal="true"><div class="fms-confirm-icon"><svg viewBox="0 0 24 24"><path d="M7 7h10v12H7z"/><path d="M5 7h14M9 7V4h6v3M10 11v5M14 11v5"/></svg></div><p class="fms-confirm-eyebrow">ยืนยันการลบรายการ</p><h2>ต้องการเลิกใช้งานรายการนี้หรือไม่?</h2><p>รายการ <strong>${escapeHtml(record.name || record.productName || "นี้")}</strong> จะเลิกใช้งานในคลัง แต่ประวัติยังอยู่</p><div class="fms-confirm-actions"><button type="button" class="fms-confirm-cancel">ยกเลิก</button><button type="button" class="fms-confirm-delete">ลบรายการ</button></div></section>`;
    document.body.append(overlay);
    const finish = value => { overlay.remove(); resolve(value); };
    overlay.querySelector(".fms-confirm-cancel").onclick = () => finish(false);
    overlay.querySelector(".fms-confirm-delete").onclick = () => finish(true);
    overlay.onclick = event => { if (event.target === overlay) finish(false); };
  });
  const actions = document.querySelector(".detail-actions");
  if (actions) {
    actions.innerHTML = `<button type="button" class="detail-edit" aria-label="แก้ไขรายการ" title="แก้ไขรายการ"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 16.5-.7 3.2 3.2-.7L18.8 8.7a2.1 2.1 0 0 0-3-3L5.5 16.5Z"/><path d="m14.7 7.3 2 2"/></svg> แก้ไข</button><button type="button" class="detail-delete" aria-label="ลบรายการ" title="ลบรายการ"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg> ลบ</button>`;
    actions.querySelector(".detail-edit").addEventListener("click", () => {
      location.href = `./stock-add.html?edit=${encodeURIComponent(record.id)}`;
    });
    actions.querySelector(".detail-delete").addEventListener("click", async () => {
      if (!await openDetailDeleteDialog()) return;
      try { await MedicineAPI.request(`/${encodeURIComponent(record.id)}`, { method: "DELETE", body: JSON.stringify({}) }); } catch (error) { MedicineAPI.error(error); return; }
      location.href = "./stock.html?deleted=1";
    });
  }
}

})().catch(MedicineAPI.error);
