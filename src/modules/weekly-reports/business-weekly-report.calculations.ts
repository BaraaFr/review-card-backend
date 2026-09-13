import { calculateChangePercentage as calculateChange, calculatePercentage } from "../analytics/utils/analytics-math.js";
import { formatDateInTimeZone, formatHour, getHourInTimeZone, getWeekdayName } from "./weekly-report-time.util.js";
import type { WeeklyReportContext, WeeklyReportMetrics } from "./business-weekly-report.data.js";

export type WeeklyReportPeriod = { now: Date; currentFrom: Date; previousFrom: Date; timeZone: string };

export function buildEmptyWeeklyReport(context: WeeklyReportContext, period: WeeklyReportPeriod) {
  const { business } = context;
  const { now, currentFrom, timeZone } = period;
      return {
        business,
  
        period: {
          from:
            formatDateInTimeZone(
              currentFrom,
              timeZone
            ),
  
          to:
            formatDateInTimeZone(
              now,
              timeZone
            ),
  
          timeZone,
        },
  
        overview: {
          interactions:
            0,
  
          previousInteractions:
            0,
  
          changePercentage:
            0,
  
          uniqueVisitors:
            0,
  
          nfc:
            0,
  
          qr:
            0,
  
          nfcPercentage:
            0,
  
          qrPercentage:
            0,
        },
  
        patterns: {
          peakDay:
            null,
  
          peakTime:
            null,
        },
  
        performance: {
          bestLocation:
            null,
  
          bestCard:
            null,
        },
  
        warnings: [],
      };

  
}

function rankLocations(stores: WeeklyReportContext["stores"], metrics: WeeklyReportMetrics) {
  const { currentStoreGroups, previousStoreGroups } = metrics;
    /*
     * Locations
     */
  
    const currentStoreMap =
      new Map<
        string,
        number
      >();
  
    for (
      const group
      of currentStoreGroups
    ) {
      currentStoreMap.set(
        group.storeId,
        group._count
          ._all
      );
    }
  
    const previousStoreMap =
      new Map<
        string,
        number
      >();
  
    for (
      const group
      of previousStoreGroups
    ) {
      previousStoreMap.set(
        group.storeId,
        group._count
          ._all
      );
    }
  
    const locationPerformance =
      stores.map(
        (
          store
        ) => {
          const current =
            currentStoreMap.get(
              store.id
            ) ??
            0;
  
          const previous =
            previousStoreMap.get(
              store.id
            ) ??
            0;
  
          return {
            ...store,
  
            current,
  
            previous,
  
            changePercentage:
              calculateChange(
                current,
                previous
              ),
          };
        }
      );
  
    locationPerformance.sort(
      (
        a,
        b
      ) =>
        b.current -
        a.current
    );
  
    const bestLocation =
      locationPerformance[0] &&
      locationPerformance[0]
        .current >
        0
        ? {
            id:
              locationPerformance[0]
                .id,
  
            name:
              locationPerformance[0]
                .name,
  
            interactions:
              locationPerformance[0]
                .current,
  
            changePercentage:
              locationPerformance[0]
                .changePercentage,
          }
        : null;
  
  return { locationPerformance, bestLocation };
}

function rankCards(activeCards: WeeklyReportContext["activeCards"], metrics: WeeklyReportMetrics) {
  const { currentCardGroups, lifetimeCardGroups } = metrics;
    /*
     * Cards
     */
  
    const currentCardMap =
      new Map<
        string,
        number
      >();
  
    for (
      const group
      of currentCardGroups
    ) {
      if (
        group.cardId
      ) {
        currentCardMap.set(
          group.cardId,
          group._count
            ._all
        );
      }
    }
  
    const lastCardActivityMap =
      new Map<
        string,
        Date | null
      >();
  
    for (
      const group
      of lifetimeCardGroups
    ) {
      if (
        group.cardId
      ) {
        lastCardActivityMap.set(
          group.cardId,
          group._max
            .createdAt ??
            null
        );
      }
    }
  
    const cardPerformance =
      activeCards.map(
        (
          card
        ) => ({
          ...card,
  
          interactions:
            currentCardMap.get(
              card.id
            ) ??
            0,
  
          lastInteractionAt:
            lastCardActivityMap.get(
              card.id
            ) ??
            null,
        })
      );
  
    cardPerformance.sort(
      (
        a,
        b
      ) =>
        b.interactions -
        a.interactions
    );
  
    const bestCard =
      cardPerformance[0] &&
      cardPerformance[0]
        .interactions >
        0
        ? {
            id:
              cardPerformance[0]
                .id,
  
            label:
              cardPerformance[0]
                .label,
  
            code:
              cardPerformance[0]
                .code,
  
            interactions:
              cardPerformance[0]
                .interactions,
          }
        : null;
  
  return { cardPerformance, bestCard };
}

