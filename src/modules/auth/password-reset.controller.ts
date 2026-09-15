import type {
    NextFunction,
    Request,
    Response,
  } from "express";
  
  import {
    forgotPasswordSchema,
    resetPasswordSchema,
  } from "./auth.schema.js";
  
  import {
    PasswordResetError,
    passwordResetService,
  } from "./password-reset.service.js";
  
  /*
   * =========================================================
   * Forgot password
   * =========================================================
   */
  
  export async function forgotPasswordController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const parsed =
        forgotPasswordSchema.safeParse(
          req.body
        );
  
      if (
        !parsed.success
      ) {
        return res
          .status(
            400
          )
          .json({
            success:
              false,
  
            code:
              "INVALID_PASSWORD_RESET_REQUEST",
  
            message:
              "Please provide a valid email address.",
  
            errors:
              parsed.error.flatten(),
          });
      }
  
      await passwordResetService
        .requestPasswordReset(
          parsed.data
        );
  
      /*
       * Never disclose whether the account exists.
       */
  
      res.setHeader(
        "Cache-Control",
        "no-store"
      );
  
      return res.json({
        success:
          true,
  
        message:
          "If an account exists for this email, password reset instructions have been sent.",
      });
    } catch (
      error
    ) {
      return next(
        error
      );
    }
  }
  
  /*
   * =========================================================
   * Reset password
   * =========================================================
   */
  
  export async function resetPasswordController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const parsed =
        resetPasswordSchema.safeParse(
          req.body
        );
  
      if (
        !parsed.success
      ) {
        return res
          .status(
            400
          )
          .json({
            success:
              false,
  
            code:
              "INVALID_PASSWORD_RESET_DATA",
  
            message:
              "Please check your password reset information.",
  
            errors:
              parsed.error.flatten(),
          });
      }
  
      await passwordResetService
        .resetPassword(
          parsed.data
        );
  
      res.setHeader(
        "Cache-Control",
        "no-store"
      );
  
      return res.json({
        success:
          true,
  
        message:
          "Your password has been reset successfully. Please sign in.",
      });
    } catch (
      error
    ) {
      if (
        error instanceof
          PasswordResetError
      ) {
        if (
          error.code ===
          "INVALID_OR_EXPIRED_PASSWORD_RESET"
        ) {
          return res
            .status(
              400
            )
            .json({
              success:
                false,
  
              code:
                error.code,
  
              message:
                "This password reset link is invalid or has expired.",
            });
        }
  
        if (
          error.code ===
          "PASSWORD_NOT_CHANGED"
        ) {
          return res
            .status(
              400
            )
            .json({
              success:
                false,
  
              code:
                error.code,
  
              message:
                "Your new password must be different from your current password.",
            });
        }
      }
  
      return next(
        error
      );
    }
  }