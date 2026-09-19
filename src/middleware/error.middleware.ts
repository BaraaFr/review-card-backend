import type {
  ErrorRequestHandler,
} from "express";

import {
  DomainError,
} from "../lib/domain-error.js";

import {
  ZodError,
} from "zod";

import {
  AnalyticsRangeError,
} from "../modules/analytics/utils/analytics-range.util.js";
import { logError, logWarn } from "../lib/logger.js";

export const errorHandler:
  ErrorRequestHandler =
  (
    error:
      unknown,

    req,

    res,

    next
  ) => {
    if (
      res.headersSent
    ) {
      return next(
        error
      );
    }

    if (
      error instanceof
      DomainError
    ) {
      if (
        error.status >=
        500
      ) {
        logWarn(
          "request_domain_error",

          {
            requestId:
              req.requestId,

            method:
              req.method,

            path:
              req.originalUrl
                ?.split(
                  "?"
                )[0],

            statusCode:
              error.status,

            code:
              error.code,
          }
        );
      }
      if (
        error.status ===
        503
      ) {
        res.setHeader(
          "Retry-After",
          "2"
        );
      }

      return res
        .status(
          error.status
        )
        .json({
          success:
            false,

          code:
            error.code,

          message:
            error.message,
        });
    }

    if (
      error instanceof
      AnalyticsRangeError
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            error.message,
        });
    }

    if (
      error instanceof
      ZodError
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          code:
            "INVALID_REQUEST",

          message:
            "Invalid request data.",

          errors:
            error.flatten(),
        });
    }

    /*
     * Express body parsers may expose
     * 4xx parsing errors.
     *
     * Never expose their body,
     * stack or arbitrary diagnostic
     * information.
     */
    const requestError =
      error as {
        status?:
        unknown;

        expose?:
        unknown;
      } |
      null;

    if (
      requestError
        ?.expose ===
      true &&
      typeof requestError
        .status ===
      "number" &&
      requestError.status >=
      400 &&
      requestError.status <
      500
    ) {
      return res
        .status(
          requestError.status
        )
        .json({
          success:
            false,

          code:
            "INVALID_REQUEST",

          message:
            "Invalid request.",
        });
    }

    logError(
      "request_unhandled_error",

      error,

      {
        requestId:
          req.requestId,

        method:
          req.method,

        path:
          req.originalUrl
            ?.split(
              "?"
            )[0],

        statusCode:
          500,
      }
    );
    return res
    .status(500)
    .json({
      success:
        false,
  
      code:
        "INTERNAL_SERVER_ERROR",
  
      message:
        "An unexpected error occurred.",
  
      requestId:
        req.requestId,
    });
  };