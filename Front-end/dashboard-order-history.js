(() => {
  const key = "fms-history-catalog-orders";
  const container = document.getElementById("purchaseCalendarContent");
  const openOrderIds = new Set();
  const calendarStartYear = new Date().getFullYear();
  let calendarEndYear = calendarStartYear + 4;
  let viewDate = new Date();
  let annualSelectedYear = calendarStartYear;
  let yearPickerOpen = false;
  let selectedDateKey = null;
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const normalized = (value) => String(value ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const read = (storageKey) => {
    try { const value = JSON.parse(localStorage.getItem(storageKey) || "[]"); return Array.isArray(value) ? value : []; }
    catch { return []; }
  };
  function parseOrderDate(order) {
    const value = order.date || order.createdAt || order.orderedAt || order.orderDate;
    if (!value) return null;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const match = String(value).match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
    if (!match) return null;
    let year = Number(match[3]);
    if (year > 2400) year -= 543;
    const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const currentProducts = () => read("fms-stock-records");
  function findCurrent(item, products) {
    const code = normalized(item.code || item.productCode);
    const name = normalized(item.name || item.productName);
    return products.find((product) => code && normalized(product.code || product.productCode) === code)
      || products.find((product) => [product.name, product.productName, product.genericName].some((value) => normalized(value) === name))
      || null;
  }
  const imageOf = (record) => {
    const image = record?.image || record?.imageUrl || record?.imageDataUrl || record?.photo || record?.photoUrl || "";
    return typeof image === "string" ? image : image?.dataUrl || image?.url || image?.src || "";
  };
  function orderDetails(order, index, products) {
    const items = Array.isArray(order.items) ? order.items : Array.isArray(order.products) ? order.products : [];
    const id = String(order.id || `order-${index}`);
    const detailOpen = openOrderIds.has(id);
    const title = order.title || order.name || `การสั่งซื้อสินค้าครั้งที่ ${index + 1}`;
    const dateValue = order.date || order.createdAt || order.orderedAt || order.orderDate;
    const displayDate = parseOrderDate(order) ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(parseOrderDate(order)) : dateValue || "ไม่ระบุวันที่";
    const contentId = `purchase-detail-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const itemMarkup = items.map((item) => {
      const current = findCurrent(item, products) || item;
      const name = current.name || current.productName || item.name || item.productName || "รายการสินค้า";
      const code = current.code || current.productCode || item.code || item.productCode || "-";
      const quantity = item.quantity ?? item.count ?? 1;
      const total = Number(current.total) || 0, used = Number(current.used) || 0;
      const remaining = current.remaining ?? Math.max(0, total - used);
      const category = { oral: "ยากิน", topical: "ยาทา", equipment: "เวชภัณฑ์" }[current.category] || current.category || "-";
      const image = imageOf(current) || imageOf(item);
      const details = [
        ["รหัสสินค้า", code], ["ประเภท", category], ["รูปแบบ", current.form || item.form], ["ขนาด", current.size || item.size],
        ["จำนวนที่สั่ง", `${quantity} ${item.unit || current.unit || "หน่วย"}`], ["สต็อกปัจจุบัน", current.total],
        ["ใช้/เบิกปัจจุบัน", current.used], ["คงเหลือปัจจุบัน", remaining], ["วันหมดอายุ", current.expiry || current.expiryDate],
        ["สรรพคุณ", current.benefit], ["อาการที่ใช้", current.symptom], ["วิธีใช้", current.usage], ["ข้อควรระวัง", current.warning]
      ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");
      return `<article class="purchase-product"><div class="purchase-product-head"><strong>${image ? `<img class="purchase-order-image" src="${escape(image)}" alt="" />` : ""}${escape(name)} <small>(${escape(code)})</small></strong><span>×${escape(quantity)} ${escape(item.unit || current.unit || "หน่วย")}</span></div><dl class="purchase-item-detail">${details.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl></article>`;
    }).join("");
    const summary = [
      ["วันที่สั่งซื้อ", displayDate], ["สถานะคำสั่งซื้อ", order.status || "ไม่ระบุ"], ["รายการสินค้าทั้งหมด", `${items.length} รายการ`]
    ];
    return `<article class="purchase-order"><button class="purchase-order-toggle" type="button" aria-expanded="${detailOpen}" aria-controls="${escape(contentId)}" data-purchase-detail="${escape(contentId)}" data-order-key="${escape(id)}"><span class="purchase-order-name">${escape(title)}</span><span class="purchase-order-meta">${escape(displayDate)}</span><span class="purchase-order-status">${escape(order.status || "บันทึกแล้ว")}</span></button><div class="purchase-order-detail" id="${escape(contentId)}" ${detailOpen ? "" : "hidden"}><dl class="purchase-order-summary">${summary.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl>${order.documentTitle ? `<p class="purchase-order-doc">เอกสาร: <strong>${escape(order.documentTitle)}</strong></p>` : ""}${order.requester || order.department ? `<p class="purchase-order-doc">${order.requester ? `ผู้สั่งซื้อ: <strong>${escape(order.requester)}</strong>` : ""} ${order.department ? `หน่วยงาน: <strong>${escape(order.department)}</strong>` : ""}</p>` : ""}<h3>รายละเอียดสินค้าที่สั่ง</h3><div class="purchase-products">${itemMarkup || `<p class="purchase-order-empty">ไม่มีรายละเอียดสินค้าในคำสั่งซื้อนี้</p>`}</div></div></article>`;
  }
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  function orderColor(entry) {
    const state = normalized(entry.order.status);
    if (/ยกเลิก|cancel|reject/.test(state)) return "is-cancelled";
    if (/สำเร็จ|complete|received|approved/.test(state)) return "is-complete";
    if (/รอ|pending|draft/.test(state)) return "is-pending";
    return "is-saved";
  }
  function renderMonth(orders, english) {
    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const first = new Date(year, month, 1), count = new Date(year, month + 1, 0).getDate();
    const weekdays = english ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    const monthName = new Intl.DateTimeFormat(english ? "en-US" : "th-TH", { month: "long", year: "numeric" }).format(first);
    const byDate = new Map();
    orders.filter((entry) => entry.date.getFullYear() === year && entry.date.getMonth() === month).forEach((entry) => {
      const key = dateKey(entry.date); byDate.set(key, [...(byDate.get(key) || []), entry]);
    });
    const cells = Array.from({ length: first.getDay() }, () => '<span class="purchase-day-blank" aria-hidden="true"></span>');
    for (let number = 1; number <= count; number++) {
      const key = dateKey(new Date(year, month, number)), marked = byDate.get(key) || [];
      const dots = marked.slice(0, 4).map((entry) => `<i class="purchase-dot ${orderColor(entry)}" aria-hidden="true"></i>`).join("");
      cells.push(`<button type="button" class="purchase-day${marked.length ? " has-orders" : ""}${key === selectedDateKey ? " is-selected" : ""}${key === dateKey(new Date()) ? " is-today" : ""}" data-calendar-date="${key}" aria-label="${key}${marked.length ? ` · ${marked.length} ${english ? "orders" : "รายการสั่งซื้อ"}` : ""}"><span>${number}</span><span class="purchase-day-dots">${dots}${marked.length > 4 ? `<small>+${marked.length - 4}</small>` : ""}</span></button>`);
    }
    const canGoPrevious = year > calendarStartYear || month > 0;
    const canGoNext = year < calendarEndYear || month < 11;
    return `<div class="purchase-calendar"><div class="purchase-calendar-toolbar"><button type="button" data-month-shift="-1" aria-label="${english ? "Previous month" : "เดือนก่อนหน้า"}" ${canGoPrevious ? "" : "disabled"}>‹</button><strong>${escape(monthName)}</strong><button type="button" data-month-shift="1" aria-label="${english ? "Next month" : "เดือนถัดไป"}" ${canGoNext ? "" : "disabled"}>›</button></div><div class="purchase-calendar-week">${weekdays.map((name) => `<span>${name}</span>`).join("")}</div><div class="purchase-calendar-grid">${cells.join("")}</div></div>`;
  }
  function renderMiniMonth(year, month, byDate, english) {
    const first = new Date(year, month, 1), count = new Date(year, month + 1, 0).getDate();
    const weekdays = english ? ["S", "M", "T", "W", "T", "F", "S"] : ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
    const monthName = new Intl.DateTimeFormat(english ? "en-US" : "th-TH", { month: "long" }).format(first);
    const cells = Array.from({ length: first.getDay() }, () => '<span class="purchase-mini-blank" aria-hidden="true"></span>');
    for (let number = 1; number <= count; number++) {
      const key = dateKey(new Date(year, month, number)), marked = byDate.get(key) || [];
      const dots = marked.slice(0, 3).map((entry) => `<i class="purchase-status-dot ${orderColor(entry)}" aria-hidden="true"></i>`).join("");
      cells.push(`<button type="button" class="purchase-mini-day${marked.length ? " has-orders" : ""}${key === selectedDateKey ? " is-selected" : ""}${key === dateKey(new Date()) ? " is-today" : ""}" data-calendar-date="${key}" aria-label="${key}${marked.length ? ` · ${marked.length} ${english ? "orders" : "รายการสั่งซื้อ"}` : ""}"><span>${number}</span><span class="purchase-mini-dots">${dots}</span></button>`);
    }
    return `<section class="purchase-mini-month${year === calendarStartYear && month === new Date().getMonth() ? " is-current-month" : ""}" id="purchase-month-${year}-${String(month + 1).padStart(2, "0")}"><h3>${escape(monthName)}</h3><div class="purchase-mini-week">${weekdays.map((name) => `<span>${name}</span>`).join("")}</div><div class="purchase-mini-grid">${cells.join("")}</div></section>`;
  }
  function renderAnnualCalendar(orders, english) {
    const byDate = new Map();
    orders.forEach((entry) => {
      const key = dateKey(entry.date);
      byDate.set(key, [...(byDate.get(key) || []), entry]);
    });
    const years = Array.from({ length: 5 }, (_, index) => annualSelectedYear + index);
    return `<div class="purchase-years-overview">${years.map((year) => {
      const yearLabel = new Intl.DateTimeFormat(english ? "en-US" : "th-TH", { year: "numeric" }).format(new Date(year, 0, 1));
      const count = orders.filter((entry) => entry.date.getFullYear() === year).length;
      return `<section class="purchase-year-overview" id="purchase-year-${year}"><header><h2>${escape(yearLabel)}</h2><span>${count} ${english ? "orders" : "รายการ"}</span></header><div class="purchase-month-overview">${Array.from({ length: 12 }, (_, month) => renderMiniMonth(year, month, byDate, english)).join("")}</div></section>`;
    }).join("")}</div>`;
  }
  function renderDateDialog(orders, products, english) {
    const date = new Date(`${selectedDateKey}T00:00:00`), dayOrders = orders.filter((entry) => dateKey(entry.date) === selectedDateKey);
    const title = new Intl.DateTimeFormat(english ? "en-US" : "th-TH", { dateStyle: "long" }).format(date);
    const list = dayOrders.length ? dayOrders.map((entry) => orderDetails(entry.order, entry.originalIndex, products)).join("") : `<p class="purchase-order-empty">${english ? "No purchase history for this date." : "ไม่มีประวัติการสั่งซื้อในวันนี้"}</p>`;
    return `<dialog class="purchase-day-dialog" id="purchaseDayDialog"><header><div><p>${english ? "Purchase history" : "ประวัติการสั่งซื้อ"}</p><h2>${escape(title)}</h2><small>${dayOrders.length} ${english ? "orders" : "รายการ"}</small></div><button type="button" data-close-day-dialog aria-label="${english ? "Close" : "ปิด"}">×</button></header><div class="purchase-order-list">${list}</div></dialog>`;
  }
  function render() {
    const thisYear = new Date().getFullYear();
    const english = language === "en";
    document.querySelector(".catalog-history-panel .panel-title").textContent = english ? "Medicine order history" : "ประวัติการสั่งยา";
    document.querySelector(".catalog-history-subtitle").textContent = english ? "Purchase history calendar" : "ปฏิทินประวัติการสั่งซื้อ";
    document.getElementById("purchaseCalendarToday").textContent = english ? "Calendar" : "ปฏิทิน";
    const orders = read(key).map((order, originalIndex) => ({ order, originalIndex, date: parseOrderDate(order) }))
      .filter((entry) => entry.date && entry.date.getFullYear() >= thisYear && entry.date.getFullYear() <= calendarEndYear)
      .sort((a, b) => b.date - a.date);
    const products = currentProducts();
    if (!selectedDateKey) selectedDateKey = dateKey(new Date());
    const previousDayDialog = document.getElementById("purchaseDayDialog");
    const previousAnnualDialog = document.getElementById("purchaseAnnualDialog");
    const wasDayDialogOpen = previousDayDialog?.open;
    const wasAnnualDialogOpen = previousAnnualDialog?.open;
    const dayDialogScrollTop = previousDayDialog?.scrollTop || 0;
    const annualDialogScrollTop = previousAnnualDialog?.scrollTop || 0;
    const annualTitle = english ? "Annual purchase calendar" : "ปฏิทินรายปี";
    if (annualSelectedYear < calendarStartYear || annualSelectedYear > calendarEndYear) annualSelectedYear = calendarStartYear;
    const yearOptions = Array.from({ length: calendarEndYear - calendarStartYear + 1 }, (_, index) => {
      const year = calendarStartYear + index;
      const label = new Intl.DateTimeFormat(english ? "en-US" : "th-TH", { year: "numeric" }).format(new Date(year, 0, 1));
      return `<button type="button" role="option" aria-selected="${year === annualSelectedYear}" class="purchase-year-option${year === annualSelectedYear ? " is-selected" : ""}" data-select-calendar-year="${year}"><span>${escape(english ? "Year" : "พ.ศ.")}</span><strong>${escape(label)}</strong>${year === annualSelectedYear ? '<i aria-hidden="true">✓</i>' : ""}</button>`;
    }).join("");
    const selectedYearLabel = new Intl.DateTimeFormat(english ? "en-US" : "th-TH", { year: "numeric" }).format(new Date(annualSelectedYear, 0, 1));
    const windowEndYear = annualSelectedYear + 4;
    container.innerHTML = `<div class="purchase-status-legend"><span><i class="purchase-status-dot is-saved"></i>${english ? "Saved" : "บันทึกแล้ว"}</span></div>${renderMonth(orders, english)}<dialog class="purchase-annual-dialog" id="purchaseAnnualDialog"><header><div><p>${english ? "Purchase history" : "ประวัติการสั่งซื้อ"}</p><h2>${annualTitle}</h2><small>${english ? `${annualSelectedYear}–${windowEndYear}` : `${annualSelectedYear + 543}–${windowEndYear + 543}`}</small></div><div class="purchase-annual-actions"><div class="purchase-year-picker"><span class="purchase-year-picker-label">${english ? "Select year" : "เลือกปี"}</span><button type="button" class="purchase-year-picker-trigger" data-toggle-year-picker aria-haspopup="listbox" aria-expanded="${yearPickerOpen}"><span><small>${english ? "Selected year" : "ปีที่เลือก"}</small><strong>${escape(selectedYearLabel)}</strong></span><svg class="purchase-year-picker-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5" /></svg></button><div class="purchase-year-picker-menu" role="listbox" aria-label="${english ? "Select year" : "เลือกปี"}" ${yearPickerOpen ? "" : "hidden"}>${yearOptions}</div></div><button type="button" data-close-annual-dialog aria-label="${english ? "Close" : "ปิด"}">×</button></div></header>${renderAnnualCalendar(orders, english)}</dialog>${renderDateDialog(orders, products, english)}`;
    if (wasAnnualDialogOpen) {
      const annualDialog = document.getElementById("purchaseAnnualDialog");
      annualDialog.showModal();
      annualDialog.scrollTop = annualDialogScrollTop;
    }
    if (wasDayDialogOpen) {
      const dayDialog = document.getElementById("purchaseDayDialog");
      dayDialog.showModal();
      dayDialog.scrollTop = dayDialogScrollTop;
    }
  }
  container.addEventListener("click", (event) => {
    const monthButton = event.target.closest("[data-month-shift]");
    if (monthButton) {
      const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + Number(monthButton.dataset.monthShift), 1);
      if (next.getFullYear() >= calendarStartYear && next.getFullYear() <= calendarEndYear) { viewDate = next; selectedDateKey = dateKey(next); render(); }
      return;
    }
    if (event.target.closest("[data-toggle-year-picker]")) {
      yearPickerOpen = !yearPickerOpen;
      render();
      return;
    }
    const yearOption = event.target.closest("[data-select-calendar-year]");
    if (yearOption) {
      annualSelectedYear = Number(yearOption.dataset.selectCalendarYear);
      calendarEndYear = Math.max(calendarEndYear, annualSelectedYear + 4);
      viewDate = new Date(annualSelectedYear, 0, 1);
      selectedDateKey = dateKey(viewDate);
      yearPickerOpen = false;
      render();
      return;
    }
    if (event.target.closest("[data-close-annual-dialog]")) { yearPickerOpen = false; document.getElementById("purchaseAnnualDialog").close(); return; }
    const dayButton = event.target.closest("[data-calendar-date]");
    if (dayButton) {
      const fromAnnualCalendar = dayButton.closest("#purchaseAnnualDialog") !== null;
      if (fromAnnualCalendar) document.getElementById("purchaseAnnualDialog").close();
      selectedDateKey = dayButton.dataset.calendarDate;
      const [year, month] = selectedDateKey.split("-").map(Number);
      viewDate = new Date(year, month - 1, 1);
      render();
      if (read(key).some((order) => { const date = parseOrderDate(order); return date && dateKey(date) === selectedDateKey; })) document.getElementById("purchaseDayDialog").showModal();
      return;
    }
    if (event.target.closest("[data-close-day-dialog]")) { document.getElementById("purchaseDayDialog").close(); return; }
    const detailButton = event.target.closest("[data-purchase-detail]");
    if (detailButton) { const panel = document.getElementById(detailButton.dataset.purchaseDetail), opening = !openOrderIds.has(detailButton.dataset.orderKey); opening ? openOrderIds.add(detailButton.dataset.orderKey) : openOrderIds.delete(detailButton.dataset.orderKey); detailButton.setAttribute("aria-expanded", String(opening)); panel.hidden = !opening; }
  });
  container.addEventListener("cancel", (event) => {
    if (event.target.id === "purchaseAnnualDialog") yearPickerOpen = false;
  });
  document.getElementById("purchaseCalendarToday").addEventListener("click", () => { document.getElementById("purchaseAnnualDialog").showModal(); });
  window.addEventListener("storage", (event) => { if (!event.key || event.key === key || event.key === "fms-stock-records") render(); });
  window.addEventListener("focus", render);
  languageButton.addEventListener("click", () => setTimeout(render, 0));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") render(); });
  window.setInterval(render, 5000);
  window.renderPurchaseHistory = render;
  render();
})();

