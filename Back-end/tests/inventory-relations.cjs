// Exercises real API transactions with uniquely tagged synthetic rows. Only rows
// created by this run are removed; existing stock and patients are never edited.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const base = process.env.TEST_API_URL || 'http://127.0.0.1:4000/api';
const marker = `inventory-test-${randomUUID()}`;
const keys = new Set();
const visitIds = new Set();
const loanIds = new Set();
const medicines = [];
async function request(route, method = 'GET', body, expected = 200, key = randomUUID()) {
  if (method !== 'GET') keys.add(key);
  const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(result)}`);
  if (route === '/infirmary-visits' && result.success) visitIds.add(result.data.id);
  if (route === '/loans' && result.success) loanIds.add(result.data.id);
  return result.data;
}
const payload = items => ({ visitorType: 'บุคคลภายใน', firstName: 'Inventory integration', lastName: marker, symptom: 'Synthetic test only', status: 'observe', dispensations: items });
async function drug(suffix, total = 20, extra = {}) {
  const m = await request('/medicines', 'POST', { name: `${marker}-${suffix}`, category: 'oral', unit: 'tablet', total, used: 0, expiry: '2035-12-31', ...extra }, 201);
  medicines.push(m.id); return m;
}
const get = id => request('/medicines/' + id);
async function check(id, remaining, dispensed, borrowed, manualUsed = 0) {
  const row = await get(id);
  assert.deepEqual([row.remaining,row.dispensed,row.borrowed,row.manualUsed], [remaining,dispensed,borrowed,manualUsed]);
  assert.equal(row.used, row.dispensed + row.borrowed + row.manualUsed);
  return row;
}
(async () => {
  try {
    const a = await drug('A'), b = await drug('B');
    const key = randomUUID(), body = payload([{medicineId:a.id,quantity:3},{medicineId:b.id,quantity:2}]);
    let v = await request('/infirmary-visits','POST',body,201,key);
    assert.equal(v.dispensations.length,2);
    assert.equal((await request('/infirmary-visits','POST',body,201,key)).id,v.id);
    await request('/infirmary-visits','POST',{...body,symptom:'different'},409,key);
    await check(a.id,17,3,0); await check(b.id,18,2,0);
    v = await request('/infirmary-visits/'+v.id,'PATCH',{...payload([{medicineId:a.id,quantity:5}])});
    await check(a.id,15,5,0); await check(b.id,20,0,0);
    v = await request('/infirmary-visits/'+v.id,'PATCH',{status:'normal'});
    await check(a.id,15,5,0);
    v = await request('/infirmary-visits/'+v.id,'PATCH',{status:'observe'});
    assert.equal(v.status,'observe');
    for (const key of ['version','stockLinked','medicine','quantity']) assert.equal(key in v,false);
    assert.equal('version' in a,false);
    const beforeCount = await db.infirmaryVisit.count();
    await request('/infirmary-visits','POST',payload([{medicineId:a.id,quantity:1},{medicineId:b.id,quantity:100}]),409);
    assert.equal(await db.infirmaryVisit.count(),beforeCount); await check(a.id,15,5,0);
    await request('/infirmary-visits','POST',payload([{medicineId:a.id,quantity:1},{medicineId:a.id,quantity:1}]),400);
    await request('/infirmary-visits','POST',payload(null),400);
    for (const q of [0,-1,1.5,'2',true]) await request('/infirmary-visits','POST',payload([{medicineId:a.id,quantity:q}]),400);
    await request('/infirmary-visits','POST',payload([{medicineId:'not-found',quantity:1}]),404);
    const expired = await drug('expired',10,{expiry:'2020-01-01'});
    await request('/infirmary-visits','POST',payload([{medicineId:expired.id,quantity:1}]),409);
    const final = await drug('last',1);
    const results=await Promise.all([1,2].map(async()=>{
      const k=randomUUID();keys.add(k);
      const r=await fetch(base+'/infirmary-visits',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':k},body:JSON.stringify(payload([{medicineId:final.id,quantity:1}]))});
      const j=await r.json();if(j.data?.id)visitIds.add(j.data.id);return r.status;
    }));
    assert.deepEqual(results.sort(),[201,409]);await check(final.id,0,1,0);
    const replayKey=randomUUID(), replayBody=payload([{medicineId:b.id,quantity:1}]);
    const replays=await Promise.all([1,2].map(()=>request('/infirmary-visits','POST',replayBody,201,replayKey)));
    assert.equal(replays[0].id,replays[1].id);await check(b.id,19,1,0);
    await request('/infirmary-visits/'+replays[0].id,'PATCH',{...payload([])});
    console.log('PASS: multiple medicines, delta edits, status-only edits, replay, edits without version, atomic rollback and concurrent last-unit dispensing');

    const loanBody={details:{fullName:marker,reason:'Synthetic loan'},dueDate:'2030-10-01',items:[{medicineId:a.id,quantity:4},{medicineId:b.id,quantity:2}]};
    let loan = await request('/loans','POST',loanBody,201);
    await check(a.id,11,5,4);
    const returnKey=randomUUID(), returnBody={items:[{medicineId:a.id,quantity:1}]};
    loan=await request(`/loans/${loan.id}/returns`,'POST',returnBody,200,returnKey);
    await request(`/loans/${loan.id}/returns`,'POST',returnBody,200,returnKey);
    await check(a.id,12,5,3);
    await request(`/loans/${loan.id}/returns`,'POST',{items:[{medicineId:a.id,quantity:4}]},409);
    loan=await request('/loans/'+loan.id,'PATCH',{dueDate:'2030-10-02'});
    assert.equal('version' in loan,false);
    assert.equal('stockLinked' in loan,false);
    assert.equal(loan.dueDate.slice(0,10),'2030-10-02');
    loan=await request(`/loans/${loan.id}/returns`,'POST',{items:[{medicineId:a.id,quantity:3},{medicineId:b.id,quantity:2}]});
    assert.equal(loan.status,'returned');await check(a.id,15,5,0);await check(b.id,20,0,0);
    console.log('PASS: borrowing, partial return, replayed return, over-return rejection, extension and full return');

    let row=await get(a.id);
    await request('/medicines/'+a.id,'PATCH',{used:6},400);
    row=await request('/medicines/'+a.id,'PATCH',{used:6,reason:'Inventory count adjustment'});
    await check(a.id,14,5,0,1);
    await request('/medicines/'+a.id,'PATCH',{used:4,reason:'Must not erase dispensing'},409);
    await request('/medicines/'+a.id,'PATCH',{total:5,reason:'Must not exceed total'},409);
    await request('/medicines/'+a.id,'PATCH',{unit:'box'},400);
    row=await request('/medicines/'+a.id,'PATCH',{name:marker+'-renamed'});
    const detail=await request('/infirmary-visits/'+v.id);
    assert.equal(detail.dispensations[0].name,a.name);
    row=await request('/medicines/'+a.id,'DELETE',{});assert.equal(row.active,false);
    await request('/infirmary-visits','POST',payload([{medicineId:a.id,quantity:1}]),409);
    v=await request('/infirmary-visits/'+v.id,'PATCH',{...payload([])});
    await check(a.id,19,0,0,1);
    const external=await request('/infirmary-visits','POST',{...payload([]),visitorType:'บุคคลภายนอก'},201);
    assert.equal(external.visitorType,'บุคคลภายนอก');
    await Promise.all([2,3].map(quantity=>request('/infirmary-visits/'+external.id,'PATCH',payload([{medicineId:b.id,quantity}]))));
    const latest=await request('/infirmary-visits/'+external.id);
    await check(b.id,20-latest.dispensations[0].quantity,latest.dispensations[0].quantity,0);
    await request('/infirmary-visits/'+external.id,'PATCH',payload([]));
    await check(b.id,20,0,0);
    await request('/legacy-storage/fms-stock-records','PUT',{value:[]},409);
    const movements=await request('/medicines/movements');assert.ok(movements.some(m=>m.medicineId===a.id&&m.source==='manual'));
    console.log('PASS: reason required, stock components protected, historical snapshots, archive, uniform records and audit history');
  } finally {
    // Synthetic data cleanup in foreign-key order. Never delete pre-existing rows.
    await db.$transaction(async tx=>{
      await tx.loanReturn.deleteMany({where:{loanId:{in:[...loanIds]}}});
      await tx.loanItem.deleteMany({where:{loanId:{in:[...loanIds]}}});
      await tx.loan.deleteMany({where:{id:{in:[...loanIds]}}});
      await tx.dispensation.deleteMany({where:{visitId:{in:[...visitIds]}}});
      await tx.infirmaryVisit.deleteMany({where:{id:{in:[...visitIds]}}});
      await tx.stockMovement.deleteMany({where:{medicineId:{in:medicines}}});
      await tx.medicine.deleteMany({where:{id:{in:medicines}}});
      await tx.inventoryRequest.deleteMany({where:{id:{in:[...keys]}}});
    });
    await db.$disconnect();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
