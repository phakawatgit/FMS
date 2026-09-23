ALTER TABLE "Medical Supply Catalog"
ADD COLUMN "หน่วยนับ" VARCHAR(100);

UPDATE "Medical Supply Catalog"
SET
  "หน่วยนับ" = NULLIF(BTRIM(REGEXP_REPLACE("จำนวน", '^[[:space:]]*[0-9]+[[:space:]]*', '')), ''),
  "จำนวน" = BTRIM(SUBSTRING("จำนวน" FROM '^[[:space:]]*[0-9]+'))::INTEGER::TEXT;

ALTER TABLE "Medical Supply Catalog"
ALTER COLUMN "หน่วยนับ" SET NOT NULL;

ALTER TABLE "Medical Supply Catalog"
ALTER COLUMN "จำนวน" TYPE INTEGER USING "จำนวน"::INTEGER;
