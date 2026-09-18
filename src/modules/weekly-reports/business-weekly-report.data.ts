import { prisma } from "../../lib/prisma.js";

export async function loadWeeklyReportContext(businessId: string) {
    const business =
      await prisma.business.findUnique({
        where: {
          id:
            businessId,
        },
  
        select: {
          id:
            true,
  
          name:
            true,
        },
      });
  
    if (!business) {
      throw new Error(
        "BUSINESS_NOT_FOUND"
      );
    }
  
    const stores =
      await prisma.store.findMany({
        where: {
          businessId,
        },
  
        select: {
          id:
            true,
  
          name:
            true,
  
          createdAt:
            true,
        },
      });
  
    const storeIds =
      stores.map(
        (
          store
        ) =>
          store.id
      );
  
    const activeCards =
      await prisma.card.findMany({
        where: {
          storeId: {
            in:
              storeIds,
          },
  
          status:
            "ACTIVE",
        },
  
        select: {
          id:
            true,
  
          label:
            true,
  
          code:
            true,
  
          storeId:
            true,
        },
      });
  
    const activeCardIds =
      activeCards.map(
        (
          card
        ) =>
          card.id
      );
  
  return { business, stores, storeIds, activeCards, activeCardIds };
}

export async function loadWeeklyReportMetrics(
  storeIds:
    string[],

  activeCardIds:
    string[],

  currentFrom:
    Date,

  previousFrom:
    Date,

  currentTo:
    Date
) {
    const [
      currentCount,
      previousCount,
      uniqueVisitors,
      sourceGroups,
      currentStoreGroups,
      previousStoreGroups,
      currentCardGroups,
      lifetimeCardGroups,
      timingRows,
    ] =
      await Promise.all([
        prisma.interaction.count({
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
        }),
  
        prisma.interaction.count({
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
                currentFrom,
            },
          },
        }),
  
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
  
        prisma.interaction.groupBy({
          by: [
            "source",
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
                currentFrom,
            },
          },
  
          _count: {
            _all:
              true,
          },
        }),
  
        prisma.interaction.groupBy({
          by: [
            "cardId",
          ],
  
          where: {
            cardId: {
              in:
                activeCardIds,
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
  
        prisma.interaction.groupBy({
          by: [
            "cardId",
          ],
  
          where: {
            cardId: {
              in:
                activeCardIds,
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
  
        prisma.interaction.findMany({
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
  
          select: {
            createdAt:
              true,
          },
        }),
      ]);
  
  return { currentCount, previousCount, uniqueVisitors, sourceGroups, currentStoreGroups, previousStoreGroups, currentCardGroups, lifetimeCardGroups, timingRows };
}

export type WeeklyReportContext = Awaited<ReturnType<typeof loadWeeklyReportContext>>;
export type WeeklyReportMetrics = Awaited<ReturnType<typeof loadWeeklyReportMetrics>>;
