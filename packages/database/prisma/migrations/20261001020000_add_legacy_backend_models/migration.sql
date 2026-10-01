CREATE TYPE "Role" AS ENUM ('ADMIN', 'NURSE');

CREATE TABLE "Nurse" (
    "fullName" VARCHAR(255) NOT NULL,
    "nickname" VARCHAR(120),
    "affiliation" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Nurse_pkey" PRIMARY KEY ("fullName")
);

CREATE TABLE "PasswordResetOtp" (
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

CREATE INDEX "PasswordResetOtp_email_createdAt_idx" ON "PasswordResetOtp"("email", "createdAt");
CREATE INDEX "PasswordResetOtp_resetTokenHash_idx" ON "PasswordResetOtp"("resetTokenHash");

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'NURSE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "DutyShift" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "color" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nickname" TEXT,
    "affiliation" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DutyShift_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DutyShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DutyShift_date_color_key" ON "DutyShift"("date", "color");
CREATE INDEX "DutyShift_date_idx" ON "DutyShift"("date");
