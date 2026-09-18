import { Router } from "express";

import {
  assignCard,
  createCard,
  getCard,
  getCardQr,
  getCards,
  unassignCard,
  updateCard,
} from "./card.controller.js";

import {
  deliverCardSafely,
} from "../commercial/commercial.controller.js";

import {
  authenticate,
} from "../../middleware/auth.middleware.js";

import {
  authorize,
} from "../../middleware/role.middleware.js";

const router = Router();

router.use(authenticate);

/*
 * Card creation still uses the old flow
 * for now.
 *
 * We will migrate it after delivery has
 * been fully verified.
 */
router.post(
  "/",
  authorize("SUPER_ADMIN"),
  createCard
);

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

router.patch(
  "/:id",
  updateCard
);

/*
 * Assignment still uses the old flow
 * for this checkpoint.
 */
router.post(
  "/:id/assign",
  authorize("SUPER_ADMIN"),
  assignCard
);

router.post(
  "/:id/unassign",
  authorize("SUPER_ADMIN"),
  unassignCard
);

/*
 * FIRST commercial mutation migrated:
 *
 * - requires Idempotency-Key
 * - requires receiptReference
 * - creates PaymentRecord
 * - creates AuditEvent
 * - stores idempotent response
 * - protects against duplicate delivery/payment
 */
router.post(
  "/:id/deliver",
  authorize("SUPER_ADMIN"),
  deliverCardSafely
);

export default router;