(function () {
  const ACTIVITY_KEY = "fms-admin-audit-log";
  const DELETED_KEY = "fms-admin-deleted-records";

  function read(key) {
    try {
      const value = JSON.parse(FMSStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function write(key, value) {
    try { FMSStorage.setItem(key, JSON.stringify(value)); }
    catch (error) { console.warn("Audit record could not be saved.", error); }
  }

  function log(action, detail = {}) {
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      detail,
      actor: sessionStorage.getItem("fms-admin-session") ? "Admin" : "User",
      createdAt: new Date().toISOString()
    };
    const records = read(ACTIVITY_KEY);
    records.unshift(record);
    write(ACTIVITY_KEY, records.slice(0, 500));
    return record;
  }

  function logDeleted(collection, record, reason = "user-deleted") {
    const deleted = read(DELETED_KEY);
    deleted.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      collection,
      record,
      reason,
      deletedAt: new Date().toISOString()
    });
    write(DELETED_KEY, deleted.slice(0, 500));
    log("delete", { collection, reason });
  }

  window.FMSAdminAudit = { read, write, log, logDeleted, ACTIVITY_KEY, DELETED_KEY };
})();
