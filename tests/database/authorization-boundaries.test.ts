import "dotenv/config";

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const {
    getActionCenter,
    getStoreCardPerformance,
    getStoreEngagementSummary,
    getStoreEngagementPatterns,
    getLocationPerformance,
    getFilteredAnalyticsReport,
    getDataReport,
    getWeeklyReport,
} =
    await import(
        "../../src/modules/analytics/analytics.service.js"
    );

const {
    resolveAnalyticsRangeQuery,
} =
    await import(
        "../../src/modules/analytics/utils/analytics-range.util.js"
    );
const url =
    process.env.TEST_DATABASE_URL;

if (
    !url ||
    !new URL(url).pathname.endsWith(
        "_test"
    )
) {
    throw new Error(
        "TEST_DATABASE_URL must point to an isolated _test database."
    );
}

process.env.DATABASE_URL =
    url;

process.env.NODE_ENV =
    "test";

process.env.JWT_SECRET ??=
    "test-secret-012345678901234567890123456789";

process.env.ANALYTICS_SALT ??=
    "test-salt-012345678901234567890123456789";

process.env.FRONTEND_URL ??=
    "http://localhost:3000";

process.env.PUBLIC_API_URL ??=
    "http://localhost:4000";

process.env.GOOGLE_PLACES_API_KEY ??=
    "unused-test-key";

const {
    prisma,
} =
    await import(
        "../../src/lib/prisma.js"
    );

const {
    businessService,
} =
    await import(
        "../../src/modules/businesses/business.service.js"
    );

const {
    storeService,
} =
    await import(
        "../../src/modules/stores/store.service.js"
    );

const {
    cardService,
} =
    await import(
        "../../src/modules/cards/card.service.js"
    );

const {
    subscriptionService,
} =
    await import(
        "../../src/modules/subscriptions/subscription.service.js"
    );

const {
    getWeeklyReportSettings,
    updateWeeklyReportSettings,
    sendTestWeeklyReport,
} =
    await import(
        "../../src/modules/weekly-reports/weekly-report.settings.js"
    );

const {
    connectGooglePlace,
    disconnectGooglePlace,
    getStoreGoogleReputation,
} =
    await import(
        "../../src/modules/google/google.service.js"
    );

const {
    requireFeatureAccess,
} =
    await import(
        "../../src/middleware/feature-access.middleware.js"
    );

function response() {
    return {
        statusCode:
            200,

        body:
            undefined as unknown,

        status(
            value: number
        ) {
            this.statusCode =
                value;

            return this;
        },

        json(
            value: unknown
        ) {
            this.body =
                value;

            return this;
        },
    };
}

function hasErrorMessage(
    expected:
        string
) {
    return (
        error:
            unknown
    ) => {
        return (
            error instanceof
            Error &&
            error.message ===
            expected
        );
    };
}

