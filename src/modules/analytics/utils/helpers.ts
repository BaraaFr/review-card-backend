import { Request } from "express";
import { AnalyticsQuery, analyticsQuerySchema } from "../analytics.schema.js";
import { CardActivityStatus, CurrentUser, LocationPerformanceStatus } from "../types/index.js";
import { calculateChangePercentage } from "./analytics-math.js";

export function sanitizeFilename(
    value: string
) {
    return value
        .trim()
        .replace(
            /[^a-zA-Z0-9-_]+/g,
            "-"
        )
        .replace(
            /-+/g,
            "-"
        )
        .replace(
            /^-+|-+$/g,
            ""
        );
}

export function parseQuery(
    req: Request
) {
    return analyticsQuerySchema.safeParse(
        req.query
    );
};

export function getCardName(
    card: {
        label?:
        string | null;

        code:
        string;
    }
) {
    if (
        card.label?.trim()
    ) {
        return card.label.trim();
    }

    return `Card ${card.code.slice(
        0,
        6
    )}`;
}

export function getLocationName(
    location: {
        name:
        string | null;
    }
) {
    return (
        location.name?.trim() ||
        "Unnamed location"
    );
}
export const buildInteractionWhere = (
    user: CurrentUser,
    query: AnalyticsQuery,
    from: Date,
    to: Date
) => {
    return {
        createdAt: {
            gte: from,
            lt: to,
        },

        ...(query.cardId
            ? {
                cardId: query.cardId,
            }
            : {}),

        ...(query.storeId
            ? {
                storeId: query.storeId,
            }
            : {}),

        store: {
            is: {
                ...(query.businessId
                    ? {
                        businessId:
                            query.businessId,
                    }
                    : {}),

                ...(user.role !==
                    "SUPER_ADMIN"
                    ? {
                        business: {
                            is: {
                                ownerId: user.id,
                            },
                        },
                    }
                    : {}),
            },
        },
    };
};

const DAY_MS =
    24 *
    60 *
    60 *
    1000;

const INACTIVE_CARD_DAYS =
    7;


export function getCardActivityStatus(
    lastInteractionAt:
        Date | null,

    now: Date
): CardActivityStatus {
    if (
        !lastInteractionAt
    ) {
        return "NEVER_USED";
    }

    const inactiveSince =
        new Date(
            now.getTime() -
            INACTIVE_CARD_DAYS *
            DAY_MS
        );

    if (
        lastInteractionAt <
        inactiveSince
    ) {
        return "NO_RECENT_ACTIVITY";
    }

    return "ACTIVE";
}

export function parseDateOnlyUtc(
    value: string
) {
    const [
        year,
        month,
        day,
    ] =
        value
            .split("-")
            .map(Number);

    return new Date(
        Date.UTC(
            year,
            month - 1,
            day
        )
    );
}

export function formatDateOnlyUtc(
    date: Date
) {
    const year =
        date.getUTCFullYear();

    const month =
        String(
            date.getUTCMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const day =
        String(
            date.getUTCDate()
        ).padStart(
            2,
            "0"
        );

    return `${year}-${month}-${day}`;
}

export function addUtcCalendarDays(
    date: Date,
    amount: number
) {
    const result =
        new Date(
            date
        );

    result.setUTCDate(
        result.getUTCDate() +
        amount
    );

    return result;
}

export function normalizeTimeZone(
    value: string
) {
    try {
        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone:
                    value,
            }
        ).format();

        return value;
    } catch {
        return "UTC";
    }
}

export const WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

export function getDateKey(
    date: Date,
    timeZone: string
) {
    const parts =
        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone,

                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit",
            }
        ).formatToParts(
            date
        );

    const year =
        parts.find(
            (
                part
            ) =>
                part.type ===
                "year"
        )?.value;

    const month =
        parts.find(
            (
                part
            ) =>
                part.type ===
                "month"
        )?.value;

    const day =
        parts.find(
            (
                part
            ) =>
                part.type ===
                "day"
        )?.value;

    return `${year}-${month}-${day}`;
}

