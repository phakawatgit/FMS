# Stock, Infirmary และยืม–คืน

## โครงสร้างและยอด

Schema ที่ใช้งานคือ `Back-end/prisma/schema.prisma` ทั้งการรันในเครื่องและ Docker
`Dispensation` เชื่อมคนไข้กับ `Medicine`; `LoanItem` เชื่อมใบยืมกับยา;
`LoanReturn` เก็บแต่ละครั้งที่คืน และ `StockMovement` เก็บยอดก่อน–หลังทุกการเคลื่อนไหว

- `total`: จำนวนทั้งหมดที่รับเข้า/ปรับนับ
- `manualUsed`: ยอดใช้ที่บันทึกหรือปรับด้วยมือ
- `dispensed`: ผลรวมจำนวนในรายการจ่ายคนไข้
- `borrowed`: จำนวนยืมที่ยังไม่คืน
- `used = manualUsed + dispensed + borrowed`
- `remaining = total - used`

แก้จำนวนใช้รวมด้วยมือได้เฉพาะส่วน manualUsed และต้องมีเหตุผล จึงไม่สามารถลด used
ต่ำกว่าจำนวนจ่ายคนไข้รวมกับยอดยืมค้างได้ การปรับ total ต้องไม่ต่ำกว่า used
ป้ายใกล้หมดใช้เกณฑ์เดียวกัน: คงเหลือไม่เกิน `max(1, ceil(total * 20%))`

หน่วยต้องเป็นหน่วยที่ระบุใน stock และจำนวนเต็มบวก ไม่มีการแปลงกล่อง/แผง/เม็ด
ชื่อยา รหัส และหน่วยถูกเก็บเป็น snapshot ในรายการจ่ายและรายการยืม
ยาเลิกใช้งานหรือหมดอายุจ่ายเพิ่มไม่ได้ แต่คืนยอดจากการจ่าย/ยืมเดิมได้
เปลี่ยนหน่วยของยาที่มีประวัติแล้วไม่ได้ ให้สร้างรายการใหม่; ข้อมูลเก่าที่ยังไม่มีหน่วยเติมหน่วยได้
การลบยาทำเป็นเลิกใช้งาน (`active=false`) เพื่อเก็บประวัติและความสัมพันธ์

## API

ทุกคำขอที่เปลี่ยน stock/คนไข้/ใบยืมต้องมี header `Idempotency-Key` (UUID)
ใช้ key เดิมและ body เดิมเมื่อลองซ้ำจากการเชื่อมต่อหลุด; เซิร์ฟเวอร์คืนผลเดิมโดยไม่ตัดซ้ำ
key เดิมกับข้อมูลต่างกันตอบ 409 ไม่ใช้ `version` ในคำขอหรือผลลัพธ์
การแก้ไขที่ทำงานทีหลังใช้ค่าที่ส่งมาสำหรับฟิลด์นั้น โดยคำนวณส่วนต่างสต็อกจากข้อมูลล่าสุดภายใต้ row lock

- `POST /api/infirmary-visits`: ข้อมูลคนไข้เดิม พร้อม `dispensations: [{medicineId, quantity}]`; ว่างได้เมื่อไม่จ่ายยา
- `GET /api/infirmary-visits/:id`: ข้อมูลคนไข้ พร้อมรายการยา snapshot
- `PATCH /api/infirmary-visits/:id`: ข้อมูลเต็ม หรือ status/hospitalName; ถ้าส่ง dispensations จะปรับตามส่วนต่าง หากไม่ส่งจะคงยาเดิม
- `POST /api/loans`: `{details: {fullName, ...}, dueDate: "YYYY-MM-DD", items: [{medicineId, quantity}]}`
- `GET /api/loans`: ใบยืมจากตาราง Loan เท่านั้น
- `POST /api/loans/:id/returns`: `{items: [{medicineId, quantity}]}` จำนวนคือจำนวนที่คืนครั้งนี้ รองรับคืนบางส่วน
- `PATCH /api/loans/:id`: `{dueDate}` ต่อกำหนดคืนของใบยืมที่ยังค้าง
- `PATCH /api/medicines/:id/inventory`: `{field: "total" | "used", delta: 1 | -1, reason}`
- `PATCH /api/medicines/:id`: ถ้าแก้ total/used ต้องมี reason; อย่าส่งยอดเก่าถ้าแก้เฉพาะชื่อ/รายละเอียด
- `DELETE /api/medicines/:id`: `{}` เลิกใช้งาน
- `GET /api/medicines/movements`: ประวัติความเคลื่อนไหวพร้อมข้อมูลยา

ทุกการบันทึกพร้อมตัด/คืน stock ใช้ transaction เดียวและ row lock
ถ้ารายการใดผิดหรือไม่พอ ต้องไม่บันทึกส่วนอื่นบางส่วน
วันหมดอายุและสถานะเกินกำหนดใช้วันของ Asia/Bangkok

