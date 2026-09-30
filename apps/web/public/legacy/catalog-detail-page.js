(async function () {
const detailPageRecords = await MedicineAPI.list();
const detailPageRecord = detailPageRecords.find((item) => String(item.code || "") === String(new URLSearchParams(location.search).get("code") || ""));

document.querySelector(".language")?.addEventListener("click", () => {
  const english = document.documentElement.lang !== "en";
  document.documentElement.lang = english ? "en" : "th";
  document.querySelector(".language span").textContent = english ? "English" : "ไทย";
});
document.getElementById("exportPdf")?.addEventListener("click", () => window.print());
document.getElementById("exportExcel")?.addEventListener("click", () => {
  if (!detailPageRecord) return;
  const rows = [["Name", "Code", "Category", "Total", "Used", "Remaining"], [detailPageRecord.name || detailPageRecord.productName || "", detailPageRecord.code || "", detailPageRecord.category || "", detailPageRecord.total || 0, detailPageRecord.used || 0, Math.max(0, (Number(detailPageRecord.total) || 0) - (Number(detailPageRecord.used) || 0))]];
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff" + rows.map((row) => row.join(",")).join("\n")], { type: "text/csv" }));
  link.download = `${detailPageRecord.code || "catalog-item"}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});
const detailNotificationButton = document.getElementById("notificationButton");
const detailNotificationPanel = document.getElementById("notificationPanel");
detailNotificationButton?.addEventListener("click", () => { detailNotificationPanel.hidden = !detailNotificationPanel.hidden; });
document.getElementById("closeNotification")?.addEventListener("click", () => { detailNotificationPanel.hidden = true; });

})().catch(MedicineAPI.error);
