import { calculateChangePercentage, calculatePercentage, calculateOverviewChangePercentage as calculatePercentageChange } from "./utils/analytics-math.js";
import { prisma } from "../../lib/prisma.js";

import {
  getAnalyticsDateRange,
} from "../../utils/date-range.js";

import type {
  AnalyticsQuery,
} from "./analytics.schema.js";
import { resolveAnalyticsRangeQuery, ResolvedAnalyticsRange } from "./utils/analytics-range.util.js";
import { iterateMeaningfulInteractions } from "./utils/interaction-batches.js";
import { ActionCenterItem, CurrentUser, DailyBucket, WeeklyReportHealth } from "./types/index.js";
import { addUtcCalendarDays, buildInteractionWhere, formatDateOnlyUtc, formatHour, getCardActivityStatus, getCardName, getDateKey, getDateKeyInTimeZone, getDateLabel, getHour, getLocationName, getLocationStatus, getWeekday, normalizeTimeZone, parseDateOnlyUtc, shiftDateKey, WEEKDAYS } from "./utils/helpers.js";

export const analyticsService = {
  async overview(
    user: CurrentUser,
    query: AnalyticsQuery
  ) {
    const {
      from,
      to,
      previousFrom,
      previousTo,
    } =
      getAnalyticsDateRange(
        query
      );

    const currentWhere =
      buildInteractionWhere(
        user,
        query,
        from,
        to
      );

    const previousWhere =
      buildInteractionWhere(
        user,
        query,
        previousFrom,
        previousTo
      );

    const [
      total,
      previousTotal,
      sourceGroups,
      uniqueVisitors,
    ] = await Promise.all([
      prisma.interaction.count({
        where: currentWhere,
      }),

      prisma.interaction.count({
        where: previousWhere,
      }),

      prisma.interaction.groupBy({
        by: ["source"],

        where: currentWhere,

        _count: {
          _all: true,
        },
      }),

      prisma.interaction.groupBy({
        by: ["visitorHash"],

        where: {
          ...currentWhere,

          visitorHash: {
            not: null,
          },
        },

        _count: {
          _all: true,
        },
      }),
    ]);

    let nfc = 0;
    let qr = 0;
    let unknown = 0;

    for (
      const group of sourceGroups
    ) {
      const count =
        group._count._all;

      if (
        group.source === "NFC"
      ) {
        nfc = count;
      } else if (
        group.source === "QR"
      ) {
        qr = count;
      } else {
        unknown = count;
      }
    }

    return {
      period: {
        from,
        to,
      },

      totalInteractions: total,

      previousInteractions:
        previousTotal,

      percentageChange:
        calculatePercentageChange(
          total,
          previousTotal
        ),

      approximateUniqueVisitors:
        uniqueVisitors.length,

      source: {
        nfc,
        qr,
        unknown,
      },
    };
  },

  async cards(
    user: CurrentUser,
    query: AnalyticsQuery
  ) {
    const {
      from,
      to,
    } =
      getAnalyticsDateRange(
        query
      );

    const groups =
      await prisma.interaction.groupBy({
        by: [
          "cardId",
          "source",
        ],

        where:
          buildInteractionWhere(
            user,
            query,
            from,
            to
          ),

        _count: {
          _all: true,
        },
      });

    const cardIds = [
      ...new Set(
        groups.map(
          (item) =>
            item.cardId
        )
      ),
    ];

    const cards =
      await prisma.card.findMany({
        where: {
          id: {
            in: cardIds,
          },
        },

        select: {
          id: true,
          code: true,
          label: true,
          status: true,

          store: {
            select: {
              id: true,
              name: true,

              business: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

    const result =
      cards.map((card) => {
        const cardGroups =
          groups.filter(
            (group) =>
              group.cardId ===
              card.id
          );

        const nfc =
          cardGroups.find(
            (item) =>
              item.source ===
              "NFC"
          )?._count._all ?? 0;

        const qr =
          cardGroups.find(
            (item) =>
              item.source ===
              "QR"
          )?._count._all ?? 0;

        const unknown =
          cardGroups.find(
            (item) =>
              item.source ===
              "UNKNOWN"
          )?._count._all ?? 0;

        return {
          id: card.id,
          code: card.code,
          label: card.label,
          status: card.status,

          store: card.store,

          total:
            nfc +
            qr +
            unknown,

          nfc,
          qr,
          unknown,
        };
      });

    result.sort(
      (a, b) =>
        b.total -
        a.total
    );

    return {
      period: {
        from,
        to,
      },

      cards: result,
    };
  },

  async stores(
    user: CurrentUser,
    query: AnalyticsQuery
  ) {
    const {
      from,
      to,
    } =
      getAnalyticsDateRange(
        query
      );

    const groups =
      await prisma.interaction.groupBy({
        by: [
          "storeId",
          "source",
        ],

        where:
          buildInteractionWhere(
            user,
            query,
            from,
            to
          ),

        _count: {
          _all: true,
        },
      });

    const storeIds = [
      ...new Set(
        groups.map(
          (item) =>
            item.storeId
        )
      ),
    ];

    const stores =
      await prisma.store.findMany({
        where: {
          id: {
            in: storeIds,
          },
        },

        select: {
          id: true,
          name: true,
          address: true,

          business: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    const result =
      stores.map((store) => {
        const storeGroups =
          groups.filter(
            (group) =>
              group.storeId ===
              store.id
          );

        const nfc =
          storeGroups.find(
            (item) =>
              item.source ===
              "NFC"
          )?._count._all ?? 0;

        const qr =
          storeGroups.find(
            (item) =>
              item.source ===
              "QR"
          )?._count._all ?? 0;

        const unknown =
          storeGroups.find(
            (item) =>
              item.source ===
              "UNKNOWN"
          )?._count._all ?? 0;

        return {
          id: store.id,
          name: store.name,
          address:
            store.address,

          business:
            store.business,

          total:
            nfc +
            qr +
            unknown,

          nfc,
          qr,
          unknown,
        };
      });

    result.sort(
      (a, b) =>
        b.total -
        a.total
    );

    return {
      period: {
        from,
        to,
      },

      stores: result,
    };
  },

  async timeline(
    user: CurrentUser,
    query: AnalyticsQuery
  ) {
    const {
      from,
      to,
    } =
      getAnalyticsDateRange(
        query
      );

    const interactions =
      await prisma.interaction.findMany({
        where:
          buildInteractionWhere(
            user,
            query,
            from,
            to
          ),

        select: {
          createdAt: true,
          source: true,
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    const map =
      new Map<
        string,
        {
          date: string;
          total: number;
          nfc: number;
          qr: number;
          unknown: number;
        }
      >();

    for (
      const interaction of
      interactions
    ) {
      const date =
        interaction.createdAt
          .toISOString()
          .slice(0, 10);

      if (!map.has(date)) {
        map.set(date, {
          date,
          total: 0,
          nfc: 0,
          qr: 0,
          unknown: 0,
        });
      }

      const item =
        map.get(date)!;

      item.total += 1;

      if (
        interaction.source ===
        "NFC"
      ) {
        item.nfc += 1;
      } else if (
        interaction.source ===
        "QR"
      ) {
        item.qr += 1;
      } else {
        item.unknown += 1;
      }
    }

    return {
      period: {
        from,
        to,
      },

      timeline: Array.from(
        map.values()
      ),
    };
  },
};

export async function getActionCenter(
  storeId: string,
  range: ResolvedAnalyticsRange
) {
  /*
   * =====================================================
   * Store
   * =====================================================
   */

  const store =
    await prisma.store.findUnique({
      where: {
        id:
          storeId,
      },

      select: {
        id:
          true,

        name:
          true,

        googleReviewUrl:
          true,

        googlePlaceId:
          true,
      },
    });

  if (!store) {
    throw new Error(
      "STORE_NOT_FOUND"
    );
  }

  /*
   * =====================================================
   * Reuse analytics services
   * =====================================================
   *
   * IMPORTANT:
   *
   * We pass the SAME analytics range
   * to all dependent services.
   *
   * That guarantees:
   *
   * Action Center
   * Card Performance
   * Location Performance
   *
   * are all analyzing exactly the
   * same selected date period.
   */

  const [
    cardPerformance,
    locationPerformance,
  ] =
    await Promise.all([
      getStoreCardPerformance(
        storeId,
        range
      ),

      getLocationPerformance(
        storeId,
        range
      ),
    ]);

  return buildActionCenter({ store, range, cardPerformance, locationPerformance });
}

export function buildActionCenter({ store, range, cardPerformance, locationPerformance }: {
  store: { id: string; name: string | null; googleReviewUrl: string | null; googlePlaceId: string | null };
  range: ResolvedAnalyticsRange;
  cardPerformance: Awaited<ReturnType<typeof getStoreCardPerformance>>;
  locationPerformance: Awaited<ReturnType<typeof getLocationPerformance>>;
}) {
  const warnings:
    ActionCenterItem[] =
    [];

  const highlights:
    ActionCenterItem[] =
    [];

  /*
   * =====================================================
   * Useful period labels
   * =====================================================
   */

  const periodLabel =
    `${range.from} to ${range.to}`;

  const previousPeriodLabel =
    `${range.previousFrom} to ${range.previousTo}`;

  /*
   * =====================================================
   * 1. Google configuration
   * =====================================================
   */

  if (
    !store.googleReviewUrl
  ) {
    warnings.push({
      id:
        `google-url-${store.id}`,

      type:
        "GOOGLE_REVIEW_URL_MISSING",

      severity:
        "WARNING",

      entityType:
        "GOOGLE",

      entityId:
        store.id,

      title:
        `${store.name} needs a Google review link`,

      description:
        "Customers cannot be redirected to Google until a review URL is configured for this location.",

      metric:
        null,
    });
  } else if (
    !store.googlePlaceId
  ) {
    warnings.push({
      id:
        `google-connection-${store.id}`,

      type:
        "GOOGLE_NOT_CONNECTED",

      severity:
        "INFO",

      entityType:
        "GOOGLE",

      entityId:
        store.id,

      title:
        `${store.name} is not connected to Google insights`,

      description:
        "Your review link works, but connecting the location to Google enables reputation information inside ValYou.",

      metric:
        null,
    });
  }

  /*
   * =====================================================
   * 2. Card warnings
   * =====================================================
   */

  for (
    const card
    of cardPerformance.cards
  ) {
    /*
     * Only active physical cards
     * should create warnings.
     */

    if (
      card.cardStatus !==
      "ACTIVE"
    ) {
      continue;
    }

    /*
     * No recent activity
     */

    if (
      card.activityStatus ===
      "NO_RECENT_ACTIVITY"
    ) {
      warnings.push({
        id:
          `card-inactive-${card.id}`,

        type:
          "CARD_NO_RECENT_ACTIVITY",

        severity:
          "WARNING",

        entityType:
          "CARD",

        entityId:
          card.id,

        title:
          `${getCardName(
            card
          )} needs attention`,

        description:
          "This card has had no meaningful customer activity recently. Consider checking its placement or visibility.",

        metric: {
          label:
            "Interactions",

          value:
            String(
              card.meaningfulInteractions
            ),
        },
      });
    }

    /*
     * Never used
     */

    if (
      card.activityStatus ===
      "NEVER_USED"
    ) {
      warnings.push({
        id:
          `card-never-used-${card.id}`,

        type:
          "CARD_NEVER_USED",

        severity:
          "WARNING",

        entityType:
          "CARD",

        entityId:
          card.id,

        title:
          `${getCardName(
            card
          )} has no activity yet`,

        description:
          "No meaningful customer interaction has been recorded for this active card. Check that it is visible and accessible to customers.",

        metric: {
          label:
            "Interactions",

          value:
            "0",
        },
      });
    }
  }

  /*
   * =====================================================
   * 3. Location warnings
   * =====================================================
   */

  for (
    const location
    of locationPerformance.locations
  ) {
    /*
     * Declining location
     */

    if (
      location.status ===
      "DECLINING"
    ) {
      const change =
        location.changePercentage;

      warnings.push({
        id:
          `location-declining-${location.id}`,

        type:
          "LOCATION_DECLINING",

        severity:
          "WARNING",

        entityType:
          "LOCATION",

        entityId:
          location.id,

        title:
          `${getLocationName(
            location
          )} engagement is declining`,

        description:
          change !== null
            ? `Customer engagement decreased ${Math.abs(
              change
            )}% compared with the previous equivalent period. Check card visibility and placement at this location.`
            : "Customer engagement decreased compared with the previous equivalent period.",

        metric: {
          label:
            "Change",

          value:
            change !== null
              ? `${change}%`
              : "Down",
        },
      });
    }

    /*
     * No activity
     */

    if (
      location.status ===
      "NO_ACTIVITY"
    ) {
      warnings.push({
        id:
          `location-no-activity-${location.id}`,

        type:
          "LOCATION_NO_ACTIVITY",

        severity:
          "WARNING",

        entityType:
          "LOCATION",

        entityId:
          location.id,

        title:
          `${getLocationName(
            location
          )} has no activity`,

        description:
          `No meaningful customer interactions were recorded during the selected period (${periodLabel}).`,

        metric: {
          label:
            "Interactions",

          value:
            "0",
        },
      });
    }
  }

  /*
   * =====================================================
   * 4. Best card highlight
   * =====================================================
   */

  if (
    cardPerformance.summary
      .bestCard
  ) {
    const bestCard =
      cardPerformance.summary
        .bestCard;

    highlights.push({
      id:
        `top-card-${bestCard.id}`,

      type:
        "TOP_CARD",

      severity:
        "SUCCESS",

      entityType:
        "CARD",

      entityId:
        bestCard.id,

      title:
        `${getCardName(
          bestCard
        )} is your top-performing card`,

      description:
        `This card generated the most meaningful customer interactions during the selected period (${periodLabel}).`,

      metric: {
        label:
          "Interactions",

        value:
          String(
            bestCard
              .meaningfulInteractions
          ),
      },
    });
  }

  /*
   * =====================================================
   * 5. Best location highlight
   * =====================================================
   */

  if (
    locationPerformance.summary
      .totalLocations >
    1 &&
    locationPerformance.summary
      .bestLocation
  ) {
    const bestLocation =
      locationPerformance.summary
        .bestLocation;

    highlights.push({
      id:
        `top-location-${bestLocation.id}`,

      type:
        "TOP_LOCATION",

      severity:
        "SUCCESS",

      entityType:
        "LOCATION",

      entityId:
        bestLocation.id,

      title:
        `${getLocationName(
          bestLocation
        )} is your strongest location`,

      description:
        `This location generated the most customer engagement during the selected period (${periodLabel}).`,

      metric: {
        label:
          "Interactions",

        value:
          String(
            bestLocation
              .interactions
          ),
      },
    });
  }

  /*
   * =====================================================
   * 6. Everything healthy
   * =====================================================
   */

  const realWarnings =
    warnings.filter(
      (
        item
      ) =>
        item.severity ===
        "WARNING"
    );

  if (
    realWarnings.length ===
    0
  ) {
    highlights.unshift({
      id:
        "all-healthy",

      type:
        "ALL_HEALTHY",

      severity:
        "SUCCESS",

      entityType:
        "SYSTEM",

      entityId:
        null,

      title:
        "Everything looks healthy",

      description:
        "Your active ValYou cards and locations are not showing any major engagement issues during the selected period.",

      metric:
        null,
    });
  }

  /*
   * =====================================================
   * Final response
   * =====================================================
   */

  return {
    period: {
      preset:
        range.preset,

      from:
        range.from,

      to:
        range.to,

      days:
        range.days,

      timeZone:
        range.timeZone,

      previousFrom:
        range.previousFrom,

      previousTo:
        range.previousTo,

      label:
        periodLabel,

      previousLabel:
        previousPeriodLabel,
    },

    summary: {
      warningCount:
        realWarnings.length,

      infoCount:
        warnings.filter(
          (
            item
          ) =>
            item.severity ===
            "INFO"
        ).length,

      highlightCount:
        highlights.length,

      healthy:
        realWarnings.length ===
        0,
    },

    warnings,

    highlights,
  };
}

export async function getStoreCardPerformance(
  storeId: string,
  range: ResolvedAnalyticsRange
) {
  /*
   * =====================================================
   * Verify store
   * =====================================================
   *
   * Authorization and subscription
   * validation are already handled by:
   *
   * requireFeatureAccess("ANALYTICS")
   */

  const store =
    await prisma.store.findUnique({
      where: {
        id:
          storeId,
      },

      select: {
        id:
          true,
      },
    });

  if (!store) {
    throw new Error(
      "STORE_NOT_FOUND"
    );
  }

  /*
   * =====================================================
   * Selected analytics period
   * =====================================================
   *
   * IMPORTANT:
   *
   * Do NOT calculate dates here anymore.
   *
   * The controller already resolved:
   *
   * range.fromUtc
   * range.toExclusiveUtc
   *
   * based on:
   *
   * preset
   * from
   * to
   * timezone
   */

  const from =
    range.fromUtc;

  const to =
    range.toExclusiveUtc;

  /*
   * We still need the real current time
   * for card operational activity status.
   *
   * Example:
   *
   * ACTIVE
   * NO_RECENT_ACTIVITY
   * NEVER_USED
   *
   * This is intentionally NOT based on
   * the selected analytics period.
   */

  const now =
    new Date();

  /*
   * =====================================================
   * Cards assigned to this store
   * =====================================================
   */

  const cards =
    await prisma.card.findMany({
      where: {
        storeId,
      },

      select: {
        id:
          true,

        code:
          true,

        label:
          true,

        status:
          true,
      },
    });

  /*
   * =====================================================
   * Empty store
   * =====================================================
   */

  if (
    cards.length ===
    0
  ) {
    return {
      period: {
        preset:
          range.preset,

        from:
          range.from,

        to:
          range.to,

        days:
          range.days,

        timeZone:
          range.timeZone,

        previousFrom:
          range.previousFrom,

        previousTo:
          range.previousTo,
      },

      summary: {
        totalCards:
          0,

        activeCards:
          0,

        cardsWithActivity:
          0,

        cardsNeedingAttention:
          0,

        totalInteractions:
          0,

        totalUniqueVisitors:
          0,

        bestCard:
          null,
      },

      cards:
        [],
    };
  }

  /*
   * =====================================================
   * Card IDs
   * =====================================================
   */

  const cardIds =
    cards.map(
      (
        card
      ) =>
        card.id
    );

  /*
   * =====================================================
   * Database calculations
   * =====================================================
   */

  const [
    currentInteractionGroups,

    uniqueVisitorRows,

    duplicateGroups,

    lifetimeActivityGroups,
  ] =
    await Promise.all([
      /*
       * ===============================================
       * Meaningful interactions
       * ===============================================
       *
       * Only interactions inside the
       * currently selected analytics range.
       */

      prisma.interaction.groupBy({
        by: [
          "cardId",
        ],

        where: {
          cardId: {
            in:
              cardIds,
          },

          storeId,

          isDuplicate:
            false,

          isBot:
            false,

          createdAt: {
            gte:
              from,

            lt:
              to,
          },
        },

        _count: {
          _all:
            true,
        },

        _max: {
          createdAt:
            true,
        },
      }),

      /*
       * ===============================================
       * Unique visitors per card
       * ===============================================
       */

      prisma.interaction.findMany({
        where: {
          cardId: {
            in:
              cardIds,
          },

          storeId,

          visitorKey: {
            not:
              null,
          },

          isDuplicate:
            false,

          isBot:
            false,

          createdAt: {
            gte:
              from,

            lt:
              to,
          },
        },

        select: {
          cardId:
            true,

          visitorKey:
            true,
        },

        distinct: [
          "cardId",
          "visitorKey",
        ],
      }),

      /*
       * ===============================================
       * Duplicate taps
       * ===============================================
       *
       * We keep this restricted to the
       * selected analytics period too.
       */

      prisma.interaction.groupBy({
        by: [
          "cardId",
        ],

        where: {
          cardId: {
            in:
              cardIds,
          },

          storeId,

          isDuplicate:
            true,

          isBot:
            false,

          createdAt: {
            gte:
              from,

            lt:
              to,
          },
        },

        _count: {
          _all:
            true,
        },
      }),

      /*
       * ===============================================
       * Lifetime last meaningful interaction
       * ===============================================
       *
       * DO NOT apply the selected range here.
       *
       * This tells us the actual most recent time
       * each card was used in its lifetime.
       *
       * This is required for:
       *
       * ACTIVE
       * NO_RECENT_ACTIVITY
       * NEVER_USED
       */

      prisma.interaction.groupBy({
        by: [
          "cardId",
        ],

        where: {
          cardId: {
            in:
              cardIds,
          },

          storeId,

          isDuplicate:
            false,

          isBot:
            false,
        },

        _max: {
          createdAt:
            true,
        },
      }),
    ]);

  /*
   * =====================================================
   * Interaction lookup map
   * =====================================================
   */

  const interactionMap =
    new Map<
      string,
      {
        count:
        number;

        lastInPeriod:
        Date | null;
      }
    >();

  for (
    const group
    of currentInteractionGroups
  ) {
    interactionMap.set(
      group.cardId,
      {
        count:
          group._count
            ._all,

        lastInPeriod:
          group._max
            .createdAt ??
          null,
      }
    );
  }

  /*
   * =====================================================
   * Unique visitors per card
   * =====================================================
   */

  const uniqueVisitorMap =
    new Map<
      string,
      number
    >();

  for (
    const row
    of uniqueVisitorRows
  ) {
    const current =
      uniqueVisitorMap.get(
        row.cardId
      ) ??
      0;

    uniqueVisitorMap.set(
      row.cardId,
      current +
      1
    );
  }

  /*
   * =====================================================
   * Duplicate taps map
   * =====================================================
   */

  const duplicateMap =
    new Map<
      string,
      number
    >();

  for (
    const group
    of duplicateGroups
  ) {
    duplicateMap.set(
      group.cardId,
      group._count
        ._all
    );
  }

  /*
   * =====================================================
   * Lifetime activity map
   * =====================================================
   */

  const lifetimeActivityMap =
    new Map<
      string,
      Date | null
    >();

  for (
    const group
    of lifetimeActivityGroups
  ) {
    lifetimeActivityMap.set(
      group.cardId,
      group._max
        .createdAt ??
      null
    );
  }

  /*
   * =====================================================
   * Total meaningful interactions
   * =====================================================
   */

  const totalInteractions =
    currentInteractionGroups.reduce(
      (
        total,
        group
      ) =>
        total +
        group._count
          ._all,
      0
    );

  /*
   * =====================================================
   * Store unique visitors
   * =====================================================
   *
   * Important:
   *
   * Do NOT sum the unique visitor
   * count from individual cards.
   *
   * One visitor may interact with
   * multiple physical cards.
   */

  const storeUniqueVisitors =
    await prisma.interaction.findMany({
      where: {
        storeId,

        visitorKey: {
          not:
            null,
        },

        isDuplicate:
          false,

        isBot:
          false,

        createdAt: {
          gte:
            from,

          lt:
            to,
        },
      },

      select: {
        visitorKey:
          true,
      },

      distinct: [
        "visitorKey",
      ],
    });

  /*
   * =====================================================
   * Build card performance objects
   * =====================================================
   */

  const cardPerformance =
    cards.map(
      (
        card
      ) => {
        const interactionData =
          interactionMap.get(
            card.id
          );

        const meaningfulInteractions =
          interactionData?.count ??
          0;

        const uniqueVisitors =
          uniqueVisitorMap.get(
            card.id
          ) ??
          0;

        const duplicateTaps =
          duplicateMap.get(
            card.id
          ) ??
          0;

        /*
         * This is lifetime last activity,
         * not last activity in the
         * selected report period.
         */

        const lastInteractionAt =
          lifetimeActivityMap.get(
            card.id
          ) ??
          null;

        /*
         * Operational health remains
         * based on the real current time.
         */

        const activityStatus =
          getCardActivityStatus(
            lastInteractionAt,
            now
          );

        return {
          id:
            card.id,

          code:
            card.code,

          label:
            card.label,

          cardStatus:
            card.status,

          meaningfulInteractions,

          uniqueVisitors,

          duplicateTaps,

          sharePercentage:
            calculatePercentage(
              meaningfulInteractions,
              totalInteractions
            ),

          lastInteractionAt,

          activityStatus,
        };
      }
    );

  /*
   * =====================================================
   * Sort strongest cards first
   * =====================================================
   */

  cardPerformance.sort(
    (
      a,
      b
    ) =>
      b.meaningfulInteractions -
      a.meaningfulInteractions
  );

  /*
   * =====================================================
   * Best card
   * =====================================================
   */

  const bestCard =
    cardPerformance[0] &&
      cardPerformance[0]
        .meaningfulInteractions >
      0
      ? {
        id:
          cardPerformance[0]
            .id,

        code:
          cardPerformance[0]
            .code,

        label:
          cardPerformance[0]
            .label,

        meaningfulInteractions:
          cardPerformance[0]
            .meaningfulInteractions,

        uniqueVisitors:
          cardPerformance[0]
            .uniqueVisitors,
      }
      : null;

  /*
   * =====================================================
   * Summary
   * =====================================================
   */

  const activeCards =
    cards.filter(
      (
        card
      ) =>
        card.status ===
        "ACTIVE"
    ).length;

  const cardsWithActivity =
    cardPerformance.filter(
      (
        card
      ) =>
        card
          .meaningfulInteractions >
        0
    ).length;

  const cardsNeedingAttention =
    cardPerformance.filter(
      (
        card
      ) =>
        card.activityStatus !==
        "ACTIVE"
    ).length;

  /*
   * =====================================================
   * Final response
   * =====================================================
   */

  return {
    period: {
      preset:
        range.preset,

      from:
        range.from,

      to:
        range.to,

      days:
        range.days,

      timeZone:
        range.timeZone,

      previousFrom:
        range.previousFrom,

      previousTo:
        range.previousTo,
    },

    summary: {
      totalCards:
        cards.length,

      activeCards,

      cardsWithActivity,

      cardsNeedingAttention,

      totalInteractions,

      totalUniqueVisitors:
        storeUniqueVisitors.length,

      bestCard,
    },

    cards:
      cardPerformance,
  };
}

export async function getStoreEngagementSummary(
  storeId: string,
  range: ResolvedAnalyticsRange
) {
  /*
   * =====================================================
   * Store
   * =====================================================
   *
   * We need businessId because returning visitor
   * is defined at BUSINESS level.
   *
   * Example:
   *
   * Customer visited Branch A previously,
   * then visits Branch B during the selected period.
   *
   * They are still a returning visitor for the business.
   */

  const store =
    await prisma.store.findUnique({
      where: {
        id:
          storeId,
      },

      select: {
        id:
          true,

        businessId:
          true,
      },
    });

  if (!store) {
    throw new Error(
      "STORE_NOT_FOUND"
    );
  }

  /*
   * =====================================================
   * Analytics range
   * =====================================================
   *
   * Do NOT calculate dates here.
   *
   * The controller already resolved the selected
   * period into timezone-safe UTC boundaries.
   */

  const currentFrom =
    range.fromUtc;

  const currentTo =
    range.toExclusiveUtc;

  const previousFrom =
    range.previousFromUtc;

  const previousTo =
    range.previousToExclusiveUtc;

  /*
   * Meaningful interaction:
   *
   * - not duplicate
   * - not bot
   */

  const [
    currentInteractions,

    previousInteractions,

    sourceGroups,

    deviceGroups,

    currentVisitors,
  ] =
    await Promise.all([
      /*
       * =========================================
       * Current meaningful interactions
       * =========================================
       */

      prisma.interaction.count({
        where: {
          storeId,

          isDuplicate:
            false,

          isBot:
            false,

          createdAt: {
            gte:
              currentFrom,

            lt:
              currentTo,
          },
        },
      }),

      /*
       * =========================================
       * Previous meaningful interactions
       * =========================================
       *
       * This uses the previous equivalent period.
       *
       * Example:
       *
       * Aug 1 -> Aug 31
       *
       * compared with:
       *
       * Jul 1 -> Jul 31
       */

      prisma.interaction.count({
        where: {
          storeId,

          isDuplicate:
            false,

          isBot:
            false,

          createdAt: {
            gte:
              previousFrom,

            lt:
              previousTo,
          },
        },
      }),

      /*
       * =========================================
       * NFC / QR distribution
       * =========================================
       */

      prisma.interaction.groupBy({
        by: [
          "source",
        ],

        where: {
          storeId,

          isDuplicate:
            false,

          isBot:
            false,

          createdAt: {
            gte:
              currentFrom,

            lt:
              currentTo,
          },
        },

        _count: {
          _all:
            true,
        },
      }),

      /*
       * =========================================
       * Device distribution
       * =========================================
       */

      prisma.interaction.groupBy({
        by: [
          "deviceType",
        ],

        where: {
          storeId,

          isDuplicate:
            false,

          isBot:
            false,

          createdAt: {
            gte:
              currentFrom,

            lt:
              currentTo,
          },
        },

        _count: {
          _all:
            true,
        },
      }),

      /*
       * =========================================
       * Unique anonymous visitors
       * =========================================
       *
       * visitorKey can be null for old
       * interactions created before visitor
       * tracking was introduced.
       */

      prisma.interaction.findMany({
        where: {
          storeId,

          visitorKey: {
            not:
              null,
          },

          isDuplicate:
            false,

          isBot:
            false,

          createdAt: {
            gte:
              currentFrom,

            lt:
              currentTo,
          },
        },

        select: {
          visitorKey:
            true,
        },

        distinct: [
          "visitorKey",
        ],
      }),
    ]);

  /*
   * =====================================================
   * Unique visitors
   * =====================================================
   */

  const visitorKeys =
    currentVisitors
      .map(
        (
          visitor
        ) =>
          visitor.visitorKey
      )
      .filter(
        (
          visitorKey
        ): visitorKey is string =>
          Boolean(
            visitorKey
          )
      );

  const uniqueVisitors =
    visitorKeys.length;

  /*
   * =====================================================
   * Returning visitors
   * =====================================================
   *
   * Important:
   *
   * We are calculating UNIQUE PEOPLE,
   * not returning interactions.
   *
   * Process:
   *
   * 1. Get unique visitors from the current period.
   *
   * 2. Search whether those visitor keys had any
   *    meaningful interaction BEFORE currentFrom.
   *
   * 3. Search across all stores belonging to the
   *    same business.
   */

  let returningVisitors =
    0;

  if (
    visitorKeys.length >
    0
  ) {
    const historicalVisitors =
      await prisma.interaction.findMany({
        where: {
          visitorKey: {
            in:
              visitorKeys,
          },

          isDuplicate:
            false,

          isBot:
            false,

          /*
           * Anything before the currently
           * selected period counts as history.
           */

          createdAt: {
            lt:
              currentFrom,
          },

          /*
           * Returning is BUSINESS-level,
           * not location-level.
           */

          store: {
            businessId:
              store.businessId,
          },
        },

        select: {
          visitorKey:
            true,
        },

        distinct: [
          "visitorKey",
        ],
      });

    returningVisitors =
      historicalVisitors.length;
  }

  const newVisitors =
    Math.max(
      uniqueVisitors -
      returningVisitors,
      0
    );

  /*
   * =====================================================
   * Source distribution
   * =====================================================
   */

  let nfc =
    0;

  let qr =
    0;

  let unknownSource =
    0;

  for (
    const group
    of sourceGroups
  ) {
    const count =
      group._count
        ._all;

    switch (
    group.source
    ) {
      case "NFC": {
        nfc =
          count;

        break;
      }

      case "QR": {
        qr =
          count;

        break;
      }

      default: {
        unknownSource +=
          count;

        break;
      }
    }
  }

  /*
   * =====================================================
   * Device distribution
   * =====================================================
   */

  let mobile =
    0;

  let tablet =
    0;

  let desktop =
    0;

  let unknownDevice =
    0;

  for (
    const group
    of deviceGroups
  ) {
    const count =
      group._count
        ._all;

    switch (
    group.deviceType
    ) {
      case "MOBILE": {
        mobile =
          count;

        break;
      }

      case "TABLET": {
        tablet =
          count;

        break;
      }

      case "DESKTOP": {
        desktop =
          count;

        break;
      }

      default: {
        unknownDevice +=
          count;

        break;
      }
    }
  }

  /*
   * =====================================================
   * Final response
   * =====================================================
   */

  return {
    period: {
      preset:
        range.preset,

      /*
       * Human-readable date-only values
       * for the frontend.
       *
       * Example:
       *
       * 2026-08-01
       * 2026-08-31
       */

      from:
        range.from,

      to:
        range.to,

      days:
        range.days,

      timeZone:
        range.timeZone,

      previousFrom:
        range.previousFrom,

      previousTo:
        range.previousTo,
    },

    interactions: {
      current:
        currentInteractions,

      previous:
        previousInteractions,

      changePercentage:
        calculateChangePercentage(
          currentInteractions,
          previousInteractions
        ),
    },

    visitors: {
      unique:
        uniqueVisitors,

      new:
        newVisitors,

      returning:
        returningVisitors,

      newPercentage:
        calculatePercentage(
          newVisitors,
          uniqueVisitors
        ),

      returningPercentage:
        calculatePercentage(
          returningVisitors,
          uniqueVisitors
        ),
    },

    sources: {
      nfc,

      qr,

      unknown:
        unknownSource,

      nfcPercentage:
        calculatePercentage(
          nfc,
          currentInteractions
        ),

      qrPercentage:
        calculatePercentage(
          qr,
          currentInteractions
        ),

      unknownPercentage:
        calculatePercentage(
          unknownSource,
          currentInteractions
        ),
    },

    devices: {
      mobile,

      tablet,

      desktop,

      unknown:
        unknownDevice,

      mobilePercentage:
        calculatePercentage(
          mobile,
          currentInteractions
        ),

      tabletPercentage:
        calculatePercentage(
          tablet,
          currentInteractions
        ),

      desktopPercentage:
        calculatePercentage(
          desktop,
          currentInteractions
        ),

      unknownPercentage:
        calculatePercentage(
          unknownDevice,
          currentInteractions
        ),
    },
  };
}


export async function getStoreEngagementPatterns(
  storeId: string,
  range: ResolvedAnalyticsRange
) {
  /*
   * =====================================================
   * Verify store
   * =====================================================
   */

  const store =
    await prisma.store.findUnique({
      where: {
        id:
          storeId,
      },

      select: {
        id:
          true,
      },
    });

  if (!store) {
    throw new Error(
      "STORE_NOT_FOUND"
    );
  }

  /*
   * =====================================================
   * Analytics range
   * =====================================================
   *
   * The controller has already resolved
   * the selected local date range into
   * timezone-safe UTC boundaries.
   */

  const timeZone =
    normalizeTimeZone(
      range.timeZone
    );

  const from =
    range.fromUtc;

  const to =
    range.toExclusiveUtc;

  /*
   * =====================================================
   * Meaningful interactions
   * =====================================================
   *
   * Since fromUtc/toExclusiveUtc were
   * generated using the selected timezone,
   * we no longer need to query one extra day.
   */

  /*
   * =====================================================
   * Generate exact local calendar buckets
   * =====================================================
   *
   * IMPORTANT:
   *
   * Do not generate these using:
   *
   * now - offset * 24 hours
   *
   * because DST can make a local calendar
   * day shorter or longer than 24 hours.
   *
   * range.from and range.to are date-only
   * strings:
   *
   * 2026-08-01
   * 2026-08-31
   */

  const dailyMap =
    new Map<
      string,
      DailyBucket
    >();

  let cursor =
    parseDateOnlyUtc(
      range.from
    );

  const finalDate =
    parseDateOnlyUtc(
      range.to
    );

  while (
    cursor <=
    finalDate
  ) {
    const dateKey =
      formatDateOnlyUtc(
        cursor
      );

    /*
     * dateKey already represents the
     * intended LOCAL calendar date.
     *
     * For labels we format it using UTC
     * so another timezone conversion does
     * not accidentally move it to the
     * previous/next day.
     */

    dailyMap.set(
      dateKey,
      {
        date:
          dateKey,

        label:
          getDateLabel(
            cursor,
            "UTC"
          ),

        weekday:
          getWeekday(
            cursor,
            "UTC"
          ),

        interactions:
          0,

        visitorKeys:
          new Set<string>(),
      }
    );

    cursor =
      addUtcCalendarDays(
        cursor,
        1
      );
  }

  /*
   * =====================================================
   * Weekday distribution
   * =====================================================
   */

  const weekdayMap =
    new Map<
      string,
      number
    >();

  for (
    const weekday
    of WEEKDAYS
  ) {
    weekdayMap.set(
      weekday,
      0
    );
  }

  /*
   * =====================================================
   * Hour distribution
   * =====================================================
   */

  const hourCounts =
    Array.from(
      {
        length:
          24,
      },
      () =>
        0
    );

  /*
   * Unique visitors for entire
   * selected period.
   */

  const periodVisitorKeys =
    new Set<string>();

  /*
   * =====================================================
   * Aggregate interactions
   * =====================================================
   */

  for await (const interaction of iterateMeaningfulInteractions(storeId, from, to)) {
    /*
     * Convert the UTC interaction timestamp
     * to its local calendar date.
     */

    const dateKey =
      getDateKey(
        interaction.createdAt,
        timeZone
      );

    /*
     * Extra safety:
     *
     * only include interactions whose local
     * date exists inside the selected period.
     */

    const dayBucket =
      dailyMap.get(
        dateKey
      );

    if (
      !dayBucket
    ) {
      continue;
    }

    /*
     * Daily count
     */

    dayBucket.interactions +=
      1;

    /*
     * Unique visitor
     */

    if (
      interaction.visitorKey
    ) {
      dayBucket.visitorKeys.add(
        interaction.visitorKey
      );

      periodVisitorKeys.add(
        interaction.visitorKey
      );
    }

    /*
     * =================================================
     * Weekday
     * =================================================
     */

    const weekday =
      getWeekday(
        interaction.createdAt,
        timeZone
      );

    weekdayMap.set(
      weekday,
      (
        weekdayMap.get(
          weekday
        ) ??
        0
      ) +
      1
    );

    /*
     * =================================================
     * Hour
     * =================================================
     */

    const hour =
      getHour(
        interaction.createdAt,
        timeZone
      );

    hourCounts[
      hour
    ] +=
      1;
  }

  /*
   * =====================================================
   * Daily trend
   * =====================================================
   */

  const dailyTrend =
    Array.from(
      dailyMap.values()
    ).map(
      (
        day
      ) => ({
        date:
          day.date,

        label:
          day.label,

        weekday:
          day.weekday,

        interactions:
          day.interactions,

        uniqueVisitors:
          day.visitorKeys
            .size,
      })
    );

  /*
   * =====================================================
   * Weekday distribution
   * =====================================================
   */

  const weekdayDistribution =
    WEEKDAYS.map(
      (
        weekday
      ) => ({
        weekday,

        shortLabel:
          weekday.slice(
            0,
            3
          ),

        interactions:
          weekdayMap.get(
            weekday
          ) ??
          0,
      })
    );

  /*
   * =====================================================
   * Hourly distribution
   * =====================================================
   */

  const hourlyDistribution =
    hourCounts.map(
      (
        count,
        hour
      ) => ({
        hour,

        label:
          formatHour(
            hour
          ),

        interactions:
          count,
      })
    );

  /*
   * =====================================================
   * Total interactions
   * =====================================================
   */

  const totalInteractions =
    dailyTrend.reduce(
      (
        total,
        day
      ) =>
        total +
        day.interactions,
      0
    );

  /*
   * =====================================================
   * Peak weekday
   * =====================================================
   */

  const peakDay =
    weekdayDistribution.reduce(
      (
        best,
        day
      ) => {
        if (
          !best ||
          day.interactions >
          best.interactions
        ) {
          return day;
        }

        return best;
      },
      null as
      | {
        weekday:
        string;

        shortLabel:
        string;

        interactions:
        number;
      }
      | null
    );

  /*
   * Don't call a weekday a peak
   * when there was no activity.
   */

  const finalPeakDay =
    peakDay &&
      peakDay.interactions >
      0
      ? {
        weekday:
          peakDay.weekday,

        interactions:
          peakDay.interactions,
      }
      : null;

  /*
   * =====================================================
   * Peak 2-hour window
   * =====================================================
   *
   * Example:
   *
   * 7 PM = 18
   * 8 PM = 14
   *
   * Peak:
   *
   * 7 PM - 9 PM
   * 32 interactions
   */

  let bestWindow:
    | {
      startHour:
      number;

      endHour:
      number;

      interactions:
      number;
    }
    | null =
    null;

  for (
    let startHour =
      0;
    startHour <
    24;
    startHour++
  ) {
    const secondHour =
      (
        startHour +
        1
      ) %
      24;

    const interactionsInWindow =
      hourCounts[
      startHour
      ] +
      hourCounts[
      secondHour
      ];

    if (
      !bestWindow ||
      interactionsInWindow >
      bestWindow.interactions
    ) {
      bestWindow = {
        startHour,

        endHour:
          (
            startHour +
            2
          ) %
          24,

        interactions:
          interactionsInWindow,
      };
    }
  }

  const peakTime =
    bestWindow &&
      bestWindow.interactions >
      0
      ? {
        startHour:
          bestWindow.startHour,

        endHour:
          bestWindow.endHour,

        label:
          `${formatHour(
            bestWindow.startHour
          )} – ${formatHour(
            bestWindow.endHour
          )}`,

        interactions:
          bestWindow.interactions,
      }
      : null;

  /*
   * =====================================================
   * Average daily interactions
   * =====================================================
   *
   * Use actual generated calendar buckets.
   *
   * This is slightly safer than assuming
   * days always matches dailyTrend.length.
   */

  const actualDays =
    dailyTrend.length;

  const averagePerDay =
    actualDays >
      0
      ? Math.round(
        (
          totalInteractions /
          actualDays
        ) *
        10
      ) /
      10
      : 0;

  /*
   * =====================================================
   * Final response
   * =====================================================
   */

  return {
    period: {
      preset:
        range.preset,

      from:
        range.from,

      to:
        range.to,

      days:
        range.days,

      timeZone,

      previousFrom:
        range.previousFrom,

      previousTo:
        range.previousTo,
    },

    summary: {
      totalInteractions,

      totalUniqueVisitors:
        periodVisitorKeys.size,

      averagePerDay,

      peakDay:
        finalPeakDay,

      peakTime,
    },

    dailyTrend,

    weekdayDistribution,

    hourlyDistribution,
  };
}

export async function getLocationPerformance(
  contextStoreId: string,
  range: ResolvedAnalyticsRange
) {
  /*
   * =====================================================
   * Context store
   * =====================================================
   *
   * The analytics page gives us one selected store.
   *
   * We use that store to securely determine which
   * business these locations belong to.
   */

  const contextStore =
    await prisma.store.findUnique({
      where: {
        id:
          contextStoreId,
      },

      select: {
        id:
          true,

        businessId:
          true,
      },
    });

  if (
    !contextStore
  ) {
    throw new Error(
      "STORE_NOT_FOUND"
    );
  }

  /*
   * =====================================================
   * Analytics range
   * =====================================================
   *
   * Do NOT calculate dates from `days` here anymore.
   *
   * The controller has already resolved:
   *
   * current range:
   * range.fromUtc
   * range.toExclusiveUtc
   *
   * previous comparison range:
   * range.previousFromUtc
   * range.previousToExclusiveUtc
   */

  const currentFrom =
    range.fromUtc;

  const currentTo =
    range.toExclusiveUtc;

  const previousFrom =
    range.previousFromUtc;

  const previousTo =
    range.previousToExclusiveUtc;

  /*
   * =====================================================
   * Business locations
   * =====================================================
   */

  const stores =
    await prisma.store.findMany({
      where: {
        businessId:
          contextStore.businessId,
      },

      select: {
        id:
          true,

        name:
          true,

        createdAt:
          true,
      },

      orderBy: {
        createdAt:
          "asc",
      },
    });

  /*
   * =====================================================
   * Empty business
   * =====================================================
   */

  if (
    stores.length ===
    0
  ) {
    return {
      period: {
        preset:
          range.preset,

        from:
          range.from,

        to:
          range.to,

        days:
          range.days,

        timeZone:
          range.timeZone,

        previousFrom:
          range.previousFrom,

        previousTo:
          range.previousTo,
      },

      summary: {
        totalLocations:
          0,

        locationsWithActivity:
          0,

        locationsNeedingAttention:
          0,

        totalInteractions:
          0,

        totalUniqueVisitors:
          0,

        bestLocation:
          null,
      },

      locations:
        [],
    };
  }

  /*
   * =====================================================
   * Store IDs
   * =====================================================
   */

  const storeIds =
    stores.map(
      (
        store
      ) =>
        store.id
    );

  /*
   * =====================================================
   * Analytics queries
   * =====================================================
   */

  const [
    currentGroups,

    previousGroups,

    uniqueVisitorRows,

    lifetimeGroups,

    businessUniqueVisitors,
  ] =
    await Promise.all([
      /*
       * ===============================================
       * Current meaningful interactions
       * ===============================================
       */

      prisma.interaction.groupBy({
        by: [
          "storeId",
        ],

        where: {
          storeId: {
            in:
              storeIds,
          },

          isDuplicate:
            false,

          isBot:
            false,

          createdAt: {
            gte:
              currentFrom,

            lt:
              currentTo,
          },
        },

        _count: {
          _all:
            true,
        },
      }),

      /*
       * ===============================================
       * Previous equivalent period
       * ===============================================
       *
       * Examples:
       *
       * Current:
       * Aug 1 -> Aug 31
       *
       * Previous:
       * Jul 1 -> Jul 31
       *
       *
       * Current:
       * Sep 1 -> Sep 12
       *
       * Previous:
       * Aug 1 -> Aug 12
       *
       * depending on the selected preset.
       */

      prisma.interaction.groupBy({
        by: [
          "storeId",
        ],

        where: {
          storeId: {
            in:
              storeIds,
          },

          isDuplicate:
            false,

          isBot:
            false,

          createdAt: {
            gte:
              previousFrom,

            lt:
              previousTo,
          },
        },

        _count: {
          _all:
            true,
        },
      }),

      /*
       * ===============================================
       * Unique visitors per location
       * ===============================================
       */

      prisma.interaction.findMany({
        where: {
          storeId: {
            in:
              storeIds,
          },

          visitorKey: {
            not:
              null,
          },

          isDuplicate:
            false,

          isBot:
            false,

          createdAt: {
            gte:
              currentFrom,

            lt:
              currentTo,
          },
        },

        select: {
          storeId:
            true,

          visitorKey:
            true,
        },

        distinct: [
          "storeId",
          "visitorKey",
        ],
      }),

      /*
       * ===============================================
       * Lifetime last meaningful activity
       * ===============================================
       *
       * IMPORTANT:
       *
       * Do NOT filter this by selected analytics range.
       *
       * This represents:
       *
       * "When was this location last used?"
       *
       * not:
       *
       * "When was it last used during this report?"
       */

      prisma.interaction.groupBy({
        by: [
          "storeId",
        ],

        where: {
          storeId: {
            in:
              storeIds,
          },

          isDuplicate:
            false,

          isBot:
            false,
        },

        _max: {
          createdAt:
            true,
        },
      }),

      /*
       * ===============================================
       * Unique visitors across whole business
       * ===============================================
       *
       * Do NOT add each location's unique visitor count.
       *
       * The same person may interact with:
       *
       * Saida
       * AND
       * Hamra
       *
       * during the same selected period.
       */

      prisma.interaction.findMany({
        where: {
          storeId: {
            in:
              storeIds,
          },

          visitorKey: {
            not:
              null,
          },

          isDuplicate:
            false,

          isBot:
            false,

          createdAt: {
            gte:
              currentFrom,

            lt:
              currentTo,
          },
        },

        select: {
          visitorKey:
            true,
        },

        distinct: [
          "visitorKey",
        ],
      }),
    ]);

  /*
   * =====================================================
   * Current interaction map
   * =====================================================
   */

  const currentMap =
    new Map<
      string,
      number
    >();

  for (
    const group
    of currentGroups
  ) {
    currentMap.set(
      group.storeId,
      group._count
        ._all
    );
  }

  /*
   * =====================================================
   * Previous interaction map
   * =====================================================
   */

  const previousMap =
    new Map<
      string,
      number
    >();

  for (
    const group
    of previousGroups
  ) {
    previousMap.set(
      group.storeId,
      group._count
        ._all
    );
  }

  /*
   * =====================================================
   * Unique visitor map
   * =====================================================
   */

  const visitorMap =
    new Map<
      string,
      number
    >();

  for (
    const row
    of uniqueVisitorRows
  ) {
    visitorMap.set(
      row.storeId,
      (
        visitorMap.get(
          row.storeId
        ) ??
        0
      ) +
      1
    );
  }

  /*
   * =====================================================
   * Last activity map
   * =====================================================
   */

  const lastActivityMap =
    new Map<
      string,
      Date | null
    >();

  for (
    const group
    of lifetimeGroups
  ) {
    lastActivityMap.set(
      group.storeId,
      group._max
        .createdAt ??
      null
    );
  }

  /*
   * =====================================================
   * Total business interactions
   * =====================================================
   */

  const totalInteractions =
    currentGroups.reduce(
      (
        total,
        group
      ) =>
        total +
        group._count
          ._all,
      0
    );

  /*
   * =====================================================
   * Build location performance
   * =====================================================
   */

  const locations =
    stores.map(
      (
        store
      ) => {
        const currentInteractions =
          currentMap.get(
            store.id
          ) ??
          0;

        const previousInteractions =
          previousMap.get(
            store.id
          ) ??
          0;

        const uniqueVisitors =
          visitorMap.get(
            store.id
          ) ??
          0;

        /*
         * Compare the selected period with
         * its previous equivalent period.
         */

        const changePercentage =
          calculateChangePercentage(
            currentInteractions,
            previousInteractions
          );

        /*
         * =================================================
         * Location status
         * =================================================
         *
         * Keep currentFrom here.
         *
         * getLocationStatus() may use the location's
         * creation date and reporting-period start to
         * distinguish a genuinely inactive location
         * from a location that was only recently created.
         */

        const status =
          getLocationStatus({
            current:
              currentInteractions,

            previous:
              previousInteractions,

            createdAt:
              store.createdAt,

            periodFrom:
              currentFrom,
          });

        return {
          id:
            store.id,

          name:
            store.name,

          isSelected:
            store.id ===
            contextStoreId,

          currentInteractions,

          previousInteractions,

          changePercentage,

          uniqueVisitors,

          activityShare:
            calculatePercentage(
              currentInteractions,
              totalInteractions
            ),

          /*
           * Lifetime most recent interaction.
           */

          lastInteractionAt:
            lastActivityMap.get(
              store.id
            ) ??
            null,

          status,
        };
      }
    );

  /*
   * =====================================================
   * Sort strongest locations first
   * =====================================================
   */

  locations.sort(
    (
      a,
      b
    ) =>
      b.currentInteractions -
      a.currentInteractions
  );

  /*
   * =====================================================
   * Best location
   * =====================================================
   */

  const bestLocation =
    locations[0] &&
      locations[0]
        .currentInteractions >
      0
      ? {
        id:
          locations[0]
            .id,

        name:
          locations[0]
            .name,

        interactions:
          locations[0]
            .currentInteractions,

        uniqueVisitors:
          locations[0]
            .uniqueVisitors,

        changePercentage:
          locations[0]
            .changePercentage,
      }
      : null;

  /*
   * =====================================================
   * Summary
   * =====================================================
   */

  const locationsWithActivity =
    locations.filter(
      (
        location
      ) =>
        location
          .currentInteractions >
        0
    ).length;

  const locationsNeedingAttention =
    locations.filter(
      (
        location
      ) =>
        location.status ===
        "DECLINING" ||
        location.status ===
        "NO_ACTIVITY"
    ).length;

  /*
   * =====================================================
   * Final response
   * =====================================================
   */

  return {
    period: {
      preset:
        range.preset,

      from:
        range.from,

      to:
        range.to,

      days:
        range.days,

      timeZone:
        range.timeZone,

      previousFrom:
        range.previousFrom,

      previousTo:
        range.previousTo,
    },

    summary: {
      totalLocations:
        stores.length,

      locationsWithActivity,

      locationsNeedingAttention,

      totalInteractions,

      totalUniqueVisitors:
        businessUniqueVisitors.length,

      bestLocation,
    },

    locations,
  };
}

export async function getWeeklyReport(
  storeId: string,
  timeZone = "UTC"
) {
  /*
   * =======================================================
   * Store
   * =======================================================
   */

  const store =
    await prisma.store.findUnique({
      where: {
        id:
          storeId,
      },

      select: {
        id:
          true,

        name:
          true,
      },
    });

  if (
    !store
  ) {
    throw new Error(
      "STORE_NOT_FOUND"
    );
  }

  /*
   * =======================================================
   * Weekly analytics range
   * =======================================================
   *
   * Weekly reports remain FIXED to 7 days.
   *
   * They are NOT affected by the custom range selected
   * on the Analytics dashboard.
   *
   * We use the same backend range resolver used by the
   * dashboard so:
   *
   * - timezone boundaries are correct
   * - current period is correct
   * - previous comparison period is correct
   * - all analytics services receive exactly the same range
   */

  const today =
    getDateKeyInTimeZone(
      new Date(),
      timeZone
    );

  const from =
    shiftDateKey(
      today,
      -6
    );

  const range =
    resolveAnalyticsRangeQuery({
      preset:
        "7d",

      from,

      to:
        today,

      timeZone,
    });
  /*
   * =======================================================
   * Reuse analytics services
   * =======================================================
   */

  const [
    engagement,

    patterns,

    cardPerformance,

    locationPerformance,

    actionCenter,
  ] =
    await Promise.all([
      getStoreEngagementSummary(
        storeId,
        range
      ),

      getStoreEngagementPatterns(
        storeId,
        range
      ),

      getStoreCardPerformance(
        storeId,
        range
      ),

      getLocationPerformance(
        storeId,
        range
      ),

      getActionCenter(
        storeId,
        range
      ),
    ]);

  /*
   * =======================================================
   * Relevant warnings
   * =======================================================
   *
   * Action Center includes business-wide Location
   * Performance.
   *
   * This weekly report belongs to one selected store.
   *
   * CARD warnings already belong to this store.
   * GOOGLE warnings already belong to this store.
   *
   * For LOCATION warnings we only keep warnings
   * belonging to this store.
   */

  const relevantWarnings =
    actionCenter.warnings.filter(
      (
        item
      ) => {
        if (
          item.entityType ===
          "LOCATION"
        ) {
          return (
            item.entityId ===
            storeId
          );
        }

        return true;
      }
    );

  /*
   * =======================================================
   * Important attention items
   * =======================================================
   *
   * Keep the weekly report short.
   *
   * The Analytics dashboard remains the place
   * for the complete Action Center.
   */

  const warningItems =
    relevantWarnings.filter(
      (
        item
      ) =>
        item.severity ===
        "WARNING"
    );

  const attentionItems =
    warningItems
      .slice(
        0,
        3
      )
      .map(
        (
          item
        ) => ({
          id:
            item.id,

          type:
            item.type,

          entityType:
            item.entityType,

          entityId:
            item.entityId,

          title:
            item.title,

          description:
            item.description,

          metric:
            item.metric,
        })
      );

  /*
   * =======================================================
   * Highlights
   * =======================================================
   */

  const highlights =
    actionCenter.highlights
      .filter(
        (
          item
        ) =>
          item.type !==
          "ALL_HEALTHY"
      )
      .slice(
        0,
        3
      )
      .map(
        (
          item
        ) => ({
          id:
            item.id,

          type:
            item.type,

          title:
            item.title,

          description:
            item.description,

          metric:
            item.metric,
        })
      );

  /*
   * =======================================================
   * Health
   * =======================================================
   *
   * Use the warnings relevant to THIS location.
   *
   * Don't use:
   *
   * actionCenter.summary.warningCount
   *
   * because Action Center can contain a location warning
   * belonging to another branch.
   */

  const health:
    WeeklyReportHealth =
    warningItems.length >
      0
      ? "NEEDS_ATTENTION"
      : "HEALTHY";

  /*
   * =======================================================
   * Best card
   * =======================================================
   */

  const bestCard =
    cardPerformance
      .summary
      .bestCard
      ? {
        id:
          cardPerformance
            .summary
            .bestCard
            .id,

        name:
          cardPerformance
            .summary
            .bestCard
            .label,

        code:
          cardPerformance
            .summary
            .bestCard
            .code,

        interactions:
          cardPerformance
            .summary
            .bestCard
            .meaningfulInteractions,

        uniqueVisitors:
          cardPerformance
            .summary
            .bestCard
            .uniqueVisitors,
      }
      : null;

  /*
   * =======================================================
   * Best location
   * =======================================================
   *
   * Location Performance is intentionally business-wide.
   *
   * This gives the owner useful context about which
   * location is performing strongest.
   *
   * Only show it when the business has more than
   * one location.
   */

  const bestLocation =
    locationPerformance
      .summary
      .totalLocations >
      1 &&
      locationPerformance
        .summary
        .bestLocation
      ? {
        id:
          locationPerformance
            .summary
            .bestLocation
            .id,

        name:
          locationPerformance
            .summary
            .bestLocation
            .name,

        interactions:
          locationPerformance
            .summary
            .bestLocation
            .interactions,

        uniqueVisitors:
          locationPerformance
            .summary
            .bestLocation
            .uniqueVisitors,

        changePercentage:
          locationPerformance
            .summary
            .bestLocation
            .changePercentage,
      }
      : null;

  /*
   * =======================================================
   * Final report
   * =======================================================
   */

  return {
    generatedAt:
      new Date(),

    /*
     * =====================================================
     * Store
     * =====================================================
     */

    store: {
      id:
        store.id,

      name:
        store.name,
    },

    /*
     * =====================================================
     * Period
     * =====================================================
     *
     * range is now the source of truth.
     *
     * Don't read these values from:
     *
     * patterns.period
     * engagement.period
     * cardPerformance.period
     *
     * even though they should contain the same values.
     */

    period: {
      preset:
        range.preset,

      days:
        range.days,

      from:
        range.from,

      to:
        range.to,

      timeZone:
        range.timeZone,

      previousFrom:
        range.previousFrom,

      previousTo:
        range.previousTo,
    },

    /*
     * =====================================================
     * Health
     * =====================================================
     */

    health,

    /*
     * =====================================================
     * Overview
     * =====================================================
     */

    overview: {
      interactions: {
        current:
          engagement
            .interactions
            .current,

        previous:
          engagement
            .interactions
            .previous,

        changePercentage:
          engagement
            .interactions
            .changePercentage,
      },

      visitors: {
        unique:
          engagement
            .visitors
            .unique,

        new:
          engagement
            .visitors
            .new,

        returning:
          engagement
            .visitors
            .returning,

        newPercentage:
          engagement
            .visitors
            .newPercentage,

        returningPercentage:
          engagement
            .visitors
            .returningPercentage,
      },

      sources: {
        nfc:
          engagement
            .sources
            .nfc,

        qr:
          engagement
            .sources
            .qr,

        /*
         * Keep unknown as well so the report
         * doesn't silently lose source data.
         */

        unknown:
          engagement
            .sources
            .unknown,

        nfcPercentage:
          engagement
            .sources
            .nfcPercentage,

        qrPercentage:
          engagement
            .sources
            .qrPercentage,

        unknownPercentage:
          engagement
            .sources
            .unknownPercentage,
      },

      devices: {
        mobile:
          engagement
            .devices
            .mobile,

        tablet:
          engagement
            .devices
            .tablet,

        desktop:
          engagement
            .devices
            .desktop,

        unknown:
          engagement
            .devices
            .unknown,

        mobilePercentage:
          engagement
            .devices
            .mobilePercentage,

        tabletPercentage:
          engagement
            .devices
            .tabletPercentage,

        desktopPercentage:
          engagement
            .devices
            .desktopPercentage,

        unknownPercentage:
          engagement
            .devices
            .unknownPercentage,
      },
    },

    /*
     * =====================================================
     * Engagement patterns
     * =====================================================
     */

    patterns: {
      averagePerDay:
        patterns
          .summary
          .averagePerDay,

      totalInteractions:
        patterns
          .summary
          .totalInteractions,

      totalUniqueVisitors:
        patterns
          .summary
          .totalUniqueVisitors,

      peakDay:
        patterns
          .summary
          .peakDay,

      peakTime:
        patterns
          .summary
          .peakTime,
    },

    /*
     * =====================================================
     * Performance
     * =====================================================
     */

    performance: {
      bestCard,

      bestLocation,

      cards: {
        total:
          cardPerformance
            .summary
            .totalCards,

        active:
          cardPerformance
            .summary
            .activeCards,

        withActivity:
          cardPerformance
            .summary
            .cardsWithActivity,

        needingAttention:
          cardPerformance
            .summary
            .cardsNeedingAttention,
      },

      locations: {
        total:
          locationPerformance
            .summary
            .totalLocations,

        withActivity:
          locationPerformance
            .summary
            .locationsWithActivity,

        needingAttention:
          locationPerformance
            .summary
            .locationsNeedingAttention,
      },
    },

    /*
     * =====================================================
     * Attention
     * =====================================================
     */

    attention: {
      total:
        warningItems.length,

      items:
        attentionItems,
    },

    /*
     * =====================================================
     * Highlights
     * =====================================================
     */

    highlights,
  };
}

export async function getDataReport(
  storeId: string,
  range: ResolvedAnalyticsRange
) {
  /*
   * =======================================================
   * Store
   * =======================================================
   */

  const store =
    await prisma.store.findUnique({
      where: {
        id: storeId,
      },

      select: {
        id: true,
        name: true,
      },
    });

  if (!store) {
    throw new Error(
      "STORE_NOT_FOUND"
    );
  }

  /*
   * =======================================================
   * Analytics data
   * =======================================================
   *
   * Unlike getWeeklyReport(), this function receives
   * the selected Analytics dashboard range.
   */

  const [
    engagement,
    patterns,
    cardPerformance,
    locationPerformance,
    actionCenter,
  ] =
    await Promise.all([
      getStoreEngagementSummary(
        storeId,
        range
      ),

      getStoreEngagementPatterns(
        storeId,
        range
      ),

      getStoreCardPerformance(
        storeId,
        range
      ),

      getLocationPerformance(
        storeId,
        range
      ),

      getActionCenter(
        storeId,
        range
      ),
    ]);

  /*
   * =======================================================
   * Relevant warnings
   * =======================================================
   */

  const relevantWarnings =
    actionCenter.warnings.filter(
      (item) => {
        /*
         * Location Performance is business-wide.
         *
         * The report itself belongs to the selected
         * location, so don't show warnings belonging
         * to another location.
         */

        if (
          item.entityType ===
          "LOCATION"
        ) {
          return (
            item.entityId ===
            storeId
          );
        }

        return true;
      }
    );

  /*
   * =======================================================
   * Attention
   * =======================================================
   */

  const warningItems =
    relevantWarnings.filter(
      (item) =>
        item.severity ===
        "WARNING"
    );

  const attentionItems =
    warningItems
      .slice(
        0,
        3
      )
      .map(
        (item) => ({
          id:
            item.id,

          type:
            item.type,

          entityType:
            item.entityType,

          entityId:
            item.entityId,

          title:
            item.title,

          description:
            item.description,

          metric:
            item.metric,
        })
      );

  /*
   * =======================================================
   * Highlights
   * =======================================================
   */

  const highlights =
    actionCenter.highlights
      .filter(
        (item) =>
          item.type !==
          "ALL_HEALTHY"
      )
      .slice(
        0,
        3
      )
      .map(
        (item) => ({
          id:
            item.id,

          type:
            item.type,

          title:
            item.title,

          description:
            item.description,

          metric:
            item.metric,
        })
      );

  /*
   * =======================================================
   * Health
   * =======================================================
   */

  const health:
    WeeklyReportHealth =
    warningItems.length >
    0
      ? "NEEDS_ATTENTION"
      : "HEALTHY";

  /*
   * =======================================================
   * Best card
   * =======================================================
   */

  const bestCard =
    cardPerformance
      .summary
      .bestCard
      ? {
          id:
            cardPerformance
              .summary
              .bestCard
              .id,

          name:
            cardPerformance
              .summary
              .bestCard
              .label,

          code:
            cardPerformance
              .summary
              .bestCard
              .code,

          interactions:
            cardPerformance
              .summary
              .bestCard
              .meaningfulInteractions,

          uniqueVisitors:
            cardPerformance
              .summary
              .bestCard
              .uniqueVisitors,
        }
      : null;

  /*
   * =======================================================
   * Best location
   * =======================================================
   */

  const bestLocation =
    locationPerformance
      .summary
      .totalLocations >
      1 &&
    locationPerformance
      .summary
      .bestLocation
      ? {
          id:
            locationPerformance
              .summary
              .bestLocation
              .id,

          name:
            locationPerformance
              .summary
              .bestLocation
              .name,

          interactions:
            locationPerformance
              .summary
              .bestLocation
              .interactions,

          uniqueVisitors:
            locationPerformance
              .summary
              .bestLocation
              .uniqueVisitors,

          changePercentage:
            locationPerformance
              .summary
              .bestLocation
              .changePercentage,
        }
      : null;

  /*
   * =======================================================
   * Final Data Report
   * =======================================================
   */

  return {
    generatedAt:
      new Date(),

    store: {
      id:
        store.id,

      name:
        store.name,
    },

    period: {
      preset:
        range.preset,

      days:
        range.days,

      from:
        range.from,

      to:
        range.to,

      timeZone:
        range.timeZone,

      previousFrom:
        range.previousFrom,

      previousTo:
        range.previousTo,
    },

    health,

    /*
     * =====================================================
     * Overview
     * =====================================================
     */

    overview: {
      interactions: {
        current:
          engagement
            .interactions
            .current,

        previous:
          engagement
            .interactions
            .previous,

        changePercentage:
          engagement
            .interactions
            .changePercentage,
      },

      visitors: {
        unique:
          engagement
            .visitors
            .unique,

        new:
          engagement
            .visitors
            .new,

        returning:
          engagement
            .visitors
            .returning,

        newPercentage:
          engagement
            .visitors
            .newPercentage,

        returningPercentage:
          engagement
            .visitors
            .returningPercentage,
      },

      sources: {
        nfc:
          engagement
            .sources
            .nfc,

        qr:
          engagement
            .sources
            .qr,

        unknown:
          engagement
            .sources
            .unknown,

        nfcPercentage:
          engagement
            .sources
            .nfcPercentage,

        qrPercentage:
          engagement
            .sources
            .qrPercentage,

        unknownPercentage:
          engagement
            .sources
            .unknownPercentage,
      },

      devices: {
        mobile:
          engagement
            .devices
            .mobile,

        tablet:
          engagement
            .devices
            .tablet,

        desktop:
          engagement
            .devices
            .desktop,

        unknown:
          engagement
            .devices
            .unknown,

        mobilePercentage:
          engagement
            .devices
            .mobilePercentage,

        tabletPercentage:
          engagement
            .devices
            .tabletPercentage,

        desktopPercentage:
          engagement
            .devices
            .desktopPercentage,

        unknownPercentage:
          engagement
            .devices
            .unknownPercentage,
      },
    },

    /*
     * =====================================================
     * Patterns
     * =====================================================
     */

    patterns: {
      averagePerDay:
        patterns
          .summary
          .averagePerDay,

      totalInteractions:
        patterns
          .summary
          .totalInteractions,

      totalUniqueVisitors:
        patterns
          .summary
          .totalUniqueVisitors,

      peakDay:
        patterns
          .summary
          .peakDay,

      peakTime:
        patterns
          .summary
          .peakTime,
    },

    /*
     * =====================================================
     * Performance
     * =====================================================
     */

    performance: {
      bestCard,

      bestLocation,

      cards: {
        total:
          cardPerformance
            .summary
            .totalCards,

        active:
          cardPerformance
            .summary
            .activeCards,

        withActivity:
          cardPerformance
            .summary
            .cardsWithActivity,

        needingAttention:
          cardPerformance
            .summary
            .cardsNeedingAttention,
      },

      locations: {
        total:
          locationPerformance
            .summary
            .totalLocations,

        withActivity:
          locationPerformance
            .summary
            .locationsWithActivity,

        needingAttention:
          locationPerformance
            .summary
            .locationsNeedingAttention,
      },
    },

    /*
     * =====================================================
     * Attention
     * =====================================================
     */

    attention: {
      total:
        warningItems.length,

      items:
        attentionItems,
    },

    /*
     * =====================================================
     * Highlights
     * =====================================================
     */

    highlights,
  };
}

export async function getFilteredAnalyticsReport(
  storeId: string,
  range: ResolvedAnalyticsRange,
) {
  const store =
    await prisma.store.findUnique({
      where: {
        id:
          storeId,
      },

      select: {
        id:
          true,

        name:
          true,

        googleReviewUrl: true,
        googlePlaceId: true,

        business: {
          select: {
            id:
              true,

            name:
              true,
          },
        },
      },
    });

  if (!store) {
    throw new Error(
      "STORE_NOT_FOUND"
    );
  }

  const [
    engagement,
    patterns,
    cards,
    locations,
  ] =
    await Promise.all([
      getStoreEngagementSummary(
        storeId,
        range
      ),

      getStoreEngagementPatterns(
        storeId,
        range,
      ),

      getStoreCardPerformance(
        storeId,
        range
      ),

      getLocationPerformance(
        storeId,
        range
      ),
    ]);

  const actionCenter = buildActionCenter({
    store, range, cardPerformance: cards, locationPerformance: locations,
  });
  const { googleReviewUrl, googlePlaceId, ...reportStore } = store;

  const relevantWarnings =
    actionCenter.warnings.filter(
      (
        item
      ) => {
        if (
          item.entityType ===
          "LOCATION"
        ) {
          return (
            item.entityId ===
            storeId
          );
        }

        return true;
      }
    );

  return {
    generatedAt:
      new Date(),

    period: {
      preset:
        range.preset,

      from:
        range.from,

      to:
        range.to,

      days:
        range.days,

      timeZone:
        range.timeZone,

      previousFrom:
        range.previousFrom,

      previousTo:
        range.previousTo,
    },

    store: reportStore,

    engagement,

    patterns,

    cards,

    warnings:
      relevantWarnings,
  };
}