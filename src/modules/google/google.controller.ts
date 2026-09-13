import type {
    NextFunction,
    Request,
    Response,
} from "express";

import {
    confirmGooglePlaceSchema,
} from "./google.schema.js";

import {
    confirmGooglePlace,
    connectGooglePlace,
    disconnectGooglePlace,
    getStoreGoogleReputation,
} from "./google.service.js";

function handleGoogleError(
    error: unknown,
    res: Response
) {
    if (
        !(error instanceof Error)
    ) {
        return false;
    }

    const errorMap:
        Record<
            string,
            {
                status: number;
                message: string;
            }
        > = {
        STORE_NOT_FOUND: {
            status: 404,

            message:
                "Location not found.",
        },

        FORBIDDEN: {
            status: 403,

            message:
                "You don't have access to this location.",
        },

        GOOGLE_REVIEW_URL_REQUIRED:
        {
            status: 400,

            message:
                "Add a Google Review URL before connecting Google.",
        },

        INVALID_GOOGLE_REVIEW_URL:
        {
            status: 400,

            message:
                "The Google Review URL is invalid.",
        },

        GOOGLE_PLACE_FETCH_FAILED:
        {
            status: 502,

            message:
                "Google Business information is temporarily unavailable.",
        },

        GOOGLE_PLACE_SEARCH_FAILED:
        {
            status: 502,

            message:
                "Google Business search is temporarily unavailable.",
        },

        INVALID_GOOGLE_CONFIRMATION_TOKEN:
        {
            status: 400,

            message:
                "The Google Business confirmation is invalid.",
        },

        GOOGLE_CONFIRMATION_EXPIRED:
        {
            status: 409,

            message:
                "The Google Business confirmation expired. Please connect again.",
        },

        GOOGLE_CONFIRMATION_STALE:
        {
            status: 409,

            message:
                "The Google Review URL changed. Please connect Google again.",
        },

        GOOGLE_PLACE_NOT_ALLOWED:
        {
            status: 400,

            message:
                "The selected Google Business is not one of the suggested businesses.",
        },
    };

    const mapped =
        errorMap[
        error.message
        ];

    if (!mapped) {
        return false;
    }

    res
        .status(
            mapped.status
        )
        .json({
            success: false,

            code:
                error.message,

            message:
                mapped.message,
        });

    return true;
}

export async function connectGooglePlaceController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const result =
            await connectGooglePlace(
                req.params.storeId as string,
                {
                    id:
                        req.user!.id,

                    role:
                        req.user!.role,
                }
            );

        return res.json({
            success: true,

            data:
                result,
        });
    } catch (error) {
        if (
            handleGoogleError(
                error,
                res
            )
        ) {
            return;
        }

        return next(error);
    }
}

export async function confirmGooglePlaceController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const parsed =
            confirmGooglePlaceSchema.safeParse(
                req.body
            );

        if (!parsed.success) {
            return res
                .status(400)
                .json({
                    success: false,

                    code:
                        "INVALID_GOOGLE_CONFIRMATION",

                    message:
                        "Place ID and confirmation token are required.",

                    errors:
                        parsed.error.flatten(),
                });
        }

        const result =
            await confirmGooglePlace(
                {
                    storeId: req.params.storeId as string,

                    placeId:
                        parsed.data.placeId,

                    confirmationToken:
                        parsed.data
                            .confirmationToken,

                    user: {
                        id:
                            req.user!.id,

                        role:
                            req.user!.role,
                    },
                }
            );

        return res.json({
            success: true,

            data:
                result,
        });
    } catch (error) {
        if (
            handleGoogleError(
                error,
                res
            )
        ) {
            return;
        }

        return next(error);
    }
}

export async function getGoogleReputationController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const result =
            await getStoreGoogleReputation(
                req.params.storeId as string,

                req.user!.id,

                req.user!.role ===
                "SUPER_ADMIN"
            );

        return res.json({
            success: true,

            data:
                result,
        });
    } catch (error) {
        if (
            handleGoogleError(
                error,
                res
            )
        ) {
            return;
        }

        return next(error);
    }
}

export async function disconnectGooglePlaceController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result =
        await disconnectGooglePlace(
          req.params.storeId as string,
          {
            id:
              req.user!.id,
  
            role:
              req.user!.role,
          }
        );
  
      return res.json({
        success: true,
  
        data:
          result,
      });
    } catch (error) {
      if (
        handleGoogleError(
          error,
          res
        )
      ) {
        return;
      }
  
      return next(error);
    }
  }