import { Router } from "express";

import {
  assignCard,
  createCard,
  deliverCard,
  getCard,
  getCardQr,
  getCards,
  unassignCard,
  updateCard,
} from "./card.controller.js";

import { authenticate } from "../../middleware/auth.middleware.js";
import { authorize } from "../../middleware/role.middleware.js";

const router = Router();

router.use(authenticate);

// Only YOU create inventory.
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

// Only YOU assign physical inventory.
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

router.post(
  "/:id/deliver",
  authenticate,
  authorize("SUPER_ADMIN"),
  deliverCard
);

export default router;