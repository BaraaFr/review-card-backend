import {
  Router,
} from "express";
import { loginRateLimit } from "./login-rate-limit.js";

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

const router =
  Router();

/*
 * Public authentication routes
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
 * Refresh does NOT require
 * a valid access token.
 */
router.post(
  "/refresh",
  refreshSessionController
);

/*
 * Logout also doesn't require
 * a valid access token.
 *
 * The refresh cookie identifies
 * the current persistent session.
 */
router.post(
  "/logout",
  logoutController
);

/*
 * Requires valid access JWT.
 *
 * Frontend interceptor will refresh
 * automatically if it has expired.
 */
router.get(
  "/me",
  authenticate,
  meController
);

export default router;
