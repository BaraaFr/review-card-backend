import { prisma } from "../../../lib/prisma.js";

import { env } from "../../../config/env.js";

import {
  generateActivationToken,
  hashActivationToken,
} from "../../../utils/activation-token.js";

import type {
  CreateAdditionalBusinessInput,
  CreateCustomerInput,
} from "./customer.schema.js";

const DAY =
  24 * 60 * 60 * 1000;

const ACTIVATION_DAYS = 7;

type SubscriptionSetup =
  CreateCustomerInput["subscription"];

function buildSubscriptionData(
  setup: SubscriptionSetup
) {
  if (setup.mode === "NONE") {
    return null;
  }

  if (setup.mode === "TRIAL") {
    return {
      plan: setup.plan,

      status: "TRIAL" as const,

      startsAt: new Date(),

      expiresAt: new Date(
        Date.now() +
        setup.days * DAY
      ),
    };
  }

  return {
    plan: setup.plan,

    status: "ACTIVE" as const,

    startsAt: new Date(),

    expiresAt:
      setup.expiresAt ?? null,
  };
}

export const customerService = {
  async createCustomer(
    data: CreateCustomerInput
  ) {
    const activationToken =
      generateActivationToken();

    const tokenHash =
      hashActivationToken(
        activationToken
      );

    const activationExpiresAt =
      new Date(
        Date.now() +
        ACTIVATION_DAYS * DAY
      );

    const subscriptionData =
      buildSubscriptionData(
        data.subscription
      );

    const result =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Prevent duplicate
           * customer accounts.
           */
          const existingUser =
            await tx.user.findUnique({
              where: {
                email: data.email,
              },

              select: {
                id: true,
              },
            });

          if (existingUser) {
            throw new Error(
              "USER_ALREADY_EXISTS"
            );
          }

          /*
           * Customer exists but has
           * no password yet.
           */
          const user =
            await tx.user.create({
              data: {
                name: data.name,

                email: data.email,

                passwordHash: null,

                role:
                  "BUSINESS_OWNER",

                status: "PENDING",
              },

              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                createdAt: true,
              },
            });

          /*
           * Business is created by
           * Super Admin but owned by
           * the customer.
           */
          const business =
            await tx.business.create({
              data: {
                name:
                  data.business.name,

                logoUrl:
                  data.business
                    .logoUrl ?? null,

                ownerId: user.id,
              },
            });

          /*
           * Subscription is optional.
           *
           * Super Admin decides:
           * TRIAL / ACTIVE / NONE.
           */
          let subscription = null;

          if (subscriptionData) {
            subscription =
              await tx.subscription.create({
                data: {
                  businessId:
                    business.id,

                  ...subscriptionData,
                },
              });
          }

          /*
           * Only the hash is stored.
           */
          await tx.accountInvitation.create({
            data: {
              userId: user.id,

              tokenHash,

              expiresAt:
                activationExpiresAt,
            },
          });

          return {
            user,
            business,
            subscription,
          };
        }
      );

    return {
      ...result,

      activationUrl:
        `${env.FRONTEND_URL}` +
        `/activate-account?token=${encodeURIComponent(
          activationToken
        )}`,

      activationExpiresAt,
    };
  },

  async resendActivation(
    userId: string
  ) {
    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          email: true,
          status: true,
        },
      });

    if (!user) {
      throw new Error(
        "USER_NOT_FOUND"
      );
    }

    if (
      user.status === "ACTIVE"
    ) {
      throw new Error(
        "ACCOUNT_ALREADY_ACTIVE"
      );
    }

    if (
      user.status === "DISABLED"
    ) {
      throw new Error(
        "ACCOUNT_DISABLED"
      );
    }

    const activationToken =
      generateActivationToken();

    const tokenHash =
      hashActivationToken(
        activationToken
      );

    const activationExpiresAt =
      new Date(
        Date.now() +
        ACTIVATION_DAYS * DAY
      );

    /*
     * Invalidates any previous
     * activation link.
     */
    await prisma.accountInvitation.upsert({
      where: {
        userId,
      },

      create: {
        userId,

        tokenHash,

        expiresAt:
          activationExpiresAt,
      },

      update: {
        tokenHash,

        expiresAt:
          activationExpiresAt,

        acceptedAt: null,
      },
    });

    return {
      activationUrl:
        `${env.FRONTEND_URL}` +
        `/activate-account?token=${encodeURIComponent(
          activationToken
        )}`,

      activationExpiresAt,
    };
  },

  async createAdditionalBusiness(
    userId: string,
    data: CreateAdditionalBusinessInput
  ) {
    const user =
      await prisma.user.findFirst({
        where: {
          id: userId,

          role:
            "BUSINESS_OWNER",

          status: {
            in: [
              "PENDING",
              "ACTIVE",
            ],
          },
        },

        select: {
          id: true,
        },
      });

    if (!user) {
      throw new Error(
        "USER_NOT_FOUND"
      );
    }

    const subscriptionData =
      buildSubscriptionData(
        data.subscription
      );

    return prisma.$transaction(
      async (tx) => {
        /*
         * 1. Create business
         */
        const business =
          await tx.business.create({
            data: {
              name:
                data.name,

              logoUrl:
                data.logoUrl ??
                null,

              ownerId:
                user.id,
            },
          });

        /*
         * 2. Create first location
         *
         * Admin onboarding creates
         * this directly so the
         * business is immediately
         * ready for card assignment.
         */
        const store =
          await tx.store.create({
            data: {
              name:
                data.location.name,

              address:
                data.location.address ??
                null,

              googleReviewUrl:
                data.location
                  .googleReviewUrl,

              businessId:
                business.id,
            },
          });

        /*
         * 3. Optional subscription
         */
        let subscription =
          null;

        if (subscriptionData) {
          subscription =
            await tx.subscription.create({
              data: {
                businessId:
                  business.id,

                ...subscriptionData,
              },
            });
        }

        return {
          business,
          store,
          subscription,
        };
      }
    );
  },

  async listCustomers() {
    return prisma.user.findMany({
      where: {
        role:
          "BUSINESS_OWNER",
      },

      select: {
        id: true,

        name: true,

        email: true,

        status: true,

        createdAt: true,

        businesses: {
          select: {
            id: true,
            name: true,
            logoUrl: true,

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
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async getCustomer(
    userId: string
  ) {
    const customer =
      await prisma.user.findFirst({
        where: {
          id: userId,

          role:
            "BUSINESS_OWNER",
        },

        select: {
          id: true,

          name: true,

          email: true,

          status: true,

          createdAt: true,

          businesses: {
            include: {
              subscriptions: {
                orderBy: {
                  createdAt:
                    "desc",
                },
              },

              stores: true,
            },
          },
        },
      });

    if (!customer) {
      throw new Error(
        "USER_NOT_FOUND"
      );
    }

    return customer;
  },

  async disableCustomer(
    userId: string
  ) {
    const user =
      await prisma.user.findFirst({
        where: {
          id: userId,

          role:
            "BUSINESS_OWNER",
        },
      });

    if (!user) {
      throw new Error(
        "USER_NOT_FOUND"
      );
    }

    return prisma.$transaction(
      async (
        tx
      ) => {
        const user =
          await tx.user.update({
            where: {
              id:
                userId,
            },

            data: {
              status:
                "DISABLED",
            },

            select: {
              id: true,
              name: true,
              email: true,
              status: true,
            },
          });

        await tx.authSession.updateMany({
          where: {
            userId,

            revokedAt:
              null,
          },

          data: {
            revokedAt:
              new Date(),
          },
        });

        return user;
      }
    );
  },

  async enableCustomer(
    userId: string
  ) {
    const user =
      await prisma.user.findFirst({
        where: {
          id: userId,

          role:
            "BUSINESS_OWNER",
        },
      });

    if (!user) {
      throw new Error(
        "USER_NOT_FOUND"
      );
    }

    /*
     * If customer never activated
     * their account, keep PENDING.
     */
    const status =
      user.passwordHash
        ? "ACTIVE"
        : "PENDING";

    return prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        status,
      },

      select: {
        id: true,
        name: true,
        email: true,
        status: true,
      },
    });
  },
};