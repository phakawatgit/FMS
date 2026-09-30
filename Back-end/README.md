# FMS Back-end

ระบบ Stock, Infirmary และยืม–คืนเชื่อมฐานข้อมูลแล้ว ดู [สัญญา API กติกายอด และวิธีทดสอบ](../docs/INVENTORY-RELATIONS.md)
คำขอเปลี่ยนข้อมูลต้องมี `Idempotency-Key`; การแก้ไขต้องส่ง `version` และการปรับ stock ด้วยมือต้องมี `reason`

Backend ของ First Aid & Medicine Management System แบ่งเป็น 2 services:

- `Node.js + Express` สำหรับ REST API หลักที่ให้ Next.js เรียกใช้งาน
- `Python + FastAPI` สำหรับงานรายงานและการประมวลผลเฉพาะทาง

## Node.js API

```powershell
cd Back-end
Copy-Item .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

API จะทำงานที่ `http://localhost:4000`

สำหรับการเปิดจากรากโปรเจกต์ ใช้ `npm run dev:api` ซึ่งเรียก backend ใน `Back-end/` (ชุด `apps/api` เดิมไม่มี API Infirmary) ติดตั้ง dependencies ด้วย `npm --prefix Back-end install` และสร้าง client ด้วย `npm run db:generate` ก่อนใช้งานครั้งแรก

หลังรีสตาร์ทเครื่อง ให้เปิด PostgreSQL เดิมและรัน API อีกครั้ง พร้อมเปิดเว็บด้วย `npm --workspace apps/web run dev -- --port 3001` สำหรับฐานข้อมูล Docker ที่เปิดพอร์ต `5434` ให้ `DATABASE_URL` ใน `Back-end/.env` ชี้ไปพอร์ตนี้ ตรวจสอบการเชื่อมต่อที่ `http://localhost:4000/api/database/health` ห้ามลบ volume หรือ reset ฐานข้อมูลเพื่อแก้ปัญหาการเชื่อมต่อ

ตั้งค่า `NEXT_PUBLIC_API_URL=http://localhost:4000` ใน Next.js เพื่อให้ Front-end เรียก API ได้

## การส่ง OTP รีเซ็ตรหัสผ่าน

ระบบรีเซ็ตรหัสผ่านจะส่ง OTP ผ่าน SMTP และเปลี่ยนรหัสผ่าน Firebase หลังยืนยัน OTP สำเร็จ

สร้างไฟล์ `Back-end/.env` แล้วเติมค่าต่อไปนี้:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
FIREBASE_PROJECT_ID=fams-7fdff
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@fams-7fdff.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

สำหรับ Gmail ต้องเปิด 2-Step Verification และสร้าง App Password ห้ามใช้รหัสผ่าน Gmail ปกติ และห้าม commit ไฟล์ `.env`

- `GET /` ดูสถานะ API
- `GET /api/health` ตรวจสอบสุขภาพ service
- `GET /api/overview` ดูโมดูลที่เตรียมไว้
- `GET /api/database/health` ตรวจสอบการเชื่อมต่อ PostgreSQL
- `GET /api/overview` ดึงข้อมูลสรุปจาก PostgreSQL ผ่าน Prisma
- `POST /api/infirmary-visits` บันทึกข้อมูลผู้เข้าใช้ห้องพยาบาลและผลตรวจลง PostgreSQL
- `GET /api/infirmary-visits` อ่านรายการจาก PostgreSQL เรียงใหม่สุดก่อน ตอบ `{ success: true, data: [...] }`
- `PATCH /api/infirmary-visits/:id` อัปเดตสถานะและโรงพยาบาลที่ส่งต่อจากหน้ารอประเมิน

`PATCH` รับได้ทั้งสถานะ/โรงพยาบาล หรือข้อมูลฟอร์มครบชุดสำหรับหน้ารายละเอียด โดยตรวจสอบข้อมูลเช่นเดียวกับการสร้างรายการ หน้า Infirmary, ประวัติ, รอประเมิน และรายละเอียดใช้ตาราง `InfirmaryVisit` เป็นแหล่งข้อมูล ไม่ใช้ localStorage ยืนยันว่าบันทึกสำเร็จ ข้อมูลเก่าใน localStorage/LegacyStorage ไม่ถูกลบหรือย้ายเข้าอัตโนมัติ

ทดสอบการบันทึกจริงด้วย `node Back-end/tests/infirmary-persistence.cjs` จากรากโปรเจกต์ เมื่อเว็บพอร์ต `3001` และฐานข้อมูลพร้อม ต้องมี Playwright และ browser ติดตั้งอยู่ (`BROWSER_CHANNEL=msedge` ใช้ Edge ที่ติดตั้งในเครื่องได้) การทดสอบเปิด API แยกพอร์ต `4011` สร้างข้อมูลสังเคราะห์และลบเฉพาะข้อมูลของรอบทดสอบนั้นหลังจบ

