BEGIN;

CREATE TYPE "BorrowStatus" AS ENUM ('BORROWED', 'PARTIALLY_RETURNED', 'RETURNED');

CREATE TABLE "borrow_records" (
  "id" UUID NOT NULL,
  "borrower_name" VARCHAR(200) NOT NULL,
  "nickname" VARCHAR(120),
  "student_id" VARCHAR(80),
  "branch" VARCHAR(120),
  "phone" VARCHAR(40),
  "roles" JSONB NOT NULL,
  "borrow_types" JSONB NOT NULL,
  "activity" TEXT,
  "reason" TEXT,
  "borrowed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "due_at" DATE NOT NULL,
  "returned_at" TIMESTAMPTZ(6),
  "status" "BorrowStatus" NOT NULL DEFAULT 'BORROWED',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "borrow_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "borrow_items" (
  "id" UUID NOT NULL,
  "borrow_record_id" UUID NOT NULL,
  "catalog_id" UUID,
  "catalog_code" VARCHAR(80) NOT NULL,
  "item_name" VARCHAR(200) NOT NULL,
  "unit" VARCHAR(40) NOT NULL,
  "quantity_borrowed" INTEGER NOT NULL,
  "quantity_returned" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "borrow_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "borrow_items_quantity_check" CHECK ("quantity_borrowed" > 0 AND "quantity_returned" >= 0 AND "quantity_returned" <= "quantity_borrowed"),
  CONSTRAINT "borrow_items_borrow_record_id_fkey" FOREIGN KEY ("borrow_record_id") REFERENCES "borrow_records"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "borrow_items_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "borrow_returns" (
  "id" UUID NOT NULL,
  "borrow_item_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "condition" VARCHAR(120),
  "note" TEXT,
  "returned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "borrow_returns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "borrow_returns_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "borrow_returns_borrow_item_id_fkey" FOREIGN KEY ("borrow_item_id") REFERENCES "borrow_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "borrow_records_status_due_at_idx" ON "borrow_records"("status", "due_at");
CREATE INDEX "borrow_records_student_id_borrowed_at_idx" ON "borrow_records"("student_id", "borrowed_at");
CREATE INDEX "borrow_records_borrower_name_borrowed_at_idx" ON "borrow_records"("borrower_name", "borrowed_at");
CREATE UNIQUE INDEX "borrow_items_borrow_record_id_catalog_code_key" ON "borrow_items"("borrow_record_id", "catalog_code");
CREATE INDEX "borrow_items_catalog_id_idx" ON "borrow_items"("catalog_id");
CREATE INDEX "borrow_items_catalog_code_idx" ON "borrow_items"("catalog_code");
CREATE INDEX "borrow_returns_borrow_item_id_returned_at_idx" ON "borrow_returns"("borrow_item_id", "returned_at");

COMMIT;
