import { WeeklyReportDay } from "../../../generated/prisma/enums.js";

  
  export function isValidTimeZone(
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
  
  export function normalizeTimeZone(
    timeZone:
      string | null | undefined
  ) {
    if (
      timeZone &&
      isValidTimeZone(
        timeZone
      )
    ) {
      return timeZone;
    }
  
    return "UTC";
  }
  
  function getParts(
    date: Date,
    timeZone: string
  ) {
    const normalized =
      normalizeTimeZone(
        timeZone
      );
  
    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          normalized,
  
        year:
          "numeric",
  
        month:
          "2-digit",
  
        day:
          "2-digit",
  
        weekday:
          "long",
  
        hour:
          "2-digit",
  
        minute:
          "2-digit",
  
        hourCycle:
          "h23",
      }
    ).formatToParts(
      date
    );
  }
  
  function getPart(
    parts:
      Intl.DateTimeFormatPart[],
    type:
      Intl.DateTimeFormatPartTypes
  ) {
    return (
      parts.find(
        (
          part
        ) =>
          part.type ===
          type
      )?.value ??
      ""
    );
  }
  
  export function getLocalDateKey(
    date: Date,
    timeZone: string
  ) {
    const parts =
      getParts(
        date,
        timeZone
      );
  
    const year =
      getPart(
        parts,
        "year"
      );
  
    const month =
      getPart(
        parts,
        "month"
      );
  
    const day =
      getPart(
        parts,
        "day"
      );
  
    return `${year}-${month}-${day}`;
  }
  
  export function getLocalWeekday(
    date: Date,
    timeZone: string
  ): WeeklyReportDay {
    const parts =
      getParts(
        date,
        timeZone
      );
  
    return getPart(
      parts,
      "weekday"
    ).toUpperCase() as WeeklyReportDay;
  }
  
  export function getLocalMinutes(
    date: Date,
    timeZone: string
  ) {
    const parts =
      getParts(
        date,
        timeZone
      );
  
    const hour =
      Number(
        getPart(
          parts,
          "hour"
        )
      );
  
    const minute =
      Number(
        getPart(
          parts,
          "minute"
        )
      );
  
    return (
      hour *
        60 +
      minute
    );
  }
  
  export function parseTimeToMinutes(
    value: string
  ) {
    const [
      hourString,
      minuteString,
    ] =
      value.split(
        ":"
      );
  
    const hour =
      Number(
        hourString
      );
  
    const minute =
      Number(
        minuteString
      );
  
    return (
      hour *
        60 +
      minute
    );
  }
  
  export function getDueScheduleKey({
    now,
    day,
    time,
    timeZone,
  }: {
    now: Date;
  
    day:
      WeeklyReportDay;
  
    time:
      string;
  
    timeZone:
      string;
  }) {
    const currentDay =
      getLocalWeekday(
        now,
        timeZone
      );
  
    if (
      currentDay !==
      day
    ) {
      return null;
    }
  
    const currentMinutes =
      getLocalMinutes(
        now,
        timeZone
      );
  
    const scheduledMinutes =
      parseTimeToMinutes(
        time
      );
  
    /*
     * If the application was temporarily down
     * at exactly 09:00, we still send later on
     * Monday instead of permanently missing it.
     */
    if (
      currentMinutes <
      scheduledMinutes
    ) {
      return null;
    }
  
    return getLocalDateKey(
      now,
      timeZone
    );
  }
  
  export function getHourInTimeZone(
    date: Date,
    timeZone: string
  ) {
    const parts =
      getParts(
        date,
        timeZone
      );
  
    return Number(
      getPart(
        parts,
        "hour"
      )
    );
  }
  
  export function getWeekdayName(
    date: Date,
    timeZone: string
  ) {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          normalizeTimeZone(
            timeZone
          ),
  
        weekday:
          "long",
      }
    ).format(
      date
    );
  }
  
  export function formatDateInTimeZone(
    date: Date,
    timeZone: string
  ) {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          normalizeTimeZone(
            timeZone
          ),
  
        month:
          "short",
  
        day:
          "numeric",
  
        year:
          "numeric",
      }
    ).format(
      date
    );
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
  
    return `${
      normalized -
      12
    } PM`;
  }