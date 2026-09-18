import type {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  analyticsService,
  getActionCenter,
  getLocationPerformance,
  getStoreCardPerformance,
  getStoreEngagementPatterns,
  getStoreEngagementSummary,
  getWeeklyReport,
  getFilteredAnalyticsReport,
  getDataReport
} from "./analytics.service.js";
import { AnalyticsRangeError, resolveAnalyticsRangeQuery } from "./utils/analytics-range.util.js";
import { generateAnalyticsReportPdf } from "./utils/analytics-report.pdf.js";
import { sanitizeFilename, parseQuery } from "./utils/helpers.js";
export const getOverview = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const validation =
      parseQuery(req);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid analytics filters",

        errors:
          validation.error
            .flatten()
            .fieldErrors,
      });
    }

    const overview =
      await analyticsService.overview(
        req.user,
        validation.data
      );

    return res.status(200).json({
      success: true,

      data: {
        overview,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to load analytics",
    });
  }
};

export const getCardAnalytics = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const validation =
      parseQuery(req);

    if (
      !validation.success
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Invalid analytics filters",
        });
    }

    const result =
      await analyticsService.cards(
        req.user,
        validation.data
      );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to load card analytics",
    });
  }
};

export const getStoreAnalytics = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const validation =
      parseQuery(req);

    if (
      !validation.success
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Invalid analytics filters",
        });
    }

    const result =
      await analyticsService.stores(
        req.user,
        validation.data
      );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to load store analytics",
    });
  }
};

export const getTimeline = async (
  req: Request,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    const validation =
      parseQuery(req);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid analytics filters",
      });
    }

    const result =
      await analyticsService.timeline(
        req.user,
        validation.data
      );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to load analytics timeline",
    });
  }
};

export async function getActionCenterController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      storeId,
    } =
      req.params;

    if (!storeId) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Store ID is required.",
        });
    }

    const range =
      resolveAnalyticsRangeQuery(
        req.query
      );

    const data =
      await getActionCenter(
        storeId as string,
        range
      );

    return res.json({
      success:
        true,

      data,
    });
  } catch (error) {
    if (
      error instanceof
      Error &&
      error.message ===
      "STORE_NOT_FOUND"
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Store not found.",
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

    return next(
      error
    );
  }
}

export async function getStoreCardPerformanceController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      storeId,
    } =
      req.params;

    if (!storeId) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Store ID is required.",
        });
    }

    const range =
      resolveAnalyticsRangeQuery(
        req.query
      );

    const data =
      await getStoreCardPerformance(
        storeId as string,
        range
      );

    return res.json({
      success:
        true,

      data,
    });
  } catch (error) {

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
      Error &&
      error.message ===
      "STORE_NOT_FOUND"
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Store not found.",
        });
    }

    return next(
      error
    );
  }
}

export async function getStoreEngagementSummaryController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      storeId,
    } =
      req.params;

    if (!storeId) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Store ID is required.",
        });
    }

    const range = resolveAnalyticsRangeQuery(req.query)

    const data =
      await getStoreEngagementSummary(
        storeId as string,
        range
      );

    return res.json({
      success:
        true,

      data,
    });
  } catch (error) {
    if (
      error instanceof
      Error &&
      error.message ===
      "STORE_NOT_FOUND"
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Store not found.",
        });
    }

    return next(
      error
    );
  }
}

export async function getStoreEngagementPatternsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      storeId,
    } =
      req.params;

    if (!storeId) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Store ID is required.",
        });
    }

    const range = resolveAnalyticsRangeQuery(req.query)

    const data =
      await getStoreEngagementPatterns(
        storeId as string,
        range
      );

    return res.json({
      success:
        true,

      data,
    });
  } catch (error) {
    if (
      error instanceof
      Error &&
      error.message ===
      "STORE_NOT_FOUND"
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Store not found.",
        });
    }

    return next(
      error
    );
  }
}

export async function downloadAnalyticsReportController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      storeId,
    } =
      req.params;

    if (!storeId) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Store ID is required.",
        });
    }
    const range = resolveAnalyticsRangeQuery(req.query)

    const report = await getFilteredAnalyticsReport(
      storeId as string,
      range,
    );

    const pdf =
      await generateAnalyticsReportPdf(
        report
      );

    const locationName =
      sanitizeFilename(
        report.store.name ??
        "location"
      );

    const filename =
      `valyou-${locationName}-report.pdf`;

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    res.setHeader(
      "Content-Length",
      pdf.length
    );

    return res.send(
      pdf
    );
  } catch (error) {
    if (
      error instanceof
      Error &&
      error.message ===
      "STORE_NOT_FOUND"
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Store not found.",
        });
    }

    next(
      error
    );
  }
}

export async function getLocationPerformanceController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      storeId,
    } =
      req.params;

    if (!storeId) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Store ID is required.",
        });
    }

    const range = resolveAnalyticsRangeQuery(req.query)

    const data =
      await getLocationPerformance(
        storeId as string,
        range
      );

    return res.json({
      success:
        true,

      data,
    });
  } catch (error) {
    if (
      error instanceof
      Error &&
      error.message ===
      "STORE_NOT_FOUND"
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Store not found.",
        });
    }

    return next(
      error
    );
  }
}

export async function getDataReportController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      storeId,
    } =
      req.params;

    if (!storeId) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Store ID is required.",
        });
    }

    /*
     * Uses the exact same range resolver
     * as the rest of the Analytics page.
     */
    const range =
      resolveAnalyticsRangeQuery(
        req.query
      );

    const data =
      await getDataReport(
        storeId as string,
        range
      );

    return res.json({
      success:
        true,

      data,
    });
  } catch (error) {
    if (
      error instanceof
        Error &&
      error.message ===
        "STORE_NOT_FOUND"
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Store not found.",
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

    return next(
      error
    );
  }
}

export async function getWeeklyReportController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      storeId,
    } =
      req.params;

    if (!storeId) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Store ID is required.",
        });
    }

    const timeZone =
      typeof req.query
        .timeZone ===
        "string"
        ? req.query
          .timeZone
        : "UTC";

    const data = await getWeeklyReport(
      storeId as string,
      timeZone
    );

    return res.json({
      success:
        true,

      data,
    });
  } catch (error) {
    if (
      error instanceof
      Error &&
      error.message ===
      "STORE_NOT_FOUND"
    ) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Store not found.",
        });
    }

    if (
      error instanceof
      AnalyticsRangeError
    ) {
      return res
        .status(
          400
        )
        .json({
          success:
            false,
    
          message:
            error.message,
        });
    }

    return next(
      error
    );
  }
}