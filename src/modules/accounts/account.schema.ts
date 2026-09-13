import {
  z,
} from "zod";

/*
 * =========================================================
 * Update profile
 * =========================================================
 */

export const updateProfileSchema =
  z.object({
    name:
      z
        .string()
        .trim()
        .min(
          2,
          "Name must contain at least 2 characters."
        )
        .max(
          100,
          "Name is too long."
        ),

    phoneNumber:
      z
        .string()
        .trim()
        .max(
          30,
          "Phone number is too long."
        )
        .nullable()
        .optional()
        .transform(
          (
            value
          ) => {
            if (
              value ===
                undefined ||
              value ===
                null ||
              value ===
                ""
            ) {
              return null;
            }

            return value;
          }
        ),
  });

export type UpdateProfileInput =
  z.infer<
    typeof updateProfileSchema
  >;

/*
 * =========================================================
 * Change password
 * =========================================================
 */

export const changePasswordSchema =
  z
    .object({
      currentPassword:
        z
          .string()
          .min(
            1,
            "Current password is required."
          ),

      newPassword:
        z
          .string()
          .min(
            8,
            "New password must contain at least 8 characters."
          )
          .max(
            128,
            "Password is too long."
          ),

      confirmPassword:
        z
          .string()
          .min(
            1,
            "Please confirm your new password."
          ),
    })
    .superRefine(
      (
        data,
        ctx
      ) => {
        /*
         * New + confirm must match.
         */

        if (
          data.newPassword !==
          data.confirmPassword
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              "confirmPassword",
            ],

            message:
              "Passwords do not match.",
          });
        }

        /*
         * Don't allow the new password
         * to be exactly the current one.
         */

        if (
          data.currentPassword ===
          data.newPassword
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              "newPassword",
            ],

            message:
              "New password must be different from your current password.",
          });
        }
      }
    );

export type ChangePasswordInput =
  z.infer<
    typeof changePasswordSchema
  >;