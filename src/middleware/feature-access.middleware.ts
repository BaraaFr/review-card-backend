import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  prisma,
} from "../lib/prisma.js";

import {
  subscriptionService,
} from "../modules/subscriptions/subscription.service.js";

export type FeatureName =
  | "ANALYTICS";

async function resolveBusinessId(req: Request): Promise<string | null> {
  const { businessId, storeId: queryStoreId, cardId } = req.query;
  const routeStoreId = req.params.storeId;
  const suppliedIds = [businessId, queryStoreId, cardId, routeStoreId];

  if (suppliedIds.some((id) => id !== undefined &&
      (typeof id !== "string" || id.length === 0))) {
    return null;
  }

  if (routeStoreId && queryStoreId && routeStoreId !== queryStoreId) {
    return null;
  }

  const businessIds = new Set<string>();
  if (typeof businessId === "string") businessIds.add(businessId);

  // Authorize the resource the handler will actually read. A caller's
  // businessId must never override the store or card's real business.
  const storeId = routeStoreId || queryStoreId;
  if (typeof storeId === "string") {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { businessId: true },
    });
    if (!store) return null;
    businessIds.add(store.businessId);
  }

  if (typeof cardId === "string") {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { store: { select: { id: true, businessId: true } } },
    });
    if (!card?.store || (storeId && card.store.id !== storeId)) return null;
    businessIds.add(card.store.businessId);
  }

  return businessIds.size === 1 ? [...businessIds][0] : null;
}

export const requireFeatureAccess =
  (
    feature: FeatureName
  ) =>
    async (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      try {
        if (!req.user) {
          return res
            .status(401)
            .json({
              success: false,

              code:
                "AUTHENTICATION_REQUIRED",

              message:
                "Authentication required.",
            });
        }

        /*
         * Super Admin bypasses
         * subscription restrictions.
         */
        if (
          req.user.role ===
          "SUPER_ADMIN"
        ) {
          return next();
        }

        const businessId =
          await resolveBusinessId(
            req
          );

        if (!businessId) {
          return res
            .status(400)
            .json({
              success: false,

              code:
                "BUSINESS_CONTEXT_REQUIRED",

              message:
                "A business is required to access this feature.",
            });
        }

        /*
         * Make sure this business
         * belongs to this owner.
         */
        const business =
          await prisma.business.findFirst({
            where: {
              id:
                businessId,

              ownerId:
                req.user.id,
            },

            select: {
              id: true,
            },
          });

        if (!business) {
          return res
            .status(404)
            .json({
              success: false,

              code:
                "BUSINESS_NOT_FOUND",

              message:
                "Business not found.",
            });
        }

        const subscription =
          await subscriptionService.getCurrentForBusiness(
            business.id
          );

        if (
          !subscription ||
          !subscription.usable
        ) {
          return res
            .status(403)
            .json({
              success: false,

              code:
                `${feature}_SUBSCRIPTION_REQUIRED`,

              message:
                "An active subscription is required to access analytics.",
            });
        }

        return next();
      } catch (error) {
        console.error(
          "Feature access check failed:",
          error
        );

        return res
          .status(500)
          .json({
            success: false,

            code:
              "FEATURE_ACCESS_CHECK_FAILED",

            message:
              "Unable to verify feature access.",
          });
      }
    };