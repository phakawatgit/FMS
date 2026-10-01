# บันทึกบทสนทนาและงาน FMS

### 2026-10-01 — ตรวจทั้งระบบและเริ่ม implement แผนใหญ่ (กำลังทำ)

- ผู้ใช้สั่งตรวจ/แก้ frontend/backend/database ทั้งหมดและทดสอบ ใช้ mockup ได้ พร้อม progress สำหรับส่งต่อ; เลือกทำทั้ง Legacy และ Next.js, Firebase จริงพร้อมบัญชีทดสอบ, Nurse ทำงานประจำครบ Admin จัดการสิทธิ์/ตั้งค่า/audit
- เรื่อง Infirmary: ตรวจพบรายการจ่ายยังอยู่ครบใน Dispensation ผู้ใช้เลือกคงแบบสัมพันธ์ ไม่เพิ่มช่อง medicine/quantity ซ้ำ
- ผู้ใช้เลือกเก็บ Medicine.imageUrl เป็น URL รูปอัปโหลด เปิดดูตรงได้ ไม่รับ URL ภายนอก
- อนุมัติแผนและสั่ง Implement แล้ว; progress ละเอียดที่ docs/IMPLEMENTATION-PROGRESS.md และตารางตรวจที่ docs/SYSTEM-AUDIT.md
- สำรองฐานก่อนทำ; เพิ่ม/apply imageUrl และตาราง orders/reference/audit/user fields แล้ว รูปเดิมเติม URL แล้ว; tests รูป/typed orders/restart ผ่านก่อนเปิด auth gateway และ inventory regression ผ่าน ณ ช่วงนั้น
- พบ fresh database migration ขาด baseline ตารางบัญชี/เวร เพิ่ม migration แก้แล้ว กำลังตรวจฐานแยก fms_system_test และ Firebase Auth Emulator
- Legacy async/auth และ Next workspace กำลังพัฒนา ยังไม่เสร็จ/ยังไม่ผ่าน E2E ทั้งระบบ ไม่ถือว่าผลก่อนเปลี่ยน auth ยืนยันโค้ดล่าสุด
- เทสต่อ 2026-10-01: `node Back-end/tests/run-system.cjs` ผ่านครบหก suite ที่มีจริงบน logical database `fms_system_test` + Auth Emulator; มีการแก้ readiness/retry expectations ใน test files และเอา suite `system-browser` ที่ไม่มีไฟล์ออกจาก default runner
- TypeScript check และ production build ของ Next.js ผ่าน; ข้าม ReIcon CDN ที่ไม่มีการใช้งาน เพราะการโหลดไม่สำเร็จเคยหยุด Legacy bootstrap ก่อนโหลดหน้า catalog detail
- ตรวจ backup `.local-backups/fms-before-system-completion-20261001.dump`, apply `20261001145000_complete_baseline` กับ database `fms` บน master; migrate status up-to-date, Prisma schema valid, API health 200
- `fms_system_test` แยกจาก database `fms` แต่ใช้ PostgreSQL master host/volume เดียวกัน; test fixtures ถูก cleanup. เว็บ/API/master/Auth Emulator กำลังรันที่ 3000/4000/5434/9099
- งานค้าง: Next.js full E2E/system-browser, ตรวจ Legacy ทุกหน้า, OTP/SMTP จริงและ concurrency, reports จริง, dependency audit 15 vulnerabilities

อัปเดตล่าสุด: 2026-10-01 (Asia/Bangkok)

บันทึกนี้สรุปเฉพาะบทสนทนาที่เข้าถึงได้ตอนสร้างไฟล์ ไม่ใช่ประวัติทุกแชตหรือข้อความแบบคำต่อคำ

## ความต้องการที่ผู้ใช้ระบุ

- ต้องการไฟล์จดจำว่าเคยคุยเรื่องอะไร สั่งงานอะไร และทำไปแล้วอย่างไร เพื่อใช้ทำงานต่อในโปรเจกต์นี้
- สนทนาในบริบทนี้เป็นภาษาไทย

## บริบทสำหรับทำงานต่อ

- โปรเจกต์: FMS ที่ `C:\Users\NS\Documents\GitHub\FMS`
- หน้าเว็บใช้ `apps/web` และหน้าเดิมใน `Front-end`; API ที่ใช้งานในครั้งนี้อยู่ใน `Back-end`
- เปิด API จากรากโปรเจกต์ด้วย `npm.cmd run dev:api`; เปิดเว็บด้วย `npm.cmd run dev:web`
- PowerShell ในครั้งนี้ปฏิเสธ `npm.ps1` ตาม execution policy จึงใช้ `npm.cmd` ได้สำเร็จ
- มีไฟล์แก้ไขและไฟล์ใหม่จำนวนมากอยู่ก่อนเริ่มแก้ปัญหา catalog; อย่าเหมาว่าเป็นผลงานของการแก้ครั้งนี้ และอย่าทับหรือย้อนการเปลี่ยนแปลงโดยไม่ตรวจสอบ
- สถานะเซิร์ฟเวอร์และพอร์ตด้านล่างเป็นผลตรวจในขณะนั้น ต้องตรวจใหม่เมื่อเริ่มงานครั้งต่อไป

