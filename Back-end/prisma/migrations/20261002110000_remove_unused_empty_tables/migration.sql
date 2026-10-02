DO $$
DECLARE
  table_name TEXT;
  has_rows BOOLEAN;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'activity_logs', 'shifts', 'shift_assignments', 'categories', 'items',
    'stock_batches', 'stock_transactions', 'visits', 'dispensations', 'users'
  ] LOOP
    IF to_regclass(format('%I', table_name)) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I LIMIT 1)', table_name) INTO has_rows;
      IF has_rows THEN
        RAISE EXCEPTION 'Refusing to remove non-empty table %', table_name;
      END IF;
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS "dispensations";
DROP TABLE IF EXISTS "stock_transactions";
DROP TABLE IF EXISTS "stock_batches";
DROP TABLE IF EXISTS "visits";
DROP TABLE IF EXISTS "items";
DROP TABLE IF EXISTS "categories";
DROP TABLE IF EXISTS "users";
DROP TABLE IF EXISTS "shift_assignments", "shifts", "activity_logs";

CREATE TABLE IF NOT EXISTS "PasswordResetOtp" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "firebaseUid" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "verifiedAt" TIMESTAMP(3),
  "resetTokenHash" TEXT,
  "resetTokenExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PasswordResetOtp_email_createdAt_idx" ON "PasswordResetOtp"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "PasswordResetOtp_resetTokenHash_idx" ON "PasswordResetOtp"("resetTokenHash");