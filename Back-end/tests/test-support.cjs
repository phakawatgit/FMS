const { randomUUID } = require('node:crypto');
// Adapt older regression tests to the explicit mutation contract. UI code itself
// still sends its own reasons and idempotency keys.
module.exports = function setup(api) {
  const keys = new Set();
  const nativeFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (!String(url).startsWith(api) || !options.method || options.method === 'GET') return nativeFetch(url, options);
    const body = JSON.parse(options.body || '{}');
    const key = randomUUID(); keys.add(key);
    const match = String(url).match(/\/api\/medicines\/([^/]+)/);
    if (match && options.method === 'PATCH') {
      body.reason = 'Regression test adjustment';
    }
    if (options.method === 'POST' && String(url).endsWith('/api/medicines')) body.unit ||= 'tablet';
    return nativeFetch(url, { ...options, headers: { ...options.headers, 'Idempotency-Key': key }, body: JSON.stringify(body) });
  };
  return {
    keys,
    async context(context) {
      await context.route(/https:\/\/(fonts\.googleapis|fonts\.gstatic)/, r => r.abort());
      await context.route('**/api/legacy-storage**', r=>r.fulfill({contentType:'application/json',body:'{"success":true,"data":{}}'}));
      context.on('request',r=>{const key=r.headers()['idempotency-key'];if(key)keys.add(key);});
      context.on('page',p=>p.on('dialog',d=>d.accept('Regression test adjustment')));
    },
    cleanup: db=>db.inventoryRequest.deleteMany({where:{id:{in:[...keys]}}})
  };
};
