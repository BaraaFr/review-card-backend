import {
  Router,
} from "express";

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
 * Public authentication routes
 * =========================================================
 */

router.post(
  "/login",
  loginRateLimit,
  loginController
);

router.post(
  "/activate-account",
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
 * Session refresh
 * =========================================================
 *
 * Refresh does NOT require a valid access token.
 */

router.post(
  "/refresh",
  refreshSessionController
);

/*
 * =========================================================
 * Logout
 * =========================================================
 *
 * The refresh cookie identifies the session.
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