ALTER TABLE "User" ADD COLUMN "firebaseUid" TEXT, ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");
CREATE TABLE "CatalogOrder" (
  "id" TEXT PRIMARY KEY, "sequence" SERIAL NOT NULL UNIQUE,
  "documentTitle" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deletedAt" TIMESTAMP(3)
);
CREATE TABLE "CatalogOrderItem" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "CatalogOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "position" INTEGER NOT NULL, "medicineId" TEXT, "code" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0), "snapshot" JSONB NOT NULL,
  UNIQUE ("orderId", "position")
);
CREATE TABLE "Faculty" (
  "id" TEXT PRIMARY KEY, "code" VARCHAR(32) NOT NULL UNIQUE,
  "name" VARCHAR(255) NOT NULL UNIQUE, "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE "Branch" (
  "id" TEXT PRIMARY KEY, "facultyId" TEXT NOT NULL REFERENCES "Faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" VARCHAR(255) NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, UNIQUE ("facultyId", "name")
);
CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY, "actorId" TEXT, "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL, "entityId" TEXT, "detail" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
-- Preserve existing orders and snapshots; retain the source for inspection.
INSERT INTO "CatalogOrder" ("id", "documentTitle", "createdAt")
SELECT item->>'id', COALESCE(item->>'documentTitle',''), (item->>'createdAt')::timestamp
FROM "LegacyStorage", jsonb_array_elements("value") AS item
WHERE "key" = 'fms-history-catalog-orders'
ORDER BY (item->>'createdAt')::timestamp, item->>'id';
INSERT INTO "CatalogOrderItem" ("id", "orderId", "position", "medicineId", "code", "quantity", "snapshot")
SELECT (o.item->>'id') || ':' || i.position, o.item->>'id', i.position::integer,
       i.item->>'id', i.item->>'code', (i.item->>'quantity')::integer, i.item
FROM "LegacyStorage" l, jsonb_array_elements(l."value") AS o(item),
     jsonb_array_elements(o.item->'items') WITH ORDINALITY AS i(item, position)
WHERE l."key" = 'fms-history-catalog-orders';
