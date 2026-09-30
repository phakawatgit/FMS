/* Transitional read adapter for legacy screens. Operational data lives in the API,
 * never in browser storage. Synchronous reads preserve existing script ordering. */
(() => {
  const base = window.FMS_API_URL || `${location.protocol}//${location.hostname}:4000`;
  const routes = { 'fms-history-catalog-orders': 'catalog-orders', 'fms-stock-records': 'medicines', 'fms-infirmary-visits': 'infirmary-visits', 'fms-infirmary-history': 'infirmary-visits', 'fms-borrow-return-records': 'loans' };
  const cache = new Map();
  const pending = new Map();
  function requestId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    // getRandomValues also works when the development site uses HTTP on a LAN.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  const display = row => ({ ...row, medicine: (row.dispensations || []).map(i => `${i.name} (${i.code})`).join(', '), quantity: (row.dispensations || []).map(i => `${i.quantity} ${i.unit}`).join(', ') });
  function error(e) {
    const show = () => {
      let el = document.getElementById('realDataError');
      if (!el) { el = document.createElement('p'); el.id = 'realDataError'; el.setAttribute('role', 'alert'); el.style.cssText = 'padding:16px;background:#fff0f0;color:#a00'; (document.querySelector('main') || document.body).prepend(el); }
      el.textContent = e.message + ' — กรุณาโหลดหน้าใหม่';
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show, { once: true });
  }
  function read(key) {
    if (['fms-catalog-cart', 'fms-borrow-products', 'fms-borrow-form'].includes(key)) {
      // Only prune after a successful inventory read. Network errors preserve drafts.
      const records = JSON.parse(read('fms-stock-records'));
      const codes = new Set(records.map(row => String(row.code)));
      const raw = localStorage.getItem(key);
      if (!raw) return raw;
      const value = JSON.parse(raw);
      const selected = key === 'fms-borrow-form' ? value.products : value;
      if (selected && typeof selected === 'object') {
        for (const code of Object.keys(selected)) if (!codes.has(code)) delete selected[code];
        localStorage.setItem(key, JSON.stringify(value));
      }
      return JSON.stringify(value);
    }
    const route = routes[key];
    if (!route) return localStorage.getItem(key);
    if (!cache.has(route)) {
      try {
        const xhr = new XMLHttpRequest(); xhr.open('GET', `${base}/api/${route}`, false); xhr.send();
        const result = JSON.parse(xhr.responseText);
        if (xhr.status !== 200 || !result.success) throw Error(result.message || 'โหลดข้อมูลจริงไม่สำเร็จ');
        let data = result.data;
        if (route === 'medicines') data = data.map(r => ({ ...r, image: r.image ? new URL(r.image, base).href : '' }));
        cache.set(route, data);
      } catch (e) { error(e); throw e; }
    }
    let data = cache.get(route);
    if (route === 'infirmary-visits') data = data.map(display);
    if (key === 'fms-infirmary-history') data = data.filter(r => r.status !== 'observe');
    if (route === 'medicines') data = data.filter(r => r.active);
    return JSON.stringify(data);
  }
  async function request(route, path = '', options = {}) {
    const method = options.method || 'GET';
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    let signature;
    if (method !== 'GET') {
      const body = JSON.parse(options.body || '{}');
      signature = method + route + path + JSON.stringify(body);
      if (!pending.has(signature)) pending.set(signature, requestId());
      headers['Idempotency-Key'] = pending.get(signature);
      options = { ...options, body: JSON.stringify(body) };
    }
    let response;
    try { response = await fetch(`${base}/api/${route}${path}`, { ...options, headers, cache: 'no-store' }); }
    catch { throw Error('เชื่อมต่อ API ไม่ได้ กรุณาลองอีกครั้ง ข้อมูลในฟอร์มยังอยู่'); }
    const result = await response.json();
    if (!response.ok || !result.success) {
      if (response.status < 500) pending.delete(signature);
      throw Error(result.message || 'บันทึกไม่สำเร็จ');
    }
    if (signature) { pending.delete(signature); cache.clear(); }
    return result.data;
  }
  window.FMSData = { getItem: read, request, display, error, clear: () => cache.clear() };
  window.FMSBorrowHistoryStore = { read: () => JSON.parse(read('fms-borrow-return-records')), save: () => { throw Error('ประวัติยืม–คืนต้องบันทึกผ่าน API'); } };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    cache.clear();
    const editing = document.activeElement?.isContentEditable || [...document.querySelectorAll('dialog[open], [role="dialog"], #extendBorrowModal, .hospital-entry.is-open')].some(el => !el.closest('[hidden]') && el.getClientRects().length > 0);
    if (/\/(stock(?:-(?:oral|topical|equipment))?|catalog|history(?:-(?:stock|catalog))?|infirmary-visit-history|pending-assessment|borrow-return(?:-history)?)\.html$/.test(location.pathname) && !editing) location.reload();
  });
})();
