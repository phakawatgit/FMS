(() => {
  const host = document.createElement('section');
  host.style.cssText = 'margin:24px 0;padding:20px;background:white;border-radius:12px;overflow:auto';
  document.querySelector('main').append(host);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = {opening:'ยอดตั้งต้น',manual:'ปรับยอด',infirmary:'จ่าย/แก้การจ่ายยา',borrow:'ยืม',return:'คืน'};
  let rows=[];
  async function load() {
    host.textContent='กำลังโหลดประวัติความเคลื่อนไหวคลัง…';
    try {
      rows=await FMSData.request('medicines','/movements');
      host.innerHTML='<h2>ประวัติความเคลื่อนไหวคลัง</h2><button type="button" data-refresh>โหลดใหม่</button> <button type="button" data-csv>ส่งออก CSV</button><table style="width:100%;text-align:left"><thead><tr><th>เวลา</th><th>ยา / รหัส</th><th>รายการ</th><th>คงเหลือก่อน → หลัง</th><th>เหตุผล</th></tr></thead><tbody>'+rows.map(r=>`<tr><td>${esc(new Date(r.createdAt).toLocaleString('th-TH'))}</td><td>${esc(r.medicine.name)} · ${esc(r.medicine.code)}</td><td>${esc(labels[r.source]||r.source)}</td><td>${r.before.remaining} → ${r.after.remaining} ${esc(r.medicine.unit)}</td><td>${esc(r.reason)}</td></tr>`).join('')+'</tbody></table>'+(rows.length?'':'<p>ยังไม่มีประวัติ</p>');
      host.querySelector('[data-refresh]').onclick=load;
      host.querySelector('[data-csv]').onclick=()=>{
        const values=[['เวลา','รหัสยา','รายการ','คงเหลือก่อน','คงเหลือหลัง','เหตุผล'],...rows.map(r=>[r.createdAt,r.medicine.code,r.source,r.before.remaining,r.after.remaining,r.reason])];
        const csv=values.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');
        const link=document.createElement('a');link.href=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));link.download='stock-movements.csv';link.click();URL.revokeObjectURL(link.href);
      };
    } catch(e) {host.textContent=e.message;const b=document.createElement('button');b.textContent='ลองใหม่';b.onclick=load;host.append(b);}
  }
  load();
})();
