import {
  formatInTimeZone,
} from "date-fns-tz";

import type {
  AnalyticsQuery,
} from "../modules/analytics/analytics.schema.js";

import {
  resolveAnalyticsRangeQuery,
} from "../modules/analytics/utils/analytics-range.util.js";

const DAY_MS =
  24 *
  60 *
  60 *
  1000;

function shiftDateKey(
  value:
    string,

  amount:
    number
) {
  const date =
    new Date(
      `${value}T00:00:00.000Z`
    );

  return new Date(
    date.getTime() +
      amount *
        DAY_MS
  )
    .toISOString()
    .slice(
      0,
      10
    );
}

export function getAnalyticsDateRange(
  query:
    AnalyticsQuery
) {
  /*
   * "Today" must mean today in the
   * selected analytics timezone.
   *
   * NOT today in UTC.
   */
  const today =
    formatInTimeZone(
      new Date(),
      query.timeZone,
      "yyyy-MM-dd"
    );

  let from:
    string;

  let to:
    string;

  switch (
    query.range
  ) {
    case "today": {
      from =
        today;

      to =
        today;

      break;
    }

    case "7d": {
      from =
        shiftDateKey(
          today,
          -6
        );

      to =
        today;

      break;
    }

    case "30d": {
      from =
        shiftDateKey(
          today,
          -29
        );

      to =
        today;

      break;
    }

    case "custom": {
      if (
        !query.from ||
        !query.to
      ) {
        throw new Error(
          "INVALID_DATE_RANGE"
        );
      }

      from =
        query.from;

      to =
        query.to;

      break;
    }

    default: {
      from =
        shiftDateKey(
          today,
          -29
        );

      to =
        today;
    }
  }

  /*
   * This utility converts calendar dates
   * in the selected timezone into proper
   * UTC boundaries.
   */
  const range =
    resolveAnalyticsRangeQuery({
      preset:
        query.range ===
          "today"
          ? "custom"
          : query.range,

      from,

      to,

      timeZone:
        query.timeZone,
    });

  return {
    /*
     * DB UTC boundaries.
     *
     * Always use:
     *
     * >= from
     * < to
     */
    from:
      range.fromUtc,

    to:
      range.toExclusiveUtc,

    previousFrom:
      range.previousFromUtc,

    previousTo:
      range.previousToExclusiveUtc,
  };
}