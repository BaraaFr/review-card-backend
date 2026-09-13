import { clearAuthCookies } from "../../utils/auth-cookie.js";
import type {
    Request,
    Response,
  } from "express";
  
  import {
    ZodError,
  } from "zod";
  
  import {
    changePasswordSchema,
    updateProfileSchema,
  } from "./account.schema.js";
  
  import {
    getAccountProfile,
    updateAccountProfile,
    changeAccountPassword,
  } from "./account.service.js";
 
  /*
   * =========================================================
   * Authenticated request
   * =========================================================
   *
   * If you already have an AuthRequest / AuthenticatedRequest
   * type in your project, IMPORT that instead.
   *
   * The important thing is:
   *
   * req.user.id
   */
  
  type AuthenticatedRequest =
    Request & {
      user?: {
        id:
          string;
  
        email?:
          string;
  
        role?:
          string;
      };
    };
  
  /*
   * =========================================================
   * Get profile
   * =========================================================
   */
  
  export async function getProfileController(
    req: AuthenticatedRequest,
    res: Response
  ) {
    try {
      const userId =
        req.user?.id;
  
      if (
        !userId
      ) {
        return res
          .status(
            401
          )
          .json({
            message:
              "Unauthorized.",
          });
      }
  
      const profile =
        await getAccountProfile(
          userId
        );
  
      return res.json({
        user:
          profile,
      });
    } catch (
      error
    ) {
      if (
        error instanceof
          Error &&
        error.message ===
          "USER_NOT_FOUND"
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "User not found.",
          });
      }
  
      console.error(
        "Failed to get account profile:",
        error
      );
  
      return res
        .status(
          500
        )
        .json({
          message:
            "Failed to load profile.",
        });
    }
  }
  
  /*
   * =========================================================
   * Update profile
   * =========================================================
   */
  
  export async function updateProfileController(
    req: AuthenticatedRequest,
    res: Response
  ) {
    try {
      const userId =
        req.user?.id;
  
      if (
        !userId
      ) {
        return res
          .status(
            401
          )
          .json({
            message:
              "Unauthorized.",
          });
      }
  
      const input =
        updateProfileSchema.parse(
          req.body
        );
  
      const profile =
        await updateAccountProfile(
          userId,
          input
        );
  
      return res.json({
        message:
          "Profile updated successfully.",
  
        user:
          profile,
      });
    } catch (
      error
    ) {
      if (
        error instanceof
        ZodError
      ) {
        return res
          .status(
            400
          )
          .json({
            message:
              "Invalid profile data.",
  
            errors:
              error.flatten()
                .fieldErrors,
          });
      }
  
      if (
        error instanceof
          Error &&
        error.message ===
          "USER_NOT_FOUND"
      ) {
        return res
          .status(
            404
          )
          .json({
            message:
              "User not found.",
          });
      }
  
      console.error(
        "Failed to update account profile:",
        error
      );
  
      return res
        .status(
          500
        )
        .json({
          message:
            "Failed to update profile.",
        });
    }
  }

  /*
 * =========================================================
 * Change password
 * =========================================================
 */

export async function changePasswordController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId =
      req.user?.id;

    if (
      !userId
    ) {
      return res
        .status(
          401
        )
        .json({
          message:
            "Unauthorized.",
        });
    }

    const input =
      changePasswordSchema.parse(
        req.body
      );

    await changeAccountPassword(
      userId,
      input
    );

    clearAuthCookies(res);

    return res.json({
      message:
        "Password changed successfully. Please log in again.",
    });
  } catch (
    error
  ) {
    /*
     * =====================================================
     * Validation
     * =====================================================
     */

    if (
      error instanceof
      ZodError
    ) {
      return res
        .status(
          400
        )
        .json({
          message:
            "Invalid password data.",

          errors:
            error.flatten()
              .fieldErrors,
        });
    }

    /*
     * =====================================================
     * User missing
     * =====================================================
     */

    if (
      error instanceof
        Error &&
      error.message ===
        "USER_NOT_FOUND"
    ) {
      return res
        .status(
          404
        )
        .json({
          message:
            "User not found.",
        });
    }

    /*
     * =====================================================
     * Wrong current password
     * =====================================================
     */

    if (
      error instanceof
        Error &&
      error.message ===
        "CURRENT_PASSWORD_INVALID"
    ) {
      return res
        .status(
          400
        )
        .json({
          message:
            "Your current password is incorrect.",

          code:
            "CURRENT_PASSWORD_INVALID",
        });
    }

    /*
     * =====================================================
     * Same password
     * =====================================================
     */

    if (
      error instanceof
        Error &&
      error.message ===
        "PASSWORD_NOT_CHANGED"
    ) {
      return res
        .status(
          400
        )
        .json({
          message:
            "Your new password must be different from your current password.",

          code:
            "PASSWORD_NOT_CHANGED",
        });
    }

    console.error(
      "Failed to change password:",
      error
    );

    return res
      .status(
        500
      )
      .json({
        message:
          "Failed to change password.",
      });
  }
}