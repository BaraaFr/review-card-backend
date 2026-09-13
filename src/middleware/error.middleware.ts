import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AnalyticsRangeError } from "../modules/analytics/utils/analytics-range.util.js";

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof AnalyticsRangeError) {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false, code: "INVALID_REQUEST", message: "Invalid request data.",
      errors: error.flatten(),
    });
  }

  // Express body parsers mark request errors as public. Never return their
  // body, stack or arbitrary exception messages to the client.
  const requestError = error as { status?: unknown; expose?: unknown } | null;
  if (requestError?.expose === true && typeof requestError.status === "number" &&
      requestError.status >= 400 && requestError.status < 500) {
    return res.status(requestError.status).json({
      success: false, code: "INVALID_REQUEST", message: "Invalid request.",
    });
  }
  console.error("Unhandled request error", error);
  return res.status(500).json({
    success: false, code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred.",
  });
};
