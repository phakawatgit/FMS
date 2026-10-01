// Requires the web app at WEB_URL (default http://127.0.0.1:3001) and
// Back-end/.env pointing to the testable local database. Only this run's
// synthetic records are removed. A separate API process uses port 4011.
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { chromium } = require("playwright");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const marker = `test-${randomUUID()}`;
const web = process.env.WEB_URL || "http://127.0.0.1:3001";
const api = "http://127.0.0.1:4011";
const support = require("./test-support.cjs")(api);
let server, browser;

async function startApi() {
  server = spawn(process.execPath, ["src/server.js"], {
    cwd: path.join(__dirname, ".."), env: { ...process.env, PORT: "4011" },
    stdio: "ignore", windowsHide: true,
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error("Test API exited");
    try { if ((await fetch(`${api}/api/database/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Test API did not start");
}
async function stopApi() {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise(resolve => server.once("exit", resolve));
  server.kill();
  await exited;
}
async function newPage() {
  const context = await browser.newContext();
  await support.context(context);
  await context.addInitScript(url => { window.FMS_API_URL = url; }, api);
  const page = await context.newPage();
  page.on("pageerror", error => { errors.push(`${page.url()} ${error.stack || error.message}`); });
  return page;
}
async function fill(page, status) {
  await page.goto(`${web}/legacy/infirmary-visit.html`);
  await page.waitForFunction(() => window.visitDispensing && window.infirmaryApi);
  await page.locator('.visitor-option[data-type="internal"] input').check();
  await page.locator('[name="firstName"]').fill("Persistence test");
  await page.locator('[name="lastName"]').fill(marker);
  await page.locator('[name="symptom"]').fill("Synthetic test record");
  await page.locator('[name="weight"]').fill("60");
  await page.locator(`.status input[value="${status}"]`).check();
  if (status === "refer") await page.locator('[name="hospitalName"]').fill("Test hospital");
}
const errors = [];
(async () => {
  try {
    await startApi();
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const page = await newPage();
    for (const status of ["normal", "observe", "refer"]) {
      await fill(page, status);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(status === "observe" ? "**/pending-assessment.html" : "**/infirmary-visit-history.html");
      const row = await db.infirmaryVisit.findFirst({ where: { lastName: marker, status } });
      assert.ok(row, `Database row for ${status}`);
      assert.equal(row.weight, 60);
      assert.equal(row.hospitalName, status === "refer" ? "Test hospital" : null);
    }
    console.log("PASS: form saves all three statuses to PostgreSQL");

    // No browser storage: both listing pages must still read the database.
    const fresh = await newPage();
    await fresh.goto(`${web}/legacy/infirmary-visit-history.html`);
    await fresh.locator(".visit-card").filter({ hasText: marker }).first().waitFor();
    assert.equal(await fresh.locator(".visit-card").filter({ hasText: marker }).count(), 2);
    await fresh.reload();
    await fresh.locator(".visit-card").filter({ hasText: marker }).first().waitFor();
    await fresh.goto(`${web}/legacy/pending-assessment.html`);
    const card = fresh.locator(".assessment-card").filter({ hasText: marker });
    await card.waitFor();
    const id = await card.getAttribute("data-id");
    await card.locator("h2").click();
    await fresh.waitForURL("**/assessment-detail.html?*");
    await fresh.locator(".edit-button").click();
    await fresh.locator('.edit-panel [name="nickname"]').fill("Updated test");
    await fresh.locator('.status-readonly input[value="observe"]').waitFor();
    const editResponse = fresh.waitForResponse(r => r.url().includes(`/api/infirmary-visits/${id}`) && r.request().method() === "PATCH");
    await fresh.locator('.edit-panel button[type="submit"]').click();
    const edited = await editResponse;
    if (edited.status() !== 200) assert.fail(await edited.text());
    await fresh.waitForFunction(() => document.querySelector('.detail-form-grid input[value="Updated test"]'));
    assert.equal((await db.infirmaryVisit.findUnique({ where: { id } })).nickname, "Updated test");
    await fresh.goto(`${web}/legacy/pending-assessment.html`);
    await fresh.route(`**/api/infirmary-visits/${id}`, route => route.fulfill({
      status: 503, contentType: "application/json", body: JSON.stringify({ success: false, message: "Test save failure" }),
    }));
    await fresh.locator(`.assessment-card[data-id="${id}"] input[value="normal"]`).check();
    await fresh.waitForFunction(() => document.querySelector(".save-error")?.textContent === "Test save failure");
    assert.equal((await db.infirmaryVisit.findUnique({ where: { id } })).status, "observe");
    await fresh.unroute(`**/api/infirmary-visits/${id}`);
    await fresh.locator(`.assessment-card[data-id="${id}"] input[value="normal"]`).check();
    await fresh.locator(`.assessment-card[data-id="${id}"]`).waitFor({ state: "detached" });
    assert.equal((await db.infirmaryVisit.findUnique({ where: { id } })).status, "normal");
    await fresh.route("**/api/infirmary-visits", route => route.abort());
    await fresh.goto(`${web}/legacy/infirmary-visit-history.html`);
    const retryButton = fresh.locator('[role="alert"] button');
    await retryButton.waitFor();
    assert.equal(await fresh.locator(".visit-card").count(), 0);
    await fresh.unroute("**/api/infirmary-visits");
    await retryButton.click();
    await fresh.locator(".visit-card").filter({ hasText: marker }).first().waitFor();
    console.log("PASS: clean browser history, detail editing and assessment update");

    await fill(page, "normal");
    await page.route("**/api/infirmary-visits", route => route.abort());
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector("#formMessage").textContent.includes("API"));
    assert.equal(await page.locator('[name="lastName"]').inputValue(), marker);
    assert.ok(page.url().endsWith("infirmary-visit.html"));
    await page.unroute("**/api/infirmary-visits");
    await page.locator('[name="age"]').fill("151");
    const invalid = page.waitForResponse(r => r.url().endsWith("/api/infirmary-visits") && r.request().method() === "POST");
    await page.locator('button[type="submit"]').click();
    assert.equal((await invalid).status(), 400);
    assert.equal(await page.locator('[name="lastName"]').inputValue(), marker);
    await page.locator('button[type="submit"]:enabled').waitFor();
    await page.locator('[name="age"]').fill("20");
    let posts = 0;
    await page.route("**/api/infirmary-visits", async route => {
      if (route.request().method() === "POST") { posts++; await new Promise(resolve => setTimeout(resolve, 200)); }
      await route.continue();
    });
    await page.evaluate(() => {
      const form = document.getElementById("visitForm");
      form.requestSubmit(); form.requestSubmit();
    });
    await page.waitForURL("**/infirmary-visit-history.html");
    assert.equal(posts, 1);
    assert.equal(await db.infirmaryVisit.count({ where: { lastName: marker } }), 4);
    console.log("PASS: unavailable API, invalid input, preserved form and duplicate-click guard");

    assert.deepEqual(errors, []);
    await fresh.close();
    await page.close();
    await stopApi();
    await startApi();
    const rows = (await (await fetch(`${api}/api/infirmary-visits`)).json()).data;
    assert.equal(rows.filter(row => row.lastName === marker).length, 4);
    console.log("PASS: records persist after API restart; no browser JavaScript errors");
  } finally {
    await browser?.close();
    await stopApi();
    await db.infirmaryVisit.deleteMany({ where: { lastName: marker } });
    await support.cleanup(db); await db.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
