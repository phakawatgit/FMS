(function () {
  const storageKey = "fms-infirmary-visits";
  const apiBase = window.FMS_API_URL || `${location.protocol}//${location.hostname}:4000`;
  const originalSetItem = Storage.prototype.setItem;

  Storage.prototype.setItem = function (key, value) {
    originalSetItem.call(this, key, value);
    if (this !== localStorage || key !== storageKey) return;

    try {
      JSON.parse(value).forEach((record) => {
        if (!record.id || !record.status) return;
        fetch(`${apiBase}/api/infirmary-visits/${encodeURIComponent(record.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: record.status, hospitalName: record.hospitalName }),
        }).catch((error) => console.error("Infirmary assessment sync failed:", error));
      });
    } catch (error) {
      console.error("Infirmary assessment sync failed:", error);
    }
  };
})();