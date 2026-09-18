import {
    formatInTimeZone,
  } from "date-fns-tz";
  
  import {
    AnalyticsRangeError,
    resolveAnalyticsRangeQuery,
  } from "../modules/analytics/utils/analytics-range.util.js";
  
  const DAY_MS =
    24 *
    60 *
    60 *
    1000;
  
  function isValidTimeZone(
    timeZone: string
  ) {
    try {
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone,
        }
      ).format();
  
      return true;
    } catch {
      return false;
    }
  }
  
  function shiftDateKey(
    value: string,
    amount: number
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
  
  /*
   * Weekly reports intentionally use the
   * last 7 COMPLETED local calendar days.
   *
   * Example:
   *
   * reference:
   * 2026-09-13 Asia/Beirut
   *
   * current:
   * Sep 6 -> Sep 12
   *
   * previous:
   * Aug 30 -> Sep 5
   *
   * This gives both periods exactly seven
   * local calendar days and avoids partial-day
   * comparisons.
   */
  export function resolveWeeklyReportRange(
    referenceDate:
      Date = new Date(),
  
    timeZone:
      string = "UTC"
  ) {
    if (
      !isValidTimeZone(
        timeZone
      )
    ) {
      throw new AnalyticsRangeError(
        "Invalid timezone."
      );
    }
  
    const localToday =
      formatInTimeZone(
        referenceDate,
        timeZone,
        "yyyy-MM-dd"
      );
  
    const to =
      shiftDateKey(
        localToday,
        -1
      );
  
    const from =
      shiftDateKey(
        to,
        -6
      );
  
    return resolveAnalyticsRangeQuery({
      preset:
        "7d",
  
      from,
  
      to,
  
      timeZone,
    });
  }