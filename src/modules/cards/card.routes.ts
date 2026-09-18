import { Router } from "express";

import {
  createCardSafely,
  assignCardSafely,
  unassignCardSafely,
  deliverCardSafely,
} from "../commercial/commercial.controller.js";

import {
  getCard,
  getCardQr,
  getCards,
  updateCard,
} from "./card.controller.js";

import {
  authenticate,
} from "../../middleware/auth.middleware.js";

import {
  authorize,
} from "../../middleware/role.middleware.js";

const router = Router();

router.use(authenticate);

/*
 * Inventory creation.
 *
 * Now protected by:
 * - SUPER_ADMIN authorization
 * - Idempotency-Key
 * - Serializable transaction
 * - AuditEvent
 */
router.post(
  "/",
  authorize("SUPER_ADMIN"),
  createCardSafely
);

/*
 * Reads stay on the existing
 * card controller/service.
 */
router.get(
  "/",
  getCards
);

router.get(
  "/:id/qr",
  getCardQr
);

router.get(
  "/:id",
  getCard
);

/*
 * Label editing is not a financial
 * or provisioning mutation, so we
 * leave the existing implementation.
 */
router.patch(
  "/:id",
  updateCard
);

/*
 * Physical inventory assignment.
 */
router.post(
  "/:id/assign",
  authorize("SUPER_ADMIN"),
  assignCardSafely
);

/*
 * Physical inventory removal.
 */
router.post(
  "/:id/unassign",
  authorize("SUPER_ADMIN"),
  unassignCardSafely
);

/*
 * Payment + delivery.
 *
 * Migrated in Phase 1B.1.
 */
router.post(
  "/:id/deliver",
  authorize("SUPER_ADMIN"),
  deliverCardSafely
);

export default router;