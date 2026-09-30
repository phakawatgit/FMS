-- Data reset is a separate, explicitly requested development operation.
-- Deploying this migration does not delete visits, medicines or loans.
ALTER TABLE "InfirmaryVisit"
  DROP COLUMN "stockLinked",
  DROP COLUMN "version",
  DROP COLUMN "medicine",
  DROP COLUMN "quantity";
ALTER TABLE "Medicine" DROP COLUMN "version";
ALTER TABLE "Loan" DROP COLUMN "version";
