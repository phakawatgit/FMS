(function () {
  const base = window.FMS_API_URL || `${location.protocol}//${location.hostname}:4000`;
  function normalize(row) { return { ...row, image: row.image ? new URL(row.image, base).href : "" }; }
  async function request(path = "", options = {}) {
    const result = await FMSData.request('medicines', path, options);
    return Array.isArray(result) ? result.filter(row => row.active).map(normalize) : normalize(result);
  }
  let records;
  window.MedicineAPI = {
    request,
    list: () => records ||= request().catch(error => { records = null; throw error; }),
    error(error) {
      let message = document.getElementById("medicineApiError");
      if (!message) {
        message = document.createElement("p"); message.id = "medicineApiError"; message.setAttribute("role", "alert");
        (document.querySelector("main") || document.body).prepend(message);
      }
      message.replaceChildren(document.createTextNode(error.message + " "));
      const retry = document.createElement("button"); retry.type = "button"; retry.textContent = "ลองโหลดใหม่";
      retry.onclick = () => location.reload(); message.append(retry);
    },
  };
})();
