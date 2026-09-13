import {
    randomUUID,
} from "node:crypto";



import {
    prisma,
} from "../../lib/prisma.js";

import {
    subscriptionService,
} from "../subscriptions/subscription.service.js";

import {
    enqueueWeeklyReportDelivery,
} from "./weekly-report.queue.js";
import { WeeklyReportDay } from "../../../generated/prisma/enums.js";

type AuthUser = {
    id:
    string;

    role:
    string;
};

async function getAccessibleBusiness(
    businessId: string,
    user: AuthUser
) {
    const business =
        await prisma.business.findFirst({
            where:
                user.role ===
                    "SUPER_ADMIN"
                    ? {
                        id:
                            businessId,
                    }
                    : {
                        id:
                            businessId,

                        ownerId:
                            user.id,
                    },

            select: {
                id:
                    true,

                name:
                    true,

                weeklyReportEnabled:
                    true,

                weeklyReportDay:
                    true,

                weeklyReportTime:
                    true,

                weeklyReportTimeZone:
                    true,

                weeklyReportEmail:
                    true,

                weeklyReportLastSentAt:
                    true,

                owner: {
                    select: {
                        email:
                            true,
                    },
                },
            },
        });

    if (!business) {
        throw new Error(
            "BUSINESS_NOT_FOUND"
        );
    }

    return business;
}

export async function getWeeklyReportSettings(
    businessId: string,
    user: AuthUser
) {
    const business =
        await getAccessibleBusiness(
            businessId,
            user
        );

    return {
        enabled:
            business
                .weeklyReportEnabled,

        day:
            business
                .weeklyReportDay,

        time:
            business
                .weeklyReportTime,

        timeZone:
            business
                .weeklyReportTimeZone,

        email:
            business
                .weeklyReportEmail,

        defaultEmail:
            business.owner.email,

        lastSentAt:
            business
                .weeklyReportLastSentAt,
    };
}

export async function updateWeeklyReportSettings(
    businessId: string,
    user:
        AuthUser,
    input: {
        enabled?:
        boolean;

        day?:
        WeeklyReportDay;

        time?:
        string;

        timeZone?:
        string;

        email?:
        string | null;
    }
) {
    await getAccessibleBusiness(
        businessId,
        user
    );

    const updated =
        await prisma.business.update({
            where: {
                id:
                    businessId,
            },

            data: {
                ...(input.enabled !==
                    undefined
                    ? {
                        weeklyReportEnabled:
                            input.enabled,
                    }
                    : {}),

                ...(input.day
                    ? {
                        weeklyReportDay:
                            input.day,
                    }
                    : {}),

                ...(input.time
                    ? {
                        weeklyReportTime:
                            input.time,
                    }
                    : {}),

                ...(input.timeZone
                    ? {
                        weeklyReportTimeZone:
                            input.timeZone,
                    }
                    : {}),

                ...(input.email !==
                    undefined
                    ? {
                        weeklyReportEmail:
                            input.email,
                    }
                    : {}),
            },

            select: {
                weeklyReportEnabled:
                    true,

                weeklyReportDay:
                    true,

                weeklyReportTime:
                    true,

                weeklyReportTimeZone:
                    true,

                weeklyReportEmail:
                    true,

                weeklyReportLastSentAt:
                    true,

                owner: {
                    select: {
                        email:
                            true,
                    },
                },
            },
        });

    return {
        enabled:
            updated
                .weeklyReportEnabled,

        day:
            updated
                .weeklyReportDay,

        time:
            updated
                .weeklyReportTime,

        timeZone:
            updated
                .weeklyReportTimeZone,

        email:
            updated
                .weeklyReportEmail,

        defaultEmail:
            updated.owner.email,

        lastSentAt:
            updated
                .weeklyReportLastSentAt,
    };
}

export async function sendTestWeeklyReport(
    businessId: string,
    user:
        AuthUser
) {
    const business =
        await getAccessibleBusiness(
            businessId,
            user
        );

    const subscription =
        await subscriptionService
            .getCurrentForBusiness(
                businessId
            );

    if (
        !subscription ||
        !subscription.usable
    ) {
        throw new Error(
            "SUBSCRIPTION_REQUIRED"
        );
    }

    const recipient =
        business
            .weeklyReportEmail
            ?.trim() ||
        business.owner.email;

    if (
        !recipient
    ) {
        throw new Error(
            "REPORT_EMAIL_REQUIRED"
        );
    }

    const delivery =
        await prisma
            .weeklyReportDelivery
            .create({
                data: {
                    businessId,

                    kind:
                        "TEST",

                    scheduleKey:
                        `TEST-${randomUUID()}`,

                    recipient,

                    status:
                        "PENDING",
                },
            });

    await enqueueWeeklyReportDelivery(
        delivery.id
    );

    return {
        deliveryId:
            delivery.id,

        recipient,
    };
}