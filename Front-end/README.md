# FMS Front-end

โฟลเดอร์นี้คือ Front-end เดิมที่ใช้งานจริงของระบบ FMS เป็น Static Web App ที่ประกอบด้วย HTML, CSS และ JavaScript แบบแยกตามหน้า

## ทำไมไฟล์ยังอยู่ระดับเดียวกัน

ไฟล์หน้าเว็บถูกเปิดผ่าน `/legacy/*.html` และมีลิงก์แบบ relative จำนวนมาก การย้ายไฟล์ทันทีจะทำให้ลิงก์ รูปภาพ CSS และสคริปต์ของหน้าที่ใช้งานอยู่เสียหาย ดังนั้นตอนนี้จึงจัดหมวดหมู่ด้วยหน้าที่รับผิดชอบและคง URL เดิมไว้ก่อน

## แผนผังการทำงาน

```text
หน้า HTML
  ├─ โหลด CSS ของหน้านั้น
  ├─ โหลด header-controls / page-tools
  ├─ โหลด language-toggle
  ├─ โหลด legacy-storage เพื่อเชื่อม FMSStorage กับ API
  └─ โหลด JavaScript ของ module

ข้อมูลหน้าเว็บ
  ├─ FMSStorage → /api/legacy-storage → PostgreSQL (แหล่งเก็บข้อมูลถาวร)
  └─ Firebase Auth (การเข้าสู่ระบบของหน้าที่ใช้ Firebase)
```

ข้อมูลของระบบทุกหน้าต้องอ่านและเขียนผ่าน `FMSStorage` ซึ่งเรียก `/api/legacy-storage` โดยตรง ไม่มี browser storage สำรองสำหรับข้อมูลระบบ หาก backend ใช้งานไม่ได้ หน้าเว็บจะแจ้งว่าบันทึกไม่ได้ ข้อมูล session สำหรับการเข้าสู่ระบบชั่วคราวยังอยู่ใน `sessionStorage` และไม่ถูกส่งไปเก็บร่วมกับข้อมูลระบบ

## หน้าและโมดูล

| กลุ่ม | หน้าเริ่มต้น | ไฟล์ JavaScript หลัก |
|---|---|---|
| Authentication | `index.html` | `script.js` |
| Menu | `menu.html` | `menu.js` |
| Dashboard | `dashboard.html` | `dashboard.js`, `dashboard-live.js`, `dashboard-order-history.js` |
| Infirmary | `infirmary-visit.html` | `infirmary-visit.js` |
| Infirmary history | `infirmary-visit-history.html` | `infirmary-visit-history.js` |
| Stock | `stock.html`, `stock-oral.html`, `stock-topical.html`, `stock-equipment.html` | `stock.js` |
| Stock detail | `stock-detail.html`, `stock-add.html` | `stock-detail.js`, `stock-add.js` |
| Catalog | `catalog.html`, `catalog-detail.html`, `catalog-cart.html`, `catalog-order.html` | ชุด `catalog-*.js` |
| Borrow / Return | `borrow-return.html`, `borrow-form.html`, `borrow-selected.html`, `borrow-order.html` | ชุด `borrow-*.js` |
| Assessment | `pending-assessment.html`, `assessment-detail.html` | ชุด `assessment-detail-*.js` |
| Duty shift | `duty-shift.html` | `duty-shift.js` |
| History | `history.html`, `history-stock.html`, `history-catalog.html`, `borrow-return-history.html` | ชุด `history-*.js` |
| Admin | `admin-settings.html` | `admin-settings.js`, `admin-audit.js` |
| Activity | `system-activity.html` | `system-activity.js` |

## ไฟล์กลางที่ควรแก้เมื่อแก้ระบบรวม

- `language-toggle.js` — ภาษาไทย/อังกฤษและการจำภาษาที่เลือก
- `header-controls.js` — ปุ่มและพฤติกรรมของ Topbar
- `header-controls.css` — Layout ของ Topbar และ Responsive ทุกหน้า
- `page-tools.js` / `page-tools.css` — เครื่องมือด้านบนของหน้า
- `legacy-storage.js` — `FMSStorage` client สำหรับอ่านและเขียนข้อมูลกับ Backend; นำเข้าข้อมูล FMS เก่าจาก browser storage หนึ่งครั้งเมื่อเชื่อมต่อสำเร็จ
- `notification-utils.js` — คำนวณรายการแจ้งเตือนจากข้อมูลยาและรายการยืม
- `theme-colors.css` / `font-kanit.css` — สีและฟอนต์ร่วม
- `assets/` — รูปภาพ ไอคอน และภาพประกอบ

## กฎการเพิ่มหน้าใหม่

1. ตั้งชื่อหน้าเป็น `module.html` และสคริปต์เป็น `module.js` / `module.css`
2. ใส่ `header-controls.css` และ `language-toggle.js` ให้หน้าใหม่
3. อ่านและเขียนข้อมูลระบบผ่าน `FMSStorage` และ `/api/legacy-storage` หรือ API ของระบบใหม่เท่านั้น
4. ห้ามเพิ่ม browser storage เป็นแหล่งเก็บข้อมูลหรือ offline fallback
5. เพิ่มหน้าใหม่ในตารางด้านบนทันที

## ความสัมพันธ์กับ Next.js

Next.js อยู่ที่ `apps/web` และเป็นโครงสร้างใหม่ ส่วนหน้าเมนูของ Next.js ในปัจจุบันยังลิงก์กลับมายังหน้านี้ผ่าน `/legacy/*.html` ดังนั้นการแก้หน้าที่ผู้ใช้กำลังใช้งานอยู่ต้องแก้ใน `Front-end` ก่อน
