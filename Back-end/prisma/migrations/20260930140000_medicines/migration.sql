CREATE TABLE "Medicine" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sequence" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "productName" VARCHAR(255), "genericName" VARCHAR(255),
  "category" VARCHAR(16) NOT NULL,
  "form" VARCHAR(120), "size" VARCHAR(120), "unit" VARCHAR(120),
  "benefit" TEXT, "symptom" TEXT, "usage" TEXT, "warning" TEXT,
  "total" INTEGER NOT NULL DEFAULT 0, "used" INTEGER NOT NULL DEFAULT 0,
  "expiry" DATE, "imageData" BYTEA, "imageType" VARCHAR(32),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Medicine_inventory_check" CHECK ("total" >= 0 AND "used" >= 0 AND "used" <= "total"),
  CONSTRAINT "Medicine_category_check" CHECK ("category" IN ('oral', 'topical', 'equipment'))
);
CREATE UNIQUE INDEX "Medicine_sequence_key" ON "Medicine"("sequence");
CREATE UNIQUE INDEX "Medicine_code_key" ON "Medicine"("code");
CREATE INDEX "Medicine_category_createdAt_idx" ON "Medicine"("category", "createdAt");
