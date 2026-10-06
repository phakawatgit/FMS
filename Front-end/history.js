location.replace("./infirmary-visit-history.html");
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
