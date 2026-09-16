import { prisma } from "../../lib/prisma.js";

import {
  PLAN_LIMITS,
} from "../../config/plans.js";

import {
  isSubscriptionUsable,
} from "../../utils/subscription.js";

import type {
  ActivatePaidSubscriptionInput,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from "./subscription.schema.js";
import { addDays, addMonths } from "date-fns";
import { TRIAL_DURATION_DAYS } from "../../config/commercial.js";

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

  async startTrial(
    businessId: string
  ) {
    const now =
      new Date();

    const expiresAt =
      addDays(
        now,
        TRIAL_DURATION_DAYS
      );

    return prisma.$transaction(
      async (tx) => {
        const business =
          await tx.business.findUnique({
            where: {
              id: businessId,
            },

            select: {
              id: true,

              trialStartedAt:
                true,
            },
          });

        if (!business) {
          throw new Error(
            "BUSINESS_NOT_FOUND"
          );
        }

        /*
         * Each business gets exactly
         * one free trial.
         */
        if (
          business.trialStartedAt
        ) {
          throw new Error(
            "TRIAL_ALREADY_USED"
          );
        }

        /*
         * Trial cannot start until at
         * least one physical card has
         * been paid for and delivered.
         */
        const deliveredCards =
          await tx.card.count({
            where: {
              paidAt: {
                not: null,
              },

              deliveredAt: {
                not: null,
              },

              store: {
                is: {
                  businessId,
                },
              },
            },
          });

        if (
          deliveredCards < 1
        ) {
          throw new Error(
            "DELIVERED_CARD_REQUIRED"
          );
        }

        /*
         * A free trial uses STARTER
         * limits.
         */
        const storesCount =
          await tx.store.count({
            where: {
              businessId,
            },
          });

        if (
          storesCount >
          PLAN_LIMITS.STARTER.stores
        ) {
          throw new Error(
            "TRIAL_STORE_LIMIT_REACHED"
          );
        }

        const cardsCount =
          await tx.card.count({
            where: {
              store: {
                is: {
                  businessId,
                },
              },

              status: {
                not:
                  "UNASSIGNED",
              },
            },
          });

        if (
          cardsCount >
          PLAN_LIMITS.STARTER.cards
        ) {
          throw new Error(
            "TRIAL_CARD_LIMIT_REACHED"
          );
        }

        const currentSubscription =
          await tx.subscription.findFirst({
            where: {
              businessId,
            },

            orderBy: {
              createdAt:
                "desc",
            },
          });

        /*
         * Don't overwrite an existing
         * usable subscription.
         */
        if (
          currentSubscription &&
          isSubscriptionUsable(
            currentSubscription
          )
        ) {
          throw new Error(
            "SUBSCRIPTION_ALREADY_ACTIVE"
          );
        }

        /*
         * Atomically reserve the trial.
         *
         * This also protects against
         * two requests being made at
         * almost the same time.
         */
        const claimedTrial =
          await tx.business.updateMany({
            where: {
              id: businessId,

              trialStartedAt:
                null,
            },

            data: {
              trialStartedAt:
                now,
            },
          });

        if (
          claimedTrial.count !== 1
        ) {
          throw new Error(
            "TRIAL_ALREADY_USED"
          );
        }

        /*
         * Expire previous inactive
         * subscription records if your
         * system allows multiple rows.
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
            status:
              "EXPIRED",
          },
        });

        return tx.subscription.create({
          data: {
            businessId,

            plan:
              "STARTER",

            status:
              "TRIAL",

            startsAt:
              now,

            expiresAt,
          },
        });
      }
    );
  },

  async activatePaidPlan(
    businessId: string,
    data: ActivatePaidSubscriptionInput
  ) {
    const now =
      new Date();

    return prisma.$transaction(
      async (tx) => {
        const business =
          await tx.business.findUnique({
            where: {
              id: businessId,
            },

            select: {
              id: true,
            },
          });

        if (!business) {
          throw new Error(
            "BUSINESS_NOT_FOUND"
          );
        }

        const limits =
          PLAN_LIMITS[
          data.plan
          ];

        /*
         * Make sure the selected paid
         * plan can actually contain the
         * business's current locations.
         */
        const storesCount =
          await tx.store.count({
            where: {
              businessId,
            },
          });

        if (
          storesCount >
          limits.stores
        ) {
          throw new Error(
            "PLAN_STORE_LIMIT_EXCEEDED"
          );
        }

        const cardsCount =
          await tx.card.count({
            where: {
              store: {
                is: {
                  businessId,
                },
              },

              status: {
                not:
                  "UNASSIGNED",
              },
            },
          });

        if (
          cardsCount >
          limits.cards
        ) {
          throw new Error(
            "PLAN_CARD_LIMIT_EXCEEDED"
          );
        }

        const currentSubscription =
          await tx.subscription.findFirst({
            where: {
              businessId,
            },

            orderBy: {
              createdAt:
                "desc",
            },
          });

        /*
         * Preserve remaining time when
         * the customer pays early.
         *
         * Example:
         *
         * Trial ends Oct 30
         * Customer pays Oct 20
         *
         * Paid month ends Nov 30,
         * NOT Nov 20.
         */
        const hasRemainingTime =
          Boolean(
            currentSubscription &&
            (
              currentSubscription.status ===
              "TRIAL" ||
              currentSubscription.status ===
              "ACTIVE"
            ) &&
            currentSubscription.expiresAt &&
            currentSubscription.expiresAt >
            now
          );

        const renewalBase =
          hasRemainingTime &&
            currentSubscription
              ?.expiresAt
            ? currentSubscription.expiresAt
            : now;

        const expiresAt =
          addMonths(
            renewalBase,
            data.months
          );

        /*
         * Continue using the current
         * subscription record where
         * possible.
         */
        if (
          currentSubscription
        ) {
          return tx.subscription.update({
            where: {
              id:
                currentSubscription.id,
            },

            data: {
              plan:
                data.plan,

              status:
                "ACTIVE",

              /*
               * If this is an early
               * conversion from trial,
               * preserve the original
               * start date.
               */
              startsAt:
                hasRemainingTime
                  ? currentSubscription
                    .startsAt
                  : now,

              expiresAt,
            },
          });
        }

        /*
         * Customer somehow starts
         * directly on a paid plan.
         */
        return tx.subscription.create({
          data: {
            businessId,

            plan:
              data.plan,

            status:
              "ACTIVE",

            startsAt:
              now,

            expiresAt,
          },
        });
      }
    );
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
      trial: {
        eligible:
          !business.trialStartedAt,

        startedAt:
          business.trialStartedAt,
      },
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