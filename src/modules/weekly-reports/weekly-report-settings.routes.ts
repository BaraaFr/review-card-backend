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
    sendTestWeeklyReportController
);

export default router;