test(
    "business owners cannot access or mutate another owner's resources",

    async () => {
        const suffix =
            randomUUID();

        const [
            ownerA,
            ownerB,
        ] =
            await Promise.all([
                prisma.user.create({
                    data: {
                        name:
                            "Owner A",

                        email:
                            `owner-a-${suffix}@example.invalid`,

                        status:
                            "ACTIVE",
                    },
                }),

                prisma.user.create({
                    data: {
                        name:
                            "Owner B",

                        email:
                            `owner-b-${suffix}@example.invalid`,

                        status:
                            "ACTIVE",
                    },
                }),
            ]);

        const [
            businessA,
            businessB,
        ] =
            await Promise.all([
                prisma.business.create({
                    data: {
                        name:
                            "Business A",

                        ownerId:
                            ownerA.id,
                    },
                }),

                prisma.business.create({
                    data: {
                        name:
                            "Business B",

                        ownerId:
                            ownerB.id,
                    },
                }),
            ]);

        const [
            storeA,
            storeB,
        ] =
            await Promise.all([
                prisma.store.create({
                    data: {
                        name:
                            "Store A",

                        businessId:
                            businessA.id,

                        googleReviewUrl:
                            "https://www.google.com/maps",
                    },
                }),

                prisma.store.create({
                    data: {
                        name:
                            "Store B",

                        businessId:
                            businessB.id,

                        googleReviewUrl:
                            "https://www.google.com/maps",
                    },
                }),
            ]);

        const cardB =
            await prisma.card.create({
                data: {
                    code:
                        randomUUID(),

                    status:
                        "ACTIVE",

                    storeId:
                        storeB.id,
                },
            });

        const now =
            new Date();

        /*
         * Business A requires a usable
         * subscription so we can also prove
         * legitimate analytics access succeeds.
         */
        await prisma.subscription.create({
            data: {
                businessId:
                    businessA.id,

                plan:
                    "STARTER",

                status:
                    "ACTIVE",

                startsAt:
                    new Date(
                        now.getTime() -
                        24 *
                        60 *
                        60 *
                        1000
                    ),

                expiresAt:
                    new Date(
                        now.getTime() +
                        30 *
                        24 *
                        60 *
                        60 *
                        1000
                    ),
            },
        });

        const actorA = {
            id:
                ownerA.id,

            role:
                "BUSINESS_OWNER" as const,
        };

        try {
            /*
             * ==================================================
             * BUSINESS
             * ==================================================
             */

            const foreignBusiness =
                await businessService.findById(
                    actorA,
                    businessB.id
                );

            assert.equal(
                foreignBusiness,
                null
            );

            await assert.rejects(
                businessService.update(
                    actorA,
                    businessB.id,
                    {
                        name:
                            "Unauthorized update",
                    }
                ),

                hasErrorMessage(
                    "BUSINESS_NOT_FOUND"
                )
            );

            /*
             * ==================================================
             * STORE
             * ==================================================
             */

            const foreignStore =
                await storeService.findById(
                    actorA,
                    storeB.id
                );

            assert.equal(
                foreignStore,
                null
            );

            await assert.rejects(
                storeService.update(
                    actorA,
                    storeB.id,
                    {
                        name:
                            "Unauthorized update",
                    }
                ),

                hasErrorMessage(
                    "STORE_NOT_FOUND"
                )
            );

            await assert.rejects(
                storeService.remove(
                    actorA,
                    storeB.id
                ),

                hasErrorMessage(
                    "STORE_NOT_FOUND"
                )
            );

            /*
             * ==================================================
             * CARD
             * ==================================================
             */

            const foreignCard =
                await cardService.findById(
                    actorA,
                    cardB.id
                );

            assert.equal(
                foreignCard,
                null
            );

            await assert.rejects(
                cardService.update(
                    actorA,
                    cardB.id,
                    {
                        label:
                            "Unauthorized label",
                    }
                ),

                hasErrorMessage(
                    "CARD_NOT_FOUND"
                )
            );

            /*
             * ==================================================
             * SUBSCRIPTION
             * ==================================================
             */

            await assert.rejects(
                subscriptionService.getCurrent(
                    actorA,
                    businessB.id
                ),

                hasErrorMessage(
                    "BUSINESS_NOT_FOUND"
                )
            );

            await assert.rejects(
                subscriptionService.getUsage(
                    actorA,
                    businessB.id
                ),

                hasErrorMessage(
                    "BUSINESS_NOT_FOUND"
                )
            );

            /*
             * ==================================================
             * WEEKLY REPORT SETTINGS
             * ==================================================
             */

            await assert.rejects(
                getWeeklyReportSettings(
                    businessB.id,
                    actorA
                ),

                hasErrorMessage(
                    "BUSINESS_NOT_FOUND"
                )
            );

            await assert.rejects(
                updateWeeklyReportSettings(
                    businessB.id,
                    actorA,
                    {
                        enabled:
                            true,
                    }
                ),

                hasErrorMessage(
                    "BUSINESS_NOT_FOUND"
                )
            );

            await assert.rejects(
                sendTestWeeklyReport(
                    businessB.id,
                    actorA
                ),

                hasErrorMessage(
                    "BUSINESS_NOT_FOUND"
                )
            );

            /*
             * ==================================================
             * GOOGLE
             * ==================================================
             *
             * These must fail BEFORE an external
             * Google request is attempted.
             */

            await assert.rejects(
                connectGooglePlace(
                    storeB.id,
                    actorA
                ),

                hasErrorMessage(
                    "FORBIDDEN"
                )
            );

            await assert.rejects(
                disconnectGooglePlace(
                    storeB.id,
                    actorA
                ),

                hasErrorMessage(
                    "FORBIDDEN"
                )
            );

            await assert.rejects(
                getStoreGoogleReputation(
                    storeB.id,
                    ownerA.id,
                    false
                ),

                hasErrorMessage(
                    "FORBIDDEN"
                )
            );

            /*
             * ==================================================
             * ANALYTICS FEATURE BOUNDARY
             * ==================================================
             */

            const analyticsGuard =
                requireFeatureAccess(
                    "ANALYTICS"
                );

            /*
             * Owner A attempting to use
             * Store B.
             */
            {
                const res =
                    response();

                let nextCalled =
                    false;

                await analyticsGuard(
                    {
                        user:
                            actorA,

                        params: {
                            storeId:
                                storeB.id,
                        },

                        query: {},
                    } as any,

                    res as any,

                    () => {
                        nextCalled =
                            true;
                    }
                );

                assert.equal(
                    nextCalled,
                    false
                );

                assert.equal(
                    res.statusCode,
                    404
                );

                assert.equal(
                    (
                        res.body as {
                            code?: string;
                        }
                    ).code,
                    "BUSINESS_NOT_FOUND"
                );
            }

            /*
             * Caller attempts to mix:
             *
             * owned Store A
             * foreign Business B
             *
             * This must not allow either context
             * to override the real resource.
             */
            {
                const res =
                    response();

                let nextCalled =
                    false;

                await analyticsGuard(
                    {
                        user:
                            actorA,

                        params: {
                            storeId:
                                storeA.id,
                        },

                        query: {
                            businessId:
                                businessB.id,
                        },
                    } as any,

                    res as any,

                    () => {
                        nextCalled =
                            true;
                    }
                );

                assert.equal(
                    nextCalled,
                    false
                );

                assert.equal(
                    res.statusCode,
                    400
                );

                assert.equal(
                    (
                        res.body as {
                            code?: string;
                        }
                    ).code,
                    "BUSINESS_CONTEXT_REQUIRED"
                );
            }

            /*
             * Legitimate Owner A → Store A
             * analytics access must succeed.
             */
            {
                const res =
                    response();

                let nextCalled =
                    false;

                await analyticsGuard(
                    {
                        user:
                            actorA,

                        params: {
                            storeId:
                                storeA.id,
                        },

                        query: {},
                    } as any,

                    res as any,

                    () => {
                        nextCalled =
                            true;
                    }
                );

                assert.equal(
                    nextCalled,
                    true
                );

                assert.equal(
                    res.statusCode,
                    200
                );
            }
        } finally {
            await prisma.auditEvent.deleteMany({
                where: {
                    actorId: {
                        in: [
                            ownerA.id,
                            ownerB.id,
                        ],
                    },
                },
            });

            await prisma.card.deleteMany({
                where: {
                    storeId: {
                        in: [
                            storeA.id,
                            storeB.id,
                        ],
                    },
                },
            });

            await prisma.store.deleteMany({
                where: {
                    id: {
                        in: [
                            storeA.id,
                            storeB.id,
                        ],
                    },
                },
            });

            await prisma.subscription.deleteMany({
                where: {
                    businessId: {
                        in: [
                            businessA.id,
                            businessB.id,
                        ],
                    },
                },
            });

            await prisma.business.deleteMany({
                where: {
                    id: {
                        in: [
                            businessA.id,
                            businessB.id,
                        ],
                    },
                },
            });

            await prisma.user.deleteMany({
                where: {
                    id: {
                        in: [
                            ownerA.id,
                            ownerB.id,
                        ],
                    },
                },
            });
        }

        const range =
            resolveAnalyticsRangeQuery({
                preset:
                    "custom",

                from:
                    "2026-09-13",

                to:
                    "2026-09-13",

                timeZone:
                    "Asia/Beirut",
            });
        await assert.rejects(
            getStoreEngagementSummary(
                actorA,
                storeB.id,
                range
            ),

            hasErrorMessage(
                "STORE_NOT_FOUND"
            )
        );

        await assert.rejects(
            getStoreCardPerformance(
                actorA,
                storeB.id,
                range
            ),

            hasErrorMessage(
                "STORE_NOT_FOUND"
            )
        );

        await assert.rejects(
            getStoreEngagementPatterns(
                actorA,
                storeB.id,
                range
            ),

            hasErrorMessage(
                "STORE_NOT_FOUND"
            )
        );

        await assert.rejects(
            getLocationPerformance(
                actorA,
                storeB.id,
                range
            ),

            hasErrorMessage(
                "STORE_NOT_FOUND"
            )
        );

        await assert.rejects(
            getActionCenter(
                actorA,
                storeB.id,
                range
            ),

            hasErrorMessage(
                "STORE_NOT_FOUND"
            )
        );

        await assert.rejects(
            getFilteredAnalyticsReport(
                actorA,
                storeB.id,
                range
            ),

            hasErrorMessage(
                "STORE_NOT_FOUND"
            )
        );

        await assert.rejects(
            getDataReport(
                actorA,
                storeB.id,
                range
            ),

            hasErrorMessage(
                "STORE_NOT_FOUND"
            )
        );

        await assert.rejects(
            getWeeklyReport(
                actorA,
                storeB.id,
                "Asia/Beirut",
                new Date(
                    "2026-09-13T12:00:00Z"
                )
            ),

            hasErrorMessage(
                "STORE_NOT_FOUND"
            )
        );
    }
);