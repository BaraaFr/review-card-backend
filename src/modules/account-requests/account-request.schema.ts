import {
  z,
} from "zod";

export const createAccountRequestSchema =
  z.object({
    ownerName:
      z
        .string()
        .trim()
        .min(
          2,
          "Owner name is required."
        )
        .max(
          80,
          "Owner name is too long."
        ),


    email: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .max(254, "Email is too long.")
      .toLowerCase(),

    phone:
      z
        .string()
        .trim()
        .min(
          7,
          "Phone number is required."
        )
        .max(
          30,
          "Phone number is too long."
        )
        .regex(
          /^\+?[0-9\s\-()]+$/,
          "Please enter a valid phone number."
        ),

    shopName:
      z
        .string()
        .trim()
        .min(
          2,
          "Shop name is required."
        )
        .max(
          120,
          "Shop name is too long."
        ),

    businessType:
      z
        .string()
        .trim()
        .max(
          80
        )
        .optional()
        .nullable(),

    requestedCards:
      z
        .number()
        .int()
        .min(
          1,
          "At least one card is required."
        )
        .max(
          500,
          "Please contact ValYou for larger orders."
        ),

    message:
      z
        .string()
        .trim()
        .max(
          1000,
          "Message is too long."
        )
        .optional()
        .nullable(),

    /*
     * Honeypot field.
     *
     * Real users never see this.
     * Bots often fill it.
     */
    website:
      z
        .string()
        .max(200)
        .optional()
        .default(""),
  });

export const adminAccountRequestQuerySchema =
  z.object({
    status:
      z.enum([
        "NEW",
        "CONTACTED",
        "QUALIFIED",
        "CONVERTED",
        "CLOSED",
      ])
        .optional(),

    search:
      z
        .string()
        .trim()
        .max(100)
        .optional(),

    page:
      z.coerce
        .number()
        .int()
        .min(1)
        .default(1),

    perPage:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20),
  });

export const updateAccountRequestSchema =
  z
    .object({
      status:
        z.enum([
          "NEW",
          "CONTACTED",
          "QUALIFIED",
          "CONVERTED",
          "CLOSED",
        ])
          .optional(),

      adminNote:
        z
          .string()
          .trim()
          .max(1000)
          .nullable()
          .optional(),
    })
    .refine(
      (
        data
      ) =>
        data.status !==
        undefined ||
        data.adminNote !==
        undefined,
      {
        message:
          "At least one field must be updated.",
      }
    );