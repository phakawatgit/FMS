import { PrismaClient } from "@prisma/client";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createVisitFixtures, deleteVisitFixtures, requireTestDatabaseUrl, type VisitFixtures } from "../fixtures";

const port = 4111;
const baseUrl = `http://127.0.0.1:${port}`;
let db: PrismaClient;
let fixtures: VisitFixtures;
let apiProcess: ChildProcess | undefined;

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + 20_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    if (apiProcess?.exitCode !== null && apiProcess?.exitCode !== undefined) {
      throw new Error(`API exited before becoming ready (code ${apiProcess.exitCode}).`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
      lastError = new Error(`Health endpoint returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`API did not become healthy: ${String(lastError)}`);
}

async function stopApi(): Promise<void> {
  if (!apiProcess || apiProcess.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      apiProcess?.kill("SIGKILL");
      resolve();
    }, 5_000);
    apiProcess?.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    apiProcess?.kill("SIGTERM");
  });
}

function visitBody(stockBatchId: string, quantity: number) {
  return {
    patientId: fixtures.patientId,
    nurseId: fixtures.nurseId,
    symptoms: "QA test symptom",
    diagnosis: "QA test diagnosis",
    treatmentNotes: "Automated test only",
    dispensedItems: [{ stockBatchId, quantity }],
  };
}

async function postVisit(body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/visits`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const databaseUrl = requireTestDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await db.$connect();
  fixtures = await createVisitFixtures(db);

  apiProcess = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      API_PORT: String(port),
    },
    stdio: "ignore",
  });
  await waitForHealth();
}, 30_000);

afterAll(async () => {
  await stopApi();
  if (fixtures) await deleteVisitFixtures(db, fixtures);
  await db?.$disconnect();
});

describe("POST /api/visits integration", () => {
  it("creates a visit and atomically deducts stock with an audit record", async () => {
    const response = await postVisit(visitBody(fixtures.normalBatchId, 2.5));
    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body.patientId).toBe(fixtures.patientId);
    expect(body.nurseId).toBe(fixtures.nurseId);
    expect(body.dispensations).toHaveLength(1);
    expect(body.dispensations[0].stockBatchId).toBe(fixtures.normalBatchId);

    const batch = await db.stockBatch.findUniqueOrThrow({ where: { id: fixtures.normalBatchId } });
    expect(batch.currentQuantity.toString()).toBe("17.5");

    const transaction = await db.stockTransaction.findFirstOrThrow({
      where: { stockBatchId: fixtures.normalBatchId },
      orderBy: { createdAt: "desc" },
    });
    expect(transaction.quantity.toString()).toBe("-2.5");
    expect(transaction.type).toBe("DISPENSATION");
  });

  it("leaves all records and quantities unchanged when a multi-item request has insufficient stock", async () => {
    const beforeVisits = await db.visit.count({ where: { patientId: fixtures.patientId } });
    const beforeBatch = await db.stockBatch.findUniqueOrThrow({ where: { id: fixtures.normalBatchId } });

    const response = await fetch(`${baseUrl}/api/visits`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...visitBody(fixtures.normalBatchId, 1),
        dispensedItems: [
          { stockBatchId: fixtures.normalBatchId, quantity: 1 },
          { stockBatchId: fixtures.emptyBatchId, quantity: 1 },
        ],
      }),
    });

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("INSUFFICIENT_STOCK");
    expect(await db.visit.count({ where: { patientId: fixtures.patientId } })).toBe(beforeVisits);
    expect(
      (await db.stockBatch.findUniqueOrThrow({ where: { id: fixtures.normalBatchId } })).currentQuantity.toString(),
    ).toBe(beforeBatch.currentQuantity.toString());
    expect(
      await db.dispensation.count({
        where: { stockBatchId: { in: [fixtures.normalBatchId, fixtures.emptyBatchId] } },
      }),
    ).toBe(1);
  });

  it("rejects an unknown stock batch without creating a visit", async () => {
    const beforeVisits = await db.visit.count({ where: { patientId: fixtures.patientId } });
    const response = await postVisit(visitBody(randomUUID(), 1));
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("STOCK_BATCH_NOT_FOUND");
    expect(await db.visit.count({ where: { patientId: fixtures.patientId } })).toBe(beforeVisits);
  });

  it.each([0, -1, 0.0001])("rejects quantity %s and invalid UUIDs before database writes", async (quantity) => {
    const response = await postVisit({
      ...visitBody(fixtures.normalBatchId, quantity),
      patientId: "not-a-uuid",
    });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("VALIDATION_ERROR");
  });

  it("prevents concurrent requests from overselling the same batch", async () => {
    const results = await Promise.all([
      postVisit(visitBody(fixtures.raceBatchId, 7)),
      postVisit(visitBody(fixtures.raceBatchId, 7)),
    ]);
    const responses = await Promise.all(results.map(async (response) => ({
      status: response.status,
      body: await response.clone().json(),
    })));
    const statuses = responses.map(({ status }) => status).sort();
    if (JSON.stringify(statuses) !== JSON.stringify([201, 409])) {
      throw new Error(`Unexpected concurrent response: ${JSON.stringify(responses)}`);
    }
    expect(statuses).toEqual([201, 409]);

    const batch = await db.stockBatch.findUniqueOrThrow({ where: { id: fixtures.raceBatchId } });
    expect(batch.currentQuantity.toString()).toBe("3");
    expect(await db.dispensation.count({ where: { stockBatchId: fixtures.raceBatchId } })).toBe(1);
  });
});
