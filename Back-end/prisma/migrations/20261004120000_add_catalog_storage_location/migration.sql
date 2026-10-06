ALTER TABLE "catalog"
ADD COLUMN IF NOT EXISTS "storage_location" VARCHAR(200);

ALTER TABLE "patient_medications"
ADD COLUMN IF NOT EXISTS "storage_location" VARCHAR(200);
