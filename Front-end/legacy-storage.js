(function () {
  "use strict";

  // Both Live Server and Docker use the API on port 4000. Using the current
  // hostname also works when the page is opened via 127.0.0.1.
  const apiBase = window.FMS_API_URL || `${location.protocol}//${location.hostname}:4000`;
  const endpoint = `${apiBase}/api/legacy-storage`;
  const nativeStorage = window.localStorage;
  const nativeSetItem = nativeStorage.setItem.bind(nativeStorage);
  const nativeRemoveItem = nativeStorage.removeItem.bind(nativeStorage);
  const pending = new Set();
  let hydrated = false;

  function readLocalStorage() {
    const values = {};
    for (let index = 0; index < nativeStorage.length; index += 1) {
      const key = nativeStorage.key(index);
      if (!key) continue;
      const raw = nativeStorage.getItem(key);
      try { values[key] = JSON.parse(raw); } catch (_) { values[key] = raw; }
    }
    return values;
  }

  function migrateMissingLocalData(remote) {
    const local = readLocalStorage();
    const missing = {};
    Object.entries(local).forEach(([key, value]) => {
      if (!Object.prototype.hasOwnProperty.call(remote, key)) missing[key] = value;
    });
    if (!Object.keys(missing).length) return;
    fetch(`${endpoint}/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: missing, preserveExisting: true }),
    }).catch(() => {});
  }

  function sync(key, value) {
    if (pending.has(key)) return;
    pending.add(key);
    fetch(`${endpoint}/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    }).catch(() => {}).finally(() => pending.delete(key));
  }

  // Fetch before the page's other scripts run. If the API is unavailable,
  // localStorage remains the offline fallback.
  try {
    const request = new XMLHttpRequest();
    request.open("GET", endpoint, false);
    request.send();
    if (request.status >= 200 && request.status < 300) {
      const remote = JSON.parse(request.responseText).data || {};
      Object.entries(remote).forEach(([key, value]) => nativeSetItem(key, typeof value === "string" ? value : JSON.stringify(value)));
      migrateMissingLocalData(remote);
      hydrated = true;
    }
  } catch (_) {
    // Live Server can still be used offline; the browser-local copy remains available.
  }

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (key, value) {
    originalSetItem.call(this, key, value);
    if (this === nativeStorage && hydrated) {
      try { sync(String(key), JSON.parse(value)); } catch (_) { sync(String(key), value); }
    }
  };
  Storage.prototype.removeItem = function (key) {
    originalRemoveItem.call(this, key);
    if (this === nativeStorage && hydrated) fetch(`${endpoint}/${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => {});
  };

})();
