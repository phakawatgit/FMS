# FMS Back-end

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
- `PATCH /api/infirmary-visits/:id` อัปเดตสถานะและโรงพยาบาลที่ส่งต่อจากหน้ารอประเมิน

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
