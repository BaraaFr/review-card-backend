import { prisma } from "../../lib/prisma.js";

import type {
  CreateBusinessInput,
  UpdateBusinessInput,
} from "./business.schema.js";

type CurrentUser = {
  id: string;
  role: "SUPER_ADMIN" | "BUSINESS_OWNER";
};

export const businessService = {
  async create(
    user: CurrentUser,
    data: CreateBusinessInput
  ) {
    const trialEndsAt =
      new Date(
        Date.now() +
        14 *
        24 *
        60 *
        60 *
        1000
      );
    return prisma.$transaction(
      async (tx) => {
        const business =
          await tx.business.create({
            data: {
              name: data.name,

              logoUrl:
                data.logoUrl ??
                null,

              ownerId: user.id,
            },

            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },

              _count: {
                select: {
                  stores: true,
                },
              },
            },
          });

        await tx.subscription.create({
          data: {
            businessId:
              business.id,

            plan: "STARTER",

            status: "TRIAL",

            startsAt:
              new Date(),

            expiresAt:
              trialEndsAt,
          },
        });

        return business;
      }
    );
  },

  async findAll(user: CurrentUser) {
    return prisma.business.findMany({
      where:
        user.role === "SUPER_ADMIN"
          ? undefined
          : {
            ownerId: user.id,
          },

      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        stores:true,

        _count: {
          select: {
            stores: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async findById(
    user: CurrentUser,
    businessId: string
  ) {
    return prisma.business.findFirst({
      where: {
        id: businessId,

        ...(user.role !== "SUPER_ADMIN"
          ? {
            ownerId: user.id,
          }
          : {}),
      },

      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        stores: {
          orderBy: {
            createdAt: "desc",
          },
        },

        subscriptions: {
          orderBy: {
            createdAt: "desc",
          },

          take: 1,
        },
      },
    });
  },

  async update(
    user: CurrentUser,
    businessId: string,
    data: UpdateBusinessInput
  ) {
    const business = await this.findById(
      user,
      businessId
    );

    if (!business) {
      throw new Error("BUSINESS_NOT_FOUND");
    }

    return prisma.business.update({
      where: {
        id: businessId,
      },

      data,
    });
  },
};