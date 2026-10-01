CREATE TABLE "infirmary_visit_records" (
  "id" UUID NOT NULL,
  "source_record_id" VARCHAR(120) NOT NULL,
  "patient_id" UUID NOT NULL,
  "visitor_type" VARCHAR(30),
  "age" VARCHAR(20),
  "nickname" VARCHAR(120),
  "branch" VARCHAR(120),
  "gender" VARCHAR(40),
  "blood" VARCHAR(10),
  "weight" VARCHAR(20),
  "height" VARCHAR(20),
  "symptom" TEXT,
  "sys" VARCHAR(12),
  "dia" VARCHAR(12),
  "pr" VARCHAR(12),
  "medicine" VARCHAR(200),
  "quantity" VARCHAR(40),
  "status" VARCHAR(30) NOT NULL,
  "hospital_name" VARCHAR(200),
  "raw_record" JSONB NOT NULL,
  "visited_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "infirmary_visit_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "infirmary_visit_records_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "infirmary_visit_records_source_record_id_key"
  ON "infirmary_visit_records"("source_record_id");
CREATE INDEX "infirmary_visit_records_patient_id_visited_at_idx"
  ON "infirmary_visit_records"("patient_id", "visited_at");
CREATE INDEX "infirmary_visit_records_status_visited_at_idx"
  ON "infirmary_visit_records"("status", "visited_at");