## ประวัติ 2026-10-01

### 1. อธิบายไฟล์ tests

- ผู้ใช้ถามว่าไฟล์ tests คืออะไรและจำเป็นหรือไม่ แล้วระบุพาธ `Back-end/tests`
- พบ `infirmary-persistence.cjs`: ทดสอบบันทึกข้อมูลเข้าห้องพยาบาล แก้ไข เปลี่ยนสถานะ การจัดการข้อผิดพลาด และข้อมูลคงอยู่หลังรีสตาร์ต API
- พบ `medicine-persistence.cjs`: ทดสอบข้อมูลยา รูปภาพ สต็อก การเพิ่ม/แก้ไข/ลบ การตรวจข้อมูล และข้อมูลคงอยู่หลังรีสตาร์ต API
- อธิบายว่าเป็นชุดทดสอบที่รันแยก ไม่จำเป็นต่อการเปิดเว็บตามปกติ และไม่ถูกเรียกจากคำสั่ง dev/start ของ Back-end ณ เวลาตรวจ
- ผู้ช่วยแนะนำให้เก็บไว้; ผู้ใช้ไม่ได้สั่งลบ และไม่มีการลบหรือแก้ไฟล์ทดสอบ
- การค้นครั้งแรกตกหล่นเพราะค้นนามสกุลไม่ครอบคลุม `.cjs`; ภายหลังตรวจพาธโดยตรงและแก้คำอธิบายแล้ว

### 2. แก้หน้า catalog เชื่อมต่อไม่ได้ — เสร็จแล้ว

- คำสั่งผู้ใช้: หน้า catalog ขึ้นว่า “เชื่อมต่อฐานข้อมูลยาไม่ได้ กรุณาตรวจสอบ API” ให้แก้ไข
- ผลตรวจ: เว็บพอร์ต 3000 ตอบ HTTP 200 แต่ API พอร์ต 4000 ตอบ ECONNREFUSED; พอร์ตเว็บ 3001 ไม่ได้เปิดในขณะนั้น
- การแก้: รัน `npm.cmd run dev` ใน `Back-end` เพื่อเปิด API พอร์ต 4000 ไม่ได้แก้โค้ดแอปสำหรับปัญหานี้
- ยืนยัน `/api/database/health` ตอบ HTTP 200 และ success=true
- ยืนยัน `/api/medicines` ตอบ HTTP 200 และ success=true พร้อมรายการยา 1 รายการ
- ใช้ Playwright กับ Edge แบบ headless เปิด `http://localhost:3000/legacy/catalog.html`: พบ `.catalog-card` 1 ใบ และไม่มี `#medicineApiError`
- แจ้งผู้ใช้ให้รีเฟรช และให้เปิด API ควบคู่กับเว็บในการใช้งานครั้งถัดไป; ผู้ใช้ตอบ “โอเค”
- ไม่ได้ตั้งให้ API เปิดอัตโนมัติหลังรีบูตหรือรับประกันว่าจะรันต่อข้ามเซสชัน

### 3. สร้างบันทึกความต่อเนื่อง — เสร็จแล้ว

- ผู้ใช้ขอให้สร้างไฟล์จำเรื่องที่เคยคุยและสิ่งที่สั่ง
- สร้าง `CONVERSATION_MEMORY.md` เป็นบันทึกภาษาไทย พร้อมเติมประวัติที่มีในบทสนทนานี้
- สร้าง `AGENTS.md` ให้ผู้ช่วยอ่านบันทึกเมื่อเริ่มงานและอัปเดตหลังมีเรื่องสำคัญ โดยแยกคำสั่ง ข้อเสนอ ผลจริง และงานค้าง
- แนวทางไฟล์คำแนะนำอ้างอิง: https://learn.chatgpt.com/docs/agent-configuration/agents-md

### 4. เชื่อม Stock, Infirmary และยืม–คืน — ทำและทดสอบแล้ว

