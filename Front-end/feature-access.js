(function () {
  "use strict";

  const blockedAdminPages = new Set([
    "assessment-detail.html",
    "borrow-form.html",
    "borrow-return-history.html",
    "borrow-return.html",
    "borrow-selected.html",
    "duty-shift.html",
    "history-stock.html",
    "infirmary-visit-history.html",
    "infirmary-visit.html",
    "pending-assessment.html",
    "return-form.html",
    "stock-add.html",
    "stock-detail.html",
    "stock-equipment.html",
    "stock-oral.html",
    "stock-topical.html",
    "stock.html",
  ]);
  const page = location.pathname.split("/").pop().toLowerCase();
  if (!blockedAdminPages.has(page)) return;

  document.documentElement.style.visibility = "hidden";
  const reveal = () => { document.documentElement.style.visibility = ""; };
  let cachedRole = "";
  try {
    cachedRole = JSON.parse(sessionStorage.getItem("fms-admin-session") || "null")?.role?.toUpperCase() || "";
  } catch {}

  if (cachedRole === "ADMIN") {
    location.replace("./menu.html");
    return;
  }

  fetch(`${window.FMS_API_URL || ""}/api/auth/session`, { credentials: "include" })
    .then((response) => response.ok ? response.json() : null)
    .then((result) => {
      const role = String(result?.data?.user?.role || "").toUpperCase();
      if (role === "ADMIN") {
        try { sessionStorage.setItem("fms-admin-session", JSON.stringify({ role: "admin" })); } catch {}
        location.replace("./menu.html");
        return;
      }
      reveal();
    })
    .catch(reveal);
})();
