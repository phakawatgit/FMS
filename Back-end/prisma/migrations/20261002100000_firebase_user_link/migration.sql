ALTER TABLE "User"
  ADD COLUMN "firebase_uid" TEXT,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX "User_firebase_uid_key" ON "User"("firebase_uid");