## รูปแบบเดียวและหน้าเว็บ

ทุกคนไข้ใช้ `Dispensation` เป็นแหล่งรายการยาเพียงแห่งเดียว ไม่มี stockLinked หรือช่อง medicine/quantity ซ้ำใน InfirmaryVisit
ส่ง dispensations เป็น [] เพื่อล้างรายการจ่ายและคืนยอด; ไม่ส่งขณะแก้ไขคือคงรายการเดิม
หน้าเว็บสรุปชื่อและจำนวนจาก dispensations สำหรับแสดงผลเท่านั้น

Migration `20261001130000_simplify_inventory_records` ลบฟิลด์ที่เลิกใช้ ไม่ล้างข้อมูลอัตโนมัติ
ข้อมูลทดสอบคนไข้/คลัง/ยืมคืน/ความเคลื่อนไหว/คำขอซ้ำและสำเนา legacy ถูกล้างแยกครั้งเดียวตามคำสั่งผู้ใช้
การล้างไม่ได้รีเซ็ตลำดับรหัสยา ไม่กระทบบัญชี พยาบาล เวร หรือประวัติคำสั่งซื้อ

`Front-end/real-data.js` เป็น adapter สำหรับหน้าระบบเดิมที่ยังอ่านข้อมูลแบบ synchronous:
อ่าน stock/คนไข้/ใบยืมจาก API แล้วเก็บ cache เฉพาะหน้านั้น ไม่ใช้ browser storage เป็นยอดจริง
ฟอร์มใหม่ใช้ async requests โดยตรง โหลดข้อมูลล้มเหลวแสดงข้อผิดพลาด ไม่แทนด้วยข้อมูลจำลอง
ร่างยืมและตะกร้าเก็บเฉพาะ browser และกรองรหัสที่ไม่มีในคลังเมื่อโหลด API สำเร็จ; หยุดอัปโหลดข้อมูลเก่าจาก browser อัตโนมัติ
ยังคง legacy store สำหรับโมดูลอื่น เช่น ประวัติคำสั่งซื้อ และคง demo-admin ตามขอบเขตที่ตกลง
การเปลี่ยนรอบนี้จึงไม่ได้เปลี่ยนระบบบัญชีและสิทธิ์ทั้งระบบ

## ติดตั้งและตรวจสอบ

สำรองฐานข้อมูลก่อน migration แล้วรันจาก `Back-end`:

```powershell
npx.cmd prisma migrate deploy
npx.cmd prisma generate
npm.cmd run dev
```

เปิดเว็บอีก terminal ด้วย `npm.cmd run dev:web` จากรากโปรเจกต์ แล้วตรวจ:

```powershell
npm.cmd --prefix Back-end run test:inventory
npm.cmd --prefix Back-end run test:inventory:browser
npm.cmd --prefix Back-end run verify:inventory
$env:WEB_URL='http://localhost:3000'
$env:BROWSER_CHANNEL='msedge'
node Back-end/tests/infirmary-persistence.cjs
node Back-end/tests/medicine-persistence.cjs
```

ชุดใหม่ใช้ API 4000 และเว็บ 3000 เป็นค่าเริ่มต้น เปลี่ยนด้วย TEST_API_URL
(รวม `/api`) และ WEB_URL ได้ Tests เดิมเปิด API ของตัวเองที่ 4011/4012
Tests ใช้ข้อมูลสังเคราะห์ที่ติด marker เฉพาะรอบและลบเฉพาะข้อมูลของรอบนั้นตามลำดับ foreign key
`verify:inventory` อ่านอย่างเดียวและเทียบยอดกับรายการจ่าย/ยืม/ประวัติจริง

## ข้อมูลจำลองที่นำออก

- ตัวเลือกยาตายตัวจากฟอร์มคนไข้; ใช้ ID ชื่อ รหัส หน่วย และยอดจาก API
- `/100` ตายตัวและตัวเลือกหน่วยบรรจุปลอมใน catalog; ใช้หน่วยและจำนวนจริง
- สรรพคุณ/คำแนะนำที่เติมเองเมื่อข้อมูลว่าง และข้อความแจ้งเตือนจำนวนคงที่
- การแก้ประวัติยืมด้วยชื่อคนที่ hardcode และการสร้างสินค้าคืนตัวอย่างเมื่อไม่มีรายการ
- การล้างประวัติคำสั่งซื้อทั้งชุดเมื่อเปิด dashboard ครั้งแรก

ล้างเฉพาะข้อมูลตามขอบเขตที่ผู้ใช้สั่ง ไม่ล้างฐานข้อมูลทั้งระบบ
เก็บ fixture ใน tests และข้อมูลอ้างอิง UI เช่นชื่อสถานะและประเภทสินค้า
