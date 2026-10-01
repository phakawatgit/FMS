-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'NURSE', 'STAFF');

-- CreateEnum
CREATE TYPE "StockTransactionType" AS ENUM ('INTAKE', 'ADJUSTMENT', 'DISPENSATION', 'BORROW', 'RETURN', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('NOT_REQUIRED', 'REFERRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BorrowStatus" AS ENUM ('BORROWED', 'RETURNED', 'LATE');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT', 'FULL_DAY', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('SCHEDULED', 'PRESENT', 'ABSENT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "employee_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(128) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "sku" VARCHAR(80),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "unit" VARCHAR(40) NOT NULL,
    "reorder_level" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "batch_number" VARCHAR(100) NOT NULL,
    "expires_at" DATE,
    "current_quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "stock_batch_id" UUID NOT NULL,
    "type" "StockTransactionType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "patient_number" VARCHAR(80),
    "name" VARCHAR(200) NOT NULL,
    "date_of_birth" DATE,
    "phone" VARCHAR(40),
    "email" VARCHAR(320),
    "allergies" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "nurse_id" UUID NOT NULL,
    "visited_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symptoms" TEXT,
    "diagnosis" TEXT,
    "treatment_notes" TEXT,
    "referral_status" "ReferralStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispensations" (
    "id" UUID NOT NULL,
    "visit_id" UUID NOT NULL,
    "stock_batch_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "instructions" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrow_records" (
    "id" UUID NOT NULL,
    "processed_by_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "borrowed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_return_at" TIMESTAMPTZ(6) NOT NULL,
    "actual_return_at" TIMESTAMPTZ(6),
    "status" "BorrowStatus" NOT NULL DEFAULT 'BORROWED',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "borrow_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrow_items" (
    "id" UUID NOT NULL,
    "borrow_record_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity_borrowed" DECIMAL(12,3) NOT NULL,
    "quantity_returned" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "return_condition" VARCHAR(100),
    "returned_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "borrow_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "shift_type" "ShiftType" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "attendance_status" "AttendanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "attended_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_entity_type_entity_id_idx" ON "activity_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "items_sku_key" ON "items"("sku");

-- CreateIndex
CREATE INDEX "items_category_id_name_idx" ON "items"("category_id", "name");

-- CreateIndex
CREATE INDEX "items_is_active_name_idx" ON "items"("is_active", "name");

-- CreateIndex
CREATE INDEX "stock_batches_item_id_expires_at_idx" ON "stock_batches"("item_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_batches_item_id_batch_number_key" ON "stock_batches"("item_id", "batch_number");

-- CreateIndex
CREATE INDEX "stock_transactions_user_id_created_at_idx" ON "stock_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_transactions_item_id_created_at_idx" ON "stock_transactions"("item_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_transactions_stock_batch_id_created_at_idx" ON "stock_transactions"("stock_batch_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_transactions_type_created_at_idx" ON "stock_transactions"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "patients_patient_number_key" ON "patients"("patient_number");

-- CreateIndex
CREATE INDEX "patients_name_idx" ON "patients"("name");

-- CreateIndex
CREATE INDEX "visits_patient_id_visited_at_idx" ON "visits"("patient_id", "visited_at");

-- CreateIndex
CREATE INDEX "visits_nurse_id_visited_at_idx" ON "visits"("nurse_id", "visited_at");

-- CreateIndex
CREATE INDEX "visits_visited_at_idx" ON "visits"("visited_at");

-- CreateIndex
CREATE INDEX "dispensations_stock_batch_id_created_at_idx" ON "dispensations"("stock_batch_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "dispensations_visit_id_stock_batch_id_key" ON "dispensations"("visit_id", "stock_batch_id");

-- CreateIndex
CREATE INDEX "borrow_records_processed_by_id_borrowed_at_idx" ON "borrow_records"("processed_by_id", "borrowed_at");

-- CreateIndex
CREATE INDEX "borrow_records_patient_id_borrowed_at_idx" ON "borrow_records"("patient_id", "borrowed_at");

-- CreateIndex
CREATE INDEX "borrow_records_status_expected_return_at_idx" ON "borrow_records"("status", "expected_return_at");

-- CreateIndex
CREATE INDEX "borrow_items_item_id_created_at_idx" ON "borrow_items"("item_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "borrow_items_borrow_record_id_item_id_key" ON "borrow_items"("borrow_record_id", "item_id");

-- CreateIndex
CREATE INDEX "shifts_date_shift_type_idx" ON "shifts"("date", "shift_type");

-- CreateIndex
CREATE INDEX "shift_assignments_user_id_attendance_status_idx" ON "shift_assignments"("user_id", "attendance_status");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_shift_id_user_id_key" ON "shift_assignments"("shift_id", "user_id");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_stock_batch_id_fkey" FOREIGN KEY ("stock_batch_id") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_nurse_id_fkey" FOREIGN KEY ("nurse_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispensations" ADD CONSTRAINT "dispensations_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispensations" ADD CONSTRAINT "dispensations_stock_batch_id_fkey" FOREIGN KEY ("stock_batch_id") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_records" ADD CONSTRAINT "borrow_records_processed_by_id_fkey" FOREIGN KEY ("processed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_records" ADD CONSTRAINT "borrow_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_items" ADD CONSTRAINT "borrow_items_borrow_record_id_fkey" FOREIGN KEY ("borrow_record_id") REFERENCES "borrow_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_items" ADD CONSTRAINT "borrow_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
