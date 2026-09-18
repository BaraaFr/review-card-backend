import {
  z,
} from "zod";

import {
  isAllowedGoogleReviewUrl,
} from "../../../utils/google-url.js";

/*
 * Customer/business onboarding must
 * never grant subscription access.
 *
 * Trial and paid access are provisioned
 * later through the audited commercial
 * actions.
 */
const subscriptionSetupSchema =
  z.object({
    mode:
      z.literal(
        "NONE"
      ),
  });

export const createCustomerSchema =
  z.object({
    name:
      z
        .string()
        .trim()
        .min(2)
        .max(100),

    email:
      z
        .string()
        .trim()
        .email()
        .transform(
          (
            value
          ) =>
            value.toLowerCase()
        ),

    business:
      z.object({
        name:
          z
            .string()
            .trim()
            .min(2)
            .max(150),

        logoUrl:
          z
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
    name:
      z
        .string()
        .trim()
        .min(2)
        .max(150),

    logoUrl:
      z
        .string()
        .url()
        .nullable()
        .optional(),

    location:
      z.object({
        name:
          z
            .string()
            .trim()
            .min(
              2,
              "Location name is required"
            )
            .max(
              150
            ),

        address:
          z
            .string()
            .trim()
            .max(
              255
            )
            .nullable()
            .optional(),

        googleReviewUrl:
          z
            .string()
            .trim()
            .url(
              "Invalid Google review URL"
            )
            .refine(
              isAllowedGoogleReviewUrl,
              "Use a supported Google URL"
            ),
      }),

    subscription:
      subscriptionSetupSchema,
  });

export const customerParamsSchema =
  z.object({
    userId:
      z
        .string()
        .min(1),
  });

export type CreateCustomerInput =
  z.infer<
    typeof createCustomerSchema
  >;

export type CreateAdditionalBusinessInput =
  z.infer<
    typeof createAdditionalBusinessSchema
  >;