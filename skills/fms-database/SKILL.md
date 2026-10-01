---
name: fms-database
description: Use when changing, reviewing, migrating, or troubleshooting FMS database schemas, Prisma models, PostgreSQL data, or persistence behavior across the legacy and new applications.
---

# FMS Database Skill

ทำงานกับฐานข้อมูลของ First Aid & Medicine Management System (FMS) โดยรักษาความถูกต้องของข้อมูลผู้ป่วย เวชภัณฑ์ สต็อก การเบิกยืม/คืน และประวัติการทำรายการ ใช้แนวทางนี้เมื่องานเกี่ยวกับ Prisma, PostgreSQL, migration, query, หรือการจัดเก็บข้อมูลของ FMS

## กติกาหลัก

- เริ่มจากค้นหา schema, migration, Prisma config, caller และเอกสารที่เกี่ยวข้องก่อนแก้ อย่าคาดเดาจากชื่อโฟลเดอร์
- ตรวจ `git status` ก่อนเริ่ม และรักษาการเปลี่ยนแปลงที่มีอยู่
- ใน repository นี้มี Prisma schema มากกว่าหนึ่งชุด:
  - `Back-end/prisma/schema.prisma` และ `Back-end/prisma/migrations/` เป็น target ที่ `prisma.config.ts` ระบุไว้สำหรับ Prisma CLI ที่รันจาก root
  - `packages/database/prisma/schema.prisma` เป็น schema แยก ให้ตรวจ caller และ package config ก่อนแก้
- ตรวจ `prisma.config.ts`, `package.json` และตำแหน่งที่เรียกใช้ Prisma ทุกครั้งก่อนสร้าง migration หรือ generate client การมี schema อยู่ในโฟลเดอร์หนึ่งไม่ได้แปลว่าคำสั่งจะใช้ schema นั้น
- ห้ามอ่าน แสดง คัดลอก หรือ commit ค่า secret จาก `.env` ใช้ชื่อตัวแปรจาก `.env.example` และเก็บค่าจริงไว้ใน environment
- ห้ามชี้คำสั่งที่แก้ข้อมูลไปยัง production หรือฐานข้อมูลที่ไม่ทราบเจ้าของ หาก target ไม่ชัด ให้หยุดก่อนคำสั่งที่เขียนข้อมูลและชี้แจงความไม่แน่นอน

## วิธีออกแบบ schema

- ตั้งชื่อ model และ field ให้สื่อความหมายและสอดคล้องกับ schema ที่แก้ ใช้ enum เมื่อชุดค่ามีขอบเขตชัดเจนและไม่เปลี่ยนบ่อย
- กำหนด `@unique`, `@@unique`, foreign key, `onDelete` และ index ตามกฎธุรกิจและรูปแบบ query จริง ไม่ใส่ index โดยไม่มีเหตุผล
- ใส่ index ให้ foreign key หรือ field ที่ใช้ค้นหา/เรียงบ่อยเมื่อเหมาะสม และพิจารณาลำดับ field ใน composite index จาก query จริง
- กำหนด nullability และ default อย่างตั้งใจ อย่าใช้ default เพื่อกลบข้อมูลที่ขาดหรือความผิดพลาดจาก application
- เก็บวันเวลาเป็นชนิดที่รองรับ timezone และกำหนดชัดว่าเป็น instant หรือวันที่ปฏิทิน หลีกเลี่ยงการแปลง timezone โดยปริยาย
- ใช้ decimal สำหรับค่าที่ต้องการความเที่ยงตรง เช่น ราคา ห้ามใช้ floating point กับจำนวนเงิน
- ข้อมูลสต็อกต้องระบุหน่วยและรักษาความสัมพันธ์ระหว่างยอดคงเหลือกับประวัติการรับ/จ่าย การทำรายการหลายแถวที่ต้องสำเร็จร่วมกันควรอยู่ใน transaction
- เก็บประวัติที่จำเป็นต่อการตรวจสอบและการย้อนรอย หลีกเลี่ยงการลบข้อมูลทางธุรกิจแบบ cascade โดยไม่ตรวจผลกระทบ
- จำกัดข้อมูลส่วนบุคคลและข้อมูลสุขภาพเท่าที่จำเป็น ไม่เพิ่มข้อมูลอ่อนไหวลง log หรือ fixture โดยไม่มีเหตุผล

## Workflow สำหรับ migration

