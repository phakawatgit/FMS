# FMS system audit

สถานะเริ่มตรวจ 2026-10-01; “มีโค้ด” ไม่เท่ากับ “ทดสอบผ่าน”

| โมดูล | ข้อมูล/API หลัก | สิ่งที่พบ | งานแก้/ตรวจรับ |
|---|---|---|---|
| Login/register/reset | Firebase, User, PasswordResetOtp | Legacy Firebase + demo bypass; Next login ตัวอย่าง | token/roles API, Emulator, login/logout/reset ทั้งสอง UI |
| Infirmary/assessment/history | InfirmaryVisit, Dispensation | API มีรายการยา; summary ใน frontend | CRUD/status/persistence หลายยา ทั้งสอง UI |
| Stock/images/history | Medicine, StockMovement | เก็บ imageData/type; URL คำนวณ | imageUrl จริง, upload/replace/delete/open URL, reconciliation |
| Catalog/orders | LegacyStorage catalog-orders | orders JSON ทั้งชุด | CatalogOrder/Item, snapshot, idempotency, delete audit |
| Borrow/return | Loan/Item/Return | transaction/API มีแล้ว | partial/full return/extend/concurrent ทั้งสอง UI |
| Nurse/duty | Nurse/User/DutyShift | API token บางส่วน; browser cache | async โหลดจริง สิทธิ์เจ้าของ unique date/color race |
| Dashboard/notifications | dashboard API + frontend calculations | Legacy เชื่อมแล้ว Next preview | ตัวกรอง เวลาไทย refresh error state รายงานจริง |
| Admin/reference data | LegacyStorage/localStorage | render เขียนข้อมูล; defaults; ไม่มี role API | Faculty/Branch/settings/users/admin-only |
| Activity/deleted | localStorage audit | ผู้กระทำอิง browser เขียนเอง | server AuditLog transaction, admin read |
| Reports | Python reports + browser exports | Python ยังสร้างเอกสารว่าง | authorized snapshot Excel/PDF ภาษาไทย |
| Startup/schema | Back-end vs apps/api | สอง schema/API; Docker volume ขึ้นกับชื่อ compose | canonical commands/docs explicit database target |

## เกณฑ์จบ
ทุกปุ่ม/ฟอร์มในทุกหน้า Legacy มี API/ข้อมูล/สิทธิ์ชัดเจน และ Next.js มีหน้าทำงานเทียบเท่า; ผ่าน syntax/type/build/API/E2E/restart/error/concurrency tests; บริการภายนอกที่ยังไม่ได้ทดสอบระบุแยก
