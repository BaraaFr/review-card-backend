import {
  z,
} from "zod";

const dateSchema =
  z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "Date must use YYYY-MM-DD format"
    )
    .refine(
      (
        value
      ) => {
        const date =
          new Date(
            `${value}T00:00:00.000Z`
          );

        return (
          Number.isFinite(
            date.getTime()
          ) &&
          date
            .toISOString()
            .slice(
              0,
              10
            ) === value
        );
      },

      "Invalid calendar date"
    );

function validTimeZone(
  value:
    string
) {
  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          value,
      }
    ).format();

    return true;
  } catch {
    return false;
  }
}

export const analyticsQuerySchema =
  z
    .object({
      range:
        z
          .enum([
            "today",
            "7d",
            "30d",
            "custom",
          ])
          .optional(),

      from:
        dateSchema
          .optional(),

      to:
        dateSchema
          .optional(),

      timeZone:
        z
          .string()
          .max(100)
          .default(
            "UTC"
          )
          .refine(
            validTimeZone,
            "Invalid timezone"
          ),

      businessId:
        z
          .string()
          .min(1)
          .optional(),

      storeId:
        z
          .string()
          .min(1)
          .optional(),

      cardId:
        z
          .string()
          .min(1)
          .optional(),
    })

    .transform(
      (
        value
      ) => ({
        ...value,

        range:
          value.range ??
          (
            value.from ||
            value.to
              ? "custom" as const
              : "30d" as const
          ),
      })
    )

    .superRefine(
      (
        value,
        context
      ) => {
        if (
          value.range !==
          "custom"
        ) {
          return;
        }

        if (
          !value.from ||
          !value.to
        ) {
          context.addIssue({
            code:
              "custom",

            message:
              "Both from and to are required",

            path: [
              "from",
            ],
          });

          return;
        }

        const days =
          (
            Date.parse(
              value.to
            ) -
            Date.parse(
              value.from
            )
          ) /
            86_400_000 +
          1;

        if (
          days < 1 ||
          days > 366
        ) {
          context.addIssue({
            code:
              "custom",

            message:
              "Choose between 1 and 366 days",

            path: [
              "to",
            ],
          });
        }
      }
    );

export type AnalyticsQuery =
  z.infer<
    typeof analyticsQuerySchema
  >;