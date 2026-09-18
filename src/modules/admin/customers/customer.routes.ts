import {
  createAdditionalBusinessSafely,
} from "../../commercial/commercial.controller.js";

import {
  Router,
} from "express";

import {
  authenticate,
} from "../../../middleware/auth.middleware.js";

import {
  authorize,
} from "../../../middleware/role.middleware.js";

import {
  createCustomer,
  disableCustomer,
  enableCustomer,
  getCustomer,
  listCustomers,
  resendActivation,
} from "./customer.controller.js";

const router =
  Router();

router.use(
  authenticate
);

router.use(
  authorize(
    "SUPER_ADMIN"
  )
);

router.get(
  "/",
  listCustomers
);

router.get(
  "/:userId",
  getCustomer
);

/*
 * Customer creation remains on
 * the existing onboarding service.
 *
 * It now always creates:
 *
 * user + business + invitation
 *
 * but NO subscription.
 */
router.post(
  "/",
  createCustomer
);

router.post(
  "/:userId/resend-activation",
  resendActivation
);

/*
 * COMMERCIAL MUTATION
 *
 * Creates:
 * business + first store
 *
 * Protected by:
 * Idempotency-Key
 * Serializable transaction
 * AuditEvent
 */
router.post(
  "/:userId/businesses",
  createAdditionalBusinessSafely
);

router.patch(
  "/:userId/disable",
  disableCustomer
);

router.patch(
  "/:userId/enable",
  enableCustomer
);

export default router;