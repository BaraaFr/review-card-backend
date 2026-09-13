import {
  z,
} from "zod";

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
        .max(72),

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

export type LoginInput =
  z.infer<
    typeof loginSchema
  >;

export type ActivateAccountInput =
  z.infer<
    typeof activateAccountSchema
  >;