import { Router } from "express";

import authRoutes from "../modules/auth/auth.routes.js";
import businessRoutes from "../modules/businesses/business.routes.js";
import storeRoutes from "../modules/stores/store.routes.js";
import cardRoutes from "../modules/cards/card.routes.js";
import analyticsRoutes from "../modules/analytics/analytics.routes.js";
import subscriptionRoutes from "../modules/subscriptions/subscription.routes.js";
import weeklyReportRoutes from "../modules/weekly-reports/weekly-report-settings.routes.js";

import adminCustomerRoutes from "../modules/admin/customers/customer.routes.js";
import adminSubscriptionRoutes from "../modules/admin/subscriptions/subscription.routes.js";
import adminOverviewRoutes from "../modules/admin/overview/overview.routes.js";
import googleRoutes from "../modules/google/google.routes.js";
import accountRequestRoutes from "../modules/account-requests/account-request.routes.js";
import accountRoutes from "../modules/accounts/account.routes.js";
import supportRoutes from "../modules/supports/support.routes.js";


const router = Router();

router.use(
  "/auth",
  authRoutes
);

router.use(
  "/businesses",
  businessRoutes
);

router.use(
  "/stores",
  storeRoutes
);

router.use(
  "/cards",
  cardRoutes
);

router.use(
  "/analytics",
  analyticsRoutes
);

router.use(
  "/subscriptions",
  subscriptionRoutes
);

router.use(
  "/weekly-reports",
  weeklyReportRoutes
);

router.use(
  "/admin/customers",
  adminCustomerRoutes
);

router.use(
  "/admin/subscriptions",
  adminSubscriptionRoutes
);

router.use(
  "/admin/overview",
  adminOverviewRoutes
);

router.use(
  "/google",
  googleRoutes
);

router.use(
  accountRequestRoutes
);

router.use(
  "/account",
  accountRoutes
);

router.use(
  "/support",
  supportRoutes
);


export default router;