import {
    Router,
  } from "express";
  
  import {
    authenticate,
  } from "../../middleware/auth.middleware.js";
  
  import {
    authorize,
  } from "../../middleware/role.middleware.js";
  
  import {
    publicAccountRequestRateLimit,
  } from "./account-request-rate-limit.js";
  
  import {
    createAccountRequestController,
    getAdminAccountRequestsController,
    updateAccountRequestController,
  } from "./account-request.controller.js";
  
  const router =
    Router();
  
  /*
   * Public landing-page request.
   */
  router.post(
    "/public/account-requests",
  
    publicAccountRequestRateLimit,
  
    createAccountRequestController
  );
  
  /*
   * Super Admin only.
   */
  router.get(
    "/admin/account-requests",
  
    authenticate,
  
    authorize(
      "SUPER_ADMIN"
    ),
  
    getAdminAccountRequestsController
  );
  
  router.patch(
    "/admin/account-requests/:requestId",
  
    authenticate,
  
    authorize(
      "SUPER_ADMIN"
    ),
  
    updateAccountRequestController
  );
  
  export default router;