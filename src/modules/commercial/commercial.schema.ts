import {
    z,
  } from "zod";
  
  export const receiptSchema =
    z
      .string()
      .trim()
      .min(3)
      .max(100)
      .toUpperCase();
  
  export const paymentMethodSchema =
    z.enum([
      "CASH",
      "WHISH",
      "OTHER",
    ]);
  
  export const paidPlanSchema =
    z.object({
      plan:
        z.enum([
          "STARTER",
          "PRO",
          "BUSINESS",
        ]),
  
      months:
        z
          .number()
          .int()
          .min(1)
          .max(12),
  
      amountCents:
        z
          .number()
          .int()
          .min(1)
          .max(
            100_000_000
          ),
  
      paymentMethod:
        paymentMethodSchema,
  
      receiptReference:
        receiptSchema,
    });
  
  export const deliverySchema =
    z.object({
      paymentMethod:
        paymentMethodSchema,
  
      receiptReference:
        receiptSchema,
    });
  
  export const subscriptionStatusSchema =
    z.object({
      status:
        z.enum([
          "PAST_DUE",
          "CANCELED",
          "EXPIRED",
        ]),
  
      reason:
        z
          .string()
          .trim()
          .min(5)
          .max(500),
    });