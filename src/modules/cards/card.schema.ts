import { z } from "zod";

export const createCardSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .nullable()
    .optional(),
});

export const updateCardSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .nullable()
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message:
        "At least one field must be provided",
    }
  );

export const assignCardSchema = z.object({
  storeId: z.string().min(1),

  label: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional(),
});

export const listCardsQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),

  businessId: z
    .string()
    .optional(),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),

  status: z
    .enum([
      "UNASSIGNED",
      "ACTIVE",
      "INACTIVE",
    ])
    .optional(),

  storeId: z
    .string()
    .optional(),
});

export type CreateCardInput = z.infer<
  typeof createCardSchema
>;

export type UpdateCardInput = z.infer<
  typeof updateCardSchema
>;

export type AssignCardInput = z.infer<
  typeof assignCardSchema
>;

export type ListCardsQuery = z.infer<
  typeof listCardsQuerySchema
>;