(function () {
  "use strict";

  const apiBase = window.FMS_API_URL || `${location.protocol}//${location.hostname}:4000`;
  const endpoint = `${apiBase}/api/legacy-storage`;
  const values = new Map();
  let storageReady = false;

  function request(method, url, body) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, false);
    if (body !== undefined) xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(body === undefined ? null : JSON.stringify(body));
    if (xhr.status < 200 || xhr.status >= 300) {
      throw new Error(`Legacy storage request failed (${xhr.status || "network error"}).`);
    }
    return xhr.responseText ? JSON.parse(xhr.responseText) : {};
  }

  function showStorageError() {
    let notice = document.getElementById("fms-storage-error");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "fms-storage-error";
      notice.setAttribute("role", "alert");
      notice.textContent = "เชื่อมต่อฐานข้อมูลไม่ได้ ข้อมูลยังไม่ได้บันทึก กรุณาลองใหม่เมื่อติดต่อระบบได้";
      Object.assign(notice.style, {
        position: "fixed", zIndex: "99999", inset: "0 0 auto", padding: "12px 18px",
        color: "#fff", background: "#a32323", textAlign: "center", font: "16px sans-serif"
      });
      document.addEventListener("DOMContentLoaded", () => document.body.prepend(notice), { once: true });
      if (document.body) document.body.prepend(notice);
    }
  }

  function dispatchChange(key) {
    window.dispatchEvent(new StorageEvent("storage", { key }));
  }

  try {
    const response = request("GET", endpoint);
    Object.entries(response.data || {}).forEach(([key, value]) => values.set(key, value));

    // One-time import of existing FMS browser records. The server copy wins on
    // conflicts; browser data is removed only after the server confirms the import.
    const oldStorage = window.localStorage;
    const pendingImport = {};
    for (let index = 0; index < oldStorage.length; index += 1) {
      const key = oldStorage.key(index);
      if (!key || !key.startsWith("fms-") || key === "fms-admin-session" || values.has(key)) continue;
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
      if (key?.startsWith("fms-")) oldStorage.removeItem(key);
    }
    storageReady = true;
  } catch (error) {
    console.error("FMS legacy storage is unavailable.", error);
    showStorageError();
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
          headers: { "Content-Type": "application/json" },
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
        showStorageError();
        throw error;
      }
    },
    async createBorrowRecord(record) {
      const response = await fetch(`${apiBase}/api/borrow-records`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || `Borrow save failed (${response.status}).`);
      values.set("fms-borrow-return-records", [result.data, ...(values.get("fms-borrow-return-records") || []).filter((item) => String(item.id) !== String(result.data.id))]);
      dispatchChange("fms-borrow-return-records");
      return result.data;
    },
    async returnBorrowRecord(id, items) {
      const response = await fetch(`${apiBase}/api/borrow-records/${encodeURIComponent(id)}/returns`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
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
        if (name === "fms-stock-records") {
          const result = request("PUT", `${apiBase}/api/catalog`, { records: value });
          value = result.data || [];
        } else {
          request("PUT", `${endpoint}/${encodeURIComponent(name)}`, { value });
        }
        values.set(name, value);
        dispatchChange(name);
      } catch (error) {
        console.error("FMS data was not saved.", error);
        showStorageError();
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
        showStorageError();
        throw error;
      }
    },
    clear() {
      Array.from(values.keys()).forEach((key) => this.removeItem(key));
    }
  });
})();
