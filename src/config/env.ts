import "dotenv/config";

import {
  z,
} from "zod";

const envSchema =
  z.object({
    NODE_ENV:
      z
        .enum([
          "development",
          "test",
          "production",
        ])
        .default(
          "development"
        ),

    PORT:
      z.coerce
        .number()
        .int()
        .positive()
        .default(
          4000
        ),

    DATABASE_URL:
      z
        .string()
        .min(1),

    JWT_SECRET:
      z
        .string()
        .min(
          32,
          "JWT_SECRET must be at least 32 characters."
        ),

    FRONTEND_URL:
      z
        .string()
        .url(),

    PUBLIC_API_URL:
      z
        .string()
        .url(),

    COOKIE_DOMAIN:
      z
        .string()
        .optional()
        .default(
          ""
        ),

    GOOGLE_PLACES_API_KEY:
      z
        .string()
        .min(1),

    GOOGLE_API_DAILY_LIMIT:
      z.coerce
        .number()
        .int()
        .min(1)
        .default(200),

    ANALYTICS_SALT:
      z
        .string()
        .min(
          32,
          "ANALYTICS_SALT must be at least 32 characters."
        ),
  });

const result =
  envSchema.safeParse(
    process.env
  );

if (
  !result.success
) {
  console.error(
    "Invalid environment variables:",
    result.error
      .flatten()
      .fieldErrors
  );

  process.exit(1);
}

export const env =
  result.data;