- ผู้ใช้ต้องการเลือกยาและจำนวนจาก stock จริงในการบันทึกคนไข้ พร้อมหักยอดจริง และให้ลบข้อมูล mock ที่พบทั่วโปรเจกต์
- ข้อตกลง: จ่ายยาหลายรายการต่อคนไข้; แก้แล้วปรับเฉพาะส่วนต่าง; ปรับ stock ด้วยมือได้พร้อมเหตุผล; เชื่อมยืม–คืนด้วย; คนไข้/ใบยืมเดิมเก็บเป็นประวัติ ไม่หักหรือคืนย้อนหลัง; คง demo-admin ไว้ก่อน; เก็บ fixtures สำหรับ tests
- ผู้ใช้สั่ง implement และต่อมายืนยันว่าเว็บยังไม่เปิดใช้งานจริง อนุญาตให้ลองบันทึกและแก้ข้อมูลกับฐานข้อมูลปัจจุบันได้ ไม่ต้องหลีกเลี่ยงการทดสอบจริงเพราะกังวลข้อมูลชุดนี้ แต่ไม่ได้ล้างข้อมูลทั้งหมด
- สำรอง PostgreSQL ก่อน migration ไว้ที่ `.local-backups/fms-before-stock-links.dump` (ไม่ติด Git)
- ใช้ migration `20261001090000_link_inventory` สำเร็จ: เพิ่ม Dispensation, Loan, LoanItem, LoanReturn, StockMovement, InventoryRequest พร้อม version และ foreign keys
- ยอด `used = manualUsed + dispensed + borrowed`; ย้าย used เดิมเป็น manualUsed และบันทึกยอดตั้งต้น โดย total/used เดิมไม่เปลี่ยน
- API ใช้ transaction, row locks, version และ Idempotency-Key; แก้รายการจ่ายปรับส่วนต่าง; ยืม/คืนบางส่วนเข้าสต็อกเดียวกัน; คืนเกิน จ่ายเกิน เวอร์ชันเก่า และคำขอซ้ำถูกตรวจสอบ
- ยาที่มีประวัติเลิกใช้งานแทนลบจริง; ไม่เปลี่ยนหน่วยย้อนหลัง; ห้ามจ่ายใหม่เมื่อหมดอายุ เลิกใช้งาน หรือไม่มีหน่วย
- ฟอร์มคนไข้รองรับหลายรายการด้วย medicineId; รายละเอียด ประวัติ ส่งออก dashboard และแจ้งเตือนใช้ข้อมูล API; หน้า stock แสดงยอดปรับมือ/จ่ายคนไข้/ยืมค้างแยกกัน
- `Front-end/real-data.js` เป็น adapter อ่านข้อมูลจริงให้หน้าระบบเดิม (อ่านแบบ synchronous เพื่อคงลำดับ scripts); ฟอร์มทำ mutations แบบ async; ไม่เก็บ stock/คนไข้/ใบยืมเป็นยอดจริงใน localStorage อีกต่อไป
- ร่างยืม/ตะกร้าเก็บเฉพาะ browser; หยุดอัปโหลด localStorage เก่าอัตโนมัติ และปิดทางเขียนข้อมูล stock/คนไข้/ใบยืมผ่าน legacy-storage
- เอาตัวเลือกยาตายตัว ข้อความนับแจ้งเตือนปลอม ตัวหาร /100 ตัวเลือกหน่วยบรรจุปลอม สรรพคุณที่เติมเอง และโค้ดแก้ประวัติตามชื่อคน hardcode ออก; เอาโค้ดล้างประวัติคำสั่งซื้อทั้งชุดเมื่อเปิด dashboard ครั้งแรกออกด้วย
- พบและแก้ข้อผิดพลาด change/blur ที่วาดหน้า borrow-selected ซ้ำระหว่างแก้จำนวน
- ทดสอบผ่าน: `inventory-relations.cjs` (ธุรกรรม/พร้อมกัน/คำขอซ้ำ/ยอด/ข้อผิดพลาด), `inventory-browser.cjs` (ฟอร์มจริง/แก้ยา/ปรับสต็อก/ยืมคืน/API ตอบกลับหลุดหลังบันทึก/ข้อมูลว่าง), และ regression เดิม `infirmary-persistence.cjs`, `medicine-persistence.cjs` (รวมรูปยาและ restart API)
- `verify-inventory.cjs` ตรวจแบบอ่านอย่างเดียว ยอดตรงกับตารางจ่าย/ยืม/ประวัติทั้งหมด ณ เวลาตรวจ เหลือยาเดิม 1 รายการ คนไข้เดิม 3 รายการ ใบยืมใหม่ 0 รายการ และไม่มีรายการยาทดสอบตกค้าง
- ตรวจ 12 หน้าหลักผ่านเบราว์เซอร์ ไม่พบ JavaScript errors และ Prisma schema validate ผ่าน
- รายละเอียด API และคำสั่งรัน tests อยู่ใน `docs/INVENTORY-RELATIONS.md`; npm scripts ใหม่: `test:inventory`, `test:inventory:browser`, `verify:inventory` ใน Back-end
- ขอบเขตที่คงเดิม: demo-admin และ legacy store ของโมดูลอื่น เช่นประวัติคำสั่งซื้อ ไม่ได้ย้ายระบบสิทธิ์/บัญชีทั้งระบบในงานนี้

### 5. ยาเหลือ 500 แผงแต่เลือกจ่ายไม่ได้ — ตรวจพบสาเหตุและปรับข้อความแล้ว

