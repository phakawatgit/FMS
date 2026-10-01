# Front-end Architecture

เอกสารนี้อธิบายขอบเขตของ Front-end สองชุดในโปรเจกต์ FMS

## Legacy Front-end: `Front-end/`

ระบบที่ใช้งานจริงในปัจจุบัน เป็น Static Web App:

```text
HTML page
  -> page CSS
  -> shared header / language / storage
  -> page JavaScript
  -> FMSStorage API -> PostgreSQL
```

แต่ละหน้าเป็น entry point แยกกัน เช่น `dashboard.html`, `stock.html` และ `catalog.html` จึงไม่มี React component tree ร่วมกันแบบ Next.js

## New web app: `apps/web/`

เป็น Next.js App Router ที่กำลังทยอยย้ายระบบเข้าไป:

```text
app/layout.tsx          Root layout and metadata
app/page.tsx            Next.js home page
app/login/page.tsx      Login UI (ยังเป็นตัวอย่าง)
app/modules/[slug]      Dynamic module placeholder
components/layout       AppHeader and ModulePage
components/dashboard   DashboardPreview and MenuCard
lib/api.ts              API client
app/globals.css         Global Tailwind/CSS
```

ปัจจุบัน Next.js ยังใช้ลิงก์ `/legacy/*.html` สำหรับฟังก์ชันระบบจริงหลายส่วน จึงไม่ควรลบหรือย้ายไฟล์ใน `Front-end/` จนกว่าจะย้าย route นั้นเข้า Next.js เสร็จ

## Data ownership

| ข้อมูล | แหล่งเก็บปัจจุบัน |
|---|---|
| ข้อมูลระบบและ UI state ที่ต้องคงอยู่ | `/api/legacy-storage` -> PostgreSQL |
| ข้อมูล session ชั่วคราว | Browser `sessionStorage` |
| Duty Shift รุ่น API ใหม่ | Express + Prisma + PostgreSQL |
| Authentication บางหน้า | Firebase Auth |

## หลักการแก้ไข

- แก้ UI ของหน้าที่ใช้งานจริงใน `Front-end/`
- แก้หน้า Next.js ใน `apps/web/`
- แก้ API ใหม่ใน `apps/api/`
- แก้ schema และ migration ใน `packages/database/`
- แก้ระบบรายงานใน `services/reports/`
- หลีกเลี่ยงการย้ายไฟล์ Legacy โดยไม่ปรับ URL และ relative paths พร้อมกัน
