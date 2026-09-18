import {
    Router,
  } from "express";
  
  import {
    authenticate,
  } from "../../middleware/auth.middleware.js";
  
  import {
    requireFeatureAccess,
  } from "../../middleware/feature-access.middleware.js";
  
  import {
    sharedRateLimit,
  } from "../../middleware/shared-rate-limit.js";
  
  import {
    prisma,
  } from "../../lib/prisma.js";
  
  import {
    DomainError,
  } from "../../lib/domain-error.js";
  
  import {
    confirmGooglePlaceController,
    connectGooglePlaceController,
    disconnectGooglePlaceController,
    getGoogleReputationController,
  } from "./google.controller.js";
  
  const router =
    Router();
  
  /*
   * All Google management routes
   * require authentication.
   */
  router.use(
    authenticate
  );
  
  /*
   * =========================================================
   * Store ownership boundary
   * =========================================================
   *
   * Verify access BEFORE consuming
   * Google/store-specific budgets.
   */
  router.use(
    "/stores/:storeId",
  
    async (
      req,
      _res,
      next
    ) => {
      try {
        const store =
          await prisma.store
            .findFirst({
              where: {
                id:
                  req.params.storeId as string,
  
                ...(
                  req.user!.role ===
                    "SUPER_ADMIN"
                    ? {}
                    : {
                        business: {
                          ownerId:
                            req.user!.id,
                        },
                      }
                ),
              },
  
              select: {
                id:
                  true,
              },
            });
  
        if (
          !store
        ) {
          throw new DomainError(
            404,
  
            "STORE_NOT_FOUND",
  
            "Location not found."
          );
        }
  
        next();
      } catch (
        error
      ) {
        next(
          error
        );
      }
    }
  );
  
  /*
   * =========================================================
   * Google connection budget
   * =========================================================
   *
   * Connect/search calls can invoke
   * Google Places APIs.
   *
   * 20 per user/hour is enough for
   * normal administration while
   * blocking automated abuse.
   */
  const connectionLimit =
    sharedRateLimit(
      "google-connect",
  
      20,
  
      60 *
        60 *
        1000,
  
      (
        req
      ) =>
        req.user!.id
    );
  
  /*
   * =========================================================
   * Reputation budget
   * =========================================================
   *
   * Shared across API replicas.
   */
  const reputationLimit =
    sharedRateLimit(
      "google-reputation",
  
      12,
  
      60 *
        60 *
        1000,
  
      (
        req
      ) =>
        String(
          req.params.storeId
        )
    );
  
  /*
   * Start Google connection.
   */
  router.post(
    "/stores/:storeId/connect",
  
    connectionLimit,
  
    connectGooglePlaceController
  );
  
  /*
   * Confirm candidate.
   */
  router.post(
    "/stores/:storeId/confirm",
  
    connectionLimit,
  
    confirmGooglePlaceController
  );
  
  /*
   * Disconnect doesn't call Google,
   * so it doesn't consume upstream
   * Google quota.
   */
  router.delete(
    "/stores/:storeId/connection",
  
    disconnectGooglePlaceController
  );
  
  /*
   * Reputation fetch.
   */
  router.get(
    "/stores/:storeId/reputation",
  
    requireFeatureAccess(
      "ANALYTICS"
    ),
  
    reputationLimit,
  
    getGoogleReputationController
  );
  
  export default router;