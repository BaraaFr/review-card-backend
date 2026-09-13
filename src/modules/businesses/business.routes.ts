import { Router } from "express";

import {
  getBusiness,
  getBusinesses,
  updateBusiness,
} from "./business.controller.js";

import {
  createStore,
  getBusinessStores,
} from "../stores/store.controller.js";

import { authenticate } from "../../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

// router.post("/", createBusiness);

router.get("/", getBusinesses);

router.post(
  "/:businessId/stores",
  createStore
);

router.get(
  "/:businessId/stores",
  getBusinessStores
);

router.get("/:id", getBusiness);

router.patch("/:id", updateBusiness);

export default router;