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
    getOperationalHealth,
  } from "./operations.controller.js";
  
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
    "/health",
    getOperationalHealth
  );
  
  export default router;