BEGIN;
-- AlterTable
ALTER TABLE "InfirmaryVisit" ADD COLUMN     "stockLinked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Medicine" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "borrowed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dispensed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "manualUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Dispensation" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "Dispensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "dueDate" DATE NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanItem" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "returned" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "LoanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanReturn" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryRequest" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dispensation_visitId_medicineId_key" ON "Dispensation"("visitId", "medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanItem_loanId_medicineId_key" ON "LoanItem"("loanId", "medicineId");

-- CreateIndex
CREATE INDEX "StockMovement_medicineId_createdAt_idx" ON "StockMovement"("medicineId", "createdAt");

-- AddForeignKey
ALTER TABLE "Dispensation" ADD CONSTRAINT "Dispensation_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "InfirmaryVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispensation" ADD CONSTRAINT "Dispensation_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanItem" ADD CONSTRAINT "LoanItem_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanItem" ADD CONSTRAINT "LoanItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanReturn" ADD CONSTRAINT "LoanReturn_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "Medicine" SET "manualUsed" = "used";
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_components_check" CHECK ("manualUsed" >= 0 AND "dispensed" >= 0 AND "borrowed" >= 0 AND "used" = "manualUsed" + "dispensed" + "borrowed");
ALTER TABLE "Dispensation" ADD CONSTRAINT "Dispensation_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "LoanItem" ADD CONSTRAINT "LoanItem_quantity_check" CHECK ("quantity" > 0 AND "returned" >= 0 AND "returned" <= "quantity");
INSERT INTO "StockMovement" ("id", "medicineId", "source", "reason", "before", "after")
SELECT 'opening-' || "id", "id", 'opening', 'ยอดตั้งต้นก่อนเชื่อมการจ่ายยา',
jsonb_build_object('total', "total", 'used', "used", 'manualUsed', "manualUsed", 'dispensed', 0, 'borrowed', 0, 'remaining', "total" - "used"),
jsonb_build_object('total', "total", 'used', "used", 'manualUsed', "manualUsed", 'dispensed', 0, 'borrowed', 0, 'remaining', "total" - "used") FROM "Medicine";

COMMIT;
