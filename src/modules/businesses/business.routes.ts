import { Router } from "express";

import {
  createStoreSafely,
} from "../commercial/commercial.controller.js";

import {
  getBusiness,
  getBusinesses,
  updateBusiness,
} from "./business.controller.js";

import {
  getBusinessStores,
} from "../stores/store.controller.js";

import {
  authenticate,
} from "../../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

/*
 * List businesses.
 */
router.get(
  "/",
  getBusinesses
);

/*
 * COMMERCIAL MUTATION
 *
 * Location creation now runs through:
 *
 * - business ownership/access validation
 * - plan capacity validation
 * - Serializable transaction
 * - Idempotency-Key
 * - AuditEvent
 */
router.post(
  "/:businessId/stores",
  createStoreSafely
);

/*
 * Normal read operation.
 */
router.get(
  "/:businessId/stores",
  getBusinessStores
);

/*
 * Business detail.
 */
router.get(
  "/:id",
  getBusiness
);

/*
 * Normal business metadata update.
 */
router.patch(
  "/:id",
  updateBusiness
);

export default router;