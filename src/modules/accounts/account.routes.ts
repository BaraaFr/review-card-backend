import {
    Router,
  } from "express";
  
  import {
    getProfileController,
    updateProfileController,
    changePasswordController
  } from "./account.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
  
  /*
   * Import your EXISTING authentication middleware.
   *
   * Change only this import path/name to match your project.
   */

  
  const router =
    Router();
  
  /*
   * =========================================================
   * Account profile
   * =========================================================
   */
  
  router.get(
    "/profile",
    authenticate,
    getProfileController
  );
  
  router.patch(
    "/profile",
    authenticate,
    updateProfileController
  );

  router.patch(
    "/password",
    authenticate,
    changePasswordController
  );
  
  export default router;