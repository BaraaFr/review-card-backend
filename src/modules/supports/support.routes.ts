import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { getTawkIdentity } from "./support.controller.js";

const router = Router();

router.get(
    "/tawk-identity",
    authenticate,
    getTawkIdentity
);

export default router;