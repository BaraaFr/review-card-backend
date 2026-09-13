
import {
    prisma,
  } from "../../../lib/prisma.js";
  
  const DAY =
    24 * 60 * 60 * 1000;
  
  function startOfDay(
    date: Date
  ) {
    const result =
      new Date(date);
  
    result.setHours(
      0,
      0,
      0,
      0
    );
  
    return result;
  }
  
  function dateKey(
    date: Date
  ) {
    return date
      .toISOString()
      .slice(0, 10);
  }
  
  type EffectiveSubscriptionStatus =
    | "TRIAL"
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCELED"
    | "EXPIRED"
    | "NO_SUBSCRIPTION";
  
  function getEffectiveStatus(
    subscription:
      | {
          status:
            | "TRIAL"
            | "ACTIVE"
            | "PAST_DUE"
            | "CANCELED"
            | "EXPIRED";
  
          expiresAt:
            | Date
            | null;
        }
      | undefined,
    now: Date
  ): EffectiveSubscriptionStatus {
    if (!subscription) {
      return "NO_SUBSCRIPTION";
    }
  
    if (
      (
        subscription.status ===
          "ACTIVE" ||
        subscription.status ===
          "TRIAL"
      ) &&
      subscription.expiresAt &&
      subscription.expiresAt <
        now
    ) {
      return "EXPIRED";
    }
  
    return subscription.status;
  }
  
  export const adminOverviewService = {
    async getOverview() {
      const now =
        new Date();
  
      const todayStart =
        startOfDay(now);
  
      const last7Start =
        new Date(
          todayStart.getTime() -
            6 * DAY
        );
  
      const previous7Start =
        new Date(
          todayStart.getTime() -
            13 * DAY
        );
  
      const expiringThreshold =
        new Date(
          now.getTime() +
            7 * DAY
        );
  
      const [
        customerGroups,
        businesses,
        cardGroups,
        todayInteractions,
        last7Interactions,
        previous7Interactions,
        interactionTimeline,
        recentCustomers,
      ] =
        await Promise.all([
          /*
           * Customers
           */
          prisma.user.groupBy({
            by: ["status"],
  
            where: {
              role:
                "BUSINESS_OWNER",
            },
  
            _count: {
              _all: true,
            },
          }),
  
          /*
           * Businesses + latest
           * subscription
           */
          prisma.business.findMany({
            select: {
              id: true,
              name: true,
              logoUrl: true,
              createdAt: true,
  
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  status: true,
                },
              },
  
              subscriptions: {
                orderBy: {
                  createdAt:
                    "desc",
                },
  
                take: 1,
  
                select: {
                  id: true,
                  plan: true,
                  status: true,
                  startsAt: true,
                  expiresAt: true,
                },
              },
  
              _count: {
                select: {
                  stores: true,
                },
              },
            },
          }),
  
          /*
           * Card inventory
           */
          prisma.card.groupBy({
            by: ["status"],
  
            _count: {
              _all: true,
            },
          }),
  
          prisma.interaction.count({
            where: {
              createdAt: {
                gte:
                  todayStart,
              },
            },
          }),
  
          prisma.interaction.count({
            where: {
              createdAt: {
                gte:
                  last7Start,
              },
            },
          }),
  
          prisma.interaction.count({
            where: {
              createdAt: {
                gte:
                  previous7Start,
  
                lt:
                  last7Start,
              },
            },
          }),
  
          /*
           * Small dataset for
           * 7-day chart.
           *
           * Fine for V1. At larger
           * scale move this grouping
           * into SQL.
           */
          prisma.interaction.findMany({
            where: {
              createdAt: {
                gte:
                  last7Start,
              },
            },
  
            select: {
              createdAt: true,
              source: true,
            },
          }),
  
          /*
           * Recent customers
           */
          prisma.user.findMany({
            where: {
              role:
                "BUSINESS_OWNER",
            },
  
            orderBy: {
              createdAt:
                "desc",
            },
  
            take: 5,
  
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              createdAt: true,
  
              businesses: {
                take: 2,
  
                orderBy: {
                  createdAt:
                    "asc",
                },
  
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          }),
        ]);
  
      /*
       * Customer status counts
       */
      const customerStats = {
        total: 0,
        active: 0,
        pending: 0,
        disabled: 0,
      };
  
      for (
        const group of
        customerGroups
      ) {
        const count =
          group._count._all;
  
        customerStats.total +=
          count;
  
        if (
          group.status ===
          "ACTIVE"
        ) {
          customerStats.active =
            count;
        }
  
        if (
          group.status ===
          "PENDING"
        ) {
          customerStats.pending =
            count;
        }
  
        if (
          group.status ===
          "DISABLED"
        ) {
          customerStats.disabled =
            count;
        }
      }
  
      /*
       * Card status counts
       */
      const cards = {
        total: 0,
        ready: 0,
        active: 0,
        inactive: 0,
      };
  
      for (
        const group of
        cardGroups
      ) {
        const count =
          group._count._all;
  
        cards.total += count;
  
        if (
          group.status ===
          "UNASSIGNED"
        ) {
          cards.ready = count;
        }
  
        if (
          group.status ===
          "ACTIVE"
        ) {
          cards.active = count;
        }
  
        if (
          group.status ===
          "INACTIVE"
        ) {
          cards.inactive =
            count;
        }
      }
  
      /*
       * Subscription health
       */
      const subscriptions = {
        active: 0,
        trial: 0,
        pastDue: 0,
        canceled: 0,
        expired: 0,
        noSubscription: 0,
      };
  
      const expiringSoon: {
        businessId: string;
        businessName: string;
  
        customerId: string;
        customerName: string;
  
        plan:
          | "STARTER"
          | "PRO"
          | "BUSINESS";
  
        status:
          | "ACTIVE"
          | "TRIAL";
  
        expiresAt: Date;
      }[] = [];
  
      const businessesWithoutSubscription: {
        businessId: string;
        businessName: string;
  
        customerId: string;
        customerName: string;
      }[] = [];
  
      for (
        const business of
        businesses
      ) {
        const subscription =
          business
            .subscriptions[0];
  
        const status =
          getEffectiveStatus(
            subscription,
            now
          );
  
        switch (status) {
          case "ACTIVE":
            subscriptions.active++;
            break;
  
          case "TRIAL":
            subscriptions.trial++;
            break;
  
          case "PAST_DUE":
            subscriptions.pastDue++;
            break;
  
          case "CANCELED":
            subscriptions.canceled++;
            break;
  
          case "EXPIRED":
            subscriptions.expired++;
            break;
  
          case "NO_SUBSCRIPTION":
            subscriptions.noSubscription++;
            break;
        }
  
        if (
          !subscription
        ) {
          businessesWithoutSubscription.push({
            businessId:
              business.id,
  
            businessName:
              business.name,
  
            customerId:
              business.owner.id,
  
            customerName:
              business.owner.name,
          });
  
          continue;
        }
  
        if (
          (
            status ===
              "ACTIVE" ||
            status ===
              "TRIAL"
          ) &&
          subscription.expiresAt &&
          subscription.expiresAt >=
            now &&
          subscription.expiresAt <=
            expiringThreshold
        ) {
          expiringSoon.push({
            businessId:
              business.id,
  
            businessName:
              business.name,
  
            customerId:
              business.owner.id,
  
            customerName:
              business.owner.name,
  
            plan:
              subscription.plan,
  
            status,
  
            expiresAt:
              subscription.expiresAt,
          });
        }
      }
  
      expiringSoon.sort(
        (a, b) =>
          a.expiresAt.getTime() -
          b.expiresAt.getTime()
      );
  
      /*
       * 7-day timeline
       */
      const timelineMap =
        new Map<
          string,
          {
            date: string;
            total: number;
            nfc: number;
            qr: number;
          }
        >();
  
      for (
        let index = 0;
        index < 7;
        index++
      ) {
        const date =
          new Date(
            last7Start.getTime() +
              index * DAY
          );
  
        const key =
          dateKey(date);
  
        timelineMap.set(
          key,
          {
            date: key,
            total: 0,
            nfc: 0,
            qr: 0,
          }
        );
      }
  
      for (
        const interaction of
        interactionTimeline
      ) {
        const key =
          dateKey(
            interaction.createdAt
          );
  
        const point =
          timelineMap.get(key);
  
        if (!point) {
          continue;
        }
  
        point.total++;
  
        if (
          interaction.source ===
          "NFC"
        ) {
          point.nfc++;
        }
  
        if (
          interaction.source ===
          "QR"
        ) {
          point.qr++;
        }
      }
  
      const percentageChange =
        previous7Interactions ===
        0
          ? null
          : Number(
              (
                (
                  (
                    last7Interactions -
                    previous7Interactions
                  ) /
                  previous7Interactions
                ) *
                100
              ).toFixed(1)
            );
  
      return {
        customers:
          customerStats,
  
        businesses: {
          total:
            businesses.length,
        },
  
        subscriptions,
  
        cards,
  
        activity: {
          today:
            todayInteractions,
  
          last7Days:
            last7Interactions,
  
          previous7Days:
            previous7Interactions,
  
          percentageChange,
  
          timeline: Array.from(
            timelineMap.values()
          ),
        },
  
        recentCustomers,
  
        attention: {
          pendingActivations:
            customerStats.pending,
  
          expiringSoon: {
            count:
              expiringSoon.length,
  
            businesses:
              expiringSoon.slice(
                0,
                5
              ),
          },
  
          expiredSubscriptions:
            subscriptions.expired,
  
          paymentIssues:
            subscriptions.pastDue,
  
          noSubscription: {
            count:
              subscriptions
                .noSubscription,
  
            businesses:
              businessesWithoutSubscription.slice(
                0,
                5
              ),
          },
        },
      };
    },
  };