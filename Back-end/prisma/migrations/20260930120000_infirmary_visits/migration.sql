CREATE TABLE "InfirmaryVisit" (
    "id" TEXT NOT NULL,
    "visitorType" VARCHAR(16) NOT NULL,
    "visitorDetail" VARCHAR(160),
    "firstName" VARCHAR(120) NOT NULL,
    "lastName" VARCHAR(120) NOT NULL,
    "nickname" VARCHAR(120),
    "age" INTEGER,
    "studentId" VARCHAR(40),
    "faculty" VARCHAR(32),
    "branch" VARCHAR(255),
    "gender" VARCHAR(16),
    "blood" VARCHAR(3),
    "weight" DOUBLE PRECISION,
    "height" INTEGER,
    "symptom" TEXT NOT NULL,
    "sys" INTEGER,
    "dia" INTEGER,
    "pr" INTEGER,
    "medicine" VARCHAR(160),
    "quantity" INTEGER,
    "status" VARCHAR(16) NOT NULL,
    "hospitalName" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InfirmaryVisit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InfirmaryVisit_createdAt_idx" ON "InfirmaryVisit"("createdAt");
CREATE INDEX "InfirmaryVisit_studentId_idx" ON "InfirmaryVisit"("studentId");
CREATE INDEX "InfirmaryVisit_status_createdAt_idx" ON "InfirmaryVisit"("status", "createdAt");