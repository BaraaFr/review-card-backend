import type { AnalyticsQuery } from "../modules/analytics/analytics.schema.js";

type DateRange = {
  from: Date;
  to: Date;

  previousFrom: Date;
  previousTo: Date;
};

const DAY =
  24 * 60 * 60 * 1000;

export const getAnalyticsDateRange = (
  query: AnalyticsQuery
): DateRange => {
  const now = new Date();

  let from: Date;
  let to: Date;

  switch (query.range) {
    case "today": {
      from = new Date(now);

      from.setUTCHours(
        0,
        0,
        0,
        0
      );

      to = now;

      break;
    }

    case "7d": {
      to = now;

      from = new Date(
        now.getTime() -
          7 * DAY
      );

      break;
    }

    case "30d": {
      to = now;

      from = new Date(
        now.getTime() -
          30 * DAY
      );

      break;
    }

    case "custom": {
      if (!query.from || !query.to) {
        throw new Error(
          "INVALID_DATE_RANGE"
        );
      }

      from = new Date(
        `${query.from}T00:00:00.000Z`
      );

      to = new Date(
        `${query.to}T23:59:59.999Z`
      );

      break;
    }

    default: {
      throw new Error(
        "INVALID_DATE_RANGE"
      );
    }
  }

  const duration =
    to.getTime() -
    from.getTime();

  const previousTo =
    new Date(from.getTime());

  const previousFrom =
    new Date(
      from.getTime() -
        duration
    );

  return {
    from,
    to,
    previousFrom,
    previousTo,
  };
};