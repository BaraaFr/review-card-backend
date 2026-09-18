import {
  Router,
} from "express";

import {
  getCurrentSubscription,
  getSubscriptionUsage,
} from "./subscription.controller.js";

import {
  activatePaidSafely,
  changeStatusSafely,
  getPaymentHistory,
  rejectLegacySubscription,
  startTrialSafely,
} from "../commercial/commercial.controller.js";

import {
  authenticate,
} from "../../middleware/auth.middleware.js";

import {
  authorize,
} from "../../middleware/role.middleware.js";

const router =
  Router();

router.use(
  authenticate
);

/*
 * READS
 *
 * Business owner + SuperAdmin can
 * read the subscription for businesses
 * they have access to.
 */
router.get(
  "/businesses/:businessId/current",
  getCurrentSubscription
);

router.get(
  "/businesses/:businessId/usage",
  getSubscriptionUsage
);

/*
 * LEGACY GENERIC CREATE
 *
 * Do not allow an admin to create an
 * arbitrary ACTIVE/TRIAL subscription
 * without recording how access was
 * commercially provisioned.
 */
router.post(
  "/businesses/:businessId",
  authorize(
    "SUPER_ADMIN"
  ),
  rejectLegacySubscription
);

/*
 * STATUS CONTROL
 *
 * Only administrative terminal /
 * problem statuses are allowed through
 * the new commercial handler.
 *
 * Requires:
 * {
 *   status:
 *     "PAST_DUE" |
 *     "CANCELED" |
 *     "EXPIRED",
 *   reason: string
 * }
 *
 * and Idempotency-Key.
 */
router.patch(
  "/:id",
  authorize(
    "SUPER_ADMIN"
  ),
  changeStatusSafely
);

/*
 * ONE-TIME TRIAL
 */
router.post(
  "/businesses/:businessId/start-trial",
  authorize(
    "SUPER_ADMIN"
  ),
  startTrialSafely
);

/*
 * PAID SUBSCRIPTION
 */
router.post(
  "/businesses/:businessId/activate-paid",
  authorize(
    "SUPER_ADMIN"
  ),
  activatePaidSafely
);

/*
 * IMMUTABLE PAYMENT HISTORY
 */
router.get(
  "/businesses/:businessId/payments",
  authorize(
    "SUPER_ADMIN"
  ),
  getPaymentHistory
);

export default router;