- ผู้ใช้แจ้งว่าตัวเลือกยาจางและเลือกไม่ได้แม้เหลือ 500 แผง
- ตรวจ API พบรายการยามี active=true และหน่วยแผง แต่ expiry=2026-09-30 ขณะที่วันปัจจุบันคือ 2026-10-01 จึงถูกปิดเพราะหมดอายุตามข้อมูลที่บันทึก ไม่ใช่ยอดคงเหลือผิด
- แก้ dispensing-editor ให้ระบุเหตุผลตรงตัวเลือก (หมดอายุพร้อมวันที่ / ไม่มีหน่วย / สต็อกหมด / เลิกใช้งาน) และมีข้อความสรุปใต้ฟอร์ม
- ตรวจผ่านเบราว์เซอร์จริงแล้วแสดง “เหลือ 500 แผง — หมดอายุ 30/09/2026” ถูกต้อง ไม่มีการเปลี่ยนวันหมดอายุหรือยอดในฐานข้อมูล

### 6. เติมช่องสรุปเก่าที่เป็น NULL ตามรายการที่ผู้ใช้ระบุ — เสร็จแล้ว

- ผู้ใช้ขอเติม medicine/quantity ในรายการเฉพาะหนึ่งรายการ และอนุมัติแผนให้นำค่าจาก Dispensation ที่เชื่อมอยู่มาใช้ โดยไม่ตัด stock ซ้ำ
- อัปเดตฐานข้อมูลใน transaction หลังล็อกแถวและตรวจ version, ค่า NULL และรายการจ่ายล่าสุด; เพิ่ม version เพื่อป้องกันหน้าที่เปิดค้างเขียนทับ
- ตรวจค่าหลัง commit แล้วตรงกับความสัมพันธ์เดิม จำนวนคงเหลือ ข้อมูลยา และจำนวนประวัติ StockMovement ไม่เปลี่ยน ไม่มีการแก้รายการคนไข้อื่น
- เป็นการเติมข้อมูลครั้งเดียวตามขอบเขตแผน ไม่ได้เปลี่ยน API: โค้ด PATCH ปัจจุบันยังตั้ง medicine/quantity ของ stockLinked=true เป็น NULL เมื่อมีการแก้รายการผ่านเว็บครั้งถัดไป ข้อมูลหลักยังอยู่ใน Dispensation

## งานค้าง

### 2026-10-01 — Dashboard ใช้ข้อมูลฐานข้อมูลและซ่อนส่วนที่ยังไม่มีข้อมูล

- ผู้ใช้อนุมัติแผนและสั่ง implement: ค่าเริ่มต้น 30 วันล่าสุด เวลาไทย; Top 10 จัดตามจำนวนครั้งเข้ารักษาที่ได้รับยา พร้อมยอดจ่ายแยกหน่วย
- ตรวจเดิมพบตัวกรอง all ทำให้คนไข้เป็นศูนย์ หลักสูตรไม่กรอง รีเฟรชอ่านแคชเดิม และปฏิทินซ่อนปีก่อนหน้า; แก้ด้วย GET /api/dashboard อ่าน snapshot เดียวจาก PostgreSQL
- ทุกกราฟคนไข้ใช้ตัวกรองร่วมกัน สต็อก/แจ้งเตือนเป็นยอดปัจจุบัน แยกประวัติยาเดิมที่ไม่เชื่อม Dispensation; รีเฟรชจริงทุก 30 วินาทีและเมื่อกลับมาหน้า แสดงสถานะข้อมูลเก่าเมื่อโหลดล้มเหลว
- เพิ่ม API catalog-orders อ่าน/เพิ่ม/ลบรายการจริงใน LegacyStorage เดิม ล็อก transaction และ ID กันซ้ำ ปิดการเขียนทับทั้งชุดผ่าน legacy-storage; หน้าสั่งซื้อรอ API ยืนยันและลองซ้ำหลังคำตอบหลุดได้
- ปฏิทินรองรับประวัติข้ามปี วันที่ พ.ศ. และรายการไม่ระบุวันที่; Excel เป็น SpreadsheetML .xml เปิดด้วย Excel มีหลาย worksheet; PDF ใช้ browser print
- ผู้ใช้กำชับเพิ่มเติมระหว่างทำงาน: ส่วนที่ยังไม่มีข้อมูลไม่ต้องเอาขึ้น รอ recheck; ทำแล้วโดยซ่อนการ์ด/หมวดที่ไม่มีข้อมูลจริง และแสดงกลับเมื่อมีข้อมูล ไม่เติม mock หรือกราฟ CSS ตัวอย่าง
- ตรวจผ่าน dashboard.cjs: DB/API/UI, เวลาไทยจากเบราว์เซอร์ต่าง timezone, ตัวกรอง, รีเฟรช, API ล้มเหลว/ข้อมูลว่าง/ซ่อนการ์ด, ส่งออก, ปฏิทินย้อนหลัง, รายละเอียดคลัง, คำสั่งซื้อพร้อมกัน/ซ้ำ และ retry หลัง server commit
- Regression inventory-browser.cjs ผ่าน; verify-inventory.cjs หลังล้าง fixtures ผ่าน ไม่มีข้อมูลยาทดสอบตกค้าง ยอดคลังยังตรงกับ Dispensation/Loan/StockMovement
- เอกสาร docs/DASHBOARD.md; คำสั่ง npm.cmd run test:dashboard ใน Back-end; ยังไม่ได้ล้างข้อมูลเดิมหรือเปลี่ยนยอดคลังเพื่อแต่ง Dashboard

