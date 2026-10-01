BEGIN;

ALTER TABLE "patients"
  DROP COLUMN IF EXISTS "date_of_birth",
  DROP COLUMN IF EXISTS "phone",
  DROP COLUMN IF EXISTS "email",
  DROP COLUMN IF EXISTS "allergies",
  DROP COLUMN IF EXISTS "notes",
  DROP COLUMN IF EXISTS "medicine",
  DROP COLUMN IF EXISTS "quantity";

DROP TABLE IF EXISTS "borrow_items";
DROP TABLE IF EXISTS "borrow_records";
DROP TYPE IF EXISTS "BorrowStatus";

CREATE TABLE "patient_medications" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "catalog_id" UUID,
  "visit_id" VARCHAR(120) NOT NULL,
  "catalog_code" VARCHAR(80) NOT NULL,
  "medicine_name" VARCHAR(200) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "dispensed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_medications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "patient_medications_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "patient_medications_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "patient_medications_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "patient_medications_visit_id_catalog_code_key" ON "patient_medications"("visit_id", "catalog_code");
CREATE INDEX "patient_medications_patient_id_dispensed_at_idx" ON "patient_medications"("patient_id", "dispensed_at");
CREATE INDEX "patient_medications_catalog_code_dispensed_at_idx" ON "patient_medications"("catalog_code", "dispensed_at");

COMMIT;
