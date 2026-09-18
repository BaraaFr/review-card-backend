import { Router } from "express";

import {
  removeStoreSafely,
} from "../commercial/commercial.controller.js";

import {
  getStore,
  updateStore,
} from "./store.controller.js";

import {
  authenticate,
} from "../../middleware/auth.middleware.js";

const router =
  Router();

router.use(
  authenticate
);

/*
 * Normal read.
 */
router.get(
  "/:id",
  getStore
);

/*
 * Normal metadata update.
 *
 * Name/address/Google URL editing
 * remains on the existing flow.
 */
router.patch(
  "/:id",
  updateStore
);

/*
 * COMMERCIAL MUTATION
 *
 * Hard deletion is only allowed when
 * there are no cards and no interaction
 * history attached to this location.
 */
router.delete(
  "/:id",
  removeStoreSafely
);

export default router;