### 2026-10-01 — แก้ความเข้าใจ: ต้องคงโครง Dashboard เดิมทุกส่วน

- ผู้ใช้ยืนยันว่าให้เชื่อมข้อมูลอย่างเดียว ห้ามเปลี่ยนโครงหน้า; “ยังไม่มีข้อมูลไม่ต้องดึง” ไม่ได้หมายถึงซ่อนการ์ด ข้อนี้แทนการตีความเรื่องซ่อนส่วนว่างในบันทึกก่อนหน้า
- คืนการ์ดเดิมครบ 8 ส่วนและสองคอลัมน์เดิม รวมปฏิทิน หมวด stock ทั้ง 4 และ legend หมดอายุทั้ง 3 แม้ไม่มีข้อมูล; กราฟยาเป็นวงกลมเดิมและแนวโน้มใช้โครงแท่งเดิม
- เอาแถบสรุป/ปุ่มรีเฟรช/ข้อความเพิ่มเติมและ layout ใหม่ออก; คง API จริง ตัวกรอง รีเฟรชอัตโนมัติ และการส่งออก ส่วนไม่มีข้อมูลปล่อยพื้นที่กราฟเดิมว่างหรือแสดงขีด ไม่เติม mock
- ทดสอบ dashboard.cjs ผ่านหลังเปลี่ยนเงื่อนไขตรวจให้กรอบทุกส่วนยังแสดงเมื่อข้อมูลว่าง; ตรวจภาพหน้าจอและการ์ดทั้ง 8 ผ่านเบราว์เซอร์ ไม่มี JavaScript errors

- ไม่มีงานที่ผู้ใช้สั่งแล้วยังค้างจากบทสนทนาที่บันทึกนี้ครอบคลุม
- ก่อนทำงานครั้งถัดไปให้ตรวจสถานะ API/เว็บใหม่ และอ่าน `docs/INVENTORY-RELATIONS.md` ก่อนเปลี่ยนยอดคลัง

### 2026-10-01 — เปิดเว็บ API และฐานข้อมูลตามคำขอ

- ผู้ใช้ขอรันเว็บพร้อมฐานข้อมูล; เปิด dev:web พอร์ต 3000 และ dev:api พอร์ต 4000 แล้ว
- เปิด Docker Desktop และพบฐานข้อมูลเดิมในคอนเทนเนอร์ fms-master-postgres-1 ใช้ volume fms-master_postgres_data พอร์ต 5434; เริ่มคอนเทนเนอร์เดิมสำเร็จ
- docker compose up จากโฟลเดอร์ FMS สร้าง fms-postgres-1 และ volume fms_postgres_data เป็นฐานว่าง; หยุดคอนเทนเนอร์ใหม่นี้แล้ว ไม่ได้ลบ volume และไม่ได้ migrate ฐานว่าง ใช้ฐานเดิมแทน
- ตรวจเว็บ / ตอบ HTTP 200, /api/database/health ตอบ connected และ /api/medicines ตอบ HTTP 200 success=true; URL /legacy/infirmary.html ตอบ 404 จึงไม่ใช้เป็นลิงก์เข้าเว็บ
- ผู้ใช้ถามถึงงานแยกบุคคลภายใน/ภายนอกใน Infirmary ก่อนคำขอนี้ แต่บันทึกเดิมไม่มีรายละเอียด จึงยังไม่ได้ยืนยันขอบเขตหรือสถานะงานนั้น
- สถานะการรันเป็นผลตรวจครั้งนี้ ต้องตรวจใหม่ในเซสชันถัดไป

### 2026-10-01 — อธิบาย Prisma schema สองไฟล์

- ผู้ใช้ถามความแตกต่างและเหตุผลที่แยก schema.prisma กับ studio-schema.prisma
- ตรวจพบ schema.prisma มีโมเดลคลัง/จ่ายยา/ยืมคืนปัจจุบัน; studio-schema.prisma ขาดโมเดลเหล่านี้และ InfirmaryVisit ขาด version, stockLinked, dispensations รวมทั้งต่างเรื่อง default และ updatedAt
- package.json เรียก Prisma Studio ด้วย schema.prisma แล้ว; docs/INVENTORY-RELATIONS.md ระบุใช้ไฟล์หลักทั้ง local และ Docker
- ไฟล์ Studio ดูเป็น schema เก่าหรือ snapshot สำหรับเปิดดูฐานข้อมูล แต่ยังไม่มีหลักฐานยืนยันเหตุผลดั้งเดิมที่สร้าง จึงไม่อ้างว่าเป็นข้อเท็จจริง; ไม่ได้แก้หรือลบ schema ใด