1. ตรวจ schema ปัจจุบัน, migration ล่าสุด, Prisma config, model ที่ application ใช้ และสถานะ Git
2. เขียน migration ใหม่แบบ additive เมื่อทำได้ เช่น เพิ่ม nullable field หรือตารางใหม่ก่อนปรับ application
3. พิจารณาผลต่อข้อมูลเดิม การ deploy แบบหลายเวอร์ชัน lock/table rewrite ระยะเวลารัน และ rollback
4. หากต้อง backfill ให้ทำอย่างทำซ้ำได้ (idempotent) และกำหนดวิธีตรวจจำนวน/ความถูกต้องของแถวก่อนและหลัง
5. ตรวจ SQL ที่ Prisma สร้างก่อนนำไปใช้ โดยเฉพาะ `DROP`, `TRUNCATE`, การเปลี่ยนชนิดข้อมูล, `NOT NULL`, cascade และการลบ migration เก่า
6. สร้าง client และตรวจ schema/migration ตามคำสั่งที่ workspace ประกาศไว้
7. สรุป target database, migration ที่เพิ่ม, ผลกระทบต่อข้อมูลเดิม และคำสั่งตรวจสอบที่ทำ

อย่าแก้ migration ที่ถูกนำไปใช้แล้วเพื่อเปลี่ยนประวัติฐานข้อมูล ให้เพิ่ม migration ใหม่ เว้นแต่ยืนยันได้ว่า migration นั้นยังไม่ถูกใช้ร่วมกันหรือเผยแพร่

## คำสั่งใน repository

ตรวจ `package.json` และ `prisma.config.ts` ก่อนรัน เพราะคำสั่งจาก root โหลด `Back-end/.env` หากมี และ config ปัจจุบันชี้ไปที่ `Back-end/prisma/`:

```powershell
npm run db:generate
npm run db:migrate -- --name <migration-name>
```

คำสั่ง migrate เปลี่ยนฐานข้อมูลที่ `DATABASE_URL` ชี้ไป ห้ามรันบนฐานข้อมูลจริงหรือฐานข้อมูลที่ยังไม่ยืนยันว่าเป็น local/dev. `docker-compose.yml` กำหนด PostgreSQL dev ให้ port `5434`; ยืนยัน connection target จาก config โดยไม่พิมพ์ค่าลับออกมา

เว็บมีชุดทดสอบใน `apps/web`; อย่าสมมติว่ามี script ทดสอบฐานข้อมูล, API หรือ lint ที่ root กำหนดไว้ ตรวจ scripts ก่อนเลือกคำสั่ง และรายงานหากไม่ได้ตรวจ migration กับฐานข้อมูลจริง

## FMS legacy และการย้ายข้อมูล

- ระบบเดิมใน `Front-end/` เก็บบางข้อมูลใน `localStorage` และ sync ผ่าน `/api/legacy-storage`; อย่าถือว่าข้อมูลทั้งหมดอยู่ในตาราง relational
- ตรวจ `Back-end/prisma/schema.prisma` และ route ที่เกี่ยวข้องก่อนเปลี่ยน persistence ของ legacy storage; รักษา key/shape ที่หน้าปัจจุบันพึ่งพา
- การย้ายข้อมูลจาก JSON/localStorage ต้องกำหนด mapping, จัดการ key ซ้ำ/ข้อมูลผิดรูป, ทำซ้ำได้ และมีวิธีเทียบจำนวนข้อมูล
- อย่าลบช่องทาง legacy หรือเปลี่ยน data contract จนกว่าผู้เรียกใช้งานที่เกี่ยวข้องจะย้ายครบ

## Caveman mode

ถ้าผู้ใช้ขอ “caveman” หรือกำลังใช้แนวทางนี้ ให้สื่อสารและลงมือแบบสั้นตรง:

- เขียน SQL/Prisma ให้อ่านง่าย ใช้ชื่อชัด และทำเฉพาะสิ่งที่จำเป็น
- อธิบายผลของ migration ด้วยภาษาง่าย ๆ: เปลี่ยนอะไร, กระทบข้อมูลไหน, ตรวจอย่างไร
- ตัดคำอธิบายซ้ำและศัพท์ซับซ้อน แต่ห้ามตัดขั้นตอนตรวจความถูกต้อง ความปลอดภัย หรือคำเตือนที่จำเป็น
- ไม่ย่อจนซ่อนผลกระทบ เช่น การลบข้อมูล, lock, downtime, หรือการเปลี่ยนความหมายของ field

## Definition of done

- schema และ migration สอดคล้องกับกฎธุรกิจและ target ที่ตั้งใจ
- ไม่มี secret หรือข้อมูลผู้ใช้จริงใน diff
- ตรวจผลกระทบกับ caller, legacy storage, API contract และข้อมูลเดิมแล้ว
- รันเฉพาะคำสั่งตรวจที่เหมาะและปลอดภัย; ระบุข้อจำกัดเมื่อไม่ได้รัน
- สรุปผลด้วยภาษาตรงไปตรงมา โดยเน้นสิ่งที่เปลี่ยนและผลต่อข้อมูล
