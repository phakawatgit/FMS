const list=document.getElementById("historyList"),records=JSON.parse(FMSStorage.getItem("fms-infirmary-history")||"[]"),escapeHtml=value=>String(value||"-").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));list.innerHTML=records.length?records.map(record=>`<article class="history-card"><div><h2>${escapeHtml([record.firstName,record.lastName].filter(Boolean).join(" "))}</h2><p>${escapeHtml(record.symptom)} · ${record.completedAt?new Date(record.completedAt).toLocaleString("th-TH"):"-"}</p></div><span>ปกติ</span></article>`).join(""):'<div class="empty">ยังไม่มีประวัติรายการที่ดำเนินการเสร็จแล้ว</div>';
(() => {
  const header = document.querySelector("header.topbar");
  const tools = header?.querySelector(".page-tools");
  if (!header || !tools) return;

  header.classList.add("dashboard-topbar");
  tools.classList.add("actions");
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "./dashboard-topbar.css?v=3";
  document.head.appendChild(stylesheet);

  if (tools.querySelector(".menu-button")) return;
  const menu = document.createElement("a");
  menu.className = "menu-button";
  menu.href = "./menu.html";
  menu.setAttribute("aria-label", "กลับหน้าเมนู");
  menu.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
  tools.prepend(menu);

  tools.querySelector(".export-excel")?.classList.add("export");
  tools.querySelector(".export-pdf")?.classList.add("export");
  tools.querySelector(".language-tool")?.classList.add("language");

  const back = tools.querySelector(".back");
  if (back) document.querySelector("main.page")?.prepend(back);
})();