### 2026-10-01 — แก้ Prisma Studio ติดต่อ Client ไม่ได้

- ผู้ใช้ส่งข้อผิดพลาด Unable to communicate with Prisma Client ขณะอ่าน InfirmaryVisit และขอแก้พร้อมอธิบายสาเหตุ
- ตรวจไม่พบตัวรับการเชื่อมต่อพอร์ต 5555 ขณะฐานข้อมูลและ API ยังทำงาน; query InfirmaryVisit รวมความสัมพันธ์ dispensations ผ่าน Prisma Client สำเร็จ ไม่บันทึกข้อมูลส่วนบุคคลที่อ่านได้
- เปิด Studio ใน sandbox แล้ว process หยุดด้วย EPERM ขณะเขียน AppData/Local/checkpoint-nodejs/Cache/prisma-studio-default; ข้อนี้เป็นสาเหตุที่สังเกตจากการเปิดครั้งนี้ ไม่ยืนยันสาเหตุที่ process เก่าหยุด
- เปิด npm.cmd run prisma:studio -- --browser none ใน Back-end ด้วยสิทธิ์ที่ได้รับอนุมัติแล้ว ใช้ schema.prisma ที่พอร์ต 5555
- ตรวจด้วย Edge headless: Studio HTTP 200 พบและคลิก InfirmaryVisit ได้ ไม่พบข้อความ Unable to communicate with Prisma Client; query ฐานข้อมูลโดยตรงผ่าน ไม่ได้แก้ schema หรือข้อมูล

### 2026-10-01 — ลบ LegacyNurseProfile ตามคำขอ

- ผู้ใช้สั่งลบ LegacyNurseProfile รวมโค้ดที่เกี่ยวข้อง; ค้นแล้วไม่พบ runtime API/frontend เรียกโมเดลเก่า ระบบโปรไฟล์ใช้ Nurse
- สำรองแถวตารางเก่า 10 รายการลง .local-backups/legacy-nurse-profile-1790797616529.json (ไม่ติด Git) ก่อนลบ; Nurse ปัจจุบันมี 0 รายการก่อนและหลัง ไม่ได้ย้ายข้อมูลเก่าเข้าตารางใหม่
- ลบ LegacyNurseProfile จาก schema.prisma และ NurseLegacy จาก studio-schema.prisma; เพิ่มและ apply migration 20261001120000_remove_legacy_nurse_profile เพื่อลบตาราง NurseLegacy จริง
- เก็บ migration เก่าที่สร้างตารางไว้เป็นประวัติ ไม่แก้ย้อนหลัง; ไม่พบการอ้างโมเดลเก่าในโค้ด runtime และ schema ที่เหลือ
- generate ครั้งแรกติด DLL ถูกใช้งาน จึงหยุด API/Studio ที่เปิดไว้ แล้ว generate Prisma Client และ validate สำเร็จ ก่อนเปิด API/Studio กลับ
- ตรวจ legacyTable=null, ไม่มี legacyNurseProfile ใน Client, อ่าน Nurse/DutyShift ได้, migrate status ตรงล่าสุด; API database health และ Studio ตอบ HTTP 200

### 2026-10-01 — ผู้ใช้ยืนยันข้อมูลทั้งหมดเป็น mockup สำหรับทดสอบ

- ผู้ใช้ระบุว่า stockLinked กับ version ไม่จำเป็นต้องใส่ก็ได้ และยืนยันข้อมูลทั้งหมดเป็น mockup อนุญาตให้ใช้ข้อมูลทดสอบได้เต็มที่ จุดประสงค์คือทดสอบการรับส่งและคงอยู่ของข้อมูล ไม่ต้องกังวลการรักษาข้อมูลชุดนี้
- ข้อนี้เป็นการอนุญาตใช้ข้อมูลทดสอบ ไม่ใช่คำสั่งล้างข้อมูลทั้งหมดทันที
- ตรวจโค้ดพบ stockLinked แยก visit เดิมที่ไม่เชื่อมคลังออกจากรายการจ่ายจริง ส่วน version ป้องกันการแก้ข้อมูลเก่าทับข้อมูลใหม่; ทั้งสองมีผลต่อ API ไม่ใช่เพียงช่องเก็บข้อมูลหรือการสำรอง
- ยังไม่ได้ลบสองฟิลด์หรือเปลี่ยนกลไกในรอบสนทนานี้; ต้องแยกความต้องการตัดการรองรับข้อมูลเก่าจากการตัดการตรวจแก้ไขพร้อมกัน

