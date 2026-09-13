import { z } from "zod";

const dateSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must use YYYY-MM-DD format"
  );

export const analyticsQuerySchema = z
  .object({
    range: z
      .enum(["today", "7d", "30d", "custom"])
      .default("30d"),

    from: dateSchema.optional(),

    to: dateSchema.optional(),

    businessId: z.string().optional(),

    storeId: z.string().optional(),

    cardId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.range !== "custom") {
      return;
    }

    if (!data.from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message:
          "from is required for custom range",
      });
    }

    if (!data.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message:
          "to is required for custom range",
      });
    }

    if (!data.from || !data.to) {
      return;
    }

    const from = new Date(
      `${data.from}T00:00:00.000Z`
    );

    const to = new Date(
      `${data.to}T23:59:59.999Z`
    );

    if (to < from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message:
          "to must be after from",
      });

      return;
    }

    const days =
      (to.getTime() - from.getTime()) /
      (1000 * 60 * 60 * 24);

    if (days > 366) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Custom analytics range cannot exceed 366 days",
      });
    }
  });

export type AnalyticsQuery = z.infer<
  typeof analyticsQuerySchema
>;