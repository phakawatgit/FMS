BEGIN;

ALTER TABLE "User" ADD COLUMN affiliation VARCHAR(255);

WITH nurse_profiles AS (
  SELECT
    btrim("fullName") AS normalized_name,
    nickname,
    affiliation,
    row_number() OVER (
      PARTITION BY btrim("fullName")
      ORDER BY "updatedAt" DESC, "fullName" ASC
    ) AS row_number
  FROM "Nurse"
)
UPDATE "User" AS users
SET
  nickname = COALESCE(users.nickname, nurse_profiles.nickname),
  affiliation = nurse_profiles.affiliation
FROM nurse_profiles
WHERE nurse_profiles.row_number = 1
  AND btrim(users.name) = nurse_profiles.normalized_name;

DROP TABLE "Nurse";

COMMIT;
