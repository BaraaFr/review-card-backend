import {
    Router,
} from "express";

import {
    authenticate,
} from "../../middleware/auth.middleware.js";

import {
    getWeeklyReportSettingsController,
    sendTestWeeklyReportController,
    updateWeeklyReportSettingsController,
} from "./weekly-report-settings.controller.js";
import { sharedRateLimit } from "../../middleware/shared-rate-limit.js";

const router =
    Router();

router.use(
    authenticate
);

router.get(
    "/:businessId/settings",
    getWeeklyReportSettingsController
);

router.patch(
    "/:businessId/settings",
    updateWeeklyReportSettingsController
);

router.post(
    "/:businessId/settings/test",
    sharedRateLimit(
        "test-email",
    
        3,
    
        60 *
          60 *
          1000,
    
        (
          req
        ) =>
          req.user!.id
      ),
    sendTestWeeklyReportController
);

export default router;