import {
  Router,
} from "express";

import {
  sharedRateLimit,
} from "../../middleware/shared-rate-limit.js";

import {
  loginRateLimit,
} from "./login-rate-limit.js";

import {
  authenticate,
} from "../../middleware/auth.middleware.js";

import {
  activateAccountController,
  loginController,
  meController,
} from "./auth.controller.js";

import {
  logoutController,
  refreshSessionController,
} from "./auth-session.controller.js";

import {
  forgotPasswordController,
  resetPasswordController,
} from "./password-reset.controller.js";

import {
  forgotPasswordRateLimit,
  resetPasswordRateLimit,
} from "./password-reset-rate-limit.js";

const router =
  Router();

/*
 * =========================================================
 * Login
 * =========================================================
 *
 * Custom Redis limiter:
 *
 * - IP budget
 * - account/email budget
 */
router.post(
  "/login",

  loginRateLimit,

  loginController
);

/*
 * =========================================================
 * Account activation
 * =========================================================
 *
 * Activation tokens are strong random secrets,
 * but this still prevents brute-force traffic.
 */
router.post(
  "/activate-account",

  sharedRateLimit(
    "activation",
    20,
    15 * 60 * 1000
  ),

  activateAccountController
);

/*
 * =========================================================
 * Password recovery
 * =========================================================
 */

router.post(
  "/forgot-password",

  forgotPasswordRateLimit,

  forgotPasswordController
);

router.post(
  "/reset-password",

  resetPasswordRateLimit,

  resetPasswordController
);

/*
 * =========================================================
 * Refresh
 * =========================================================
 *
 * Refresh does not require a valid access JWT.
 *
 * Redis prevents a client from hammering
 * refresh-token rotation.
 */
router.post(
  "/refresh",

  sharedRateLimit(
    "refresh",
    120,
    15 * 60 * 1000
  ),

  refreshSessionController
);

/*
 * =========================================================
 * Logout
 * =========================================================
 */

router.post(
  "/logout",

  logoutController
);

/*
 * =========================================================
 * Current user
 * =========================================================
 */

router.get(
  "/me",

  authenticate,

  meController
);

export default router;