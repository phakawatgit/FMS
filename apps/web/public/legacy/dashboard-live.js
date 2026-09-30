/* Live dashboard aggregates the records saved by the infirmary and stock pages. */
(() => {
  let snapshot = null, requestNumber = 0, stale = false;
  const base = window.FMS_API_URL || `${location.protocol}//${location.hostname}:4000`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const visits = () => snapshot?.visits || [];
  const stock = () => snapshot?.stock || [];
  window.dashboardRecords = key => key === 'fms-history-catalog-orders' ? snapshot?.orders || [] : key === 'fms-stock-records' ? stock() : snapshot?.loans || [];
  const cleanDate = value => value ? new Date(value) : null;
  const day = value => new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const message = document.createElement('p'); message.id='dashboardDataStatus'; message.setAttribute('role','status'); message.hidden=true;
  document.querySelector('.filter-card').after(message);
  const trendArea=document.querySelector('.bar-chart');
  const bangkok = value => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
  function defaults() { endDate.value = bangkok(new Date()); startDate.value = new Date(Date.parse(endDate.value+'T00:00:00Z')-29*86400000).toISOString().slice(0,10); }
  defaults();
  exportExcel.disabled=true;exportPdf.disabled=true;
  document.querySelectorAll('#maleCount,#femaleCount,.stock small').forEach(el=>el.textContent='-');
  document.getElementById('referralCount').childNodes[0].nodeValue='-';
  function dimensions() {
    const selectedFaculty = facultySelect.value, selectedBranch = branchInput.value;
    const faculties = [...new Set(snapshot.dimensions.map(d=>d.faculty).filter(Boolean))];
    facultySelect.replaceChildren(new Option(translations[language].all,'all'), ...faculties.map(f=>new Option(facultyLabels[f]?.[language]||f,f)));
    facultySelect.value = faculties.includes(selectedFaculty) ? selectedFaculty : 'all';
    const branches = [...new Set(snapshot.dimensions.filter(d=>facultySelect.value==='all'||d.faculty===facultySelect.value).map(d=>d.branch).filter(Boolean))];
    branchInput.replaceChildren(new Option(translations[language].all,'all'), ...branches.map(b=>new Option(displayBranch(b),b)));
    branchInput.value = branches.includes(selectedBranch) ? selectedBranch : 'all';
    rebuildCustomSelect(facultySelect); rebuildCustomSelect(branchInput);
  }
  renderBranchOptions = () => { if(snapshot) dimensions(); };
  async function refresh() {
    const current = ++requestNumber;
    if (startDate.value && endDate.value && startDate.value > endDate.value) { message.hidden=false; message.textContent = language==='th'?'วันเริ่มต้นต้องไม่เกินวันสิ้นสุด':'Start date must not exceed end date'; return; }
    message.hidden=true;
    message.textContent = language==='th'?'กำลังโหลดข้อมูล…':'Loading…';
    try {
      const query = new URLSearchParams({start:startDate.value,end:endDate.value,faculty:facultySelect.value,branch:branchInput.value});
      const response = await fetch(`${base}/api/dashboard?${query}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
      const result = await response.json(); if(!response.ok || !result.success) throw Error(result.message || 'API error');
      if(current!==requestNumber)return;
      snapshot=result.data; stale=false; exportExcel.disabled=false; exportPdf.disabled=false; startDate.value=snapshot.filters.start; endDate.value=snapshot.filters.end;
      dimensions(); render(); window.renderPurchaseHistory?.();
    } catch(error) { if(current!==requestNumber)return; stale=true; message.hidden=false; message.textContent = (language==='th'?'โหลดไม่สำเร็จ — ':'Load failed — ') + (snapshot ? `${language==='th'?'แสดงข้อมูลเดิม ณ':'Showing previous data from'} ${snapshot.updatedAt}` : (language==='th'?'ยังไม่มีข้อมูลที่ยืนยันจากฐานข้อมูล':'No confirmed database data'));
      if(!snapshot) document.querySelectorAll('#maleCount,#femaleCount,.stock small').forEach(el=>el.textContent='-');
    }
  }
  const colors = ["#ff97a3", "#ffca91", "#f7d96b", "#92e4ca", "#80d4f6", "#ab96e8", "#f496d4", "#a8df82", "#f1ad75", "#83a4ef"];
  const emptyText = (type) => language === "th"
    ? (type === "medicine" ? "ยังไม่มีข้อมูลการจ่ายยา" : "ยังไม่มีข้อมูลอาการ")
    : (type === "medicine" ? "No medicine usage recorded" : "No symptoms recorded");
  const renderLegend = (selector, rows) => {
    const list = document.querySelector(selector);
    list.replaceChildren();
    if (!rows.length) return;
    rows.forEach((row) => {
      const item = document.createElement("li"), swatch = document.createElement("i"), label = document.createElement("span");
      swatch.style.cssText = `display:inline-block;width:9px;height:9px;border-radius:50%;background:${row.color};margin-right:7px`;
      label.textContent = `${row.name} · ${row.count}${row.detail ? ` (${row.detail})` : ''}`;
      item.replaceChildren(swatch, label);
      list.append(item);
    });
  };
  const renderPie = (id, selector, rows, type) => {
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    if (!total) {
      document.getElementById(id).replaceChildren();
      renderLegend(selector, []);
      return;
    }
    const chartData = rows.map((row, index) => ({ ...row, percent: row.count * 100 / total, color: colors[index % colors.length] }));
    renderInteractivePie(id, chartData);
    renderLegend(selector, chartData);
  };
  const status = item => item.status;
  const renderTrend = () => {
    const rows=snapshot.trend, max=Math.max(1,...rows.map(r=>r.count));
    const step=Math.max(1,Math.ceil(rows.length/8));
    document.querySelector('.bars').innerHTML=rows.map((r,index)=>`<i style="--h:${r.count/max*100}%" title="${esc(r.date)}: ${r.count}" aria-label="${esc(r.date)}: ${r.count}"><b>${index%step===0||index===rows.length-1?esc(snapshot.trendInterval==='month'?r.date:r.date.slice(5)):''}</b></i>`).join('');
    trendArea.setAttribute('aria-label', `${snapshot.filters.start} - ${snapshot.filters.end}: ${snapshot.totalVisits}`);
  };
  const renderGender = () => {
    const {male,female,other}=snapshot.gender,total=snapshot.totalVisits;
    document.getElementById('maleCount').textContent=total?male:'-';document.getElementById('femaleCount').textContent=total?female:'-';
    document.querySelector('.gender-bars').setAttribute('aria-label',`Male: ${male}, Female: ${female}, Other/unspecified: ${other}, Total: ${total}`);
    document.getElementById('maleBar').style.width=`${total?male/total*100:0}%`; document.getElementById('femaleBar').style.width=`${total?female/total*100:0}%`;
  };
  const renderReferrals = () => {
    const r=snapshot.referrals;
    document.getElementById('referralCount').childNodes[0].nodeValue=r.count ? String(r.count) : '-';
    document.getElementById('referralList').innerHTML=r.hospitals.map(i=>`<li><span>${esc(i.name)}</span><small>${i.count}</small></li>`).join('') + (r.missingHospital ? `<li>${language==='th'?'ไม่ระบุโรงพยาบาล':'Hospital unspecified'}: ${r.missingHospital}</li>` : '');
  };
  const renderStock = (items) => {
    document.querySelectorAll(".stock-detail-button").forEach((button) => {
      const total = items.filter((item) => status(item) === button.dataset.medicineStatus).length;
      button.closest(".stock").querySelector("small").textContent = `${total} ${translations[language].items}`;
    });
  };
  const renderExpiry = (items) => {
    const today = day(new Date()), labels = language === "th" ? ["หมดอายุแล้ว", "ภายใน 30 วัน", "31–90 วัน"] : ["Expired", "Within 30 days", "31–90 days"];
    const counts = [0, 0, 0];
    items.forEach((item) => {
      const expiry = cleanDate(item.expiry || item.expiryDate);
      if (!expiry) return;
      const daysLeft = item.daysLeft;
      if (daysLeft < 0) counts[0]++;
      else if (daysLeft <= 30) counts[1]++;
      else if (daysLeft <= 90) counts[2]++;
    });
    const total = counts.reduce((sum, value) => sum + value, 0);
    const rows = counts.map((count, index) => ({ name: labels[index], count, percent: total ? count * 100 / total : 0, color: ["#e00000", "#ff7b00", "#f3da00"][index] })).filter((row) => row.count);
    renderInteractiveDonut("expiryDonut", rows);
    document.querySelector("#expiryDonut strong").innerHTML = `${total || '-'}<small>${language === "th" ? "รายการ" : "items"}</small>`;
    document.querySelectorAll(".expiry-legend li").forEach((item, index) => { item.querySelector("span").textContent = `${labels[index]} · ${counts[index]}`; });
  };
  let alertFingerprint = '';
  const renderAlerts = (items) => {
    const alerts = (window.FMSNotifications?.getAll(language) || []).map((item) => [item.level, item.title, item.detail]);
    const fingerprint=JSON.stringify(alerts);if(fingerprint!==alertFingerprint){notificationsRead=false;alertFingerprint=fingerprint;}
    notificationList.innerHTML = alerts.length
      ? alerts.map(([level, title, detail]) => `<article class="notice ${level}${notificationsRead ? " read" : ""}"><i></i><div><b>${esc(title)}</b><p>${esc(detail)}</p></div></article>`).join("")
      : `<p>${language === "th" ? "ไม่มีการแจ้งเตือนจากข้อมูลปัจจุบัน" : "No alerts from current records"}</p>`;
    notificationBadge.hidden = notificationsRead || alerts.length === 0;
    notificationBadge.textContent = alerts.length;
  };
  let modalStatus = "expired", modalIndex = 0, modalPage = 0;
  const renderModal = () => {
    const items = stock().filter((item) => status(item) === modalStatus);
    modalPage = Math.max(0,Math.min(modalPage,Math.ceil(items.length/medicinePageSize)-1));
    const start = modalPage * medicinePageSize, end = Math.min(start + medicinePageSize, items.length);
    const picker = document.getElementById("medicinePicker");
    if (!items.length) {
      picker.replaceChildren();
      document.getElementById("medicinePageSummary").textContent = language === "th" ? "ไม่มีรายการในสถานะนี้" : "No items in this status";
      ["medicineDetailName", "medicineDetailCode", "medicineDetailExpiry", "medicineDetailAlert", "medicineTotalStock", "medicineUsedStock", "medicineRemainingStock"].forEach((id) => { document.getElementById(id).textContent = "-"; });
      document.getElementById("medicineDetailStatus").textContent = "";
      document.getElementById("medicinePrevPage").disabled = document.getElementById("medicineNextPage").disabled = true;
      return;
    }
    modalIndex = Math.max(start,Math.min(modalIndex, end - 1));
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
    const visual = document.getElementById("medicineDetailImage"); visual.replaceChildren();
    if (item.image) { const image = document.createElement("img"); image.src = new URL(item.image,base).href; image.alt = item.name; visual.append(image); } else visual.textContent = "💊";
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
    if(!snapshot)return;
    message.textContent=`${snapshot.filters.start} – ${snapshot.filters.end} · ${language==='th'?'เข้ารักษา':'Visits'} ${snapshot.totalVisits} · ${language==='th'?'อัปเดต':'Updated'} ${new Date(snapshot.updatedAt).toLocaleString(language==='th'?'th-TH':'en-US',{timeZone:'Asia/Bangkok'})}`;
    if(stale) message.textContent=(language==='th'?'โหลดไม่สำเร็จ — แสดงข้อมูลเดิม: ':'Load failed — previous data: ')+message.textContent;
    message.hidden=!stale;
    document.querySelector('h1').title=message.textContent;
    document.querySelector('.medicine-panel .panel-title').textContent=translations[language].topMedicines;
    const currentVisits = visits(), currentStock = stock();
    renderTrend();
    const leaders=snapshot.topMedicines.map(row=>({...row,name:`${row.name} (${row.code})`,detail:Object.entries(row.quantities).map(([unit,n])=>`${n} ${unit}`).join(' / ')}));
    renderPie('medicinePie','.medicine-legend',leaders,'medicine');
    renderPie("symptomPie", ".symptom-legend", snapshot.symptoms, "symptom");
    renderGender(currentVisits);
    renderReferrals(currentVisits);
    renderStock(currentStock);
    renderExpiry(currentStock);
    renderAlerts(currentStock);
    if (document.getElementById("medicineDetailModal").open) renderModal();
  };
  markNotificationsRead.addEventListener('click',()=>{notificationsRead=true;if(snapshot)renderAlerts();});
  window.renderLiveDashboard = render;
  window.getLiveDashboardVisits = visits;
  window.downloadLiveDashboardExcel = () => {
    if(!snapshot)return;
    const tables = [
      ['Filters', [['Start','End','Faculty','Branch','Updated'],Object.values(snapshot.filters).concat(snapshot.updatedAt)]],
      ['Summary',[['Visits','Male','Female','Other','Referrals'],[snapshot.totalVisits,...Object.values(snapshot.gender),snapshot.referrals.count]]],
      ['Trend',[['Date','Visits'],...snapshot.trend.map(r=>[r.date,r.count])]],
      ['Medicines',[['Code','Medicine','Visits','Quantity'],...snapshot.topMedicines.map(r=>[r.code,r.name,r.count,Object.entries(r.quantities).map(([u,n])=>`${n} ${u}`).join('; ')])]],
      ['Symptoms',[['Symptom','Visits'],...snapshot.symptoms.map(r=>[r.name,r.count])]],
      ['Hospitals',[['Hospital','Referrals'],...snapshot.referrals.hospitals.map(r=>[r.name,r.count]),['Unspecified',snapshot.referrals.missingHospital]]],
      ['Stock',[['Code','Medicine','Unit','Total','Dispensed','Borrowed','Manual','Remaining','Expiry','Status'],...stock().map(r=>[r.code,r.name,r.unit,r.total,r.dispensed,r.borrowed,r.manualUsed,r.remaining,r.expiry,r.status])]],
      ['Visits',[['Date','Name','Faculty','Branch','Gender','Symptom','Medicines','Status','Hospital'],...visits().map(r=>[r.createdAt,`${r.firstName} ${r.lastName}`,r.faculty,r.branch,r.gender,r.symptom,r.dispensations.map(i=>`${i.name}: ${i.quantity} ${i.unit}`).join('; '),r.status,r.hospitalName])]],
      ['Orders',[['ID','Date','Title','Status','Items'],...snapshot.orders.map(r=>[r.id,r.createdAt||r.date,r.title,r.status,JSON.stringify(r.items||[])])]]
    ];
    const cell=value=>{const text=String(value??'');return /^[=+@-]/.test(text)?"'"+text:text;};
    const xml='<?xml version="1.0" encoding="UTF-8"?>'+'<?mso-application progid="Excel.Sheet"?>'+'<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'+tables.map(([name,rows])=>`<Worksheet ss:Name="${esc(name)}"><Table>${rows.map(row=>`<Row>${row.map(v=>`<Cell><Data ss:Type="String">${esc(cell(v))}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet>`).join('')+'</Workbook>';
    downloadBlob(new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'}),'FMS-Dashboard-Report.xml');
  };
  startDate.addEventListener('change',refresh); endDate.addEventListener('change',refresh);
  facultySelect.removeEventListener('change',renderBranchOptions);
  facultySelect.addEventListener('change',()=>{branchInput.value='all';if(snapshot)dimensions();refresh();});
  branchInput.addEventListener('change',refresh);
  resetButton.addEventListener('click',()=>{defaults();if(snapshot)dimensions();refresh();});
  languageButton.addEventListener('click',()=>{if(snapshot)dimensions();render();});
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
  setInterval(()=>{if(document.visibilityState==='visible')refresh();},30000);
  window.refreshDashboard=refresh;
  refresh();
})();
