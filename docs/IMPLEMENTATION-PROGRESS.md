# FMS implementation progress

อัปเดต 2026-10-01 (Asia/Bangkok)

## ขอบเขตที่ผู้ใช้อนุมัติ
- ทำ Legacy และ Next.js ให้ครบผ่าน Back-end/schema หลักชุดเดียว คงโครง Legacy
- Firebase จริง + Auth Emulator สำหรับทดสอบ; Nurse ทำงานประจำครบ Admin จัดการบัญชี/ตั้งค่า/audit
- Dispensation เป็นรายการจ่ายยาหลัก ไม่เพิ่ม medicine/quantity ซ้ำใน Visit
- Medicine.imageUrl เป็น URL เต็มของรูปอัปโหลด คง imageData/imageType
- ตรวจและเพิ่ม persistence ทุกฟังก์ชัน ทดสอบทั้งระบบ อัปเดตบันทึกส่งต่อทุกช่วง

## สถานะ
- [x] อ่าน memory และตรวจโค้ดเบื้องต้น
- [ ] ตารางตรวจครบทุกหน้า/การกระทำ
- [ ] ฐานข้อมูลและ API: imageUrl, catalog orders, reference data, audit, auth/roles
- [ ] Legacy async API และ auth ทุกหน้า
- [ ] Next.js ทุกโมดูลแทน placeholders
- [ ] รายงานจริง Excel/PDF
- [ ] regression, E2E ทั้งสองหน้าบ้าน, reconciliation

## ข้อเท็จจริงก่อนเริ่ม
- มีการแก้ CONVERSATION_MEMORY.md และ docker-compose.yml มาก่อน ห้ามย้อนทับ
- ตรวจรอบก่อนพบ Visit 1 รายการ มี Dispensation ครบ API ส่งชื่อ/จำนวน/หน่วยได้; verify:inventory ผ่าน
- ข้างต้นไม่ใช่ผลทดสอบทั้งระบบ และสถานะ process ต้องตรวจใหม่
- apps/api และ packages/database เป็นชุดเก่า; runtime หลักคือ Back-end
- Next.js login/module ยังเป็นตัวอย่าง; admin audit/options ยังใช้ localStorage ผ่าน legacy sync

## คำสั่ง/หลักฐาน
- สำรอง `.local-backups/fms-before-system-completion-20261001.dump`
- apply ฐานจริง: 20261001140000_medicine_image_url และ 20261001150000_system_persistence; generate Client แล้ว
- image URLs เติมแล้ว; `system-persistence.cjs` ผ่านก่อนเปิด auth gateway (รูป/คำสั่งซื้อ/restart/audit); fixtures ลบเฉพาะของ test
- `verify:inventory` ผ่าน และ `test:inventory` ผ่านก่อนเปิด auth gateway; ต้องรันซ้ำผ่าน Emulator
- เพิ่ม Firebase auth/role middleware, admin/settings APIs, server mutation audit; Legacy bootstrap async และ Next.js workspace อยู่ระหว่างทดสอบ ยังไม่ถือว่าเสร็จ
- TypeScript ผ่านรอบแรกก่อนแก้ homepage เพิ่ม
- ติดตั้ง firebase-tools dev dependency; Auth Emulator เปิดที่ 127.0.0.1:9099 ด้วย project demo-fms ไม่ใช่บัญชีจริง
- npm install รายงาน 15 vulnerabilities (11 moderate, 4 high); ยังไม่ได้วิเคราะห์/แก้ จัดเป็นงานค้าง
- สร้างฐานแยก fms_system_test พบ baseline User/DutyShift/LegacyStorage/PasswordResetOtp หายจาก migration เดิม จึงเพิ่ม 20261001145000_complete_baseline
- การลอง migrate ฐานทดสอบครั้งแรกหยุดที่ตาราง User ซึ่งไม่มี; เพิ่ม baseline migration แล้ว migrate `fms_system_test` ครบทั้ง 10 migration

## ผลตรวจล่าสุด 2026-10-01
- `node Back-end/tests/run-system.cjs` ผ่านครบ 6 suites บน `fms_system_test` + Firebase Auth Emulator: system persistence, inventory relations/browser, dashboard, infirmary persistence และ medicine persistence
- `npm.cmd exec --workspace apps/web -- tsc --noEmit --incremental false` ผ่าน; `npm.cmd --workspace apps/web run build` ผ่าน compile/type validation/static generation
- apply `20261001145000_complete_baseline` กับฐาน `fms` บน PostgreSQL master หลังยืนยัน backup `.local-backups/fms-before-system-completion-20261001.dump`; Prisma migrate status up-to-date และ schema validate ผ่าน
- `fms_system_test` เป็น logical database แยกบน PostgreSQL master host/volume เดียวกัน; fixtures ของแต่ละ test ถูก cleanup, ไม่ใช่การทดสอบกับ application database `fms`
- ข้าม ReIcon CDN ที่ไม่มีการใช้งานใน Legacy เพื่อไม่ให้ CDN failure หยุด page bootstrap; source และ public mirror ตรงกัน
- แก้ test readiness สำหรับ async Legacy bootstrap, retry overlay และ default runner ที่เคยเรียก `system-browser.cjs` ซึ่งไม่มีไฟล์
- เว็บ/API/master/Auth Emulator เปิดอยู่ ณ เวลาตรวจ: ports 3000/4000/5434/9099; ทดสอบ `/legacy/index.html` และ `/api/database/health` ตอบ 200

## งานถัดไป
1. [x] ทดสอบฐาน `fms_system_test`/Auth Emulator ผ่าน runner และ token จริงครบทุก suite ที่มี
2. [ ] ตรวจ Legacy ทุกหน้าและ Next.js ทุกโมดูล; Next.js full E2E และ `system-browser.cjs` ยังไม่มี
3. [ ] OTP concurrency, reports จริง, UI/API field completeness, audit ครบ, reference validation
4. [x] apply baseline 145000 ที่ฐานจริง; migration status สะอาด
5. [ ] วิเคราะห์ dependency audit 15 vulnerabilities และทำ regression/E2E ที่ยังขาด
