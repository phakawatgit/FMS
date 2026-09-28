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

- `GET /` ดูสถานะ API
- `GET /api/health` ตรวจสอบสุขภาพ service
- `GET /api/overview` ดูโมดูลที่เตรียมไว้
- `GET /api/database/health` ตรวจสอบการเชื่อมต่อ PostgreSQL
- `GET /api/overview` ดึงข้อมูลสรุปจาก PostgreSQL ผ่าน Prisma

## PostgreSQL + Prisma

ตั้งค่า `DATABASE_URL` ในไฟล์ `.env` จากนั้นใช้คำสั่ง:

```powershell
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:studio
```

ไฟล์ Prisma schema อยู่ที่ `Back-end/prisma/schema.prisma`

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
