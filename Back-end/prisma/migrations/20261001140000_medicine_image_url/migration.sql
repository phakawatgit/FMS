ALTER TABLE "Medicine" ADD COLUMN "imageUrl" TEXT;
-- Origin is deployment-specific. The backfill command fills existing image URLs
-- using PUBLIC_API_URL after this migration; no image bytes are rewritten.
