// Read-only reconciliation: checks actual counters against their related rows.
const assert = require('node:assert/strict');
const path = require('node:path');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
(async()=>{
 try {
  const rows=await db.medicine.findMany({include:{dispensations:true,loanItems:true,movements:{orderBy:{createdAt:'desc'},take:1}}});
  for(const row of rows){
   const dispensed=row.dispensations.reduce((n,i)=>n+i.quantity,0);
   const borrowed=row.loanItems.reduce((n,i)=>n+i.quantity-i.returned,0);
   assert.equal(row.dispensed,dispensed,`Dispensing mismatch: ${row.id}`);
   assert.equal(row.borrowed,borrowed,`Borrowing mismatch: ${row.id}`);
   assert.equal(row.used,row.manualUsed+dispensed+borrowed,`Used mismatch: ${row.id}`);
   assert.ok(row.total>=row.used && row.manualUsed>=0,`Invalid balance: ${row.id}`);
   assert.ok(row.movements.length,`Missing opening history: ${row.id}`);
   const after=row.movements[0].after;
   assert.equal(after.remaining,row.total-row.used,`Movement balance mismatch: ${row.id}`);
  }
  console.log(`PASS: ${rows.length} medicine balances match dispensing, outstanding loans and movement history`);
  console.log(JSON.stringify({medicines:rows.length,visits:await db.infirmaryVisit.count(),loans:await db.loan.count(),syntheticMedicines:await db.medicine.count({where:{OR:[{name:{startsWith:'inventory-test-'}},{name:{startsWith:'browser-stock-'}},{name:{startsWith:'catalog-test-'}}]}})}));
 }finally{await db.$disconnect()}
})().catch(e=>{console.error(e);process.exitCode=1});
