import {
    Prisma,
  } from "../../../generated/prisma/client.js";
  
  import {
    prisma,
  } from "../../lib/prisma.js";
  
  import {
    getAnalyticsDateRange,
  } from "../../utils/date-range.js";
  
  import {
    calculateOverviewChangePercentage,
  } from "./utils/analytics-math.js";
  
  import {
    getDateKeyInTimeZone,
    shiftDateKey,
  } from "./utils/helpers.js";
  
  import type {
    AnalyticsQuery,
  } from "./analytics.schema.js";
  
  import type {
    CurrentUser,
  } from "./types/index.js";
  
  function scope(
    user:
      CurrentUser,
  
    query:
      AnalyticsQuery,
  
    from:
      Date,
  
    to:
      Date
  ) {
    const filters = [
      Prisma.sql`
        i."createdAt" >= ${from}
        AND i."createdAt" < ${to}
      `,
    ];
  
    if (
      user.role !==
      "SUPER_ADMIN"
    ) {
      filters.push(
        Prisma.sql`
          b."ownerId" = ${user.id}
        `
      );
    }
  
    if (
      query.businessId
    ) {
      filters.push(
        Prisma.sql`
          s."businessId" = ${query.businessId}
        `
      );
    }
  
    if (
      query.storeId
    ) {
      filters.push(
        Prisma.sql`
          i."storeId" = ${query.storeId}
        `
      );
    }
  
    if (
      query.cardId
    ) {
      filters.push(
        Prisma.sql`
          i."cardId" = ${query.cardId}
        `
      );
    }
  
    return Prisma.join(
      filters,
      " AND "
    );
  }
  
  type Counts = {
    total:
      number;
  
    unique:
      number;
  
    nfc:
      number;
  
    qr:
      number;
  
    unknown:
      number;
  };
  
  export async function dashboardOverview(
    user:
      CurrentUser,
  
    query:
      AnalyticsQuery
  ) {
    const range =
      getAnalyticsDateRange(
        query
      );
  
    const aggregate =
      async (
        from:
          Date,
  
        to:
          Date
      ) => {
        const rows =
          await prisma
            .$queryRaw<
              Counts[]
            >(
              Prisma.sql`
                SELECT
                  COUNT(*)::int
                    AS total,
  
                  COUNT(
                    DISTINCT i."visitorKey"
                  )::int
                    AS unique,
  
                  COUNT(*) FILTER (
                    WHERE i.source = 'NFC'
                  )::int
                    AS nfc,
  
                  COUNT(*) FILTER (
                    WHERE i.source = 'QR'
                  )::int
                    AS qr,
  
                  COUNT(*) FILTER (
                    WHERE i.source = 'UNKNOWN'
                  )::int
                    AS unknown
  
                FROM "Interaction" i
  
                JOIN "Store" s
                  ON s.id = i."storeId"
  
                JOIN "Business" b
                  ON b.id = s."businessId"
  
                WHERE
                  ${scope(
                    user,
                    query,
                    from,
                    to
                  )}
  
                  AND NOT i."isBot"
                  AND NOT i."isDuplicate"
              `
            );
  
        return rows[0];
      };
  
    const [
      current,
      previous,
    ] =
      await Promise.all([
        aggregate(
          range.from,
          range.to
        ),
  
        aggregate(
          range.previousFrom,
          range.previousTo
        ),
      ]);
  
    return {
      period: {
        from:
          range.from,
  
        to:
          range.to,
      },
  
      totalInteractions:
        current.total,
  
      previousInteractions:
        previous.total,
  
      percentageChange:
        calculateOverviewChangePercentage(
          current.total,
          previous.total
        ),
  
      approximateUniqueVisitors:
        current.unique,
  
      source: {
        nfc:
          current.nfc,
  
        qr:
          current.qr,
  
        unknown:
          current.unknown,
      },
    };
  }
  
  export async function dashboardTimeline(
    user:
      CurrentUser,
  
    query:
      AnalyticsQuery
  ) {
    const {
      from,
      to,
    } =
      getAnalyticsDateRange(
        query
      );
  
    const timeZone =
      query.timeZone;
  
    type Point = {
      date:
        string;
  
      total:
        number;
  
      nfc:
        number;
  
      qr:
        number;
  
      unknown:
        number;
    };
  
    const rows =
      await prisma
        .$queryRaw<
          Point[]
        >(
          Prisma.sql`
            SELECT
              to_char(
                i."createdAt"
                AT TIME ZONE 'UTC'
                AT TIME ZONE ${timeZone},
                'YYYY-MM-DD'
              ) AS date,
  
              COUNT(*)::int
                AS total,
  
              COUNT(*) FILTER (
                WHERE i.source = 'NFC'
              )::int
                AS nfc,
  
              COUNT(*) FILTER (
                WHERE i.source = 'QR'
              )::int
                AS qr,
  
              COUNT(*) FILTER (
                WHERE i.source = 'UNKNOWN'
              )::int
                AS unknown
  
            FROM "Interaction" i
  
            JOIN "Store" s
              ON s.id = i."storeId"
  
            JOIN "Business" b
              ON b.id = s."businessId"
  
            WHERE
              ${scope(
                user,
                query,
                from,
                to
              )}
  
              AND NOT i."isBot"
              AND NOT i."isDuplicate"
  
            GROUP BY 1
            ORDER BY 1
          `
        );
  
    const byDate =
      new Map(
        rows.map(
          (
            row
          ) => [
            row.date,
            row,
          ]
        )
      );
  
    /*
     * to is exclusive, so subtract 1ms
     * to resolve the last calendar day.
     */
    const end =
      getDateKeyInTimeZone(
        new Date(
          to.getTime() -
            1
        ),
  
        timeZone
      );
  
    const timeline:
      Point[] =
      [];
  
    for (
      let date =
        getDateKeyInTimeZone(
          from,
          timeZone
        );
  
      date <= end;
  
      date =
        shiftDateKey(
          date,
          1
        )
    ) {
      timeline.push(
        byDate.get(
          date
        ) ?? {
          date,
  
          total:
            0,
  
          nfc:
            0,
  
          qr:
            0,
  
          unknown:
            0,
        }
      );
    }
  
    return {
      period: {
        from,
        to,
      },
  
      timeline,
    };
  }