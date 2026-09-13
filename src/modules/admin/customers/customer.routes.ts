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
    createAdditionalBusiness,
    createCustomer,
    disableCustomer,
    enableCustomer,
    getCustomer,
    listCustomers,
    resendActivation,
  } from "./customer.controller.js";
  
  const router =
    Router();
  
  router.use(authenticate);
  
  router.use(
    authorize("SUPER_ADMIN")
  );
  
  router.get(
    "/",
    listCustomers
  );
  
  router.get(
    "/:userId",
    getCustomer
  );
  
  router.post(
    "/",
    createCustomer
  );
  
  router.post(
    "/:userId/resend-activation",
    resendActivation
  );
  
  router.post(
    "/:userId/businesses",
    createAdditionalBusiness
  );
  
  router.patch(
    "/:userId/disable",
    disableCustomer
  );
  
  router.patch(
    "/:userId/enable",
    enableCustomer
  );
  
  export default router;