BEGIN;

CREATE TABLE IF NOT EXISTS "catalog" (
  "id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "product_name" VARCHAR(200),
  "generic_name" VARCHAR(200),
  "category" VARCHAR(80) NOT NULL,
  "form" VARCHAR(120),
  "size" VARCHAR(120),
  "unit" VARCHAR(40) NOT NULL DEFAULT 'unit',
  "total" INTEGER NOT NULL DEFAULT 0,
  "used" INTEGER NOT NULL DEFAULT 0,
  "remaining" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(40) NOT NULL DEFAULT 'ปกติ',
  "benefit" TEXT,
  "symptom" TEXT,
  "usage" TEXT,
  "warning" TEXT,
  "expiry" DATE,
  "image_url" VARCHAR(2048),
  "image_data" BYTEA,
  "image_mime_type" VARCHAR(80),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "catalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_code_key" ON "catalog"("code");
CREATE INDEX IF NOT EXISTS "catalog_category_name_idx" ON "catalog"("category", "name");
CREATE INDEX IF NOT EXISTS "catalog_status_idx" ON "catalog"("status");

WITH raw AS (
  SELECT element AS item, ordinality
  FROM "LegacyStorage" storage
  CROSS JOIN LATERAL jsonb_array_elements(storage."value") WITH ORDINALITY AS records(element, ordinality)
  WHERE storage."key" = 'fms-stock-records'
    AND jsonb_typeof(storage."value") = 'array'
), parsed AS (
  SELECT
    NULLIF(BTRIM(item->>'code'), '') AS code,
    COALESCE(NULLIF(BTRIM(item->>'name'), ''), NULLIF(BTRIM(item->>'productName'), ''), 'Untitled') AS name,
    NULLIF(item->>'productName', '') AS product_name,
    NULLIF(item->>'genericName', '') AS generic_name,
    COALESCE(NULLIF(item->>'category', ''), 'equipment') AS category,
    NULLIF(item->>'form', '') AS form,
    NULLIF(item->>'size', '') AS size,
    COALESCE(NULLIF(item->>'unit', ''), 'unit') AS unit,
    CASE WHEN item->>'total' ~ '^\d+$' THEN (item->>'total')::INTEGER ELSE 0 END AS total,
    CASE WHEN item->>'used' ~ '^\d+$' THEN (item->>'used')::INTEGER ELSE 0 END AS used,
    CASE WHEN item->>'remaining' ~ '^\d+$' THEN (item->>'remaining')::INTEGER ELSE 0 END AS remaining,
    COALESCE(NULLIF(item->>'status', ''), 'ปกติ') AS status,
    NULLIF(item->>'benefit', '') AS benefit,
    NULLIF(item->>'symptom', '') AS symptom,
    NULLIF(item->>'usage', '') AS usage,
    NULLIF(item->>'warning', '') AS warning,
    CASE WHEN item->>'expiry' ~ '^\d{4}-\d{2}-\d{2}$' THEN (item->>'expiry')::DATE ELSE NULL END AS expiry,
    item->>'image' AS image,
    ordinality,
    item->>'createdAt' AS created_at
  FROM raw
), unique_rows AS (
  SELECT DISTINCT ON (code) * FROM parsed WHERE code IS NOT NULL ORDER BY code, ordinality DESC
)
INSERT INTO "catalog" (
  "id", "code", "name", "product_name", "generic_name", "category", "form", "size", "unit",
  "total", "used", "remaining", "status", "benefit", "symptom", "usage", "warning", "expiry",
  "image_url", "image_data", "image_mime_type", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), code, name, product_name, generic_name, category, form, size, unit,
  total, used, GREATEST(0, total - LEAST(used, total)), status, benefit, symptom, "usage", warning, expiry,
  CASE
    WHEN image ~ '^data:image/(jpeg|png|webp);base64,' THEN 'http://localhost:4000/api/catalog/' || code || '/image'
    WHEN image ~ '^https?://' THEN image
    ELSE NULL
  END,
  CASE WHEN image ~ '^data:image/(jpeg|png|webp);base64,' THEN decode(split_part(image, ',', 2), 'base64') ELSE NULL END,
  CASE WHEN image ~ '^data:image/(jpeg|png|webp);base64,' THEN split_part(split_part(image, ';', 1), ':', 2) ELSE NULL END,
  CASE WHEN created_at ~ '^\d{4}-\d{2}-\d{2}T' THEN created_at::TIMESTAMPTZ ELSE CURRENT_TIMESTAMP END,
  CURRENT_TIMESTAMP
FROM unique_rows
ON CONFLICT ("code") DO NOTHING;

DELETE FROM "LegacyStorage" WHERE "key" = 'fms-stock-records';

COMMIT;
