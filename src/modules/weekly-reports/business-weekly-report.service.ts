import {
  normalizeTimeZone,
} from "./weekly-report-time.util.js";

import {
  loadWeeklyReportContext,
  loadWeeklyReportMetrics,
} from "./business-weekly-report.data.js";

import {
  buildBusinessWeeklyReport,
  buildEmptyWeeklyReport,
} from "./business-weekly-report.calculations.js";

import {
  resolveWeeklyReportRange,
} from "../../utils/weekly-report-range.js";

export async function getBusinessWeeklyReport(
  businessId: string,
  requestedTimeZone: string,
  referenceDate = new Date()
) {
  const timeZone =
    normalizeTimeZone(
      requestedTimeZone
    );

  const generatedAt =
    new Date(
      referenceDate
    );

  const range =
    resolveWeeklyReportRange(
      generatedAt,
      timeZone
    );

  const context =
    await loadWeeklyReportContext(
      businessId
    );

  const period = {
    generatedAt,

    currentFrom:
      range.fromUtc,

    /*
     * THIS MUST BE toExclusiveUtc.
     *
     * Do NOT use:
     * range.fromUtc
     * range.previousToExclusiveUtc
     */
    currentTo:
      range.toExclusiveUtc,

    previousFrom:
      range.previousFromUtc,

    previousTo:
      range.previousToExclusiveUtc,

    timeZone,
  };

  if (
    context.storeIds.length ===
    0
  ) {
    return buildEmptyWeeklyReport(
      context,
      period
    );
  }

  const metrics =
    await loadWeeklyReportMetrics(
      context.storeIds,
      context.activeCardIds,

      range.fromUtc,
      range.previousFromUtc,

      /*
       * Current range ends here.
       */
      range.toExclusiveUtc
    );

  return buildBusinessWeeklyReport(
    context,
    metrics,
    period
  );
}