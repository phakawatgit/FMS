ALTER TABLE "borrow_records"
  ADD COLUMN "original_due_at" DATE,
  ADD COLUMN "extended_at" TIMESTAMPTZ(6);
