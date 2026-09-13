import { prisma } from "../../lib/prisma.js";

import { generateUniqueCardCode } from "../../utils/card-code.js";
import { getCardUrls } from "../../utils/card-url.js";

import type {
  AssignCardInput,
  CreateCardInput,
  ListCardsQuery,
  UpdateCardInput,
} from "./card.schema.js";

import {
  subscriptionService,
} from "../subscriptions/subscription.service.js";

type CurrentUser = {
  id: string;
  role:
  | "SUPER_ADMIN"
  | "BUSINESS_OWNER";
};

const withUrls = <
  T extends {
    code: string;
  }
>(
  card: T
) => ({
  ...card,
  urls: getCardUrls(card.code),
});

export const cardService = {
  async create(
    data: CreateCardInput
  ) {
    const code =
      await generateUniqueCardCode();

    const card =
      await prisma.card.create({
        data: {
          code,
          label: data.label ?? null,
          status: "UNASSIGNED",
        },
      });

    return withUrls(card);
  },

  async findAll(
    user: CurrentUser,
    query: ListCardsQuery
  ) {
    const skip =
      (query.page - 1) * query.limit;

      const where = {
        ...(query.status
          ? {
              status: query.status,
            }
          : {}),
      
        ...(query.storeId
          ? {
              storeId:
                query.storeId,
            }
          : {}),
      
        ...(
          query.businessId ||
          user.role !==
            "SUPER_ADMIN"
            ? {
                store: {
                  is: {
                    ...(query.businessId
                      ? {
                          businessId:
                            query.businessId,
                        }
                      : {}),
      
                    ...(user.role !==
                    "SUPER_ADMIN"
                      ? {
                          business: {
                            is: {
                              ownerId:
                                user.id,
                            },
                          },
                        }
                      : {}),
                  },
                },
              }
            : {}
        ),
      };

    const [cards, total] =
      await Promise.all([
        prisma.card.findMany({
          where,

          include: {
            store: {
              include: {
                business: {
                  select: {
                    id: true,
                    name: true,
                    ownerId: true,
                  },
                },
              },
            },

            _count: {
              select: {
                interactions: true,
              },
            },
          },

          orderBy: {
            createdAt: "desc",
          },

          skip,
          take: query.limit,
        }),

        prisma.card.count({
          where,
        }),
      ]);

    return {
      cards: cards.map(withUrls),

      pagination: {
        page: query.page,
        limit: query.limit,
        total,

        totalPages:
          Math.ceil(
            total / query.limit
          ),
      },
    };
  },

  async findById(
    user: CurrentUser,
    cardId: string
  ) {
    const card =
      await prisma.card.findFirst({
        where: {
          id: cardId,

          ...(user.role !==
            "SUPER_ADMIN"
            ? {
              store: {
                is: {
                  business: {
                    is: {
                      ownerId:
                        user.id,
                    },
                  },
                },
              },
            }
            : {}),
        },

        include: {
          store: {
            include: {
              business: {
                select: {
                  id: true,
                  name: true,
                  ownerId: true,
                },
              },
            },
          },

          _count: {
            select: {
              interactions: true,
            },
          },
        },
      });

    if (!card) {
      return null;
    }

    return withUrls(card);
  },

  async update(
    user: CurrentUser,
    cardId: string,
    data: UpdateCardInput
  ) {
    const card =
      await this.findById(
        user,
        cardId
      );

    if (!card) {
      throw new Error(
        "CARD_NOT_FOUND"
      );
    }

    const updated =
      await prisma.card.update({
        where: {
          id: cardId,
        },

        data: {
          label: data.label,
        },

        include: {
          store: true,
        },
      });

    return withUrls(updated);
  },

  async assign(
    cardId: string,
    data: AssignCardInput
  ) {
    const [card, store] =
      await Promise.all([
        prisma.card.findUnique({
          where: {
            id: cardId,
          },
        }),

        prisma.store.findUnique({
          where: {
            id: data.storeId,
          },

          include: {
            business: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
      ]);

    if (!card) {
      throw new Error(
        "CARD_NOT_FOUND"
      );
    }

    if (!store) {
      throw new Error(
        "STORE_NOT_FOUND"
      );
    }

    if (!store.googleReviewUrl) {
      throw new Error(
        "STORE_REVIEW_URL_REQUIRED"
      );
    }

    const subscription = await subscriptionService
      .getCurrentForBusiness(
        store.business.id
      );

    if (
      !subscription ||
      !subscription.usable
    ) {
      throw new Error(
        "SUBSCRIPTION_REQUIRED"
      );
    }
    const alreadyBelongsToBusiness =
      card.storeId
        ? await prisma.store.findFirst({
          where: {
            id: card.storeId,

            businessId:
              store.business.id,
          },

          select: {
            id: true,
          },
        })
        : null;

    if (!alreadyBelongsToBusiness) {
      const activeCardsCount =
        await prisma.card.count({
          where: {
            status: "ACTIVE",

            store: {
              is: {
                businessId:
                  store.business.id,
              },
            },
          },
        });

      if (
        activeCardsCount >=
        subscription.limits.cards
      ) {
        throw new Error(
          "CARD_LIMIT_REACHED"
        );
      }
    }

    const updated = await prisma.card.update({
      where: {
        id: cardId,
      },

      data: {
        storeId: store.id,

        status: "ACTIVE",

        assignedAt: new Date(),

        ...(data.label
          ? {
            label: data.label,
          }
          : {}),
      },

      include: {
        store: {
          include: {
            business: true,
          },
        },
      },
    });

    return withUrls(updated);
  },

  async unassign(cardId: string) {
    const card =
      await prisma.card.findUnique({
        where: {
          id: cardId,
        },
      });

    if (!card) {
      throw new Error(
        "CARD_NOT_FOUND"
      );
    }

    const updated =
      await prisma.card.update({
        where: {
          id: cardId,
        },

        data: {
          storeId: null,
          status: "UNASSIGNED",
          assignedAt: null,
        },
      });

    return withUrls(updated);
  },
};