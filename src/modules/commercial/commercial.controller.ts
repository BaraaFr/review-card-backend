import type {
    Request,
    RequestHandler,
  } from "express";
  
  import {
    z,
  } from "zod";
  
  import {
    DomainError,
  } from "../../lib/domain-error.js";
  
  import type {
    MutationContext,
  } from "../../lib/mutation.js";
  
  import {
    prisma,
  } from "../../lib/prisma.js";
  
  import {
    createStoreSchema,
  } from "../stores/store.schema.js";
  
  import {
    assignCardSchema,
    createCardSchema,
  } from "../cards/card.schema.js";
  
  import {
    createAdditionalBusinessSchema,
  } from "../admin/customers/customer.schema.js";
  
  import {
    deliverySchema,
    paidPlanSchema,
    subscriptionStatusSchema,
  } from "./commercial.schema.js";
  
  import {
    commercialService as service,
  } from "./commercial.service.js";
  
  function context(
    req: Request
  ): MutationContext {
    if (!req.user) {
      throw new DomainError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Sign in first."
      );
    }
  
    return {
      actor:
        req.user,
  
      key:
        req.get(
          "Idempotency-Key"
        ) ?? "",
    };
  }
  
  const action = (
    run:
      (
        req: Request
      ) => Promise<unknown>,
  
    status =
      200
  ): RequestHandler =>
    async (
      req,
      res,
      next
    ) => {
      try {
        res
          .status(status)
          .json({
            success:
              true,
  
            data:
              await run(
                req
              ),
          });
      } catch (error) {
        next(error);
      }
    };
  
  export const createAdditionalBusinessSafely =
    action(
      (
        req
      ) =>
        service.createAdditionalBusiness(
          context(req),
          req.params
            .userId as string,
          createAdditionalBusinessSchema.parse(
            req.body
          )
        ),
  
      201
    );
  
  export const createStoreSafely =
    action(
      (
        req
      ) =>
        service.createStore(
          context(req),
  
          req.params
            .businessId as string,
  
          createStoreSchema.parse(
            req.body
          )
        ),
  
      201
    );
  
  export const removeStoreSafely =
    action(
      (
        req
      ) =>
        service.removeStore(
          context(req),
  
          req.params
            .id as string
        )
    );
  
  export const createCardSafely =
    action(
      (
        req
      ) =>
        service.createCard(
          context(req),
  
          createCardSchema.parse(
            req.body
          )
        ),
  
      201
    );
  
  export const assignCardSafely =
    action(
      (
        req
      ) =>
        service.assignCard(
          context(req),
  
          req.params
            .id as string,
  
          assignCardSchema.parse(
            req.body
          )
        )
    );
  
  export const unassignCardSafely =
    action(
      (
        req
      ) =>
        service.unassignCard(
          context(req),
  
          req.params
            .id as string
        )
    );
  
  export const deliverCardSafely =
    action(
      (
        req
      ) =>
        service.deliverCard(
          context(req),
  
          req.params
            .id as string,
  
          deliverySchema.parse(
            req.body
          )
        )
    );
  
  export const startTrialSafely =
    action(
      (
        req
      ) =>
        service.startTrial(
          context(req),
  
          req.params
            .businessId as string
        ),
  
      201
    );
  
  export const activatePaidSafely =
    action(
      (
        req
      ) =>
        service.activatePaid(
          context(req),
  
          req.params
            .businessId as string,
  
          paidPlanSchema.parse(
            req.body
          )
        )
    );
  
  export const changeStatusSafely =
    action(
      (
        req
      ) =>
        service.changeStatus(
          context(req),
  
          req.params
            .id as string,
  
          subscriptionStatusSchema.parse(
            req.body
          )
        )
    );
  
  export const rejectLegacySubscription:
    RequestHandler =
    (
      _req,
      _res,
      next
    ) =>
      next(
        new DomainError(
          410,
          "USE_SUBSCRIPTION_ACTIONS",
          "Use Start trial or Record payment to activate access."
        )
      );
  
  export const getPaymentHistory =
    action(
      async (
        req
      ) => {
        const {
          page,
          limit,
        } =
          z
            .object({
              page:
                z
                  .coerce
                  .number()
                  .int()
                  .min(1)
                  .max(10000)
                  .default(1),
  
              limit:
                z
                  .coerce
                  .number()
                  .int()
                  .min(1)
                  .max(100)
                  .default(20),
            })
            .parse(
              req.query
            );
  
        const where = {
          businessId:
            req.params
              .businessId as string,
        };
  
        const [
          payments,
          total,
        ] =
          await Promise.all([
            prisma.paymentRecord.findMany({
              where,
  
              orderBy: [
                {
                  receivedAt:
                    "desc",
                },
  
                {
                  id:
                    "desc",
                },
              ],
  
              skip:
                (
                  page -
                  1
                ) *
                limit,
  
              take:
                limit,
            }),
  
            prisma.paymentRecord.count({
              where,
            }),
          ]);
  
        return {
          payments,
  
          pagination: {
            page,
            limit,
            total,
          },
        };
      }
    );