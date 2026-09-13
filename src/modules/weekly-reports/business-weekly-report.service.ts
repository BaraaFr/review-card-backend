import { normalizeTimeZone } from "./weekly-report-time.util.js";
import { loadWeeklyReportContext, loadWeeklyReportMetrics } from "./business-weekly-report.data.js";
import { buildBusinessWeeklyReport, buildEmptyWeeklyReport } from "./business-weekly-report.calculations.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getBusinessWeeklyReport(businessId: string, requestedTimeZone: string) {
  const timeZone = normalizeTimeZone(requestedTimeZone);
  const context = await loadWeeklyReportContext(businessId);
  const now = new Date();
  const currentFrom = new Date(now.getTime() - WEEK_MS);
  const previousFrom = new Date(currentFrom.getTime() - WEEK_MS);
  const period = { now, currentFrom, previousFrom, timeZone };

  if (context.storeIds.length === 0) return buildEmptyWeeklyReport(context, period);

  const metrics = await loadWeeklyReportMetrics(
    context.storeIds, context.activeCardIds, currentFrom, previousFrom, now,
  );
  return buildBusinessWeeklyReport(context, metrics, period);
}