function getTimingPatterns(timingRows: WeeklyReportMetrics["timingRows"], timeZone: string) {
    /*
     * Peak day + peak time.
     */
  
    const weekdayCounts =
      new Map<
        string,
        number
      >();
  
    const hourCounts =
      Array.from(
        {
          length:
            24,
        },
        () =>
          0
      );
  
    for (
      const row
      of timingRows
    ) {
      const weekday =
        getWeekdayName(
          row.createdAt,
          timeZone
        );
  
      weekdayCounts.set(
        weekday,
        (
          weekdayCounts.get(
            weekday
          ) ??
          0
        ) +
          1
      );
  
      const hour =
        getHourInTimeZone(
          row.createdAt,
          timeZone
        );
  
      hourCounts[
        hour
      ] +=
        1;
    }
  
    let peakDay:
      | {
          weekday:
            string;
  
          interactions:
            number;
        }
      | null =
      null;
  
    for (
      const [
        weekday,
        interactions,
      ]
      of weekdayCounts
    ) {
      if (
        !peakDay ||
        interactions >
          peakDay.interactions
      ) {
        peakDay = {
          weekday,
          interactions,
        };
      }
    }
  
    let peakWindow:
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
      const nextHour =
        (
          startHour +
          1
        ) %
        24;
  
      const interactions =
        hourCounts[
          startHour
        ] +
        hourCounts[
          nextHour
        ];
  
      if (
        !peakWindow ||
        interactions >
          peakWindow.interactions
      ) {
        peakWindow = {
          startHour,
  
          endHour:
            (
              startHour +
              2
            ) %
            24,
  
          interactions,
        };
      }
    }
  
    const peakTime =
      peakWindow &&
      peakWindow.interactions >
        0
        ? {
            ...peakWindow,
  
            label:
              `${formatHour(
                peakWindow.startHour
              )} – ${formatHour(
                peakWindow.endHour
              )}`,
          }
        : null;
  
  return { peakDay, peakTime };
}

function getWarnings(
  locationPerformance: ReturnType<typeof rankLocations>["locationPerformance"],
  cardPerformance: ReturnType<typeof rankCards>["cardPerformance"],
  currentFrom: Date,
) {
    /*
     * Warnings.
     */
  
    const warnings: {
      type:
        "LOCATION" |
        "CARD";
  
      title:
        string;
  
      description:
        string;
    }[] =
      [];
  
    for (
      const location
      of locationPerformance
    ) {
      if (
        location.current ===
          0 &&
        location.previous >
          0
      ) {
        warnings.push({
          type:
            "LOCATION",
  
          title:
            `${location.name ?? "Location"} has stopped receiving engagement`,
  
          description:
            "No meaningful interactions were recorded during the last 7 days.",
        });
  
        continue;
      }
  
      if (
        location
          .changePercentage !==
          null &&
        location
          .changePercentage <=
          -20
      ) {
        warnings.push({
          type:
            "LOCATION",
  
          title:
            `${location.name ?? "Location"} engagement decreased`,
  
          description:
            `Engagement dropped ${Math.abs(
              location
                .changePercentage
            )}% compared with the previous week.`,
        });
      }
    }
  
    for (
      const card
      of cardPerformance
    ) {
      const displayName =
        card.label ||
        `Card ${card.code.slice(
          0,
          6
        )}`;
  
      if (
        !card.lastInteractionAt
      ) {
        warnings.push({
          type:
            "CARD",
  
          title:
            `${displayName} has no activity yet`,
  
          description:
            "This active card has never recorded a meaningful customer interaction.",
        });
  
        continue;
      }
  
      if (
        card.lastInteractionAt <
        currentFrom
      ) {
        warnings.push({
          type:
            "CARD",
  
          title:
            `${displayName} needs attention`,
  
          description:
            "This active card has had no meaningful activity during the last 7 days.",
        });
      }
    }
  
  return warnings;
}

export function buildBusinessWeeklyReport(
  context: WeeklyReportContext, metrics: WeeklyReportMetrics, period: WeeklyReportPeriod,
) {
  const { business, stores, activeCards } = context;
  const { currentCount, previousCount, uniqueVisitors, sourceGroups, timingRows } = metrics;
  const { now, currentFrom, timeZone } = period;
    /*
     * Sources
     */
  
    const sourceMap =
      new Map<
        string,
        number
      >();
  
    for (
      const group
      of sourceGroups
    ) {
      sourceMap.set(
        group.source,
        group._count
          ._all
      );
    }
  
    const nfc =
      sourceMap.get(
        "NFC"
      ) ??
      0;
  
    const qr =
      sourceMap.get(
        "QR"
      ) ??
      0;
  
  const { locationPerformance, bestLocation } = rankLocations(stores, metrics);
  const { cardPerformance, bestCard } = rankCards(activeCards, metrics);
  const { peakDay, peakTime } = getTimingPatterns(timingRows, timeZone);
  const warnings = getWarnings(locationPerformance, cardPerformance, currentFrom);
    return {
      business,
  
      generatedAt:
        now,
  
      period: {
        from:
          formatDateInTimeZone(
            currentFrom,
            timeZone
          ),
  
        to:
          formatDateInTimeZone(
            now,
            timeZone
          ),
  
        timeZone,
      },
  
      overview: {
        interactions:
          currentCount,
  
        previousInteractions:
          previousCount,
  
        changePercentage:
          calculateChange(
            currentCount,
            previousCount
          ),
  
        uniqueVisitors:
          uniqueVisitors.length,
  
        nfc,
  
        qr,
  
        nfcPercentage:
          calculatePercentage(
            nfc,
            currentCount
          ),
  
        qrPercentage:
          calculatePercentage(
            qr,
            currentCount
          ),
      },
  
      patterns: {
        peakDay:
          peakDay &&
          peakDay.interactions >
            0
            ? peakDay
            : null,
  
        peakTime,
      },
  
      performance: {
        bestLocation,
  
        bestCard,
      },
  
      warnings:
        warnings.slice(
          0,
          5
        ),
    };
}
