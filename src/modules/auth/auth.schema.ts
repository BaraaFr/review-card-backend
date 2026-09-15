import {
  z,
} from "zod";

/*
 * =========================================================
 * Login
 * =========================================================
 */

export const loginSchema =
  z.object({
    email: z
      .string()
      .trim()
      .email()
      .transform(
        (value) =>
          value.toLowerCase()
      ),

    password: z
      .string()
      .min(1),
  });

/*
 * =========================================================
 * Account activation
 * =========================================================
 */

export const activateAccountSchema =
  z
    .object({
      token: z
        .string()
        .min(
          32,
          "Invalid activation token"
        ),

      password: z
        .string()
        .min(
          8,
          "Password must be at least 8 characters"
        )
        .max(
          72,
          "Password must not exceed 72 characters"
        ),

      confirmPassword: z
        .string()
        .min(8),
    })
    .refine(
      (data) =>
        data.password ===
        data.confirmPassword,
      {
        path: [
          "confirmPassword",
        ],

        message:
          "Passwords do not match",
      }
    );

/*
 * =========================================================
 * Forgot password
 * =========================================================
 */

export const forgotPasswordSchema =
  z.object({
    email: z
      .string()
      .trim()
      .email(
        "Please provide a valid email address."
      )
      .transform(
        (value) =>
          value.toLowerCase()
      ),
  });

/*
 * =========================================================
 * Reset password
 * =========================================================
 */

export const resetPasswordSchema =
  z
    .object({
      token: z
        .string()
        .trim()
        .min(
          32,
          "Invalid password reset token"
        )
        .max(
          256,
          "Invalid password reset token"
        ),

      password: z
        .string()
        .min(
          8,
          "Password must be at least 8 characters"
        )
        .max(
          72,
          "Password must not exceed 72 characters"
        ),

      confirmPassword: z
        .string()
        .min(
          8,
          "Please confirm your password"
        )
        .max(72),
    })
    .refine(
      (data) =>
        data.password ===
        data.confirmPassword,
      {
        path: [
          "confirmPassword",
        ],

        message:
          "Passwords do not match",
      }
    );

/*
 * =========================================================
 * Types
 * =========================================================
 */

export type LoginInput =
  z.infer<
    typeof loginSchema
  >;

export type ActivateAccountInput =
  z.infer<
    typeof activateAccountSchema
  >;

export type ForgotPasswordInput =
  z.infer<
    typeof forgotPasswordSchema
  >;

export type ResetPasswordInput =
  z.infer<
    typeof resetPasswordSchema
  >;