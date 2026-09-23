DROP TABLE IF EXISTS "Medicine & Medical Supplies Inventory";

ALTER TABLE "Nurses"
ADD COLUMN IF NOT EXISTS "ชื่อ-สกุล" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "ตำแหน่ง" VARCHAR(100);

DELETE FROM "Nurses";

ALTER TABLE "Nurses"
DROP COLUMN IF EXISTS "name",
DROP COLUMN IF EXISTS "lastName",
DROP COLUMN IF EXISTS "nickname",
DROP COLUMN IF EXISTS "TeleNumber";

INSERT INTO "Nurses" ("ชื่อ-สกุล", "ตำแหน่ง") VALUES
('นางศิริวรรณ คงบุญแก้ว', 'RN'),
('นางสุกัญญา มนธรรมสกุล', 'RN'),
('นายณัฐพล นาคบุตร', 'RN'),
('น.ส.นารีนุช เพ็ชรเวช', 'RN'),
('น.ส.เจนจิรา เกิดกอบ', 'RN'),
('น.ส.มนธยา จูบุญส่ง', 'RN'),
('น.ส.ปัญญาพร ปิยะวัฒน์', 'RN'),
('น.ส.ฤทัยรัตน์ อุ่นนอง', 'RN'),
('น.ส.พรพิมล วิเชียรรัตน์', 'RN'),
('น.ส.ปริมมา เสาวรส', 'RN');

ALTER TABLE "Nurses"
ALTER COLUMN "ชื่อ-สกุล" SET NOT NULL,
ALTER COLUMN "ตำแหน่ง" SET NOT NULL;
