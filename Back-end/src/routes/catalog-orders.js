const router = require('express').Router();
const prisma = require('../lib/prisma');
const {isDeepStrictEqual} = require('node:util');
const {fail,errorHandler} = require('../lib/inventory');
const key = 'fms-history-catalog-orders';
router.get('/',async(req,res,next)=>{try { const row=await prisma.legacyStorage.findUnique({where:{key}});res.json({success:true,data:Array.isArray(row?.value)?row.value:[]}); } catch(e){next(e);} });
router.post('/',async(req,res,next)=>{try {
  const {id,documentTitle,items}=req.body;
  if(typeof id!=='string'||! /^[\w-]{16,100}$/.test(id)||typeof documentTitle!=='string'||documentTitle.length>500||!Array.isArray(items)||!items.length||items.length>100) throw fail('คำสั่งซื้อไม่ถูกต้อง');
  if(items.some(i=>!i||typeof i.code!=='string'||!Number.isInteger(i.quantity)||i.quantity<1)) throw fail('รายการสินค้าไม่ถูกต้อง');
  const data=await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
    const row=await tx.legacyStorage.findUnique({where:{key}}), orders=Array.isArray(row?.value)?row.value:[];
    const old=orders.find(o=>o.id===id);
    if(old){if(old.documentTitle!==documentTitle||!isDeepStrictEqual(old.items,items))throw fail('รหัสคำสั่งซื้อซ้ำกับข้อมูลอื่น',409);return old;}
    const order={id,documentTitle,items,title:`การสั่งซื้อสินค้าครั้งที่ ${orders.length+1}`,createdAt:new Date().toISOString(),status:'บันทึกคำสั่งซื้อแล้ว'};
    await tx.legacyStorage.upsert({where:{key},create:{key,value:[order,...orders]},update:{value:[order,...orders]}});return order;
  },{maxWait:15000,timeout:20000});res.status(201).json({success:true,data});
}catch(e){next(e);} });
router.delete('/:id',async(req,res,next)=>{try {
  await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
    const row=await tx.legacyStorage.findUnique({where:{key}});
    if(!Array.isArray(row?.value))return;
    await tx.legacyStorage.update({where:{key},data:{value:row.value.filter(o=>o.id!==req.params.id)}});
  },{maxWait:15000,timeout:20000});res.json({success:true,data:{id:req.params.id}});
}catch(e){next(e);}});
router.use(errorHandler);module.exports=router;
