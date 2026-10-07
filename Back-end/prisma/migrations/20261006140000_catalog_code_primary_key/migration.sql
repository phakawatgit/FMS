BEGIN;

-- Preserve each line's historical catalog code while changing the live relation
-- to Catalog.code. The nullable reference is cleared when a catalog row is deleted.
ALTER TABLE patient_medications DROP CONSTRAINT IF EXISTS patient_medications_catalog_id_fkey;
ALTER TABLE borrow_items DROP CONSTRAINT IF EXISTS borrow_items_catalog_id_fkey;

ALTER TABLE patient_medications ADD COLUMN catalog_ref_code VARCHAR(80);
ALTER TABLE borrow_items ADD COLUMN catalog_ref_code VARCHAR(80);

UPDATE patient_medications pm
SET catalog_ref_code = c.code
FROM catalog c
WHERE pm.catalog_id = c.id;

UPDATE borrow_items bi
SET catalog_ref_code = c.code
FROM catalog c
WHERE bi.catalog_id = c.id;

DROP INDEX IF EXISTS borrow_items_catalog_id_idx;
ALTER TABLE patient_medications DROP COLUMN catalog_id;
ALTER TABLE borrow_items DROP COLUMN catalog_id;

ALTER TABLE patient_medications
  ADD CONSTRAINT patient_medications_catalog_ref_code_fkey
  FOREIGN KEY (catalog_ref_code) REFERENCES catalog(code)
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE borrow_items
  ADD CONSTRAINT borrow_items_catalog_ref_code_fkey
  FOREIGN KEY (catalog_ref_code) REFERENCES catalog(code)
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX patient_medications_catalog_ref_code_idx ON patient_medications(catalog_ref_code);
CREATE INDEX borrow_items_catalog_ref_code_idx ON borrow_items(catalog_ref_code);

ALTER TABLE catalog DROP CONSTRAINT catalog_pkey;
ALTER TABLE catalog DROP COLUMN id;
ALTER TABLE catalog ADD CONSTRAINT catalog_pkey PRIMARY KEY (code);

COMMIT;
