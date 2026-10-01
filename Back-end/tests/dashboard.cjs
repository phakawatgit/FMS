const assert = require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {chromium}=require('playwright');
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
const db=require('../src/lib/prisma');
const {aggregate,filters}=require('../src/lib/dashboard');
const api=process.env.TEST_API_URL||'http://127.0.0.1:4000/api';
const marker='dashboard-test-'+randomUUID();
const orderIds=[];let browser,medicine,visit,filterVisit;
async function request(path,method='GET',body){const r=await fetch(api+path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const json=await r.json();assert.ok(r.ok,JSON.stringify(json));return json.data;}
(async()=>{try{
  assert.throws(()=>filters({start:'2026-02-30'}));assert.throws(()=>filters({start:'2026-10-02',end:'2026-10-01'}));
  const sample={createdAt:'2026-09-30T17:00:00Z',gender:null,status:'refer',hospitalName:null,symptom:'  a   b ',dispensations:[{medicineId:'a',name:'old',medicine:{name:'new'},code:'A',unit:'pack',quantity:5}]};
  const grouped=aggregate([sample,{...sample,dispensations:[{...sample.dispensations[0],name:'renamed',quantity:2}]}],[],{start:'2026-09-01',end:'2026-10-01'},new Date('2026-10-01'));
  assert.equal(grouped.trend.at(-1).count,2);assert.equal(grouped.gender.other,2);assert.equal(grouped.referrals.missingHospital,2);assert.equal(grouped.topMedicines.length,1);assert.equal(grouped.topMedicines[0].count,2);assert.equal(grouped.topMedicines[0].quantities.pack,7);assert.equal(grouped.symptoms[0].name,'a b');
  assert.equal(aggregate([],[],{start:'2025-01-01',end:'2026-10-01'}).trendInterval,'month');
  const expiryRows=[-1,0,30,31,90,91].map((days,i)=>({code:String(i),total:10,used:0,expiry:new Date(Date.parse('2026-10-01')+days*86400000)}));
  const statuses=aggregate([],expiryRows,{start:'2026-10-01',end:'2026-10-01'},new Date('2026-10-01T00:00:00Z')).stock;
  assert.deepEqual(statuses.map(m=>m.status),['expired','expiring','expiring','normal','normal','normal']);
  // Provide our own filter option; a freshly reset database has no faculties.
  filterVisit=await db.infirmaryVisit.create({data:{firstName:marker,lastName:'filter',visitorType:'บุคคลภายใน',faculty:'engineering',status:'normal',symptom:marker}});
  const before=await request('/dashboard');
  assert.equal((await fetch(api+'/dashboard?start=2026-10-02&end=2026-10-01')).status,400);
  assert.equal((await request('/dashboard?faculty=no-such-faculty')).totalVisits,0);
  const count=await db.infirmaryVisit.count({where:{createdAt:{gte:new Date(before.filters.start+'T00:00:00+07:00'),lt:new Date(Date.parse(before.filters.end+'T00:00:00+07:00')+86400000)}}});assert.equal(before.totalVisits,count);
  browser=await chromium.launch({headless:true,channel:'msedge'});const context=await browser.newContext({timezoneId:'America/New_York'});
  await context.route(/https:\/\/(fonts\.googleapis|fonts\.gstatic)/,r=>r.abort());
  await require("./auth-test.cjs")(context,api.replace(/\/api$/, ""));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000/legacy/dashboard.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('dashboardDataStatus')?.textContent.includes('อัปเดต'));
  assert.equal(await page.locator('#maleCount').textContent(),before.totalVisits ? String(before.gender.male) : '-');assert.equal(await page.locator('#femaleCount').textContent(),before.totalVisits ? String(before.gender.female) : '-');
  assert.equal(await page.locator('#branchInput').inputValue(),'all');
  // Confirm filtering excludes unaffiliated visits only when a faculty is selected.
  await page.selectOption('#facultySelect','engineering',{force:true});
  await page.waitForTimeout(400);const expected=await request('/dashboard?faculty=engineering');
  assert.equal(await page.evaluate(()=>window.getLiveDashboardVisits().length),expected.totalVisits);
  await page.click('#resetButton');await page.waitForTimeout(400);
  // New records must appear on an already open page after a fresh API request.
  medicine=await db.medicine.create({data:{name:marker,code:marker,category:'oral',unit:'pack',total:20,used:3,dispensed:3,expiry:new Date('2035-01-01')}});
  visit=await db.infirmaryVisit.create({data:{firstName:marker,lastName:'fixture',visitorType: 'บุคคลภายนอก',gender:null,status:'refer',symptom:marker,dispensations:{create:{medicineId:medicine.id,name:marker,code:marker,unit:'pack',quantity:3}}}});
  await page.evaluate(()=>window.refreshDashboard());assert.equal(await page.evaluate(()=>window.getLiveDashboardVisits().length),before.totalVisits+1);
  const fresh=await request('/dashboard');assert.equal(fresh.topMedicines.find(m=>m.medicineId===medicine.id).count,1);
  // Failure retains confirmed data with a stale indication.
  await page.route('**/api/dashboard?**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"success":false}'}));
  await page.evaluate(()=>window.refreshDashboard());assert.match(await page.locator('#dashboardDataStatus').textContent(),/แสดงข้อมูลเดิม/);
  await page.unroute('**/api/dashboard?**');await page.evaluate(()=>window.refreshDashboard());
  // Excel contains all sections and uses the confirmed snapshot.
  const downloadPromise=page.waitForEvent('download');await page.click('#exportExcel');const download=await downloadPromise;const stream=await download.createReadStream();let xml='';for await(const chunk of stream)xml+=chunk;assert.match(xml,/Worksheet ss:Name="Stock"/);assert.match(xml,/Worksheet ss:Name="Visits"/);assert.match(xml,new RegExp(marker));
  const order={id:marker,documentTitle:marker,items:[{code:medicine.code,name:marker,quantity:2,unit:'pack'}]};orderIds.push(marker,marker+'-2');
  await Promise.all([request('/catalog-orders','POST',order),request('/catalog-orders','POST',order),request('/catalog-orders','POST',{...order,id:marker+'-2'})]);
  const orders=await request('/catalog-orders');assert.equal(orders.filter(o=>orderIds.includes(o.id)).length,2);
  await page.evaluate(()=>window.refreshDashboard());assert.equal(await page.evaluate(()=>window.dashboardRecords('fms-history-catalog-orders').filter(o=>o.documentTitle.startsWith('dashboard-test-')).length),2);
  await page.click('.stock-detail-button[data-medicine-status="normal"]');assert.ok(Number(await page.locator('#medicineTotalStock').textContent())>0);await page.click('#closeMedicineModal');
  // Calendar must include old Buddhist-year dates and undated records.
  const historical={...fresh,orders:[{id:'old-order',date:'15/1/2568',items:[]},{id:'undated-order',title:'UNDATED',items:[]}]};
  await page.route('**/api/dashboard?**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:historical})}));await page.evaluate(()=>window.refreshDashboard());
  assert.match(await page.locator('#purchaseCalendarContent').textContent(),/UNDATED/);await page.click('#purchaseCalendarToday');await page.click('[data-toggle-year-picker]');assert.equal(await page.locator('[data-select-calendar-year="2025"]').count(),1);await page.click('[data-select-calendar-year="2025"]');assert.equal(await page.locator('[data-calendar-date="2025-01-15"].has-orders').count(),2);await page.click('[data-close-annual-dialog]');await page.unroute('**/api/dashboard?**');
  // A response lost after committing an order must be safely retryable through the UI.
  await context.route('**/api/legacy-storage**',r=>r.fulfill({contentType:'application/json',body:'{"success":true,"data":{}}'}));
  const ordering=await context.newPage();await ordering.goto('http://localhost:3000/legacy/dashboard.html',{waitUntil:'domcontentloaded'});
  await ordering.evaluate(code=>localStorage.setItem('fms-catalog-cart',JSON.stringify({[code]:{quantity:2}})),medicine.code);
  await ordering.goto('http://localhost:3000/legacy/catalog-order.html',{waitUntil:'domcontentloaded'});await ordering.locator('#orderSaveError').waitFor({state:'attached'});await ordering.locator('#orderTitle').fill(marker);
  let lost=true;
  await ordering.route('**/api/catalog-orders',async route=>{if(route.request().method()!=='POST')return route.continue();const body=route.request().postDataJSON();if(!orderIds.includes(body.id))orderIds.push(body.id);if(lost){lost=false;await route.fetch();await route.abort();}else await route.continue();});
  await ordering.click('#submitOrder');await ordering.waitForFunction(()=>document.getElementById('orderSaveError')?.textContent.length>0);assert.equal(await ordering.locator('#exportModal').isVisible(),false);await ordering.click('#submitOrder');await ordering.locator('#exportModal').waitFor({state:'visible'});
  assert.equal((await request('/catalog-orders')).filter(o=>o.id===orderIds.at(-1)).length,1);await ordering.close();
  // Empty data and a single 100% sector must render cleanly.
  const empty={...fresh,totalVisits:0,visits:[],topMedicines:[],symptoms:[],stock:[],orders:[],loans:[],gender:{male:0,female:0,other:0},referrals:{count:0,hospitals:[],missingHospital:0},trend:fresh.trend.map(t=>({...t,count:0}))};
  await page.route('**/api/dashboard?**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:empty})}));await page.evaluate(()=>window.refreshDashboard());assert.equal(await page.locator('#maleCount').textContent(),'-');assert.equal(await page.locator('#medicinePie svg').count(),0);
  assert.equal(await page.locator('.medicine-panel').isVisible(),true);assert.equal(await page.locator('.catalog-history-panel').isVisible(),true);assert.equal(await page.locator('.expiry').isVisible(),true);assert.equal(await page.locator('.gender').isVisible(),true);
  assert.equal(await page.locator('.status-panel .stock:visible').count(),4);assert.equal(await page.locator('.expiry-legend li:visible').count(),3);assert.equal(await page.locator('.bar-chart .bars').count(),1);assert.equal(await page.locator('#medicinePie.pie-medicine').count(),1);assert.equal(await page.locator('.dashboard-data-info,.medicine-rankings,.dashboard-trend-container').count(),0);
  const paths=await page.evaluate(()=>[piePath(0,360),donutPath(0,360)]);assert.match(paths[0],/50 100/);assert.match(paths[1],/50 77/);
  await page.click('#languageButton');assert.equal(await page.locator('#branchInput').inputValue(),'all');assert.deepEqual(errors,[]);
  assert.equal(await page.locator('#symptomPie').evaluate(el=>getComputedStyle(el).backgroundImage),'none');
  const failedPage=await context.newPage();await failedPage.route('**/api/dashboard?**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"success":false}'}));await failedPage.goto('http://localhost:3000/legacy/dashboard.html',{waitUntil:'domcontentloaded'});await failedPage.waitForFunction(()=>document.getElementById('dashboardDataStatus')?.textContent.includes('Load failed') || document.getElementById('dashboardDataStatus')?.textContent.includes('โหลดไม่สำเร็จ'));assert.equal(await failedPage.locator('#maleCount').textContent(),'-');assert.equal(await failedPage.locator('#exportExcel').isDisabled(),true);await failedPage.close();
  console.log('PASS dashboard: aggregates, Bangkok dates, DB/API/UI, filters, refresh, stale/empty, export, concurrent/idempotent orders, language');
}finally{
  await browser?.close();
  await db.catalogOrder.deleteMany({where:{id:{in:orderIds}}});
  if(visit){await db.dispensation.deleteMany({where:{visitId:visit.id}});await db.infirmaryVisit.delete({where:{id:visit.id}});}if(medicine)await db.medicine.delete({where:{id:medicine.id}});if(filterVisit)await db.infirmaryVisit.delete({where:{id:filterVisit.id}});await db.$disconnect();
}})().catch(e=>{console.error(e);process.exitCode=1;});
