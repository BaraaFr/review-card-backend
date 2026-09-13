import { z } from "zod";

export const createSubscriptionSchema =
  z.object({
    plan: z.enum([
      "STARTER",
      "PRO",
      "BUSINESS",
    ]),

    status: z
      .enum([
        "TRIAL",
        "ACTIVE",
        "PAST_DUE",
        "CANCELED",
        "EXPIRED",
      ])
      .default("ACTIVE"),

    startsAt: z.coerce
      .date()
      .optional(),

    expiresAt: z.coerce
      .date()
      .nullable()
      .optional(),
  });

export const updateSubscriptionSchema =
  z
    .object({
      plan: z
        .enum([
          "STARTER",
          "PRO",
          "BUSINESS",
        ])
        .optional(),

      status: z
        .enum([
          "TRIAL",
          "ACTIVE",
          "PAST_DUE",
          "CANCELED",
          "EXPIRED",
        ])
        .optional(),

      startsAt: z.coerce
        .date()
        .optional(),

      expiresAt: z.coerce
        .date()
        .nullable()
        .optional(),
    })
    .refine(
      (data) =>
        Object.keys(data).length > 0,
      {
        message:
          "At least one field must be provided",
      }
    );

export type CreateSubscriptionInput =
  z.infer<
    typeof createSubscriptionSchema
  >;

export type UpdateSubscriptionInput =
  z.infer<
    typeof updateSubscriptionSchema
  >;