import cors from "cors";
import express from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.API_PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_request, response) => response.json({ ok: true, service: "fms-api" }));

app.get("/api/duties", async (request, response) => {
  const date = request.query.date ? new Date(String(request.query.date)) : undefined;
  const duties = await prisma.dutyShift.findMany({ where: date ? { date } : undefined, orderBy: { createdAt: "desc" } });
  response.json(duties);
});

const dutySchema = z.object({
  date: z.coerce.date(), color: z.string().min(1), firstName: z.string().min(1), lastName: z.string().min(1), nickname: z.string().optional(), affiliation: z.string().optional(), userId: z.string().min(1)
});

app.post("/api/duties", async (request, response) => {
  const parsed = dutySchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Invalid duty record", details: parsed.error.flatten() });
  try {
    const duty = await prisma.dutyShift.create({ data: parsed.data });
    return response.status(201).json(duty);
  } catch (error) {
    return response.status(409).json({ error: "This color is already assigned for this date." });
  }
});

app.listen(port, () => console.log(`FMS API listening on :${port}`));
