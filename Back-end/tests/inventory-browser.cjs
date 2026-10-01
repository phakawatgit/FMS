const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const api = process.env.TEST_API_URL || 'http://127.0.0.1:4000/api';
const web = process.env.WEB_URL || 'http://localhost:3000';
const marker = `browser-stock-${randomUUID()}`;
const keys = new Set(), drugIds = [];
let browser;
const errors = [];
async function request(route, method='GET', body) {
  const key=randomUUID();keys.add(key);
  const response=await fetch(api+route,{method,headers:{'Content-Type':'application/json','Idempotency-Key':key},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();assert.ok(response.ok,JSON.stringify(result));return result.data;
}
async function go(page,name) {await page.goto(`${web}/legacy/${name}.html`,{waitUntil:'domcontentloaded'});}
(async()=>{
 try {
  const meds=[];
  for(const suffix of ['A','B']) {const m=await request('/medicines','POST',{name:marker+suffix,category:'oral',unit:'tablet',total:20,used:0,expiry:'2035-01-01'});drugIds.push(m.id);meds.push(m);}
  browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
  const context=await browser.newContext();
  await context.addInitScript(url=>{window.FMS_API_URL=url;},api.replace(/\/api$/,''));
  await context.route(/https:\/\/(fonts\.googleapis|fonts\.gstatic)/,r=>r.abort());
  // Do not export this test browser's drafts to other users' legacy JSON records.
  await context.route('**/api/legacy-storage**',r=>r.fulfill({contentType:'application/json',body:'{"success":true,"data":{}}'}));
  context.on('request',r=>{const k=r.headers()['idempotency-key'];if(k)keys.add(k);});
  await require("./auth-test.cjs")(context,api.replace(/\/api$/, ""));
  const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(page.url(),e.stack);});page.setDefaultTimeout(15000);
  await go(page,'infirmary-visit');
  await page.locator('.visitor-option[data-type="internal"] input').check();
  await page.locator('[name="firstName"]').fill('Browser test');await page.locator('[name="lastName"]').fill(marker);
  await page.locator('[name="symptom"]').fill('Synthetic test');await page.locator('.status input[value="observe"]').check();
  for(let i=0;i<meds.length;i++){
    await page.locator('[data-add-drug]').click();
    await page.locator('[data-drug-rows] select').nth(i).selectOption(meds[i].id);
    await page.locator('[data-drug-rows] input').nth(i).fill(String(i+2));
  }
  // Drop the response AFTER the server commits, then retry the same form. The
  // retained idempotency key must prevent a second visit or stock deduction.
  await page.route('**/api/infirmary-visits',async r=>{await r.fetch();await r.abort();});
  await page.locator('button[type="submit"]').click();
  await page.locator('#formMessage').filter({hasText:'API'}).waitFor();
  assert.equal(await page.locator('[name="lastName"]').inputValue(),marker);
  assert.equal(await page.locator('[data-drug-rows] select').count(),2);
  assert.equal(await db.infirmaryVisit.count({where:{lastName:marker}}),1);
  await page.unroute('**/api/infirmary-visits');
  await page.locator('button[type="submit"]').click();await page.waitForURL('**/pending-assessment.html');
  const visit=await db.infirmaryVisit.findFirst({where:{lastName:marker},include:{dispensations:true}});
  assert.equal(visit.dispensations.length,2);
  assert.equal(await db.infirmaryVisit.count({where:{lastName:marker}}),1);
  assert.equal((await request('/medicines/'+meds[0].id)).remaining,18);
  assert.equal((await request('/medicines/'+meds[1].id)).remaining,17);
  await page.goto(`${web}/legacy/assessment-detail.html?id=${visit.id}`,{waitUntil:'domcontentloaded'});
  await page.locator('.edit-button').click();
  const rows=page.locator('.edit-panel [data-drug-rows] > div');await rows.first().waitFor();
  for(let i=0;i<2;i++){
    const row=rows.nth(i);if(await row.locator('select').inputValue()===meds[0].id)await row.locator('input').fill('5');
  }
  const bRow=page.locator('.edit-panel [data-drug-rows] > div').filter({has:page.locator(`select option[value="${meds[1].id}"]:checked`)});
  await bRow.locator('[data-remove]').click();
  await page.locator('.edit-panel button[type="submit"]').click();
  await page.waitForFunction(()=>!document.querySelector('.edit-panel'));
  assert.equal((await request('/medicines/'+meds[0].id)).remaining,15);
  assert.equal((await request('/medicines/'+meds[1].id)).remaining,20);
  console.log('PASS: browser multi-drug dispensing, failed-save preservation and edit delta');
  await go(page,'stock');
  const card=page.locator(`.medicine-card[data-code="${meds[0].code}"]`);await card.waitFor();
  assert.equal(await card.locator('.remaining strong').textContent(),'15');
  page.once('dialog',d=>d.accept('Browser test adjustment'));
  await card.locator('[data-field="used"][data-delta="1"]').click();
  await page.waitForFunction(code=>document.querySelector(`.medicine-card[data-code="${code}"] .remaining strong`)?.textContent==='14',meds[0].code);
  await go(page,'pending-assessment');
  await page.locator(`.assessment-card[data-id="${visit.id}"] input[value="normal"]`).check();
  await page.locator(`.assessment-card[data-id="${visit.id}"]`).waitFor({state:'detached'});
  await go(page,'infirmary-visit-history');
  await page.locator('.visit-card').filter({hasText:marker}).first().waitFor();
  await go(page,'history-stock');await page.getByRole('heading',{name:'ประวัติความเคลื่อนไหวคลัง'}).waitFor();
  assert.ok((await page.locator('main').textContent()).includes('Browser test adjustment'));

  // Complete the actual borrowing UI. Browser storage is only the unsaved draft.
  await go(page,'borrow-form');
  await page.locator('[name="role"][value="นักศึกษา"]').check();
  await page.locator('[name="fullName"]').fill(marker);
  await page.locator('[name="item"][value="ส่วนบุคคล"]').check();
  await page.locator('[name="reason"]').fill('Synthetic');
  await page.locator('[name="dueDate"]').fill('2030-10-01');
  const loanResponses = [];
  page.on('response', async response => {
   if (!response.url().includes('/api/loans')) return;
   loanResponses.push({status:response.status(),body:await response.text().catch(()=> '')});
  });
  await page.locator(`[data-favorite="${meds[1].code}"]`).click();
  await page.locator('button[type="submit"]').click();
  // The form saves its draft and displays a confirmation before selection.
  if(await page.locator('#borrowSavedClose').isVisible())await page.locator('#borrowSavedClose').click();
  await go(page,'borrow-selected');
  await page.locator(`[data-quantity="${meds[1].code}"]`).fill('4');
  await page.locator(`[data-quantity="${meds[1].code}"]`).dispatchEvent('change');
  await page.locator('#saveBorrowDraft').click();await page.waitForURL('**/borrow-order.html');
  await page.locator('.order-notice-modal').waitFor({state:'attached'});
  await page.locator('#saveOrder').click();
  try { await page.waitForURL('**/borrow-return.html',{timeout:8000}); }
  catch (error) {
   const state=await page.evaluate(()=>({url:location.href,notice:document.querySelector('.order-notice-modal')?.textContent,noticeHidden:document.querySelector('.order-notice-modal')?.hidden,saveDisabled:document.querySelector('#saveOrder')?.disabled}));
   throw Error(`Loan save did not navigate: ${JSON.stringify({state,loanResponses,wait:error.message})}`);
  }
  const loan=await db.loan.findFirst({where:{details:{path:['fullName'],equals:marker}}});assert.ok(loan);
  assert.equal((await request('/medicines/'+meds[1].id)).remaining,16);
  await page.goto(`${web}/legacy/return-form.html?id=${loan.id}`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-return-quantity="0"]').fill('2');
  await page.locator('#submitReturn').click();
  await page.locator('#confirmReturnNotice').click();
  await page.waitForURL('**/borrow-return-history.html');
  assert.equal((await request('/medicines/'+meds[1].id)).remaining,18);
  console.log('PASS: browser stock adjustment with reason, audit view, borrowing and partial return');
  // A clean browser sees the same server state, with no local operational records.
  const fresh=await context.newPage();fresh.on('pageerror',e=>errors.push(e.message));
  await go(fresh,'catalog');await fresh.locator(`.catalog-card[data-detail-code="${meds[1].code}"]`).waitFor();
  const client=await fresh.evaluate(()=>JSON.parse(FMSData.getItem('fms-stock-records')));
  assert.equal(client.find(m=>m.id===meds[1].id).remaining,18);
  // Stale browser selections disappear only after a successful inventory read.
  const pruned=await fresh.evaluate(code=>{
    const products={[code]:{quantity:2},'deleted-code':{quantity:7}};
    localStorage.setItem('fms-catalog-cart',JSON.stringify(products));
    localStorage.setItem('fms-borrow-products',JSON.stringify(products));
    localStorage.setItem('fms-borrow-form',JSON.stringify({fullName:'Draft',products}));
    return ['fms-catalog-cart','fms-borrow-products','fms-borrow-form'].map(key=>JSON.parse(FMSData.getItem(key)));
  },meds[1].code);
  assert.deepEqual(Object.keys(pruned[0]),[meds[1].code]);
  assert.deepEqual(pruned[0],pruned[1]);
  assert.equal(pruned[2].fullName,'Draft');assert.deepEqual(pruned[2].products,pruned[0]);
  await fresh.unroute('**/api/medicines');
  const offline=await context.newPage();
  await offline.route('**/api/medicines',r=>r.abort());
  await go(offline,'catalog');
  await offline.waitForFunction(()=>window.FMSData&&document.querySelector('[role="alert"]'));
  const preserved=await offline.evaluate(()=>{
    const raw=JSON.stringify({'deleted-code':{quantity:7}});
    localStorage.setItem('fms-catalog-cart',raw);
    let failed=false;try{FMSData.getItem('fms-catalog-cart');}catch{failed=true;}
    return {failed,unchanged:localStorage.getItem('fms-catalog-cart')===raw};
  });
  assert.deepEqual(preserved,{failed:true,unchanged:true});
  await offline.close();
  const empty=await browser.newContext();
  await empty.addInitScript(url=>{window.FMS_API_URL=url;},api.replace(/\/api$/,''));
  await empty.route(/https:\/\/(fonts\.googleapis|fonts\.gstatic)/,r=>r.abort());
  await empty.route('**/api/**',r=>new URL(r.request().url()).pathname.endsWith('/api/auth/config')?r.continue():r.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:r.request().url().includes('legacy-storage')?{}:[]})}));
  await require("./auth-test.cjs")(empty,api.replace(/\/api$/, ""));
  const blank=await empty.newPage();blank.on('pageerror',e=>errors.push(e.message));
  for(const name of ['catalog','stock','infirmary-visit-history','pending-assessment','borrow-return','dashboard']) {
    await go(blank,name);await blank.waitForTimeout(100);
    assert.equal(await blank.locator('.catalog-card,.medicine-card,.visit-card,.assessment-card').count(),0);
  }
  await empty.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: fresh page reads persisted inventory, empty API shows no mock rows; no browser JavaScript errors');
 } finally {
  await browser?.close();
  const visits=await db.infirmaryVisit.findMany({where:{lastName:marker},select:{id:true}});
  const loans=await db.loan.findMany({where:{details:{path:['fullName'],equals:marker}},select:{id:true}});
  await db.$transaction(async tx=>{
   const ids=loans.map(r=>r.id),v=visits.map(r=>r.id);
   await tx.loanReturn.deleteMany({where:{loanId:{in:ids}}});await tx.loanItem.deleteMany({where:{loanId:{in:ids}}});await tx.loan.deleteMany({where:{id:{in:ids}}});
   await tx.dispensation.deleteMany({where:{visitId:{in:v}}});await tx.infirmaryVisit.deleteMany({where:{id:{in:v}}});
   await tx.stockMovement.deleteMany({where:{medicineId:{in:drugIds}}});await tx.medicine.deleteMany({where:{id:{in:drugIds}}});
   await tx.inventoryRequest.deleteMany({where:{id:{in:[...keys]}}});
  });
  await db.$disconnect();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
