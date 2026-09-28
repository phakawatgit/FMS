(function () {
  const header = document.querySelector("header.topbar");
  if (!header) return;

  header.classList.add("dashboard-topbar");
  const controls = header.querySelector(".actions, .top-actions, .page-tools, .topbar-actions");
  if (!controls) return;

  const isMenuPage = /(?:^|[/\\])menu(?:\.html)?$/i.test(location.pathname);
  const isStockAddPage = /(?:^|[/\\])stock-add(?:\.html)?$/i.test(location.pathname);
  const isBorrowFormPage = /(?:^|[/\\])borrow-form(?:\.html)?$/i.test(location.pathname);
  const isBorrowSelectedPage = /(?:^|[/\\])borrow-selected(?:\.html)?$/i.test(location.pathname);
  const isHistoryPage = /(?:^|[/\\])(?:infirmary-visit-history|history-stock|history-catalog|borrow-return-history)(?:\.html)?$/i.test(location.pathname);
  if (isStockAddPage || isBorrowFormPage || isBorrowSelectedPage || isHistoryPage) {
    controls.querySelectorAll(".menu-link, .menu-button, .back-menu-button").forEach((button) => button.remove());
  } else if (!isMenuPage && !controls.querySelector(".menu-link, .menu-button, .back-menu-button")) {
    controls.insertAdjacentHTML("afterbegin", '<a class="menu-link" href="./menu.html" aria-label="กลับไปหน้าเมนู" title="เมนู"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx=".7"/><rect x="14" y="3" width="7" height="7" rx=".7"/><rect x="3" y="14" width="7" height="7" rx=".7"/><rect x="14" y="14" width="7" height="7" rx=".7"/></svg></a>');
  }

  if (!document.querySelector('link[data-fms-header-controls]')) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "./dashboard-topbar.css?v=3";
    stylesheet.dataset.fmsHeaderControls = "true";
    document.head.appendChild(stylesheet);
  }
})();
