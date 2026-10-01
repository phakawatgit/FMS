import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { createVisitFixtures, deleteVisitFixtures, requireTestDatabaseUrl, type VisitFixtures } from "../fixtures";

const responseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  nurseId: z.string().uuid(),
  dispensations: z.array(
    z.object({
      id: z.string().uuid(),
      visitId: z.string().uuid(),
      stockBatchId: z.string().uuid(),
      quantity: z.union([z.string(), z.number()]),
    }),
  ),
});

let db: PrismaClient;
let fixtures: VisitFixtures;

test.beforeAll(async () => {
  const databaseUrl = requireTestDatabaseUrl();
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await db.$connect();
  fixtures = await createVisitFixtures(db);
});

test.afterAll(async () => {
  if (fixtures) await deleteVisitFixtures(db, fixtures);
  await db?.$disconnect();
});

test("visit API returns validated JSON and expected status codes", async ({ request }) => {
  const successful = await request.post("/api/visits", {
    data: {
      patientId: fixtures.patientId,
      nurseId: fixtures.nurseId,
      symptoms: "E2E symptom",
      diagnosis: "E2E diagnosis",
      treatmentNotes: "Automated test only",
      dispensedItems: [{ stockBatchId: fixtures.normalBatchId, quantity: 2 }],
    },
  });
  expect(successful.status()).toBe(201);
  const responseJson = await successful.json();
  const successBody = responseSchema.parse(responseJson);
  expect(successBody.patientId).toBe(fixtures.patientId);
  expect(successBody.dispensations).toHaveLength(1);
  expect(responseJson).toMatchObject({
    dispensations: [{ stockBatchId: fixtures.normalBatchId }],
  });

  const insufficient = await request.post("/api/visits", {
    data: {
      patientId: fixtures.patientId,
      nurseId: fixtures.nurseId,
      dispensedItems: [{ stockBatchId: fixtures.emptyBatchId, quantity: 1 }],
    },
  });
  expect(insufficient.status()).toBe(409);
  expect(await insufficient.json()).toMatchObject({ code: "INSUFFICIENT_STOCK" });

  const missingBatch = await request.post("/api/visits", {
    data: {
      patientId: fixtures.patientId,
      nurseId: fixtures.nurseId,
      dispensedItems: [{ stockBatchId: "00000000-0000-4000-8000-000000000000", quantity: 1 }],
    },
  });
  expect(missingBatch.status()).toBe(404);
  expect(await missingBatch.json()).toMatchObject({ code: "STOCK_BATCH_NOT_FOUND" });

  const invalid = await request.post("/api/visits", {
    data: { patientId: "invalid", nurseId: fixtures.nurseId, dispensedItems: [] },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({ code: "VALIDATION_ERROR" });
});
