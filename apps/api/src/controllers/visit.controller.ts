import { Prisma, StockTransactionType } from "@prisma/client";
import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middlewares/errorHandler.js";
import { createVisitSchema } from "../validations/visit.schema.js";

export const createVisit: RequestHandler = async (request, response, next) => {
  const parsed = createVisitSchema.safeParse(request.body);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }

  const input = parsed.data;

  try {
    const visit = await prisma.$transaction(async (tx) => {
      const batches = await tx.stockBatch.findMany({
        where: { id: { in: input.dispensedItems.map((item) => item.stockBatchId) } },
        select: { id: true, itemId: true, currentQuantity: true },
      });
      const batchesById = new Map(batches.map((batch) => [batch.id, batch]));

      for (const dispensedItem of input.dispensedItems) {
        const batch = batchesById.get(dispensedItem.stockBatchId);
        if (!batch) {
          throw new AppError(
            `Stock batch ${dispensedItem.stockBatchId} was not found.`,
            404,
            "STOCK_BATCH_NOT_FOUND",
          );
        }

        const requestedQuantity = new Prisma.Decimal(dispensedItem.quantity.toString());
        if (batch.currentQuantity.lessThan(requestedQuantity)) {
          throw new AppError(
            `Insufficient stock for batch ${batch.id}.`,
            409,
            "INSUFFICIENT_STOCK",
          );
        }
      }

      const createdVisit = await tx.visit.create({
        data: {
          patientId: input.patientId,
          nurseId: input.nurseId,
          symptoms: input.symptoms,
          diagnosis: input.diagnosis,
          treatmentNotes: input.treatmentNotes,
        },
      });

      for (const dispensedItem of input.dispensedItems) {
        const batch = batchesById.get(dispensedItem.stockBatchId)!;

        const quantity = new Prisma.Decimal(dispensedItem.quantity.toString());
        const update = await tx.stockBatch.updateMany({
          where: {
            id: batch.id,
            currentQuantity: { gte: quantity },
          },
          data: { currentQuantity: { decrement: quantity } },
        });

        if (update.count !== 1) {
          throw new AppError(
            `Insufficient stock for batch ${batch.id}.`,
            409,
            "INSUFFICIENT_STOCK",
          );
        }

        await tx.dispensation.create({
          data: {
            visitId: createdVisit.id,
            stockBatchId: batch.id,
            quantity,
          },
        });

        await tx.stockTransaction.create({
          data: {
            userId: input.nurseId,
            itemId: batch.itemId,
            stockBatchId: batch.id,
            type: StockTransactionType.DISPENSATION,
            quantity: quantity.negated(),
            note: `Dispensed for visit ${createdVisit.id}`,
          },
        });
      }

      return tx.visit.findUniqueOrThrow({
        where: { id: createdVisit.id },
        include: { dispensations: { include: { stockBatch: true } } },
      });
    }, { maxWait: 10_000, timeout: 15_000 });

    response.status(201).json(visit);
  } catch (error) {
    next(error);
  }
};
