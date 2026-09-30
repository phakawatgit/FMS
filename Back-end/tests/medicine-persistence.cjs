const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { chromium } = require("playwright");
const sharp = require("sharp");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const marker = `catalog-test-${randomUUID()}`;
const api = "http://127.0.0.1:4012";
const web = process.env.WEB_URL || "http://127.0.0.1:3001";
const support = require("./test-support.cjs")(api);
let server, browser;
const errors = [];
async function start() {
  server = spawn(process.execPath, ["src/server.js"], { cwd: path.join(__dirname, ".."), env: { ...process.env, PORT: "4012" }, stdio: ["ignore", "ignore", "inherit"], windowsHide: true });
  for (let n = 0; n < 100; n++) {
    if (server.exitCode !== null) throw Error("Test API exited");
    try { if ((await fetch(`${api}/api/database/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error("Test API unavailable");
}
async function stop() { if (server && server.exitCode === null) { const done = new Promise(resolve => server.once("exit", resolve)); server.kill(); await done; } }
async function request(route = "", method = "GET", body, expected = 200) {
  const response = await fetch(`${api}/api/medicines${route}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = await response.json(); assert.equal(response.status, expected, JSON.stringify(json)); return json.data;
}
async function page() {
  const context = await browser.newContext();
  await support.context(context);
  await context.addInitScript(url => { window.FMS_API_URL = url; }, api);
  // Isolate cart/session legacy storage from the user's existing shared data.
  await context.route("**/api/legacy-storage**", route => route.fulfill({ contentType: "application/json", body: '{"success":true,"data":{}}' }));
  const tab = await context.newPage(); tab.setDefaultTimeout(15000);
  tab.on("pageerror", error => errors.push(error.message)); return tab;
}
(async () => {
  try {
    await start();
    const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: "red" } }).png().toBuffer();
    const fields = { name: marker, productName: "Product", genericName: "Generic", category: "oral", form: "Tablet", size: "500 mg", unit: "tablet", benefit: "Test benefit", symptom: "Test symptom", usage: "Test usage", warning: "Test warning", total: 100, used: 20, expiry: "2028-02-29", image: `data:image/png;base64,${image.toString("base64")}` };
    const first = await request("", "POST", fields, 201);
    const stored = await db.medicine.findUnique({ where: { id: first.id } });
    for (const key of ["name", "productName", "genericName", "category", "form", "size", "unit", "benefit", "symptom", "usage", "warning", "total", "used"]) assert.equal(stored[key], fields[key]);
    assert.equal(first.expiry, fields.expiry); assert.equal(first.remaining, 80); assert.equal(first.status, "ปกติ");
    assert.equal(stored.imageType, "image/jpeg"); assert.ok(stored.imageData.length);
    const picture = await fetch(api + first.image); assert.equal(picture.status, 200); assert.equal(picture.headers.get("content-type"), "image/jpeg");
    assert.equal((await sharp(Buffer.from(await picture.arrayBuffer())).metadata()).format, "jpeg");
    const pair = await Promise.all([request("", "POST", { name: marker + "-2", category: "topical" }, 201), request("", "POST", { name: marker + "-3", category: "equipment" }, 201)]);
    assert.equal(new Set([first.code, ...pair.map(row => row.code)]).size, 3);
    await request("", "POST", { ...fields, used: 101 }, 400);
    await request("", "POST", { ...fields, total: -1 }, 400);
    await request("", "POST", { ...fields, total: 1.5 }, 400);
    await request("", "POST", { ...fields, expiry: "2027-02-29" }, 400);
    await request("", "POST", { ...fields, image: "data:image/jpeg;base64,YmFk" }, 400);
    await request("", "POST", { ...fields, image: `data:image/jpeg;base64,${Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64")}` }, 413);
    await request(`/${first.id}`, "PATCH", { used: 80 });
    assert.equal((await request(`/${first.id}`)).status, "ใกล้หมด");
    await request(`/${first.id}`, "PATCH", { used: 100 });
    assert.equal((await request(`/${first.id}`)).status, "หมด");
    await request(`/${first.id}`, "PATCH", { used: 20 });
    for(let n=0;n<5;n++) await request(`/${first.id}/inventory`, "PATCH", { field: "used", delta: 1 });
    assert.equal((await request(`/${first.id}`)).used, 25);
    console.log("PASS: all fields, image bytes, unique codes, validation, status thresholds and inventory updates without version");

    browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "msedge" });
    const tab = await page();
    await tab.goto(`${web}/legacy/catalog.html`);
    await tab.locator('.catalog-card').filter({ hasText: marker }).first().waitFor();
    await tab.locator(`#addButton`).click();
    await tab.locator('[name="name"]').fill(marker + "-browser");
    await tab.locator('[name="total"]').fill("10");
    await tab.locator('[name="unit"]').fill('tablet');
    await tab.locator('[name="used"]').fill("1");
    await tab.locator('#imageInput').setInputFiles({ name: "test.png", mimeType: "image/png", buffer: image });
    await tab.locator('#imagePreview img').waitFor();
    assert.equal(await tab.locator('[name="remaining"]').inputValue(), "9");
    assert.ok(await tab.locator('[name="status"]').isDisabled());
    await tab.route("**/api/medicines", route => route.abort());
    await tab.locator('[type="submit"]').click();
    await tab.waitForFunction(() => document.getElementById("message").textContent.includes("API"));
    assert.equal(await tab.locator('[name="name"]').inputValue(), marker + "-browser");
    await tab.unroute("**/api/medicines");
    let posts = 0;
    await tab.route("**/api/medicines", async route => { if (route.request().method() === "POST") { posts++; await new Promise(resolve => setTimeout(resolve, 200)); } await route.continue(); });
    await tab.evaluate(() => { const form = document.getElementById("medicineForm"); form.requestSubmit(); form.requestSubmit(); });
    await tab.waitForURL("**/catalog.html?updated=1"); assert.equal(posts, 1);
    const created = await db.medicine.findFirst({ where: { name: marker + "-browser" } }); assert.ok(created?.imageData);
    const fresh = await page();
    await fresh.goto(`${web}/legacy/catalog.html`);
    const card = fresh.locator(`.catalog-card[data-detail-code="${created.code}"]`); await card.waitFor();
    await card.locator(".catalog-image").click();
    await fresh.locator('.detail-summary').waitFor();
    assert.ok(await fresh.locator('.detail-product-image img').evaluate(img => img.complete && img.naturalWidth > 0));
    await fresh.locator('#detailLayoutAddCart').first().click();
    await fresh.goto(`${web}/legacy/catalog-cart.html`);
    await fresh.locator('.cart-row').filter({ hasText: marker + "-browser" }).waitFor();
    await fresh.goto(`${web}/legacy/catalog-order.html`);
    await fresh.locator('.order-item').filter({ hasText: marker + "-browser" }).waitFor();
    await fresh.goto(`${web}/legacy/infirmary-visit.html`);
    await fresh.locator("[data-add-drug]").click();
    await fresh.waitForFunction(id => [...document.querySelectorAll("[data-drug-rows] option")].some(option => option.value === id), created.id);
    await fresh.goto(`${web}/legacy/stock-add.html?edit=${created.id}`);
    await fresh.locator('[type="submit"]:enabled').waitFor();
    assert.equal(await fresh.locator('[name="code"]').inputValue(), created.code);
    await fresh.locator('[name="productName"]').fill("Edited product");
    await fresh.locator('[type="submit"]').click(); await fresh.waitForURL("**/stock.html?updated=1");
    let edited = await db.medicine.findUnique({ where: { id: created.id } });
    assert.equal(edited.productName, "Edited product"); assert.deepEqual(edited.imageData, created.imageData);
    await fresh.goto(`${web}/legacy/stock-add.html?edit=${created.id}`);
    await fresh.locator('[type="submit"]:enabled').waitFor();
    const replacement = await sharp({ create: { width: 48, height: 48, channels: 3, background: "blue" } }).webp().toBuffer();
    await fresh.locator('#imageInput').setInputFiles({ name: "replacement.webp", mimeType: "image/webp", buffer: replacement });
    await fresh.waitForFunction(() => document.querySelector('#imagePreview img')?.src.startsWith('data:image/jpeg'));
    await fresh.locator('[type="submit"]').click(); await fresh.waitForURL("**/stock.html?updated=1");
    edited = await db.medicine.findUnique({ where: { id: created.id } });
    assert.notDeepEqual(edited.imageData, created.imageData);
    assert.equal(edited.code, created.code);
    const stock = fresh.locator(`.medicine-card[data-code="${created.code}"]`); await stock.waitFor();
    await stock.locator('[data-field="used"][data-delta="1"]').click();
    await fresh.waitForFunction(code => document.querySelector(`.medicine-card[data-code="${code}"] .used strong`)?.textContent === "2", created.code);
    assert.equal((await request(`/${created.id}`)).used, 2);
    await stock.locator('[data-management="delete"]').click(); await fresh.locator('.fms-confirm-delete').click(); await stock.waitFor({ state: "detached" });
    assert.equal((await db.medicine.findUnique({ where: { id: created.id } })).active, false);
    await fresh.goto(`${web}/legacy/stock-detail.html?code=${pair[0].code}`);
    const totalValue = fresh.locator('.inventory .total strong');
    await totalValue.fill("10"); await totalValue.press("Enter");
    await fresh.waitForFunction(() => document.querySelector('.inventory .remaining strong')?.textContent === "10");
    await fresh.locator('.inventory [data-field="used"][data-delta="1"]').click();
    await fresh.waitForFunction(() => document.querySelector('.inventory .used strong')?.textContent === "1");
    assert.equal((await request(`/${pair[0].id}`)).used, 1);
    const usedValue = fresh.locator('.inventory .used strong');
    await usedValue.fill("20"); await usedValue.press("Enter");
    await fresh.locator('#medicineApiError').waitFor();
    assert.equal((await request(`/${pair[0].id}`)).used, 1);
    await fresh.locator('.detail-delete:enabled').click(); await fresh.locator('.fms-confirm-delete').click();
    await fresh.waitForURL("**/stock.html?deleted=1");
    assert.equal((await db.medicine.findUnique({ where: { id: pair[0].id } })).active, false);
    await fresh.route("**/api/medicines", route => route.abort());
    await fresh.goto(`${web}/legacy/catalog.html`);
    await fresh.locator('#medicineApiError button').waitFor();
    assert.equal(await fresh.locator('.catalog-card').count(), 0);
    await fresh.unroute("**/api/medicines");
    await fresh.locator('#medicineApiError button').click();
    await fresh.locator('.catalog-card').filter({ hasText: marker }).first().waitFor();
    console.log("PASS: browser create/image, error preserves form, duplicate guard, clean browser, catalog/cart/order/Infirmary, edit and delete");
    await stop(); await start();
    assert.equal((await request(`/${first.id}`)).code, first.code);
    assert.ok((await db.medicine.findUnique({ where: { id: first.id } })).imageData.length);
    assert.deepEqual(errors, []);
    console.log("PASS: records and images persist after API restart; no page errors");
  } finally {
    await browser?.close(); await stop();
    const ids=(await db.medicine.findMany({where:{name:{startsWith:marker}},select:{id:true}})).map(r=>r.id);
    await db.stockMovement.deleteMany({where:{medicineId:{in:ids}}});
    await db.medicine.deleteMany({ where: { id:{in:ids} } }); await support.cleanup(db); await db.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
