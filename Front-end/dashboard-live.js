/* Live dashboard aggregates the records saved by the infirmary and stock pages. */
(() => {
  let databaseDashboard = null;
  const apiBase = window.FMS_API_URL || `${location.protocol}//${location.hostname}:4000`;
  async function refreshDatabaseDashboard() {
    try {
      const response = await fetch(`${apiBase}/api/dashboard/data`, { cache: "no-store", credentials: "include" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Dashboard data unavailable");
      databaseDashboard = result.data;
      window.dispatchEvent(new StorageEvent("storage", { key: "fms-dashboard-data" }));
    } catch (error) { console.error("Dashboard database data could not be refreshed.", error); }
  }
  const read = (key) => {
    try {
      const value = JSON.parse(FMSStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  };
  const cleanDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
    const match = String(value).match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    if (!match) return null;
    let year = Number(match[3]);
    if (year > 2400) year -= 543;
    return new Date(year, Number(match[2]) - 1, Number(match[1]));
  };
  const day = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const visits = () => {
    const start = parseInputDate(startDate.value), end = parseInputDate(endDate.value);
    const branch = branchInput.value.trim();
    if (databaseDashboard) {
      const source = Array.isArray(databaseDashboard.visits) ? databaseDashboard.visits : [];
      return source.filter((record) => {
        const date = cleanDate(record.createdAt || record.date || record.visitDate);
        if (date && start && day(date) < start) return false;
        if (date && end && day(date) > end) return false;
        if (branch && branch !== "all" && branch !== translations[language].all && !String(record.branch || "").toLowerCase().includes(branch.toLowerCase())) return false;
        const faculty = facultySelect.value;
        return !faculty || faculty === "all" || String(record.faculty || "").toLowerCase() === faculty.toLowerCase();
      });
    }
    const activeVisits = read("fms-infirmary-visits");
    const historyVisits = read("fms-infirmary-history");
    const source = activeVisits.length ? activeVisits : historyVisits;
    return source.filter((record) => {
      const date = cleanDate(record.createdAt || record.date || record.visitDate);
      if (date && start && day(date) < start) return false;
      if (date && end && day(date) > end) return false;
      if (branch && branch !== "all" && branch !== translations[language].all && !String(record.branch || "").toLowerCase().includes(branch.toLowerCase())) return false;
      const faculty = facultySelect.value;
      return !faculty || faculty === "all" || String(record.faculty || "").toLowerCase() === faculty.toLowerCase();
    });
  };
  const stock = () => (databaseDashboard?.stock || read("fms-stock-records")).map((item) => ({
    ...item,
    name: item.name || item.productName || "รายการยา",
    remaining: Math.max(0, Number(item.remaining ?? (Number(item.total || 0) - Number(item.used || 0))) || 0)
  }));
  const colors = ["#ff97a3", "#ffca91", "#f7d96b", "#92e4ca", "#80d4f6", "#ab96e8", "#f496d4", "#a8df82", "#f1ad75", "#83a4ef"];
  const aggregate = (records, field, quantity = false) => {
    const counts = new Map();
    records.forEach((record) => {
      const entries = field === "medicine" && Array.isArray(record.medicines)
        ? record.medicines.map((item) => ({ name: item.name || item.medicineName, quantity: item.quantity }))
        : [{ name: record[field], quantity: record.quantity }];
      entries.forEach((entry) => {
        const name = String(entry.name || "").trim();
        if (!name) return;
        counts.set(name, (counts.get(name) || 0) + (quantity ? Math.max(0, Number(entry.quantity) || 1) : 1));
      });
    });
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  };
  const emptyText = (type) => language === "th"
    ? (type === "medicine" ? "ยังไม่มีข้อมูลการจ่ายยา" : "ยังไม่มีข้อมูลอาการ")
    : (type === "medicine" ? "No medicine usage recorded" : "No symptoms recorded");
  const renderLegend = (selector, rows) => {
    const list = document.querySelector(selector);
    list.replaceChildren();
    if (!rows.length) return;
    rows.forEach((row) => {
      const item = document.createElement("li"), swatch = document.createElement("i"), label = document.createElement("span");
      swatch.style.cssText = `display:block;flex:0 0 9px;width:9px;min-width:9px;height:9px;min-height:9px;aspect-ratio:1;box-sizing:border-box;border-radius:50%;background:${row.color};margin-right:7px`;
      label.textContent = `${row.name} · ${row.count}`;
      item.replaceChildren(swatch, label);
      list.append(item);
    });
  };
  const renderPie = (id, selector, rows, type) => {
    const chart = document.getElementById(id);
    const empty = chart.parentElement.querySelector(".chart-empty");
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    chart.hidden = !total;
    document.querySelector(selector).hidden = !total;
    empty.hidden = Boolean(total);
    empty.textContent = emptyText(type);
    if (!total) {
      chart.replaceChildren();
      renderLegend(selector, []);
      return;
    }
    const chartData = rows.map((row, index) => ({ ...row, percent: row.count * 100 / total, color: colors[index % colors.length] }));
    renderInteractivePie(id, chartData);
    renderLegend(selector, chartData);
  };
  const status = (item) => {
    const expiry = cleanDate(item.expiry || item.expiryDate), today = day(new Date());
    const daysLeft = expiry ? Math.ceil((day(expiry) - today) / 86400000) : Infinity;
    const minimum = Number(item.minStock ?? item.minimumStock ?? item.min ?? 0);
    if (daysLeft < 0) return "expired";
    if (daysLeft <= 30) return "expiring";
    if (minimum > 0 && item.remaining <= minimum) return "low";
    return "normal";
  };
  const renderTrend = (records) => {
    const today = day(new Date()), start = parseInputDate(startDate.value), end = parseInputDate(endDate.value);
    let first = start || new Date(today), last = end || today;
    if (!start && !end) first.setDate(first.getDate() - 6);
    if (first > last) [first, last] = [last, first];
    if ((last - first) / 86400000 > 30) first = new Date(last.getTime() - 30 * 86400000);
    const dates = [];
    for (let date = new Date(first); date <= last; date.setDate(date.getDate() + 1)) dates.push(new Date(date));
    const counts = dates.map((date) => records.filter((record) => {
      const value = cleanDate(record.createdAt || record.date || record.visitDate);
      return value && day(value).getTime() === date.getTime();
    }).length);
    const max = Math.max(1, ...counts);
    document.querySelector(".bars").innerHTML = dates.map((date, index) => `<i style="--h:${Math.max(3, counts[index] / max * 100)}%" title="${counts[index]}"><b>${new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-US", { day: "numeric", month: "numeric" }).format(date)}</b></i>`).join("");
  };
  const renderGender = (records) => {
    let male = 0, female = 0;
    records.forEach((record) => {
      const value = String(record.gender || "").toLowerCase();
      if (["male", "ชาย", "m"].includes(value)) male++;
      if (["female", "หญิง", "f"].includes(value)) female++;
    });
    const total = male + female;
    document.getElementById("maleCount").textContent = male;
    document.getElementById("femaleCount").textContent = female;
    document.getElementById("maleBar").style.width = `${total ? male / total * 100 : 0}%`;
    document.getElementById("femaleBar").style.width = `${total ? female / total * 100 : 0}%`;
  };
  const renderReferrals = (records) => {
    const cases = records.filter((record) => record.status === "refer");
    const leaders = aggregate(cases, "hospitalName").slice(0, 3);
    document.getElementById("referralCount").childNodes[0].nodeValue = String(cases.length);
    document.getElementById("referralList").innerHTML = leaders.length
      ? leaders.map((item) => `<li><span>${item.name}</span><small>${item.count}</small></li>`).join("")
      : `<li>${language === "th" ? "ยังไม่มีรายการส่งต่อ" : "No referrals recorded"}</li>`;
  };
  const renderStock = (items) => {
    document.querySelectorAll(".stock-detail-button").forEach((button) => {
      const total = items.filter((item) => status(item) === button.dataset.medicineStatus).length;
      button.closest(".stock").querySelector("small").textContent = `${total} ${translations[language].items}`;
    });
  };
  const renderExpiry = (items) => {
    const today = day(new Date()), labels = language === "th" ? ["หมดอายุแล้ว", "ภายใน 30 วัน", "1–3 เดือน"] : ["Expired", "Within 30 days", "1–3 months"];
    const counts = [0, 0, 0];
    items.forEach((item) => {
      const expiry = cleanDate(item.expiry || item.expiryDate);
      if (!expiry) return;
      const daysLeft = (day(expiry) - today) / 86400000;
      if (daysLeft < 0) counts[0]++;
      else if (daysLeft <= 30) counts[1]++;
      else if (daysLeft <= 90) counts[2]++;
    });
    const total = counts.reduce((sum, value) => sum + value, 0);
    const rows = counts.map((count, index) => ({ name: labels[index], count, percent: total ? count * 100 / total : 0, color: ["#e00000", "#ff7b00", "#f3da00"][index] })).filter((row) => row.count);
    renderInteractiveDonut("expiryDonut", rows);
    document.querySelector("#expiryDonut strong").innerHTML = `${total}<small>${language === "th" ? "รายการ" : "items"}</small>`;
    document.querySelectorAll(".expiry-legend li").forEach((item, index) => { item.querySelector("span").textContent = `${labels[index]} · ${counts[index]}`; });
  };
  const renderAlerts = (items) => {
    const alerts = (window.FMSNotifications?.getAll(language) || []).map((item) => [item.level, item.title, item.detail]);
    notificationList.innerHTML = alerts.length
      ? alerts.map(([level, title, detail]) => `<article class="notice ${level}${notificationsRead ? " read" : ""}"><i></i><div><b>${title}</b><p>${detail}</p></div></article>`).join("")
      : `<p>${language === "th" ? "ไม่มีการแจ้งเตือนจากข้อมูลปัจจุบัน" : "No alerts from current records"}</p>`;
    notificationBadge.hidden = notificationsRead || alerts.length === 0;
    notificationBadge.textContent = alerts.length;
  };
  let modalStatus = "expired", modalIndex = 0, modalPage = 0;
  const renderModal = () => {
    const items = stock().filter((item) => status(item) === modalStatus), start = modalPage * medicinePageSize, end = Math.min(start + medicinePageSize, items.length);
    const picker = document.getElementById("medicinePicker");
    if (!items.length) {
      picker.replaceChildren();
      document.getElementById("medicinePageSummary").textContent = language === "th" ? "ไม่มีรายการในสถานะนี้" : "No items in this status";
      ["medicineDetailName", "medicineDetailCode", "medicineDetailExpiry", "medicineDetailAlert", "medicineTotalStock", "medicineUsedStock", "medicineRemainingStock"].forEach((id) => { document.getElementById(id).textContent = "-"; });
      document.getElementById("medicineDetailStatus").textContent = "";
      document.getElementById("medicinePrevPage").disabled = document.getElementById("medicineNextPage").disabled = true;
      return;
    }
    modalIndex = Math.min(modalIndex, items.length - 1);
    picker.replaceChildren(...items.slice(start, end).map((item, offset) => { const option = document.createElement("option"); option.value = String(start + offset); option.textContent = `${item.name} · ${item.code || "-"}`; return option; }));
    picker.value = String(modalIndex);
    const item = items[modalIndex], stateLabels = language === "th" ? { expired: "หมดอายุแล้ว", expiring: "ใกล้หมดอายุ", low: "ต่ำกว่า Min Stock", normal: "ปกติ" } : { expired: "Expired", expiring: "Expiring soon", low: "Below minimum stock", normal: "Normal" };
    document.getElementById("medicinePageSummary").textContent = `${start + 1}–${end} / ${items.length}`;
    document.getElementById("medicinePrevPage").disabled = modalPage === 0;
    document.getElementById("medicineNextPage").disabled = end >= items.length;
    document.getElementById("medicineDetailStatus").textContent = stateLabels[modalStatus];
    document.getElementById("medicineDetailName").textContent = item.name;
    document.getElementById("medicineDetailCode").textContent = `รหัสยา: ${item.code || "-"}`;
    document.getElementById("medicineDetailExpiry").textContent = item.expiry || item.expiryDate || "-";
    document.getElementById("medicineDetailAlert").textContent = item.warning || item.benefit || "";
    document.getElementById("medicineTotalStock").textContent = Number(item.total) || 0;
    document.getElementById("medicineUsedStock").textContent = Number(item.used) || 0;
    document.getElementById("medicineRemainingStock").textContent = item.remaining;
    document.getElementById("medicineExpiryAlert").classList.toggle("is-expired", modalStatus === "expired");
    const visual = document.getElementById("medicineDetailImage"), imageSource = String(item.image || "");
    if (!imageSource) {
      if (visual.dataset.imageSource || visual.textContent !== "💊") visual.replaceChildren(document.createTextNode("💊"));
      visual.dataset.imageSource = "";
    } else if (visual.dataset.imageSource !== imageSource) {
      visual.dataset.imageSource = imageSource;
      visual.replaceChildren();
      const image = document.createElement("img");
      image.alt = "";
      image.onerror = () => {
        if (visual.dataset.imageSource === imageSource) visual.replaceChildren(document.createTextNode("💊"));
      };
      image.src = imageSource;
      visual.append(image);
    }
  };
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".stock-detail-button");
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    modalStatus = button.dataset.medicineStatus; modalPage = 0; modalIndex = 0; renderModal();
    document.getElementById("medicineDetailModal").showModal();
  }, true);
  document.addEventListener("click", (event) => {
    const button = event.target.closest("#medicinePrevPage, #medicineNextPage");
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    modalPage += button.id === "medicineNextPage" ? 1 : -1; modalIndex = modalPage * medicinePageSize; renderModal();
  }, true);
  document.addEventListener("change", (event) => {
    if (!event.target.matches("#medicinePicker")) return;
    event.stopImmediatePropagation(); modalIndex = Number(event.target.value); renderModal();
  }, true);

  const render = () => {
    const currentVisits = visits(), currentStock = stock();
    renderTrend(currentVisits);
    renderPie("medicinePie", ".medicine-legend", aggregate(currentVisits, "medicine", true).slice(0, 10), "medicine");
    renderPie("symptomPie", ".symptom-legend", aggregate(currentVisits, "symptom"), "symptom");
    renderGender(currentVisits);
    renderReferrals(currentVisits);
    renderStock(currentStock);
    renderExpiry(currentStock);
    renderAlerts(currentStock);
    if (document.getElementById("medicineDetailModal").open) renderModal();
  };
  window.renderLiveDashboard = render;
  window.getLiveDashboardVisits = visits;
  window.downloadLiveDashboardExcel = () => {
    const rows = [["วันที่", "ผู้รับบริการ", "สาขา", "เพศ", "อาการ", "ยา", "จำนวน", "สถานะ", "โรงพยาบาล"], ...visits().map((record) => [record.createdAt || record.date || "", [record.firstName, record.lastName].filter(Boolean).join(" "), record.branch || "", record.gender || "", record.symptom || "", record.medicine || "", record.quantity || "", record.status || "", record.hospitalName || ""])];
    if (window.XLSX) {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "History");
      XLSX.writeFile(workbook, "FMS-Dashboard-Report.xlsx");
      return;
    }
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    link.download = "FMS-Dashboard-Report.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  startDate.addEventListener("change", render);
  endDate.addEventListener("change", render);
  branchInput.addEventListener("input", render);
  facultySelect.addEventListener("change", render);
  resetButton.addEventListener("click", () => setTimeout(render, 0));
  languageButton.addEventListener("click", () => setTimeout(render, 0));
  window.addEventListener("storage", (event) => { if (["fms-infirmary-visits", "fms-infirmary-history", "fms-stock-records", "fms-dashboard-data"].includes(event.key)) render(); });
  window.addEventListener("focus", () => { render(); refreshDatabaseDashboard(); });
  refreshDatabaseDashboard();
  window.setInterval(refreshDatabaseDashboard, 30000);
  render();
  window.setInterval(render, 5000);
})();
