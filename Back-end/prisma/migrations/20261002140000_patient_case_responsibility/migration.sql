ALTER TABLE "User"
  ADD COLUMN "first_name" TEXT,
  ADD COLUMN "last_name" TEXT,
  ADD COLUMN "nickname" VARCHAR(120);

ALTER TABLE "patients"
  ADD COLUMN "created_by_id" TEXT,
  ADD COLUMN "responsible_user_id" TEXT;

CREATE INDEX "patients_created_by_id_idx" ON "patients"("created_by_id");
CREATE INDEX "patients_responsible_user_id_idx" ON "patients"("responsible_user_id");

ALTER TABLE "patients"
  ADD CONSTRAINT "patients_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "patients_responsible_user_id_fkey"
    FOREIGN KEY ("responsible_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
