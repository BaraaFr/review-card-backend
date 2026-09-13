import { z } from "zod";

const subscriptionPlanSchema = z.enum([
  "STARTER",
  "PRO",
  "BUSINESS",
]);

const subscriptionSetupSchema = z.discriminatedUnion(
  "mode",
  [
    z.object({
      mode: z.literal("TRIAL"),

      plan: subscriptionPlanSchema.default(
        "STARTER"
      ),

      days: z.coerce
        .number()
        .int()
        .min(1)
        .max(90)
        .default(14),
    }),

    z.object({
      mode: z.literal("ACTIVE"),

      plan: subscriptionPlanSchema,

      expiresAt: z.coerce
        .date()
        .nullable()
        .optional(),
    }),

    z.object({
      mode: z.literal("NONE"),
    }),
  ]
);

export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(100),

  email: z
    .string()
    .trim()
    .email()
    .transform((value) =>
      value.toLowerCase()
    ),

  business: z.object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(150),

    logoUrl: z
      .string()
      .url()
      .nullable()
      .optional(),
  }),

  subscription:
    subscriptionSetupSchema,
});

export const createAdditionalBusinessSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(150),

    logoUrl: z
      .string()
      .url()
      .nullable()
      .optional(),

    location: z.object({
      name: z
        .string()
        .trim()
        .min(
          2,
          "Location name is required"
        )
        .max(150),

      address: z
        .string()
        .trim()
        .max(255)
        .nullable()
        .optional(),

      googleReviewUrl: z
        .string()
        .trim()
        .url(
          "Invalid Google review URL"
        ),
    }),

    subscription:
      subscriptionSetupSchema,
  });

export const customerParamsSchema = z.object({
  userId: z.string().min(1),
});

export type CreateCustomerInput =
  z.infer<
    typeof createCustomerSchema
  >;

export type CreateAdditionalBusinessInput =
  z.infer<
    typeof createAdditionalBusinessSchema
  >;