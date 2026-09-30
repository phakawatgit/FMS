const router = require('express').Router();
const prisma = require('../lib/prisma');
const { filters, aggregate } = require('../lib/dashboard');
router.get('/', async (req,res,next) => {
  try {
    const range = filters(req.query);
    const data = await prisma.$transaction(async tx => {
      const visits = await tx.infirmaryVisit.findMany({ where: { createdAt: { gte: new Date(range.start+'T00:00:00+07:00'), lt: new Date(new Date(range.end+'T00:00:00+07:00').getTime()+86400000) }, ...(range.faculty !== 'all' ? {faculty:range.faculty} : {}), ...(range.branch !== 'all' ? {branch:range.branch} : {}) }, include: { dispensations: {include:{medicine:{select:{name:true}}}} }, orderBy:{createdAt:'asc'} });
      const medicines = await tx.medicine.findMany({where:{active:true}, select:{id:true,code:true,name:true,unit:true,total:true,used:true,manualUsed:true,dispensed:true,borrowed:true,expiry:true,warning:true,imageType:true,category:true,form:true,size:true,benefit:true,symptom:true,usage:true},orderBy:{code:'asc'}});
      const orders = await tx.legacyStorage.findUnique({where:{key:'fms-history-catalog-orders'}});
      const loans = await tx.loan.findMany({include:{items:true}});
      const dimensions = await tx.infirmaryVisit.findMany({distinct:['faculty','branch'],select:{faculty:true,branch:true}});
      return { ...aggregate(visits,medicines,range), visits, filters:range, dimensions, orders:Array.isArray(orders?.value)?orders.value:[], loans:loans.map(l=>({...l.details,id:l.id,dueDate:l.dueDate,items:l.items.filter(i=>i.quantity>i.returned)})), updatedAt:new Date().toISOString() };
    }, {isolationLevel:'RepeatableRead',maxWait:15000,timeout:20000});
    res.set('Cache-Control','no-store').json({success:true,data});
  } catch(e) { if(e.status) return res.status(e.status).json({success:false,message:e.message}); next(e); }
});
router.use((err,req,res,next)=>{console.error('Dashboard read failed:',err.code||err.message);res.status(503).json({success:false,message:'อ่านข้อมูล Dashboard ไม่สำเร็จ'});});
module.exports = router;
