import {
  Router,
} from "express";

import {
  redirectCardController,
} from "./redirect.controller.js";

const router =
  Router();

/*
 * Public route.
 *
 * No authentication.
 *
 * NFC:
 *
 * /r/CODE?source=nfc
 *
 * QR:
 *
 * /r/CODE?source=qr
 */
router.get(
  "/:code",
  redirectCardController
);

export default router;