หน้า HTML เดิมใน `Front-end/` จะถูก mount เป็น `/legacy/` ใน Docker ชั่วคราว เพื่อให้ทุกหน้าทดลองยังเปิดใช้งานได้ระหว่างทยอยแปลงเป็น React/Next.js

## PostgreSQL + Prisma

ตั้งค่า `DATABASE_URL` ในไฟล์ `.env` จากนั้นใช้คำสั่ง:

```powershell
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:studio
```

ไฟล์ Prisma schema อยู่ที่ `Back-end/prisma/schema.prisma`

ข้อมูลการเข้าใช้ห้องพยาบาลเก็บในตาราง `InfirmaryVisit` โดยมีข้อมูลผู้เข้าใช้, หลักสูตร/สาขา, อาการ, สัญญาณชีพ, ยาที่ได้รับ, สถานะ และโรงพยาบาลที่ส่งต่อ Migration ใหม่จะถูกรันด้วย `prisma migrate deploy` ตอนเริ่ม API ใน Docker

## Catalog และ Stock

ข้อมูลยาร่วมกันอยู่ในตาราง `Medicine` รวมชื่อยา/สินค้า/ชื่อสามัญ ประเภท รูปแบบ ขนาด หน่วย สรรพคุณ อาการ วิธีใช้ ข้อควรระวัง จำนวนทั้งหมด/ใช้ และวันหมดอายุ (`DATE`) รูปเก็บเป็น JPEG ใน PostgreSQL ไม่ต้องมีโฟลเดอร์ uploads เพิ่ม รหัสยาออกฝั่งเซิร์ฟเวอร์และไม่เปลี่ยนเมื่อแก้ชื่อ

- `GET /api/medicines` รายการเรียงใหม่สุดก่อน; `GET /api/medicines/:id` รายละเอียด (รับรหัสยาเดิมได้ด้วย)
- `POST /api/medicines` เพิ่มยา; `PATCH /api/medicines/:id` แก้ไขเฉพาะช่องที่ส่งมา; `DELETE /api/medicines/:id` เลิกใช้งานและเก็บประวัติ
- `PATCH /api/medicines/:id/inventory` รับ `{ field: "total" | "used", delta: 1 | -1, reason }` ปรับจำนวนภายใต้ row lock
- `GET /api/medicines/:id/image` ส่งภาพแยกจาก JSON; ช่อง `image` ใน JSON เป็น URL ของภาพ

จำนวนต้องเป็นจำนวนเต็มที่ไม่ติดลบและใช้ไม่เกินทั้งหมด ค่า `remaining` และ `status` คำนวณโดย API: เหลือ 0 = หมด, เหลือไม่เกิน `max(1, ceil(total × 20%))` = ใกล้หมด, นอกนั้น = ปกติ ไม่รับรหัสหรือสถานะที่คำนวณจากเบราว์เซอร์ ภาพส่งเป็น data URL ของ JPEG/PNG/WEBP ไม่เกิน 2 MiB ตรวจและแปลงเป็น JPEG ด้านยาวไม่เกิน 1200 px; การแก้ไขที่ไม่ส่ง `image` จะคงภาพเดิม ส่วน `null` ลบภาพ

ติดตั้งด้วย `npm --prefix Back-end install`, รัน `prisma migrate deploy` ภายใน `Back-end` และ `npm run db:generate` จากรากโปรเจกต์ หาก Windows ล็อก Prisma DLL ให้หยุด API ก่อน generate แล้วเปิดใหม่ ไม่ต้อง reset ฐานข้อมูล

หน้าเพิ่ม/แก้ไข, Catalog, Stock, รายละเอียด รวมถึงข้อมูลสินค้าในตะกร้า/เอกสารสั่งซื้อและตัวเลือกยา Infirmary อ่านจาก API ข้อมูลตะกร้าและประวัติคำสั่งซื้อยังเก็บแบบเดิม ไม่ย้ายรายการจาก `fms-stock-records` อัตโนมัติ และไม่ sync คีย์ข้อมูลยาเก่าใน LegacyStorage อีกต่อไป

ทดสอบด้วย `node Back-end/tests/medicine-persistence.cjs` เมื่อเว็บพอร์ต 3001 และฐานข้อมูลพร้อม ชุดทดสอบใช้ API แยกพอร์ต 4012 กับ Edge (`BROWSER_CHANNEL` เปลี่ยนได้) ทดสอบการบันทึก/รูป/คงคลัง/แก้ไข/ลบผ่านเบราว์เซอร์ และลบเฉพาะรายการสังเคราะห์ของรอบนั้น เลขลำดับที่ใช้ทดสอบจะไม่ถูกนำกลับมาใช้ซ้ำ

## Python service

```powershell
cd Back-end/python-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Python service จะทำงานที่ `http://localhost:8000`

- `GET /health` ตรวจสอบสุขภาพ service
- `POST /reports/preview` จุดเริ่มต้นสำหรับระบบรายงาน

## การเชื่อมต่อกับ Next.js

กำหนด API base URL ในฝั่ง Front-end เช่น:

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
```
