import {
    prisma,
  } from "../../lib/prisma.js";
  
  type CreateAccountRequestInput = {
    ownerName: string;
  
    phone: string;
  
    shopName: string;
  
    businessType?:
      | string
      | null;
  
    requestedCards: number;
  
    message?:
      | string
      | null;
  };
  
  type AccountRequestStatus =
    | "NEW"
    | "CONTACTED"
    | "QUALIFIED"
    | "CONVERTED"
    | "CLOSED";
  
  function normalizePhone(
    phone: string
  ) {
    const hasPlus =
      phone
        .trim()
        .startsWith(
          "+"
        );
  
    const digits =
      phone.replace(
        /\D/g,
        ""
      );
  
    return hasPlus
      ? `+${digits}`
      : digits;
  }
  
  export async function createAccountRequest(
    input:
      CreateAccountRequestInput
  ) {
    const phone =
      normalizePhone(
        input.phone
      );
  
    /*
     * Prevent accidental double
     * submissions.
     */
    const duplicateWindow =
      new Date(
        Date.now() -
          15 *
            60 *
            1000
      );
  
    const existing =
      await prisma.accountRequest.findFirst({
        where: {
          phone,
  
          shopName: {
            equals:
              input.shopName,
  
            mode:
              "insensitive",
          },
  
          createdAt: {
            gte:
              duplicateWindow,
          },
        },
  
        orderBy: {
          createdAt:
            "desc",
        },
      });
  
    if (existing) {
      return {
        duplicate:
          true,
  
        request:
          existing,
      };
    }
  
    const request =
      await prisma.accountRequest.create({
        data: {
          ownerName:
            input.ownerName,
  
          phone,
  
          shopName:
            input.shopName,
  
          businessType:
            input.businessType ||
            null,
  
          requestedCards:
            input.requestedCards,
  
          message:
            input.message ||
            null,
        },
      });
  
    return {
      duplicate:
        false,
  
      request,
    };
  }
  
  export async function getAdminAccountRequests(
    input: {
      status?:
        AccountRequestStatus;
  
      search?: string;
  
      page: number;
  
      perPage: number;
    }
  ) {
    const {
      status,
      search,
      page,
      perPage,
    } =
      input;
  
    const where = {
      ...(status
        ? {
            status,
          }
        : {}),
  
      ...(search
        ? {
            OR: [
              {
                ownerName: {
                  contains:
                    search,
  
                  mode:
                    "insensitive" as const,
                },
              },
  
              {
                shopName: {
                  contains:
                    search,
  
                  mode:
                    "insensitive" as const,
                },
              },
  
              {
                phone: {
                  contains:
                    search,
                },
              },
            ],
          }
        : {}),
    };
  
    const [
      items,
      total,
      grouped,
    ] =
      await Promise.all([
        prisma.accountRequest.findMany({
          where,
  
          orderBy: {
            createdAt:
              "desc",
          },
  
          skip:
            (page - 1) *
            perPage,
  
          take:
            perPage,
        }),
  
        prisma.accountRequest.count({
          where,
        }),
  
        prisma.accountRequest.groupBy({
          by: [
            "status",
          ],
  
          _count: {
            _all:
              true,
          },
        }),
      ]);
  
    const summary = {
      NEW: 0,
      CONTACTED: 0,
      QUALIFIED: 0,
      CONVERTED: 0,
      CLOSED: 0,
    };
  
    for (
      const item of grouped
    ) {
      summary[
        item.status
      ] =
        item._count._all;
    }
  
    return {
      items,
  
      meta: {
        page,
  
        perPage,
  
        total,
  
        totalPages:
          Math.max(
            1,
  
            Math.ceil(
              total /
                perPage
            )
          ),
      },
  
      summary,
    };
  }
  
  export async function updateAccountRequest(
    requestId: string,
    input: {
      status?:
        AccountRequestStatus;
  
      adminNote?:
        | string
        | null;
    },
    adminId: string
  ) {
    const request =
      await prisma.accountRequest.findUnique({
        where: {
          id:
            requestId,
        },
      });
  
    if (!request) {
      throw new Error(
        "ACCOUNT_REQUEST_NOT_FOUND"
      );
    }
  
    const shouldSetContactedAt =
      !request.contactedAt &&
      input.status !==
        undefined &&
      input.status !==
        "NEW";
  
    return prisma.accountRequest.update({
      where: {
        id:
          requestId,
      },
  
      data: {
        ...(input.status !==
        undefined
          ? {
              status:
                input.status,
            }
          : {}),
  
        ...(input.adminNote !==
        undefined
          ? {
              adminNote:
                input.adminNote ||
                null,
            }
          : {}),
  
        handledById:
          adminId,
  
        ...(shouldSetContactedAt
          ? {
              contactedAt:
                new Date(),
            }
          : {}),
      },
    });
  }