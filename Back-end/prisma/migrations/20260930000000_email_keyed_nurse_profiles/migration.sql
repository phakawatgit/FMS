DO $$
BEGIN
  IF to_regclass('"LegacyStorage"') IS NOT NULL THEN
    DELETE FROM "LegacyStorage" WHERE "key" = 'fms-duty-profiles';
  END IF;
END $$;

DROP TABLE IF EXISTS "Nurse";

CREATE TABLE "Nurse" (
  "email" VARCHAR(254) NOT NULL,
  "firstName" VARCHAR(120) NOT NULL,
  "lastName" VARCHAR(120) NOT NULL,
  "nickname" VARCHAR(120),
  "affiliation" VARCHAR(255),
  "colorId" VARCHAR(32),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Nurse_pkey" PRIMARY KEY ("email")
);