export function getDateLabel(
    date: Date,
    timeZone: string
) {
    return new Intl.DateTimeFormat(
        "en-US",
        {
            timeZone,

            month:
                "short",

            day:
                "numeric",
        }
    ).format(
        date
    );
}

export function getWeekday(
    date: Date,
    timeZone: string
) {
    return new Intl.DateTimeFormat(
        "en-US",
        {
            timeZone,

            weekday:
                "long",
        }
    ).format(
        date
    );
}

export function getHour(
    date: Date,
    timeZone: string
) {
    const parts =
        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone,

                hour:
                    "2-digit",

                hourCycle:
                    "h23",
            }
        ).formatToParts(
            date
        );

    const hour =
        parts.find(
            (
                part
            ) =>
                part.type ===
                "hour"
        )?.value;

    const parsed =
        Number(
            hour
        );

    if (
        Number.isNaN(
            parsed
        )
    ) {
        return 0;
    }

    return parsed;
}

export function formatHour(
    hour: number
) {
    const normalized =
        (
            hour +
            24
        ) %
        24;

    if (
        normalized ===
        0
    ) {
        return "12 AM";
    }

    if (
        normalized ===
        12
    ) {
        return "12 PM";
    }

    if (
        normalized <
        12
    ) {
        return `${normalized} AM`;
    }

    return `${normalized -
        12
        } PM`;
}

export function getLocationStatus({
    current,
    previous,
    createdAt,
    periodFrom,
}: {
    current: number;

    previous: number;

    createdAt: Date;

    periodFrom: Date;
}): LocationPerformanceStatus {
    /*
     * Brand-new location with no data yet.
     *
     * Don't immediately show a warning.
     */
    if (
        current === 0 &&
        previous === 0 &&
        createdAt >=
        periodFrom
    ) {
        return "NEW";
    }

    /*
     * Existing location with no activity
     * in either period.
     */
    if (
        current === 0 &&
        previous === 0
    ) {
        return "NO_ACTIVITY";
    }

    /*
     * Previously had traffic,
     * now has none.
     */
    if (
        current === 0 &&
        previous > 0
    ) {
        return "DECLINING";
    }

    /*
     * First meaningful activity.
     */
    if (
        current > 0 &&
        previous === 0
    ) {
        return "GROWING";
    }

    const change =
        calculateChangePercentage(
            current,
            previous
        );

    if (
        change !== null &&
        change <= -20
    ) {
        return "DECLINING";
    }

    if (
        change !== null &&
        change >= 20
    ) {
        return "GROWING";
    }

    return "STABLE";
}


export function getDateKeyInTimeZone(
    date: Date,
    timeZone: string
) {
    const parts =
        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone,

                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit",
            }
        ).formatToParts(
            date
        );

    const year =
        parts.find(
            (
                part
            ) =>
                part.type ===
                "year"
        )?.value;

    const month =
        parts.find(
            (
                part
            ) =>
                part.type ===
                "month"
        )?.value;

    const day =
        parts.find(
            (
                part
            ) =>
                part.type ===
                "day"
        )?.value;

    if (
        !year ||
        !month ||
        !day
    ) {
        throw new Error(
            "INVALID_TIMEZONE_DATE"
        );
    }

    return `${year}-${month}-${day}`;
}

export function shiftDateKey(
    dateKey: string,
    amount: number
) {
    const [
        year,
        month,
        day,
    ] =
        dateKey
            .split("-")
            .map(Number);

    const date =
        new Date(
            Date.UTC(
                year,
                month - 1,
                day
            )
        );

    date.setUTCDate(
        date.getUTCDate() +
        amount
    );

    return [
        date.getUTCFullYear(),

        String(
            date.getUTCMonth() +
            1
        ).padStart(
            2,
            "0"
        ),

        String(
            date.getUTCDate()
        ).padStart(
            2,
            "0"
        ),
    ].join(
        "-"
    );
}