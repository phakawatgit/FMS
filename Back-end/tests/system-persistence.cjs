const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const db = require('../src/lib/prisma');
const base = 'http://127.0.0.1:4015';
const marker = `system-test-${randomUUID()}`;
const keys = [], medicines = [], orders = [];
let server;
async function start() {
  server = spawn(process.execPath, ['src/server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: '4015', PUBLIC_API_URL: base }, stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/api/health')).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Test API did not start');
}
async function stop() { if (server && server.exitCode === null) { const done = new Promise(r => server.once('exit', r)); server.kill(); await done; } }
async function request(route, method = 'GET', body, status = 200, key = randomUUID()) {
  keys.push(key);
  const response = await fetch(base + '/api/' + route, { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, ...(status === 401 ? { Authorization: '' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result.data;
}
(async () => {
  try {
    await start();
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } }).png().toBuffer();
    const data = { name: marker, category: 'oral', unit: 'tablet', total: 100, image: 'data:image/png;base64,' + png.toString('base64') };
    const row = await request('medicines', 'POST', data, 201); medicines.push(row.id);
    assert.equal(row.imageUrl, `${base}/api/medicines/${row.id}/image`);
    assert.equal((await db.medicine.findUnique({ where: { id: row.id } })).imageUrl, row.imageUrl);
    const firstImage = await fetch(row.imageUrl); assert.equal(firstImage.status, 200);
    assert.equal(firstImage.headers.get('content-type'), 'image/jpeg');
    const before = Buffer.from(await firstImage.arrayBuffer());
    const blue = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'blue' } }).png().toBuffer();
    const replaced = await request(`medicines/${row.id}`, 'PATCH', { image: 'data:image/png;base64,' + blue.toString('base64') });
    assert.equal(replaced.imageUrl, row.imageUrl);
    assert.notDeepEqual(Buffer.from(await (await fetch(row.imageUrl)).arrayBuffer()), before);
    const order = { id: randomUUID(), documentTitle: marker, items: [{ code: row.code, name: row.name, quantity: 2, unit: row.unit }] }; orders.push(order.id);
    const [a, b] = await Promise.all([request('catalog-orders', 'POST', order, 201), request('catalog-orders', 'POST', order, 201)]);
    assert.equal(a.sequence, b.sequence);
    assert.equal(await db.catalogOrder.count({ where: { id: order.id } }), 1);
    await request('catalog-orders', 'POST', { ...order, documentTitle: 'different' }, 409);
    await request(`catalog-orders/${order.id}`, 'DELETE', {});
    assert.ok((await db.catalogOrder.findUnique({ where: { id: order.id } })).deletedAt);
    const second = { ...order, id: randomUUID() }; orders.push(second.id);
    const next = await request('catalog-orders', 'POST', second, 201); assert.ok(next.sequence > a.sequence);
    assert.ok(await db.auditLog.count({ where: { entity: 'CatalogOrder', entityId: order.id, action: 'delete' } }));
    await stop(); await start();
    assert.equal((await request(`medicines/${row.id}`)).imageUrl, row.imageUrl);
    assert.ok((await request('catalog-orders')).some(x => x.id === second.id));
    const removed = await request(`medicines/${row.id}`, 'PATCH', { image: null });
    assert.equal(removed.imageUrl, null); assert.equal(removed.image, '');
    assert.equal((await fetch(row.imageUrl)).status, 404);
    await request(`medicines/${row.id}`, 'PATCH', { image: 'bad' }, 400);
    await request('admin/users', 'GET', null, 401);
    await request('settings', 'GET', null, 401);
    const stored = await db.medicine.findUnique({ where: { id: row.id } });
    assert.equal(stored.used, 0); assert.equal(stored.total, 100);
    console.log('PASS: persisted image URL/upload/replace/remove/restart; typed orders/concurrent retry/conflict/sequence/delete audit/restart; protected admin/settings; stock unchanged');
  } finally {
    await stop();
    await db.$transaction(async tx => {
      await tx.catalogOrder.deleteMany({ where: { id: { in: orders } } });
      await tx.stockMovement.deleteMany({ where: { medicineId: { in: medicines } } });
      await tx.inventoryRequest.deleteMany({ where: { id: { in: keys } } });
      await tx.auditLog.deleteMany({ where: { OR: [{ entityId: { in: [...orders, ...medicines] } }, ...keys.map(key => ({ detail: { path: ['requestId'], equals: key } }))] } });
      await tx.medicine.deleteMany({ where: { id: { in: medicines } } });
    });
    await db.$disconnect();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
