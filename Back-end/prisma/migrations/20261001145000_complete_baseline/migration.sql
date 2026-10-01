-- Earlier development databases obtained these tables via db push. Explicitly
-- supply the missing baseline so migrate deploy also works on an empty database.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('ADMIN', 'NURSE');
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY, "email" TEXT NOT NULL, "name" TEXT NOT NULL,
  "password" TEXT, "role" "Role" NOT NULL DEFAULT 'NURSE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE TABLE IF NOT EXISTS "DutyShift" (
  "id" TEXT PRIMARY KEY, "date" TIMESTAMP(3) NOT NULL, "color" TEXT NOT NULL,
  "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL, "nickname" TEXT, "affiliation" TEXT,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DutyShift_date_color_key" ON "DutyShift"("date", "color");
CREATE INDEX IF NOT EXISTS "DutyShift_date_idx" ON "DutyShift"("date");
CREATE TABLE IF NOT EXISTS "LegacyStorage" (
  "key" TEXT PRIMARY KEY, "value" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE IF NOT EXISTS "PasswordResetOtp" (
  "id" TEXT PRIMARY KEY, "email" TEXT NOT NULL, "firebaseUid" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0,
  "verifiedAt" TIMESTAMP(3), "resetTokenHash" TEXT, "resetTokenExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PasswordResetOtp_email_createdAt_idx" ON "PasswordResetOtp"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "PasswordResetOtp_resetTokenHash_idx" ON "PasswordResetOtp"("resetTokenHash");
