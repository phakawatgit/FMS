ALTER TABLE "DutyShift"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "DutyShift_userId_date_key"
  ON "DutyShift"("userId", "date");
