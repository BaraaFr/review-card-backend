import { z } from "zod";

export const createBusinessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters")
    .max(150),

  logoUrl: z
    .string()
    .url("Invalid logo URL")
    .nullable()
    .optional(),
});

export const updateBusinessSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(150)
      .optional(),

    logoUrl: z
      .string()
      .url("Invalid logo URL")
      .nullable()
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided",
    }
  );

export type CreateBusinessInput = z.infer<
  typeof createBusinessSchema
>;

export type UpdateBusinessInput = z.infer<
  typeof updateBusinessSchema
>;