### 2026-10-01 — ยืนยันเป้าหมายช่วงทดสอบและการล้างข้อมูลภายหลัง

- ผู้ใช้ย้ำว่าข้อมูลทดสอบทั้งหมดจะถูกลบในท้ายที่สุด ตอนนี้ต้องการตรวจความสมบูรณ์ของรูปแบบข้อมูลและฟังก์ชันเท่านั้น
- แนวทางทำงาน: ใช้และแก้ข้อมูล mockup เพื่อทดสอบได้ตามที่อนุญาต ไม่เพิ่มความซับซ้อนเพียงเพื่อรักษาหรือรองรับข้อมูลทดสอบเก่า; แยกกลไกที่จำเป็นต่อความถูกต้องของฟังก์ชันออกจากการรักษาข้อมูลเก่า
- ยังไม่ใช่คำสั่งล้างฐานข้อมูลทันที และไม่ถือเป็นการตอบรับข้อเสนอเก็บ version/ลบ stockLinked แบบเฉพาะเจาะจง; รอบนี้ไม่มีการเปลี่ยน schema หรือข้อมูล

### 2026-10-01 — ล้างข้อมูลทดสอบและเลิกแยกข้อมูลเก่า/ใหม่ — ดำเนินการแล้ว

- ผู้ใช้อนุมัติแผนและสั่ง implement: ลบคนไข้และรายการสต็อกทั้งหมดพร้อมข้อมูลจ่ายยา/ยืมคืนที่เกี่ยวข้อง; ยืนยันลบ version ทั้ง InfirmaryVisit, Medicine, Loan และลบช่อง medicine/quantity เก่าใน InfirmaryVisit ด้วย
- ล้างแบบ transaction แยกจาก migration: InfirmaryVisit, Medicine, Dispensation, Loan, LoanItem, LoanReturn, StockMovement, InventoryRequest และคีย์ LegacyStorage ของคนไข้/คลัง/ยืมคืน/ร่างที่เกี่ยวข้อง ไม่ล้างบัญชี พยาบาล เวร การตั้งค่า หรือประวัติคำสั่งซื้อ ไม่รีเซ็ตลำดับรหัสยา
- ก่อนล้างพบคนไข้ 5 รายการ ยา 1 รายการ Dispensation 2 รายการ StockMovement 3 รายการ InventoryRequest 3 รายการ และ LegacyStorage ที่เข้าเงื่อนไข 2 แถว; ตารางยืมคืนว่าง ไม่มีรายละเอียดส่วนบุคคลบันทึกไว้
- Apply migration 20261001130000_simplify_inventory_records แล้ว: ลบ stockLinked/version/medicine/quantity จาก InfirmaryVisit และ version จาก Medicine/Loan; generate/validate ผ่าน และปรับ studio-schema.prisma ให้ตรงไฟล์หลัก
- API/UI ไม่ส่งหรือตรวจ version แล้ว ใช้ Dispensation รูปแบบเดียว ไม่มีเงื่อนไข stockLinked หรือรวม legacy loans; Dashboard และ export ไม่มี legacyMedicines และคง layout เดิม
- คง transaction, row locks, Idempotency-Key, ตรวจยอดและประวัติคลัง; แก้ไขทีหลังใช้ค่าฟิลด์ที่ส่งมาและคำนวณส่วนต่างจากข้อมูลล่าสุด; ไม่ส่ง dispensations คือคงเดิม ส่ง [] คือคืนรายการจ่ายทั้งหมด
- ตะกร้าและร่างยืมกรองรหัสที่ไม่มีในคลังเมื่อโหลด API สำเร็จ แต่คงร่างไว้หาก API ล้มเหลว
- พบและนำ submit handler เก่าที่เขียน localStorage และเปลี่ยนหน้าก่อน API ยืนยันออกจาก infirmary-visit.js; เหลือการบันทึกผ่าน API จุดเดียว
- ผ่าน test:inventory (รวมคำขอพร้อมกัน/ซ้ำ/ยอด/แก้ไขไม่ใช้ version), test:inventory:browser (รวมตะกร้าค้างและ API ล้มเหลว), test:dashboard, infirmary-persistence.cjs และ medicine-persistence.cjs (รวมรูปภาพและรีสตาร์ต API); ใช้ Edge และเว็บ 3000
- ปรับ Dashboard test ให้สร้าง fixture คณะเองแทนพึ่งข้อมูลเก่าที่ถูกล้าง; ตรวจ JavaScript syntax ผ่าน
- ล้างหลังทดสอบและยืนยันทั้ง 8 ตารางข้างต้นเหลือ 0, verify:inventory ผ่าน, คอลัมน์ที่สั่งลบไม่อยู่ในฐานจริง และ migrate status ตรงล่าสุด
- API เปิดด้วย npm.cmd start พอร์ต 4000 เพื่อไม่ให้ file watcher รีสตาร์ตระหว่างทดสอบ; เว็บ 3000 และ Studio 5555 เปิดอยู่ ณ เวลานี้ ต้องตรวจสถานะใหม่ครั้งถัดไป
- อัปเดต docs/INVENTORY-RELATIONS.md, docs/DASHBOARD.md และ Back-end/README.md แล้ว; ข้อนี้แทนแนวทางเก่าที่เก็บ version/stockLinked และประวัติ mockup ไว้

