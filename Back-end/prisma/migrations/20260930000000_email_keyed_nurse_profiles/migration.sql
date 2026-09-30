DO $$
BEGIN
  IF to_regclass('"Nurse"') IS NOT NULL THEN
    ALTER TABLE "Nurse" RENAME TO "NurseLegacy";
    ALTER TABLE "NurseLegacy" ADD COLUMN "id" TEXT;
    UPDATE "NurseLegacy" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;
    ALTER TABLE "NurseLegacy" ALTER COLUMN "id" SET NOT NULL;
    ALTER TABLE "NurseLegacy" DROP CONSTRAINT "Nurse_pkey";
    ALTER TABLE "NurseLegacy" ADD CONSTRAINT "NurseLegacy_pkey" PRIMARY KEY ("id");
  ELSE
    CREATE TABLE "NurseLegacy" (
      "id" TEXT NOT NULL,
      "fullName" VARCHAR(255) NOT NULL,
      "nickname" VARCHAR(120),
      "affiliation" VARCHAR(255),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "NurseLegacy_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

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