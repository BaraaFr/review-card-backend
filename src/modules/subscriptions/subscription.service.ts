import { prisma } from "../../lib/prisma.js";

import {
  PLAN_LIMITS,
} from "../../config/plans.js";

import {
  isSubscriptionUsable,
} from "../../utils/subscription.js";

import type {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from "./subscription.schema.js";

type CurrentUser = {
  id: string;

  role:
    | "SUPER_ADMIN"
    | "BUSINESS_OWNER";
};

export const subscriptionService = {
  async getCurrentForBusiness(
    businessId: string
  ) {
    const subscription =
      await prisma.subscription.findFirst({
        where: {
          businessId,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    if (!subscription) {
      return null;
    }

    return {
      ...subscription,

      usable:
        isSubscriptionUsable(
          subscription
        ),

      limits:
        PLAN_LIMITS[
          subscription.plan
        ],
    };
  },

  async getAccessibleBusiness(
    user: CurrentUser,
    businessId: string
  ) {
    return prisma.business.findFirst({
      where: {
        id: businessId,

        ...(user.role !==
        "SUPER_ADMIN"
          ? {
              ownerId: user.id,
            }
          : {}),
      },
    });
  },

  async getCurrent(
    user: CurrentUser,
    businessId: string
  ) {
    const business =
      await this.getAccessibleBusiness(
        user,
        businessId
      );

    if (!business) {
      throw new Error(
        "BUSINESS_NOT_FOUND"
      );
    }

    return this.getCurrentForBusiness(
      businessId
    );
  },

  async create(
    businessId: string,
    data: CreateSubscriptionInput
  ) {
    const business =
      await prisma.business.findUnique({
        where: {
          id: businessId,
        },
      });

    if (!business) {
      throw new Error(
        "BUSINESS_NOT_FOUND"
      );
    }

    return prisma.$transaction(
      async (tx) => {
        /*
         * Close old usable/current
         * subscriptions.
         */
        await tx.subscription.updateMany({
          where: {
            businessId,

            status: {
              in: [
                "TRIAL",
                "ACTIVE",
                "PAST_DUE",
              ],
            },
          },

          data: {
            status: "EXPIRED",
          },
        });

        return tx.subscription.create({
          data: {
            businessId,

            plan: data.plan,

            status:
              data.status ??
              "ACTIVE",

            startsAt:
              data.startsAt ??
              new Date(),

            expiresAt:
              data.expiresAt ??
              null,
          },
        });
      }
    );
  },

  async update(
    subscriptionId: string,
    data: UpdateSubscriptionInput
  ) {
    const subscription =
      await prisma.subscription.findUnique({
        where: {
          id: subscriptionId,
        },
      });

    if (!subscription) {
      throw new Error(
        "SUBSCRIPTION_NOT_FOUND"
      );
    }

    return prisma.subscription.update({
      where: {
        id: subscriptionId,
      },

      data,
    });
  },

  async getUsage(
    user: CurrentUser,
    businessId: string
  ) {
    const business =
      await this.getAccessibleBusiness(
        user,
        businessId
      );

    if (!business) {
      throw new Error(
        "BUSINESS_NOT_FOUND"
      );
    }

    const subscription =
      await this.getCurrentForBusiness(
        businessId
      );

    const [
      stores,
      cards,
    ] = await Promise.all([
      prisma.store.count({
        where: {
          businessId,
        },
      }),

      prisma.card.count({
        where: {
          store: {
            is: {
              businessId,
            },
          },

          status: "ACTIVE",
        },
      }),
    ]);

    return {
      subscription,

      usage: {
        stores,
        cards,
      },

      remaining: subscription
        ? {
            stores: Math.max(
              0,
              subscription.limits
                .stores -
                stores
            ),

            cards: Math.max(
              0,
              subscription.limits
                .cards -
                cards
            ),
          }
        : {
            stores: 0,
            cards: 0,
          },
    };
  },
};