### 2026-10-01 — พักโปรเจกต์และหยุด process ตามคำขอ

- ผู้ใช้ขอหยุดโปรเจกต์ หยุด process และ save งานไว้
- หยุดเว็บ Next.js พอร์ต 3000, API พอร์ต 4000 และ Prisma Studio พอร์ต 5555 ผ่าน session ที่เปิดไว้ แล้วหยุด Docker container fms-master-postgres-1
- ตรวจหลังหยุดไม่พบ LISTENING ที่พอร์ต 3000/4000/5555/5434 และไม่มีคอนเทนเนอร์ FMS ที่กำลังรัน; ไม่ปิดบริการ PostgreSQL อื่นหรือ Docker Desktop ทั้งเครื่อง
- ไฟล์งานและบันทึกอยู่บนดิสก์แล้ว ยังไม่ได้ git commit/push; เก็บข้อมูลฐานข้อมูลและ Docker volume ไว้ ไม่ล้างข้อมูลเพิ่มตอนหยุด
- แก้สถานะก่อนหน้าที่ระบุเซิร์ฟเวอร์เปิดอยู่: ตอนจบครั้งนี้หยุดแล้ว การเริ่มต่อให้เปิด Docker Desktop/คอนเทนเนอร์ fms-master-postgres-1 แล้วรัน dev:api, dev:web และ db:studio ตามต้องการ หลีกเลี่ยง docker compose up จากชื่อโฟลเดอร์ FMS ที่จะเลือกฐานว่างอีกชุด

### 2026-10-01 — แก้ Docker เว็บเปิดพอร์ต 3000 ไม่ได้

- ผู้ใช้รัน docker compose up แล้วเปิด localhost:3000 ไม่ได้; ตรวจพบ services รันปกติ แต่ docker-compose.yml map เว็บเป็น 3001:3000 ทำให้พอร์ต host 3000 ปิดและ localhost:3001 ตอบ HTTP 200
- เปลี่ยน mapping เป็น 3000:3000 และ FRONTEND_URL เป็น http://localhost:3000 จากนั้น recreate เฉพาะ web/api
- ยืนยัน localhost:3000 ตอบ HTTP 200, /api/database/health ตอบ HTTP 200 connected และ services ทั้งหมด Up
- compose กำลังใช้ fms-postgres-1/volume postgres_data ซึ่งแยกจาก fms-master-postgres-1 ฐานเดิม; health-check ยืนยันแค่เชื่อมต่อได้ ไม่ยืนยันว่าเป็นฐานข้อมูลชุดเดิม

### 2026-10-01 — เปิดหน้าเว็บแบบ Legacy

- ผู้ใช้ขอรันเว็บแบบ legacy; ตรวจ Front-end/README.md พบว่า static HTML เดิมเสิร์ฟผ่าน `/legacy/*.html` จากเว็บ Next.js ที่กำลังรันอยู่ ไม่ต้องเปิด server เพิ่ม
- ยืนยัน HTTP 200 สำหรับ `/legacy/index.html`, `/legacy/menu.html`, `/legacy/dashboard.html` และ `/legacy/infirmary-visit.html` ที่พอร์ต 3000; ใช้ `http://localhost:3000/legacy/index.html` เป็นหน้าเริ่มต้นแบบ legacy
- ผู้ใช้ขอหยุด process เว็บเพื่อรันเอง; สั่ง `docker compose stop web` และยืนยันพอร์ต 3000 ปิดแล้ว ขณะที่ API, reports และ PostgreSQL ยังทำงาน
- ผู้ใช้ขอหยุด FMS compose และรัน master แทน; หยุด `fms-web`, `fms-api`, `fms-reports`, `fms-postgres` แล้ว start `fms-master-postgres-1` โดยไม่ลบ container/volume; ตรวจสถานะ running, pg_isready รับ connection และ host port 5434 เปิด
- ผู้ใช้ขอให้รันระบบ; ตรวจ `Back-end/.env` แบบไม่แสดง credential พบ DATABASE_URL ใช้ localhost:5434 และเริ่ม `npm.cmd run dev:api` กับ `npm.cmd run dev:web` แบบ local โดยไม่เปิด FMS compose
- ยืนยัน `http://localhost:3000/legacy/index.html` ตอบ HTTP 200 และ `/api/database/health` ตอบ HTTP 200 connected; เว็บและ API ยังรันอยู่ใน terminal sessions
