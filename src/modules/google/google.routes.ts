import {
    Router,
} from "express";

import {
    authenticate,
} from "../../middleware/auth.middleware.js";

import {
    requireFeatureAccess,
} from "../../middleware/feature-access.middleware.js";

import {
    confirmGooglePlaceController,
    connectGooglePlaceController,
    disconnectGooglePlaceController,
    getGoogleReputationController,
} from "./google.controller.js";

import {
    googleReputationRateLimit,
} from "./google-reputation-rate-limit.js";

const router =
    Router();

/*
 * Start Google connection.
 *
 * This can:
 *
 * CONNECT immediately
 *
 * OR
 *
 * return candidates requiring
 * owner confirmation.
 */
router.post(
    "/stores/:storeId/connect",

    authenticate,

    connectGooglePlaceController
);

/*
 * Confirm one candidate returned
 * by /connect.
 */
router.post(
    "/stores/:storeId/confirm",

    authenticate,

    confirmGooglePlaceController
);

/*
 * Disconnect Google Reputation.
 *
 * IMPORTANT:
 *
 * googleReviewUrl remains untouched.
 */
router.delete(
    "/stores/:storeId/connection",
    authenticate,
    disconnectGooglePlaceController
);



/*
 * Paid reputation feature.
 */
router.get(
    "/stores/:storeId/reputation",

    authenticate,

    googleReputationRateLimit,

    requireFeatureAccess(
        "ANALYTICS"
    ),

    getGoogleReputationController
);

export default router;