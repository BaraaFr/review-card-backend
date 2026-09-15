import { Router } from "express";

import {
  getActionCenterController,
  getCardAnalytics,
  getOverview,
  getStoreAnalytics,
  getTimeline,
  getStoreCardPerformanceController,
  getStoreEngagementSummaryController,
  getStoreEngagementPatternsController,
  downloadAnalyticsReportController,
  getLocationPerformanceController,
  getWeeklyReportController,
  getDataReportController
} from "./analytics.controller.js";

import {
  authenticate,
} from "../../middleware/auth.middleware.js";
import {
  requireFeatureAccess,
} from "../../middleware/feature-access.middleware.js";

const router = Router();

router.use(authenticate);

router.get(
  "/overview",
  requireFeatureAccess(
    "ANALYTICS"
  ),
  getOverview
);

router.get(
  "/cards",
  requireFeatureAccess(
    "ANALYTICS"
  ),
  getCardAnalytics
);

router.get(
  "/stores",
  requireFeatureAccess(
    "ANALYTICS"
  ),
  getStoreAnalytics
);

router.get(
  "/timeline",
  requireFeatureAccess(
    "ANALYTICS"
  ),
  getTimeline
);

router.get(
  "/stores/:storeId/engagement-summary",
  requireFeatureAccess(
    "ANALYTICS"
  ),
  getStoreEngagementSummaryController
);

router.get(
  "/stores/:storeId/card-performance",

  requireFeatureAccess(
    "ANALYTICS"
  ),

  getStoreCardPerformanceController
);

router.get(
  "/stores/:storeId/location-performance",

  requireFeatureAccess(
    "ANALYTICS"
  ),

  getLocationPerformanceController
);

router.get(
  "/stores/:storeId/action-center",

  requireFeatureAccess(
    "ANALYTICS"
  ),

  getActionCenterController
);

router.get(
  "/stores/:storeId/engagement-patterns",

  requireFeatureAccess(
    "ANALYTICS"
  ),

  getStoreEngagementPatternsController
);

router.get(
  "/stores/:storeId/data-report",

  requireFeatureAccess(
    "ANALYTICS"
  ),

  getDataReportController
);

router.get(
  "/stores/:storeId/weekly-report",

  requireFeatureAccess(
    "ANALYTICS"
  ),

  getWeeklyReportController
);

router.get(
  "/stores/:storeId/report.pdf",

  requireFeatureAccess(
    "ANALYTICS"
  ),

  downloadAnalyticsReportController
);

export default router;