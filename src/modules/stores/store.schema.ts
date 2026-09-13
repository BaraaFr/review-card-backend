import { z } from "zod";
import { isAllowedGoogleReviewUrl } from "../../utils/google-url.js";

const googleReviewUrlSchema = z
    .string()
    .trim()
    .url("Invalid Google review URL")
    .refine(
        isAllowedGoogleReviewUrl,
        "URL must be a Google review URL"
    );

export const createStoreSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Store name must be at least 2 characters")
        .max(150),

    address: z
        .string()
        .trim()
        .max(500)
        .nullable()
        .optional(),

    googleReviewUrl: googleReviewUrlSchema
        .nullable()
        .optional(),
});

export const updateStoreSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(2)
            .max(150)
            .optional(),

        address: z
            .string()
            .trim()
            .max(500)
            .nullable()
            .optional(),

        googleReviewUrl: googleReviewUrlSchema
            .nullable()
            .optional(),
    })
    .refine(
        (data) => Object.keys(data).length > 0,
        {
            message: "At least one field must be provided",
        }
    );

export type CreateStoreInput = z.infer<
    typeof createStoreSchema
>;

export type UpdateStoreInput = z.infer<
    typeof updateStoreSchema
>;