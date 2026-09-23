-- CreateTable
CREATE TABLE IF NOT EXISTS "Nurses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "lastName" VARCHAR(255) NOT NULL,
    "nickname" VARCHAR(255) NOT NULL,
    "TeleNumber" TEXT,

    CONSTRAINT "Nurses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Patient" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "lastName" VARCHAR(255) NOT NULL,
    "nickname" VARCHAR(255) NOT NULL,
    "Stu.id" CHAR(8) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Medicine & Medical Supplies Inventory" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "Product SKU" CHAR(8) NOT NULL,
    "Product Info" VARCHAR(255),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medicine & Medical Supplies Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Medical Supply Catalog" (
    "id" SERIAL NOT NULL,
    "ชื่อยาสากล" VARCHAR(255) NOT NULL,
    "ชื่อยาสามัญ" VARCHAR(255) NOT NULL,
    "จำนวน" VARCHAR(255) NOT NULL,
    "สรรพคุณ" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medical Supply Catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Medicine & Medical Supplies Inventory_Product SKU_key" ON "Medicine & Medical Supplies Inventory"("Product SKU");

-- SeedData
INSERT INTO "Medical Supply Catalog" ("ชื่อยาสากล", "ชื่อยาสามัญ", "จำนวน", "สรรพคุณ", "updatedAt") VALUES
('Ponstan 500', 'Mefenamic acid 500 mg', '3 แผง แผงละ 10 เม็ด', 'บรรเทาอาการปวด ลดการอักเสบ และปวดประจำเดือน', CURRENT_TIMESTAMP),
('Dramamine', 'Dimenhydrinate', '7 แผง แผงละ 10 เม็ด', 'ป้องกันและบรรเทาอาการเมารถ เมาเรือ คลื่นไส้ เวียนศีรษะ', CURRENT_TIMESTAMP),
('Rentex', 'ยาแก้แพ้และบรรเทาอาการหวัด', '5 แผง แผงละ 10 เม็ด', 'บรรเทาอาการน้ำมูกไหล จาม คัดจมูก และอาการหวัด', CURRENT_TIMESTAMP),
('แอนตาซิล', 'Antacid', '2 แผง แผงละ 10 เม็ด', 'ลดกรดในกระเพาะอาหาร บรรเทาอาการแสบร้อนกลางอกและจุกเสียด', CURRENT_TIMESTAMP),
('Air-X', 'Simethicone', '10 แผง แผงละ 10 เม็ด', 'ลดแก๊สในทางเดินอาหาร บรรเทาอาการท้องอืด แน่นท้อง', CURRENT_TIMESTAMP),
('DEOLIN', 'Dequalinium chloride', '15 แผง แผงละ 10 เม็ด', 'บรรเทาอาการเจ็บคอและระคายคอ', CURRENT_TIMESTAMP),
('Spacovin', 'Hyoscine-N-butylbromide', '10 แผง แผงละ 10 เม็ด', 'บรรเทาอาการปวดเกร็งช่องท้องและลำไส้', CURRENT_TIMESTAMP),
('Cemol 500', 'Paracetamol 500 mg', '4 แผง แผงละ 10 เม็ด (กล่องละ 50 แผง)', 'ลดไข้และบรรเทาอาการปวดเล็กน้อยถึงปานกลาง', CURRENT_TIMESTAMP),
('Amoxicillin 500', 'Amoxicillin 500 mg', '2 แผง แผงละ 10 เม็ด', 'ยาปฏิชีวนะสำหรับรักษาการติดเชื้อแบคทีเรียตามคำสั่งแพทย์', CURRENT_TIMESTAMP),
('Dicloxacillin 250', 'Dicloxacillin 250 mg', '7 แผง แผงละ 10 เม็ด', 'ยาปฏิชีวนะสำหรับรักษาการติดเชื้อแบคทีเรียตามคำสั่งแพทย์', CURRENT_TIMESTAMP),
('Motilium-M', 'Domperidone', '3 แผง แผงละ 10 เม็ด', 'บรรเทาอาการคลื่นไส้ อาเจียน และแน่นท้อง', CURRENT_TIMESTAMP),
('Motilium', 'Domperidone', '12 แผง แผงละ 10 เม็ด (กล่องละ 3 แผง)', 'บรรเทาอาการคลื่นไส้ อาเจียน และแน่นท้อง', CURRENT_TIMESTAMP),
('Omeprazole GPO', 'Omeprazole', '10 แผง แผงละ 10 เม็ด (กล่องละ 10 แผง)', 'ลดการหลั่งกรดในกระเพาะอาหาร บรรเทาโรคกรดไหลย้อนและแผลในกระเพาะ', CURRENT_TIMESTAMP),
('แอมโมเนียหอม', 'Aromatic ammonia spirit', '13 ขวด', 'ช่วยบรรเทาอาการวิงเวียนหรือหน้ามืด โดยใช้สูดดมภายนอก', CURRENT_TIMESTAMP),
('น้ำเกลือ Klein & Kare', 'Normal saline solution', '3 ขวด (ไม่จ่าย)', 'ใช้ล้างแผล ล้างจมูก หรือชะล้างทำความสะอาดตามความเหมาะสม', CURRENT_TIMESTAMP),
('ยาธาตุน้ำขาว ตรากระต่ายบิน', 'Mixture stomachic', '4 ขวด', 'บรรเทาอาการท้องอืด ท้องเฟ้อ จุกเสียด และช่วยขับลม', CURRENT_TIMESTAMP),
('ยาโปรวีน', 'Povidone-iodine', '5 ขวด (ไม่จ่าย)', 'ใช้ภายนอกเพื่อฆ่าเชื้อและทำความสะอาดบริเวณแผล', CURRENT_TIMESTAMP),
('Mixt. Carminative 180ml', 'Carminative mixture', '10 ขวด (ไม่รู้ว่ากล่องละกี่ขวด) (ไม่จ่าย)', 'บรรเทาอาการท้องอืด ท้องเฟ้อ และช่วยขับลม', CURRENT_TIMESTAMP),
('Mixt. Carminative 450ml', 'Carminative mixture', '16 ขวด (กล่องละ 12 ขวด) (ไม่จ่าย)', 'บรรเทาอาการท้องอืด ท้องเฟ้อ และช่วยขับลม', CURRENT_TIMESTAMP),
('Poly oph Eye drops 10ml', 'Antibiotic eye drops', '3 ขวด', 'ยาหยอดตาสำหรับภาวะติดเชื้อแบคทีเรียที่ตาตามคำสั่งแพทย์', CURRENT_TIMESTAMP),
('Poly oph Eye drops 5 ml', 'Antibiotic eye drops', '4 ขวด', 'ยาหยอดตาสำหรับภาวะติดเชื้อแบคทีเรียที่ตาตามคำสั่งแพทย์', CURRENT_TIMESTAMP),
('OSRA R.O รสส้ม', 'Oral rehydration salts', '44 ซอง', 'ชดเชยน้ำและเกลือแร่เมื่อท้องเสีย เหงื่อออกมาก หรือเสี่ยงขาดน้ำ', CURRENT_TIMESTAMP),
('Nexcare', 'Adhesive bandage', '2 ม้วน (กล่องละ 12 ม้วน)', 'ปิดยึดผ้าก๊อซหรือวัสดุปิดแผล', CURRENT_TIMESTAMP),
('ไทเกอร์พล๊าส', 'Medicated plaster', '16 แผง แผงละ 4 ชิ้น (กล่องละ 25 แผง) (จ่ายเป็นชิ้น ไม่ใช่แผง)', 'บรรเทาอาการปวดเมื่อยกล้ามเนื้อเฉพาะที่', CURRENT_TIMESTAMP),
('SOFTIP SIZE L', 'Cotton swab', '3 ซอง (ซองละ 100 ไม้)', 'ใช้ทำความสะอาดหรือช่วยทายาภายนอก', CURRENT_TIMESTAMP),
('Bactigras', 'Chlorhexidine acetate paraffin gauze dressing', '2 แผ่น (กล่องละ 10 แผ่น)', 'วัสดุปิดแผลชนิดเคลือบยาฆ่าเชื้อสำหรับดูแลแผล', CURRENT_TIMESTAMP),
('ชุดทำแผล KLEANSET', 'Wound dressing set', '4 กล่อง (กล่องละ 12 แผง)', 'ใช้สำหรับทำความสะอาดและปิดแผล', CURRENT_TIMESTAMP),
('Elastic Bandage', 'Elastic bandage', '3 ม้วน (กล่องละ 12 ม้วน)', 'พันพยุง ลดบวม หรือประคองข้อและกล้ามเนื้อ', CURRENT_TIMESTAMP),
('BETADINE 500ml', 'Povidone-iodine', '2 ขวด (ไม่จ่าย)', 'ใช้ภายนอกเพื่อฆ่าเชื้อและทำความสะอาดบริเวณแผล', CURRENT_TIMESTAMP),
('ALCOHOL ALSOFF 450ml', 'Ethyl alcohol 70%', '4 ขวด (แพ็คละ 6 ขวด) (ไม่จ่าย)', 'ใช้ภายนอกเพื่อทำความสะอาดและฆ่าเชื้อบนผิวหนังหรือพื้นผิว', CURRENT_TIMESTAMP),
('Pulse oximeter Lk 87', 'Pulse oximeter', '15 เครื่อง (ไม่จ่าย) (ใช้ออกหน่วย)', 'ใช้วัดระดับออกซิเจนในเลือดและชีพจร', CURRENT_TIMESTAMP),
('ไม้พยุงตัว', 'Walking aid', '1 คู่', 'ช่วยพยุงการเดินและลดการลงน้ำหนักที่ขาหรือเท้า', CURRENT_TIMESTAMP);
