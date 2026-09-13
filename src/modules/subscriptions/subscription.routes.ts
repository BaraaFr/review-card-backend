import { Router } from "express";

import {
  createSubscription,
  getCurrentSubscription,
  getSubscriptionUsage,
  updateSubscription,
} from "./subscription.controller.js";

import {
  authenticate,
} from "../../middleware/auth.middleware.js";

import {
  authorize,
} from "../../middleware/role.middleware.js";

const router = Router();

router.use(authenticate);

/*
 * Restaurant owner + admin
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
 * Only you can control subscriptions
 * in V1.
 */
router.post(
  "/businesses/:businessId",
  authorize("SUPER_ADMIN"),
  createSubscription
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN"),
  updateSubscription
);

export default router;