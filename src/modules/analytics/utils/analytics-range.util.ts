import {
    fromZonedTime,
  } from "date-fns-tz";
  
  import {
    z,
  } from "zod";
  
  const DAY_MS =
    24 * 60 * 60 * 1000;
  
  const MAX_RANGE_DAYS =
    366;
  
  export const analyticsPresetSchema =
    z.enum([
      "7d",
      "30d",
      "this-month",
      "last-month",
      "custom",
    ]);
  
  export type AnalyticsPreset =
    z.infer<
      typeof analyticsPresetSchema
    >;
  
  export type ResolvedAnalyticsRange = {
    preset:
      AnalyticsPreset;
  
    from:
      string;
  
    to:
      string;
  
    timeZone:
      string;
  
    days:
      number;
  
    fromUtc:
      Date;
  
    toExclusiveUtc:
      Date;
  
    previousFrom:
      string;
  
    previousTo:
      string;
  
    previousFromUtc:
      Date;
  
    previousToExclusiveUtc:
      Date;
  };
  
  export class AnalyticsRangeError extends Error {}
  
  const querySchema =
    z.object({
      preset:
        analyticsPresetSchema,
  
      from:
        z.string()
          .regex(
            /^\d{4}-\d{2}-\d{2}$/
          ),
  
      to:
        z.string()
          .regex(
            /^\d{4}-\d{2}-\d{2}$/
          ),
  
      timeZone:
        z.string()
          .min(1)
          .max(100),
    });
  
  function isValidTimeZone(
    timeZone: string
  ) {
    try {
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone,
        }
      ).format(
        new Date()
      );
  
      return true;
    } catch {
      return false;
    }
  }
  
  function pad(
    value: number
  ) {
    return String(
      value
    ).padStart(
      2,
      "0"
    );
  }
  
  function parseDateOnly(
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
  
    const date =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day
        )
      );
  
    /*
     * Prevent invalid dates such as
     * 2026-02-31 silently rolling
     * into March.
     */
    if (
      date.getUTCFullYear() !==
        year ||
      date.getUTCMonth() !==
        month - 1 ||
      date.getUTCDate() !==
        day
    ) {
      throw new AnalyticsRangeError(
        "Invalid analytics date."
      );
    }
  
    return date;
  }
  
  function formatDateOnly(
    date: Date
  ) {
    return `${date.getUTCFullYear()}-${pad(
      date.getUTCMonth() +
        1
    )}-${pad(
      date.getUTCDate()
    )}`;
  }
  
  function addDays(
    date: Date,
    amount: number
  ) {
    return new Date(
      date.getTime() +
        amount *
          DAY_MS
    );
  }
  

  
  function endOfMonth(
    date: Date
  ) {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() +
          1,
        0
      )
    );
  }
  
  function previousMonthStart(
    date: Date
  ) {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth() -
          1,
        1
      )
    );
  }
  
  function getInclusiveDays(
    from: Date,
    to: Date
  ) {
    return (
      Math.floor(
        (
          to.getTime() -
          from.getTime()
        ) /
          DAY_MS
      ) + 1
    );
  }
  
  function toUtcBoundary(
    dateOnly: string,
    timeZone: string
  ) {
    return fromZonedTime(
      `${dateOnly}T00:00:00`,
      timeZone
    );
  }
  
  function getPreviousPeriod(
    preset:
      AnalyticsPreset,
    fromDate:
      Date,
    toDate:
      Date,
    days:
      number
  ) {
    /*
     * This month:
     *
     * Sep 1 -> Sep 12
     *
     * compares against:
     *
     * Aug 1 -> Aug 12
     */
    if (
      preset ===
      "this-month"
    ) {
      const previousFrom =
        previousMonthStart(
          fromDate
        );
  
      const previousMonthEnd =
        endOfMonth(
          previousFrom
        );
  
      const desiredDay =
        toDate.getUTCDate();
  
      const maxDay =
        previousMonthEnd.getUTCDate();
  
      const previousTo =
        new Date(
          Date.UTC(
            previousFrom.getUTCFullYear(),
            previousFrom.getUTCMonth(),
            Math.min(
              desiredDay,
              maxDay
            )
          )
        );
  
      return {
        from:
          previousFrom,
  
        to:
          previousTo,
      };
    }
  
    /*
     * Last month:
     *
     * Aug 1 -> Aug 31
     *
     * compares against:
     *
     * Jul 1 -> Jul 31
     */
    if (
      preset ===
      "last-month"
    ) {
      const previousFrom =
        previousMonthStart(
          fromDate
        );
  
      return {
        from:
          previousFrom,
  
        to:
          endOfMonth(
            previousFrom
          ),
      };
    }
  
    /*
     * 7d / 30d / custom:
     *
     * Compare against the immediately
     * preceding range with the same
     * number of days.
     */
    const previousTo =
      addDays(
        fromDate,
        -1
      );
  
    const previousFrom =
      addDays(
        previousTo,
        -(
          days -
          1
        )
      );
  
    return {
      from:
        previousFrom,
  
      to:
        previousTo,
    };
  }
  
  export function resolveAnalyticsRangeQuery(
    input: unknown
  ): ResolvedAnalyticsRange {
    const parsed =
      querySchema.safeParse(
        input
      );
  
    if (
      !parsed.success
    ) {
      throw new AnalyticsRangeError(
        "Invalid analytics date range."
      );
    }
  
    const {
      preset,
      from,
      to,
      timeZone,
    } =
      parsed.data;
  
    if (
      !isValidTimeZone(
        timeZone
      )
    ) {
      throw new AnalyticsRangeError(
        "Invalid timezone."
      );
    }
  
    const fromDate =
      parseDateOnly(
        from
      );
  
    const toDate =
      parseDateOnly(
        to
      );
  
    if (
      fromDate >
      toDate
    ) {
      throw new AnalyticsRangeError(
        "The start date must be before the end date."
      );
    }
  
    const days =
      getInclusiveDays(
        fromDate,
        toDate
      );
  
    if (
      days >
      MAX_RANGE_DAYS
    ) {
      throw new AnalyticsRangeError(
        "Analytics date range cannot exceed 12 months."
      );
    }
  
    const nextDay =
      addDays(
        toDate,
        1
      );
  
    const previous =
      getPreviousPeriod(
        preset,
        fromDate,
        toDate,
        days
      );
  
    const previousNextDay =
      addDays(
        previous.to,
        1
      );
  
    const previousFrom =
      formatDateOnly(
        previous.from
      );
  
    const previousTo =
      formatDateOnly(
        previous.to
      );
  
    return {
      preset,
  
      from,
  
      to,
  
      timeZone,
  
      days,
  
      fromUtc:
        toUtcBoundary(
          from,
          timeZone
        ),
  
      toExclusiveUtc:
        toUtcBoundary(
          formatDateOnly(
            nextDay
          ),
          timeZone
        ),
  
      previousFrom,
  
      previousTo,
  
      previousFromUtc:
        toUtcBoundary(
          previousFrom,
          timeZone
        ),
  
      previousToExclusiveUtc:
        toUtcBoundary(
          formatDateOnly(
            previousNextDay
          ),
          timeZone
        ),
    };
  }