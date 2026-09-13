import { Router } from "express";

import {
  deleteStore,
  getStore,
  updateStore,
} from "./store.controller.js";

import { authenticate } from "../../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/:id", getStore);

router.patch("/:id", updateStore);

router.delete("/:id", deleteStore);

export default router;