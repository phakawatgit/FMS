BEGIN;

ALTER TABLE "patients"
  ADD COLUMN "symptom" TEXT,
  ADD COLUMN "sys" VARCHAR(12),
  ADD COLUMN "dia" VARCHAR(12),
  ADD COLUMN "pr" VARCHAR(12),
  ADD COLUMN "medicine" VARCHAR(200),
  ADD COLUMN "quantity" VARCHAR(40),
  ADD COLUMN "status" VARCHAR(30),
  ADD COLUMN "hospital_name" VARCHAR(200),
  ADD COLUMN "visited_at" TIMESTAMPTZ(6),
  ADD COLUMN "infirmary_history" JSONB;

DROP INDEX "patients_patient_number_key";
CREATE INDEX "patients_patient_number_idx" ON "patients"("patient_number");

WITH visit_history AS (
  SELECT "patient_id", jsonb_agg("raw_record" ORDER BY "visited_at", "created_at") AS records
  FROM "infirmary_visit_records"
  GROUP BY "patient_id"
), latest_visit AS (
  SELECT DISTINCT ON ("patient_id") "patient_id", "raw_record"
  FROM "infirmary_visit_records"
  ORDER BY "patient_id", "visited_at" DESC, "created_at" DESC
)
UPDATE "patients" AS p
SET "first_name" = NULLIF(l."raw_record"->>'firstName', ''),
    "last_name" = NULLIF(l."raw_record"->>'lastName', ''),
    "name" = COALESCE(NULLIF(concat_ws(' ', NULLIF(l."raw_record"->>'firstName', ''), NULLIF(l."raw_record"->>'lastName', '')), ''), p."name"),
    "nickname" = NULLIF(l."raw_record"->>'nickname', ''),
    "age" = CASE WHEN l."raw_record"->>'age' ~ '^[0-9]{1,3}$' AND (l."raw_record"->>'age')::integer <= 150 THEN (l."raw_record"->>'age')::integer ELSE NULL END,
    "faculty" = NULLIF(l."raw_record"->>'faculty', 'all'),
    "branch" = NULLIF(l."raw_record"->>'branch', 'all'),
    "visitor_type" = NULLIF(l."raw_record"->>'visitorType', ''),
    "visitor_detail" = NULLIF(l."raw_record"->>'visitorDetail', ''),
    "gender" = NULLIF(l."raw_record"->>'gender', 'เลือก'),
    "blood" = NULLIF(l."raw_record"->>'blood', 'เลือก'),
    "weight" = CASE WHEN l."raw_record"->>'weight' ~ '^[0-9]{1,5}(\.[0-9]{1,2})?$' THEN (l."raw_record"->>'weight')::numeric(7,2) ELSE NULL END,
    "height" = CASE WHEN l."raw_record"->>'height' ~ '^[0-9]{1,5}(\.[0-9]{1,2})?$' THEN (l."raw_record"->>'height')::numeric(7,2) ELSE NULL END,
    "symptom" = NULLIF(l."raw_record"->>'symptom', ''),
    "sys" = NULLIF(l."raw_record"->>'sys', ''),
    "dia" = NULLIF(l."raw_record"->>'dia', ''),
    "pr" = NULLIF(l."raw_record"->>'pr', ''),
    "medicine" = NULLIF(NULLIF(l."raw_record"->>'medicine', ''), 'เลือกยา'),
    "quantity" = NULLIF(l."raw_record"->>'quantity', ''),
    "status" = NULLIF(l."raw_record"->>'status', ''),
    "hospital_name" = NULLIF(l."raw_record"->>'hospitalName', ''),
    "visited_at" = NULLIF(l."raw_record"->>'createdAt', '')::timestamptz,
    "infirmary_history" = h.records,
    "updated_at" = CURRENT_TIMESTAMP
FROM latest_visit AS l
JOIN visit_history AS h USING ("patient_id")
WHERE p."id" = l."patient_id";

DROP TABLE "infirmary_visit_records";

COMMIT;
