import { Prisma } from "@prisma/client";
import { z } from "zod";

const optionalText = z.string().trim().max(10_000).optional();

export const createVisitSchema = z.object({
  patientId: z.string().uuid(),
  nurseId: z.string().uuid(),
  symptoms: optionalText,
  diagnosis: optionalText,
  treatmentNotes: optionalText,
  dispensedItems: z
    .array(
      z.object({
        stockBatchId: z.string().uuid(),
        quantity: z
          .coerce.number()
          .finite()
          .positive()
          .max(999_999_999)
          .refine(
            (quantity) => new Prisma.Decimal(quantity.toString()).decimalPlaces() <= 3,
            "Quantity supports at most three decimal places.",
          ),
      }).strict(),
    )
    .max(100)
    .default([])
    .refine(
      (items) => new Set(items.map((item) => item.stockBatchId)).size === items.length,
      "Each stock batch can appear only once per visit.",
    ),
}).strict();

export type CreateVisitInput = z.infer<typeof createVisitSchema>;
