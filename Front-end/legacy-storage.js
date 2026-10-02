(function () {
  "use strict";

  const apiBase = window.FMS_API_URL || `${location.protocol}//${location.hostname}:4000`;
  const endpoint = `${apiBase}/api/legacy-storage`;
  const isLoginPage = location.pathname.endsWith("/index.html") || location.pathname === "/";
  const values = new Map();
  let storageReady = false;

  function csrfToken() {
    const entry = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("fms_csrf="));
    return entry ? decodeURIComponent(entry.slice("fms_csrf=".length)) : "";
  }

  function request(method, url, body) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, false);
    xhr.withCredentials = true;
    const csrf = csrfToken();
    if (csrf && !["GET", "HEAD", "OPTIONS"].includes(method)) xhr.setRequestHeader("X-FMS-CSRF", csrf);
    if (body !== undefined) xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(body === undefined ? null : JSON.stringify(body));
    if (xhr.status < 200 || xhr.status >= 300) {
      let responseMessage = "";
      try { responseMessage = JSON.parse(xhr.responseText || "{}").message || ""; } catch {}
      const error = new Error(responseMessage || `Legacy storage request failed (${xhr.status || "network error"}).`);
      error.status = xhr.status;
      throw error;
    }
    return xhr.responseText ? JSON.parse(xhr.responseText) : {};
  }

  function showStorageError(error) {
    let notice = document.getElementById("fms-storage-error");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "fms-storage-error";
      notice.setAttribute("role", "alert");
      Object.assign(notice.style, {
        position: "fixed", zIndex: "99999", inset: "0 0 auto", padding: "12px 18px",
        color: "#fff", background: "#a32323", textAlign: "center", font: "16px sans-serif"
      });
      document.addEventListener("DOMContentLoaded", () => document.body.prepend(notice), { once: true });
      if (document.body) document.body.prepend(notice);
    }
    notice.textContent = error?.status === 401
      ? "กรุณาเข้าสู่ระบบใหม่ก่อนใช้งานข้อมูลส่วนกลาง"
      : error?.status === 403
        ? error.message === "CSRF validation failed"
          ? "เซสชันหมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่"
          : "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้ กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบหรือตรวจสอบสิทธิ์"
        : "เชื่อมต่อฐานข้อมูลไม่ได้ ข้อมูลยังไม่ได้บันทึก กรุณาลองใหม่เมื่อติดต่อระบบได้";
  }

  function dispatchChange(key) {
    window.dispatchEvent(new StorageEvent("storage", { key }));
  }

  try {
    const response = isLoginPage ? { data: {} } : request("GET", endpoint);
    Object.entries(response.data || {}).forEach(([key, value]) => values.set(key, value));

    if (!isLoginPage) {
    const dutyResponse = request("GET", `${apiBase}/api/duty-shifts`);
    if (Array.isArray(dutyResponse.data) && (dutyResponse.data.length || values.has("fms-local-duty-records"))) {
      values.set("fms-local-duty-records", dutyResponse.data);
    }
    // One-time import of existing FMS browser records. The server copy wins on
    // conflicts; browser data is removed only after the server confirms the import.
    const oldStorage = window.localStorage;
    const pendingImport = {};
    let isAdmin = false;
    try { isAdmin = JSON.parse(sessionStorage.getItem("fms-admin-session") || "null")?.role === "admin"; } catch {}
    const nurseImportKeys = new Set(["fms-infirmary-visits", "fms-infirmary-history", "fms-local-duty-records", "fms-duty-profiles"]);
    for (let index = 0; index < oldStorage.length; index += 1) {
      const key = oldStorage.key(index);
      if (!key || !key.startsWith("fms-") || key === "fms-admin-session" || values.has(key)) continue;
      if (!isAdmin && !nurseImportKeys.has(key)) continue;
      const raw = oldStorage.getItem(key);
      try { pendingImport[key] = JSON.parse(raw); } catch { pendingImport[key] = raw; }
    }
    if (Object.keys(pendingImport).length) {
      Object.entries(pendingImport).forEach(([key, value]) => {
        request("PUT", `${endpoint}/${encodeURIComponent(key)}`, { value });
        values.set(key, value);
      });
    }

    // Remove old FMS browser copies after the server is confirmed available.
    for (let index = oldStorage.length - 1; index >= 0; index -= 1) {
      const key = oldStorage.key(index);
      if (key?.startsWith("fms-") && (values.has(key) || Object.hasOwn(pendingImport, key))) oldStorage.removeItem(key);
    }
    }
    storageReady = true;
  } catch (error) {
    console.error("FMS legacy storage is unavailable.", error);
    showStorageError(error);
  }

  window.FMSStorage = Object.freeze({
    get length() { return values.size; },
    key(index) { return Array.from(values.keys())[index] ?? null; },
    getItem(key) {
      if (!storageReady) return null;
      const value = values.get(String(key));
      return value === undefined || value === null
        ? null
        : typeof value === "string" ? value : JSON.stringify(value);
    },
    async saveInfirmaryVisit(record) {
      if (!storageReady) {
        showStorageError();
        throw new Error("FMS legacy storage is unavailable.");
      }
      try {
        const response = await fetch(`${apiBase}/api/infirmary-visits`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "X-FMS-CSRF": csrfToken() },
          body: JSON.stringify({ record }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || `Visit save failed (${response.status}).`);
        }
        values.set("fms-infirmary-visits", result.data.records);
        dispatchChange("fms-infirmary-visits");
        return result.data;
      } catch (error) {
        console.error("Infirmary visit was not saved.", error);
        showStorageError(error);
        throw error;
      }
    },
    async createBorrowRecord(record) {
      const response = await fetch(`${apiBase}/api/borrow-records`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-FMS-CSRF": csrfToken() }, body: JSON.stringify(record) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || `Borrow save failed (${response.status}).`);
      values.set("fms-borrow-return-records", [result.data, ...(values.get("fms-borrow-return-records") || []).filter((item) => String(item.id) !== String(result.data.id))]);
      dispatchChange("fms-borrow-return-records");
      return result.data;
    },
    async returnBorrowRecord(id, items) {
      const response = await fetch(`${apiBase}/api/borrow-records/${encodeURIComponent(id)}/returns`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-FMS-CSRF": csrfToken() }, body: JSON.stringify({ items }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || `Return save failed (${response.status}).`);
      const records = values.get("fms-borrow-return-records") || [];
      values.set("fms-borrow-return-records", [result.data, ...records.filter((item) => String(item.id) !== String(result.data.id))]);
      dispatchChange("fms-borrow-return-records");
      return result.data;
    },
    setItem(key, rawValue) {
      if (!storageReady) {
        showStorageError();
        throw new Error("FMS legacy storage is unavailable.");
      }
      const name = String(key);
      const raw = String(rawValue);
      let value = raw;
      try { value = JSON.parse(raw); } catch {}
      try {
        if (name === "fms-local-duty-records") {
          const result = request("POST", `${apiBase}/api/duty-shifts`, { records: value });
          value = result.data || [];
        } else if (name === "fms-stock-records") {
          const result = request("PUT", `${apiBase}/api/catalog`, { records: value });
          value = result.data || [];
        } else {
          request("PUT", `${endpoint}/${encodeURIComponent(name)}`, { value });
        }
        values.set(name, value);
        dispatchChange(name);
      } catch (error) {
        console.error("FMS data was not saved.", error);
        showStorageError(error);
        throw error;
      }
    },
    addCatalogRecord(record) {
      if (!storageReady) {
        showStorageError();
        throw new Error("FMS legacy storage is unavailable.");
      }
      try {
        const result = request("POST", `${apiBase}/api/catalog`, { record });
        const records = values.get("fms-stock-records") || [];
        values.set("fms-stock-records", [result.data, ...records.filter((item) => item.code !== result.data.code)]);
        dispatchChange("fms-stock-records");
        return result.data;
      } catch (error) {
        console.error("Catalog item was not added.", error);
        showStorageError(error);
        throw error;
      }
    },
    removeItem(key) {
      if (!storageReady) {
        showStorageError();
        throw new Error("FMS legacy storage is unavailable.");
      }
      const name = String(key);
      try {
        if (name === "fms-stock-records") request("PUT", `${apiBase}/api/catalog`, { records: [] });
        else request("DELETE", `${endpoint}/${encodeURIComponent(name)}`);
        values.delete(name);
        dispatchChange(name);
      } catch (error) {
        console.error("FMS data was not deleted.", error);
        showStorageError(error);
        throw error;
      }
    },
    clear() {
      Array.from(values.keys()).forEach((key) => this.removeItem(key));
    }
  });
})();
