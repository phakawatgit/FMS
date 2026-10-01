import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

export type VisitFixtures = {
  patientId: string;
  nurseId: string;
  normalBatchId: string;
  emptyBatchId: string;
  raceBatchId: string;
  itemIds: string[];
  categoryId: string;
  suffix: string;
};

export function requireTestDatabaseUrl(): string {
  const url = process.env.FMS_TEST_DATABASE_URL;
  if (!url) {
    throw new Error("Set FMS_TEST_DATABASE_URL to a disposable PostgreSQL database before running API tests.");
  }

  const databaseName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  if (!/(?:^|[_-])test(?:$|[_-])/i.test(databaseName)) {
    throw new Error(
      `Refusing to use "${databaseName}" for tests. The database name must include a separate "test" segment (for example fms_test).`,
    );
  }

  return url;
}

export async function createVisitFixtures(db: PrismaClient): Promise<VisitFixtures> {
  const suffix = randomUUID();
  const category = await db.category.create({ data: { name: `QA category ${suffix}` } });
  const normalItem = await db.item.create({
    data: { categoryId: category.id, sku: `QA-NORMAL-${suffix}`, name: "QA test medicine", unit: "tablet" },
  });
  const emptyItem = await db.item.create({
    data: { categoryId: category.id, sku: `QA-EMPTY-${suffix}`, name: "QA empty medicine", unit: "tablet" },
  });
  const raceItem = await db.item.create({
    data: { categoryId: category.id, sku: `QA-RACE-${suffix}`, name: "QA concurrent medicine", unit: "tablet" },
  });
  const nurse = await db.user.create({
    data: {
      employeeId: `QA-${suffix}`,
      name: "QA Test Nurse",
      email: `qa-${suffix}@example.invalid`,
      passwordHash: "test-only-not-a-real-password-hash",
      role: "NURSE",
    },
  });
  const patient = await db.patient.create({
    data: { studentId: `QA-${suffix}`, name: "QA Test Patient" },
  });
  const [normalBatch, emptyBatch, raceBatch] = await Promise.all([
    db.stockBatch.create({
      data: { itemId: normalItem.id, batchNumber: `NORMAL-${suffix}`, currentQuantity: "20" },
    }),
    db.stockBatch.create({
      data: { itemId: emptyItem.id, batchNumber: `EMPTY-${suffix}`, currentQuantity: "0" },
    }),
    db.stockBatch.create({
      data: { itemId: raceItem.id, batchNumber: `RACE-${suffix}`, currentQuantity: "10" },
    }),
  ]);

  return {
    patientId: patient.id,
    nurseId: nurse.id,
    normalBatchId: normalBatch.id,
    emptyBatchId: emptyBatch.id,
    raceBatchId: raceBatch.id,
    itemIds: [normalItem.id, emptyItem.id, raceItem.id],
    categoryId: category.id,
    suffix,
  };
}

export async function deleteVisitFixtures(db: PrismaClient, fixtures: VisitFixtures): Promise<void> {
  const batchIds = [fixtures.normalBatchId, fixtures.emptyBatchId, fixtures.raceBatchId];
  await db.$transaction([
    db.stockTransaction.deleteMany({ where: { stockBatchId: { in: batchIds } } }),
    db.dispensation.deleteMany({ where: { stockBatchId: { in: batchIds } } }),
    db.visit.deleteMany({ where: { patientId: fixtures.patientId } }),
    db.stockBatch.deleteMany({ where: { id: { in: batchIds } } }),
    db.borrowItem.deleteMany({ where: { itemId: { in: fixtures.itemIds } } }),
    db.item.deleteMany({ where: { id: { in: fixtures.itemIds } } }),
    db.patient.delete({ where: { id: fixtures.patientId } }),
    db.user.delete({ where: { id: fixtures.nurseId } }),
    db.category.delete({ where: { id: fixtures.categoryId } }),
  ]);
}
