import { prisma } from "../../lib/prisma.js";

import type {
  CreateStoreInput,
  UpdateStoreInput,
} from "./store.schema.js";

import { resolveProvisioningAccess } from "../../utils/provisioning.js";


type CurrentUser = {
  id: string;
  role: "SUPER_ADMIN" | "BUSINESS_OWNER";
};

const getAccessibleBusiness = async (
  user: CurrentUser,
  businessId: string
) => {
  return prisma.business.findFirst({
    where: {
      id: businessId,

      ...(user.role !== "SUPER_ADMIN"
        ? {
          ownerId: user.id,
        }
        : {}),
    },
  });
};

export const storeService = {
  async create(
    user: CurrentUser,
    businessId: string,
    data: CreateStoreInput
  ) {
    const business = await getAccessibleBusiness(
      user,
      businessId
    );
  
    if (!business) {
      throw new Error("BUSINESS_NOT_FOUND");
    }
  
    const { limits } = await resolveProvisioningAccess({
      businessId,
      role: user.role,
    });
  
    const storesCount = await prisma.store.count({
      where: {
        businessId,
      },
    });
  
    if (storesCount >= limits.stores) {
      throw new Error("STORE_LIMIT_REACHED");
    }
  
    return prisma.store.create({
      data: {
        name: data.name,
        address: data.address ?? null,
        googleReviewUrl: data.googleReviewUrl ?? null,
        businessId,
      },
    });
  },

  async findByBusiness(
    user: CurrentUser,
    businessId: string
  ) {
    const business =
      await getAccessibleBusiness(
        user,
        businessId
      );

    if (!business) {
      throw new Error("BUSINESS_NOT_FOUND");
    }

    return prisma.store.findMany({
      where: {
        businessId,
      },

      include: {
        _count: {
          select: {
            cards: true,
            interactions: true,
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
    storeId: string
  ) {
    return prisma.store.findFirst({
      where: {
        id: storeId,

        ...(user.role !== "SUPER_ADMIN"
          ? {
            business: {
              is: {
                ownerId: user.id,
              },
            },
          }
          : {}),
      },

      include: {
        business: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },

        _count: {
          select: {
            cards: true,
            interactions: true,
          },
        },
      },
    });
  },

  async update(
    user: CurrentUser,
    storeId: string,
    data: UpdateStoreInput
  ) {
    const store = await this.findById(
      user,
      storeId
    );

    if (!store) {
      throw new Error("STORE_NOT_FOUND");
    }

    return prisma.store.update({
      where: {
        id: storeId,
      },

      data,
    });
  },

  async remove(
    user: CurrentUser,
    storeId: string
  ) {
    const store = await this.findById(
      user,
      storeId
    );

    if (!store) {
      throw new Error("STORE_NOT_FOUND");
    }

    const [cardsCount, interactionsCount] =
      await Promise.all([
        prisma.card.count({
          where: {
            storeId,
          },
        }),

        prisma.interaction.count({
          where: {
            storeId,
          },
        }),
      ]);

    if (
      cardsCount > 0 ||
      interactionsCount > 0
    ) {
      throw new Error("STORE_HAS_HISTORY");
    }

    return prisma.store.delete({
      where: {
        id: storeId,
      },
    });
  },
};