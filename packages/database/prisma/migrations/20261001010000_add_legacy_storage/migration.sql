CREATE TABLE "LegacyStorage" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegacyStorage_pkey" PRIMARY KEY ("key")
);
