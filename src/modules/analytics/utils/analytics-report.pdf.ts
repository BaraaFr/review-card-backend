import PDFDocument from "pdfkit";

import type {
  getFilteredAnalyticsReport,
} from "../analytics.service.js";

type Report =
  Awaited<
    ReturnType<
      typeof getFilteredAnalyticsReport
    >
  >;

type PdfDoc =
  InstanceType<
    typeof PDFDocument
  >;

/*
 * =======================================================
 * Brand colors
 * =======================================================
 */

const COLORS = {
  emerald:
    "#059669",

  emeraldDark:
    "#047857",

  emeraldDeep:
    "#065F46",

  emeraldSoft:
    "#ECFDF5",

  emeraldBorder:
    "#A7F3D0",

  dark:
    "#111827",

  text:
    "#374151",

  muted:
    "#6B7280",

  lightMuted:
    "#9CA3AF",

  border:
    "#E5E7EB",

  background:
    "#F8FAFC",

  white:
    "#FFFFFF",

  amber:
    "#D97706",

  amberSoft:
    "#FFFBEB",

  amberBorder:
    "#FDE68A",
};

/*
 * =======================================================
 * A4 layout
 * =======================================================
 */

const PAGE = {
  width:
    595.28,

  height:
    841.89,

  margin:
    42,

  contentWidth:
    595.28 -
    84,

  /*
   * Keep content away from
   * the footer.
   */
  contentBottom:
    765,
};

/*
 * =======================================================
 * Helpers
 * =======================================================
 */

function displayName(
  value:
    string | null | undefined,
  fallback:
    string
) {
  return (
    value?.trim() ||
    fallback
  );
}

function formatChange(
  change:
    number | null
) {
  if (
    change ===
    null
  ) {
    return {
      label:
        "New activity",

      tone:
        "positive" as const,
    };
  }

  if (
    change >
    0
  ) {
    return {
      label:
        `+${change}%`,

      tone:
        "positive" as const,
    };
  }

  if (
    change <
    0
  ) {
    return {
      label:
        `${change}%`,

      tone:
        "warning" as const,
    };
  }

  return {
    label:
      "0%",

    tone:
      "neutral" as const,
  };
}

function formatGeneratedDate(
  date:
    Date
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  ).format(
    date
  );
}

function formatDateKey(
  value:
    string | null
) {
  if (!value) {
    return null;
  }

  const [
    year,
    month,
    day,
  ] =
    value
      .split("-")
      .map(
        Number
      );

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      timeZone:
        "UTC",
    }
  ).format(
    date
  );
}

function getReportPeriodLabel(
  report: Report
) {
  const from =
    formatDateKey(
      report.period.from
    );

  const to =
    formatDateKey(
      report.period.to
    );

  if (
    from &&
    to
  ) {
    return `${from} - ${to}`;
  }

  return "Selected period";
}

function getReportPeriodTitle(
  report: Report
) {
  switch (
    report.period.preset
  ) {
    case "7d":
      return "LAST 7 DAYS";

    case "30d":
      return "LAST 30 DAYS";

    case "this-month":
      return "THIS MONTH";

    case "last-month":
      return "LAST MONTH";

    case "custom":
      return "CUSTOM RANGE";

    default:
      return "REPORT PERIOD";
  }
}

function getPreviousPeriodLabel(
  report: Report
) {
  const from =
    formatDateKey(
      report.period.previousFrom
    );

  const to =
    formatDateKey(
      report.period.previousTo
    );

  if (
    !from ||
    !to
  ) {
    return null;
  }

  return `${from} - ${to}`;
}

/*
 * =======================================================
 * Main generator
 * =======================================================
 */

export async function generateAnalyticsReportPdf(
  report: Report
) {
  const doc =
    new PDFDocument({
      size:
        "A4",

      margin:
        PAGE.margin,

      bufferPages:
        true,

      info: {
        Title:
          `ValYou Analytics Report - ${displayName(
            report.store.name,
            "Location"
          )}`,

        Author:
          "ValYou",

        Subject:
          `Customer engagement analytics from ${report.period.from} to ${report.period.to}`,
      },
    });

  const chunks:
    Buffer[] =
    [];

  const result =
    new Promise<Buffer>(
      (
        resolve,
        reject
      ) => {
        doc.on(
          "data",
          (
            chunk
          ) => {
            chunks.push(
              Buffer.from(
                chunk
              )
            );
          }
        );

        doc.on(
          "end",
          () => {
            resolve(
              Buffer.concat(
                chunks
              )
            );
          }
        );

        doc.on(
          "error",
          reject
        );
      }
    );

  /*
   * =====================================================
   * Header
   * =====================================================
   */

  drawReportHeader(
    doc,
    report
  );

  let y =
    172;

  /*
   * =====================================================
   * Executive summary
   * =====================================================
   */

  const previousPeriodLabel =
    getPreviousPeriodLabel(
      report
    );

  drawSectionHeading(
    doc,
    y,
    "Executive Summary",
    previousPeriodLabel
      ? `Performance for the selected period compared with ${previousPeriodLabel}.`
      : "A quick overview of customer engagement for the selected period."
  );

  y =
    doc.y +
    12;

  const metricGap =
    9;

  const metricWidth =
    (
      PAGE.contentWidth -
      metricGap *
        3
    ) /
    4;

  const metricHeight =
    82;

  const interactionChange =
    formatChange(
      report.engagement
        .interactions
        .changePercentage
    );

  drawMetricCard(
    doc,
    PAGE.margin,
    y,
    metricWidth,
    metricHeight,
    {
      label:
        "Interactions",

      value:
        String(
          report.engagement
            .interactions
            .current
        ),

      footer:
        `${interactionChange.label} vs previous period`,

      footerTone:
        interactionChange.tone,
    }
  );

  drawMetricCard(
    doc,
    PAGE.margin +
      metricWidth +
      metricGap,
    y,
    metricWidth,
    metricHeight,
    {
      label:
        "Unique Visitors",

      value:
        String(
          report.engagement
            .visitors
            .unique
        ),

      footer:
        "Anonymous customers",

      footerTone:
        "neutral",
    }
  );

  drawMetricCard(
    doc,
    PAGE.margin +
      (
        metricWidth +
        metricGap
      ) *
        2,
    y,
    metricWidth,
    metricHeight,
    {
      label:
        "Daily Average",

      value:
        String(
          report.patterns
            .summary
            .averagePerDay
        ),

      footer:
        "Interactions per day",

      footerTone:
        "neutral",
    }
  );

  drawMetricCard(
    doc,
    PAGE.margin +
      (
        metricWidth +
        metricGap
      ) *
        3,
    y,
    metricWidth,
    metricHeight,
    {
      label:
        "Returning",

      value:
        String(
          report.engagement
            .visitors
            .returning
        ),

      footer:
        `${report.engagement.visitors.returningPercentage}% of visitors`,

      footerTone:
        "positive",
    }
  );

  y +=
    metricHeight +
    22;

  /*
   * =====================================================
   * Engagement breakdown
   * =====================================================
   */

  drawSectionHeading(
    doc,
    y,
    "Engagement Breakdown",
    "How customers interacted with this location."
  );

  y =
    doc.y +
    12;

  const halfGap =
    12;

  const halfWidth =
    (
      PAGE.contentWidth -
      halfGap
    ) /
    2;

  const breakdownHeight =
    128;

  /*
   * Interaction source
   */

  drawPanel(
    doc,
    PAGE.margin,
    y,
    halfWidth,
    breakdownHeight
  );

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      10.5
    )
    .fillColor(
      COLORS.dark
    )
    .text(
      "Interaction Source",
      PAGE.margin +
        15,
      y +
        14
    );

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      7.8
    )
    .fillColor(
      COLORS.muted
    )
    .text(
      "NFC taps compared with QR scans.",
      PAGE.margin +
        15,
      y +
        31
    );

  drawProgressRow(
    doc,
    PAGE.margin +
      15,
    y +
      58,
    halfWidth -
      30,
    "NFC taps",
    report.engagement
      .sources
      .nfc,
    report.engagement
      .sources
      .nfcPercentage
  );

  drawProgressRow(
    doc,
    PAGE.margin +
      15,
    y +
      94,
    halfWidth -
      30,
    "QR scans",
    report.engagement
      .sources
      .qr,
    report.engagement
      .sources
      .qrPercentage
  );

  /*
   * Visitor mix
   */

  const visitorX =
    PAGE.margin +
    halfWidth +
    halfGap;

  drawPanel(
    doc,
    visitorX,
    y,
    halfWidth,
    breakdownHeight
  );

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      10.5
    )
    .fillColor(
      COLORS.dark
    )
    .text(
      "Visitor Mix",
      visitorX +
        15,
      y +
        14
    );

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      7.8
    )
    .fillColor(
      COLORS.muted
    )
    .text(
      "New and returning customer engagement.",
      visitorX +
        15,
      y +
        31
    );

  drawProgressRow(
    doc,
    visitorX +
      15,
    y +
      58,
    halfWidth -
      30,
    "New visitors",
    report.engagement
      .visitors
      .new,
    report.engagement
      .visitors
      .newPercentage
  );

  drawProgressRow(
    doc,
    visitorX +
      15,
    y +
      94,
    halfWidth -
      30,
    "Returning visitors",
    report.engagement
      .visitors
      .returning,
    report.engagement
      .visitors
      .returningPercentage
  );

  y +=
    breakdownHeight +
    22;

  /*
   * =====================================================
   * Peak activity
   * =====================================================
   *
   * No Activity Trend chart anymore.
   *
   * We continue directly into useful
   * business insights.
   * =====================================================
   */

  y =
    ensurePageSpace(
      doc,
      y,
      145,
      report
    );

  drawSectionHeading(
    doc,
    y,
    "Peak Activity",
    "Understand when customers are most likely to engage."
  );

  y =
    doc.y +
    12;

  const insightGap =
    12;

  const insightWidth =
    (
      PAGE.contentWidth -
      insightGap
    ) /
    2;

  const insightHeight =
    82;

  drawInsightCard(
    doc,
    PAGE.margin,
    y,
    insightWidth,
    insightHeight,
    {
      eyebrow:
        "BUSIEST DAY",

      value:
        report.patterns
          .summary
          .peakDay
          ?.weekday ??
        "No activity",

      description:
        report.patterns
          .summary
          .peakDay
          ? `${report.patterns.summary.peakDay.interactions} interactions recorded`
          : "Not enough activity yet",
    }
  );

  drawInsightCard(
    doc,
    PAGE.margin +
      insightWidth +
      insightGap,
    y,
    insightWidth,
    insightHeight,
    {
      eyebrow:
        "BUSIEST TIME",

      value:
        report.patterns
          .summary
          .peakTime
          ?.label ??
        "No activity",

      description:
        report.patterns
          .summary
          .peakTime
          ? `${report.patterns.summary.peakTime.interactions} interactions during this window`
          : "Not enough activity yet",
    }
  );

  y +=
    insightHeight +
    24;

  /*
   * =====================================================
   * Card Performance
   * =====================================================
   */

  const topCards =
    report.cards.cards.slice(
      0,
      8
    );

  /*
   * We need enough room for:
   *
   * title
   * table header
   * at least two card rows
   */
  y =
    ensurePageSpace(
      doc,
      y,
      topCards.length >
      0
        ? 150
        : 120,
      report
    );

  drawSectionHeading(
    doc,
    y,
    "Card Performance",
    "Your strongest physical ValYou cards for this location."
  );

  y =
    doc.y +
    12;

  if (
    topCards.length ===
    0
  ) {
    drawEmptyState(
      doc,
      PAGE.margin,
      y,
      PAGE.contentWidth,
      65,
      "No cards are currently assigned to this location."
    );

    y +=
      82;
  } else {
    y =
      drawCardTable(
        doc,
        y,
        topCards,
        report
      );
  }

  y +=
    22;

  /*
   * =====================================================
   * Needs Attention
   * =====================================================
   */

  const warnings =
    report.warnings
      .filter(
        (
          warning
        ) =>
          warning.severity ===
          "WARNING"
      )
      .slice(
        0,
        5
      );

  y =
    ensurePageSpace(
      doc,
      y,
      warnings.length >
      0
        ? 120
        : 115,
      report
    );

  drawSectionHeading(
    doc,
    y,
    "Needs Attention",
    warnings.length >
      0
      ? "Operational issues worth reviewing."
      : "No major issues were detected for this location."
  );

  y =
    doc.y +
    12;

  if (
    warnings.length ===
    0
  ) {
    drawHealthyState(
      doc,
      PAGE.margin,
      y,
      PAGE.contentWidth,
      72
    );

    y +=
      72;
  } else {
    for (
      const warning
      of warnings
    ) {
      /*
       * Calculate the actual height
       * before deciding whether to
       * move to another page.
       */

      const warningHeight =
        getWarningCardHeight(
          doc,
          PAGE.contentWidth,
          warning.description
        );

      y =
        ensurePageSpace(
          doc,
          y,
          warningHeight +
            8,
          report
        );

      y =
        drawWarningCard(
          doc,
          PAGE.margin,
          y,
          PAGE.contentWidth,
          warning.title,
          warning.description
        );

      y +=
        8;
    }
  }

  /*
   * =====================================================
   * Page footers
   * =====================================================
   */

  addPageFooters(
    doc,
    report
  );

  doc.end();

  return result;
}

/*
 * =======================================================
 * Main first-page header
 * =======================================================
 */

function drawReportHeader(
  doc:
    PdfDoc,
  report:
    Report
) {
  const periodLabel =
    getReportPeriodLabel(
      report
    );

  const periodTitle =
    getReportPeriodTitle(
      report
    );

  /*
   * =====================================================
   * Main emerald background
   * =====================================================
   */

  doc
    .rect(
      0,
      0,
      PAGE.width,
      150
    )
    .fill(
      COLORS.emeraldDark
    );

  /*
   * =====================================================
   * Decorative background
   * =====================================================
   */

  doc
    .save()
    .opacity(
      0.08
    )
    .circle(
      PAGE.width -
        30,
      15,
      100
    )
    .fill(
      COLORS.white
    )
    .restore();

  doc
    .save()
    .opacity(
      0.05
    )
    .circle(
      PAGE.width -
        100,
      130,
      80
    )
    .fill(
      COLORS.white
    )
    .restore();

  /*
   * =====================================================
   * ValYou icon
   * =====================================================
   */

  doc
    .roundedRect(
      PAGE.margin,
      27,
      38,
      38,
      9
    )
    .fill(
      COLORS.white
    );

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      17
    )
    .fillColor(
      COLORS.emeraldDark
    )
    .text(
      "V",
      PAGE.margin,
      37,
      {
        width:
          38,

        align:
          "center",
      }
    );

  /*
   * =====================================================
   * Brand
   * =====================================================
   */

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      14
    )
    .fillColor(
      COLORS.white
    )
    .text(
      "ValYou",
      PAGE.margin +
        50,
      29
    );

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      7
    )
    .fillColor(
      "#D1FAE5"
    )
    .text(
      "CUSTOMER ENGAGEMENT INTELLIGENCE",
      PAGE.margin +
        50,
      49
    );

  /*
   * =====================================================
   * Report title
   * =====================================================
   */

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      23
    )
    .fillColor(
      COLORS.white
    )
    .text(
      "Analytics Report",
      PAGE.margin,
      81
    );

  /*
   * =====================================================
   * Business / Location
   * =====================================================
   */

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      9
    )
    .fillColor(
      "#D1FAE5"
    )
    .text(
      `${displayName(
        report.store
          .business
          .name,
        "Business"
      )} / ${displayName(
        report.store.name,
        "Location"
      )}`,
      PAGE.margin,
      111,
      {
        width:
          300,
      }
    );

  /*
   * =====================================================
   * Selected period
   * =====================================================
   */

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      7.5
    )
    .fillColor(
      COLORS.white
    )
    .text(
      periodTitle,
      PAGE.width -
        PAGE.margin -
        210,
      80,
      {
        width:
          210,

        align:
          "right",
      }
    );

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      9
    )
    .fillColor(
      "#D1FAE5"
    )
    .text(
      periodLabel,
      PAGE.width -
        PAGE.margin -
        220,
      99,
      {
        width:
          220,

        align:
          "right",
      }
    );

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      6.8
    )
    .fillColor(
      "#A7F3D0"
    )
    .text(
      report.period
        .timeZone,
      PAGE.width -
        PAGE.margin -
        220,
      119,
      {
        width:
          220,

        align:
          "right",
      }
    );
}

/*
 * =======================================================
 * Header for subsequent pages
 * =======================================================
 */

function drawSmallPageHeader(
  doc:
    PdfDoc,
  report:
    Report
) {
  const periodLabel =
    getReportPeriodLabel(
      report
    );

  /*
   * Brand
   */

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      12.5
    )
    .fillColor(
      COLORS.emeraldDark
    )
    .text(
      "ValYou",
      PAGE.margin,
      38
    );

  /*
   * Location
   */

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      7.8
    )
    .fillColor(
      COLORS.muted
    )
    .text(
      displayName(
        report.store.name,
        "Location"
      ),
      PAGE.margin,
      56,
      {
        width:
          200,
      }
    );

  /*
   * Period on right
   */

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      7.8
    )
    .fillColor(
      COLORS.muted
    )
    .text(
      periodLabel,
      PAGE.width -
        PAGE.margin -
        240,
      56,
      {
        width:
          240,

        align:
          "right",
      }
    );

  /*
   * Divider
   */

  doc
    .strokeColor(
      COLORS.border
    )
    .lineWidth(
      1
    )
    .moveTo(
      PAGE.margin,
      75
    )
    .lineTo(
      PAGE.width -
        PAGE.margin,
      75
    )
    .stroke();
}

/*
 * =======================================================
 * Automatic page spacing
 * =======================================================
 */

function ensurePageSpace(
  doc:
    PdfDoc,
  y:
    number,
  requiredHeight:
    number,
  report:
    Report
) {
  if (
    y +
      requiredHeight <=
    PAGE.contentBottom
  ) {
    return y;
  }

  doc.addPage();

  drawSmallPageHeader(
    doc,
    report
  );

  return 94;
}

/*
 * =======================================================
 * Section heading
 * =======================================================
 */

function drawSectionHeading(
  doc:
    PdfDoc,
  y:
    number,
  title:
    string,
  description:
    string
) {
  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      13
    )
    .fillColor(
      COLORS.dark
    )
    .text(
      title,
      PAGE.margin,
      y
    );

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      8
    )
    .fillColor(
      COLORS.muted
    )
    .text(
      description,
      PAGE.margin,
      y +
        18,
      {
        width:
          PAGE.contentWidth,
      }
    );

  doc.y =
    y +
    34;
}

/*
 * =======================================================
 * Metric card
 * =======================================================
 */

function drawMetricCard(
  doc:
    PdfDoc,
  x:
    number,
  y:
    number,
  width:
    number,
  height:
    number,
  options: {
    label:
      string;

    value:
      string;

    footer:
      string;

    footerTone:
      | "positive"
      | "warning"
      | "neutral";
  }
) {
  drawPanel(
    doc,
    x,
    y,
    width,
    height
  );

  /*
   * Small emerald accent
   */

  doc
    .roundedRect(
      x +
        12,
      y +
        12,
      22,
      4,
      2
    )
    .fill(
      COLORS.emerald
    );

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      7.6
    )
    .fillColor(
      COLORS.muted
    )
    .text(
      options.label,
      x +
        12,
      y +
        24,
      {
        width:
          width -
          24,
      }
    );

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      18
    )
    .fillColor(
      COLORS.dark
    )
    .text(
      options.value,
      x +
        12,
      y +
        40,
      {
        width:
          width -
          24,
      }
    );

  let footerColor =
    COLORS.muted;

  if (
    options.footerTone ===
    "positive"
  ) {
    footerColor =
      COLORS.emerald;
  }

  if (
    options.footerTone ===
    "warning"
  ) {
    footerColor =
      COLORS.amber;
  }

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      6.8
    )
    .fillColor(
      footerColor
    )
    .text(
      options.footer,
      x +
        12,
      y +
        65,
      {
        width:
          width -
          24,

        ellipsis:
          true,

        lineBreak:
          false,
      }
    );
}

/*
 * =======================================================
 * Standard panel
 * =======================================================
 */

function drawPanel(
  doc:
    PdfDoc,
  x:
    number,
  y:
    number,
  width:
    number,
  height:
    number
) {
  doc
    .save()
    .roundedRect(
      x,
      y,
      width,
      height,
      9
    )
    .fillAndStroke(
      COLORS.white,
      COLORS.border
    )
    .restore();
}

/*
 * =======================================================
 * Progress rows
 * =======================================================
 */

function drawProgressRow(
  doc:
    PdfDoc,
  x:
    number,
  y:
    number,
  width:
    number,
  label:
    string,
  count:
    number,
  percentage:
    number
) {
  const safePercentage =
    Math.max(
      0,
      Math.min(
        100,
        percentage
      )
    );

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      7.8
    )
    .fillColor(
      COLORS.text
    )
    .text(
      label,
      x,
      y,
      {
        width:
          width *
          0.55,
      }
    );

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      7.5
    )
    .fillColor(
      COLORS.muted
    )
    .text(
      `${count} - ${percentage}%`,
      x,
      y,
      {
        width,

        align:
          "right",
      }
    );

  const barY =
    y +
    17;

  doc
    .roundedRect(
      x,
      barY,
      width,
      6,
      3
    )
    .fill(
      "#E5E7EB"
    );

  const progressWidth =
    width *
    (
      safePercentage /
      100
    );

  if (
    progressWidth >
    0
  ) {
    doc
      .roundedRect(
        x,
        barY,
        progressWidth,
        6,
        3
      )
      .fill(
        COLORS.emerald
      );
  }
}

/*
 * =======================================================
 * Peak insight card
 * =======================================================
 */

function drawInsightCard(
  doc:
    PdfDoc,
  x:
    number,
  y:
    number,
  width:
    number,
  height:
    number,
  options: {
    eyebrow:
      string;

    value:
      string;

    description:
      string;
  }
) {
  doc
    .save()
    .roundedRect(
      x,
      y,
      width,
      height,
      10
    )
    .fillAndStroke(
      COLORS.emeraldSoft,
      COLORS.emeraldBorder
    )
    .restore();

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      7
    )
    .fillColor(
      COLORS.emeraldDark
    )
    .text(
      options.eyebrow,
      x +
        15,
      y +
        13,
      {
        width:
          width -
          30,
      }
    );

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      16
    )
    .fillColor(
      COLORS.dark
    )
    .text(
      options.value,
      x +
        15,
      y +
        31,
      {
        width:
          width -
          30,

        ellipsis:
          true,
      }
    );

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      7.7
    )
    .fillColor(
      COLORS.muted
    )
    .text(
      options.description,
      x +
        15,
      y +
        59,
      {
        width:
          width -
          30,
      }
    );
}

/*
 * =======================================================
 * Card performance table
 * =======================================================
 */

function drawCardTable(
  doc:
    PdfDoc,
  startY:
    number,
  cards:
    Report["cards"]["cards"],
  report:
    Report
) {
  let y =
    startY;

  const x =
    PAGE.margin;

  const width =
    PAGE.contentWidth;

  const headerHeight =
    29;

  const rowHeight =
    36;

  /*
   * Columns
   */

  const rankX =
    x +
    12;

  const cardX =
    x +
    44;

  const interactionsX =
    x +
    255;

  const visitorsX =
    x +
    345;

  const shareX =
    x +
    430;

  function drawHeader() {
    doc
      .roundedRect(
        x,
        y,
        width,
        headerHeight,
        7
      )
      .fill(
        "#F3F4F6"
      );

    drawTableText(
      doc,
      "#",
      rankX,
      y +
        10,
      24,
      true
    );

    drawTableText(
      doc,
      "Card",
      cardX,
      y +
        10,
      190,
      true
    );

    drawTableText(
      doc,
      "Interactions",
      interactionsX,
      y +
        10,
      75,
      true
    );

    drawTableText(
      doc,
      "Visitors",
      visitorsX,
      y +
        10,
      70,
      true
    );

    drawTableText(
      doc,
      "Share",
      shareX,
      y +
        10,
      65,
      true
    );

    y +=
      headerHeight +
      3;
  }

  drawHeader();

  cards.forEach(
    (
      card,
      index
    ) => {
      /*
       * If next card doesn't fit,
       * continue table on next page.
       */

      if (
        y +
          rowHeight >
        PAGE.contentBottom
      ) {
        doc.addPage();

        drawSmallPageHeader(
          doc,
          report
        );

        y =
          94;

        doc
          .font(
            "Helvetica-Bold"
          )
          .fontSize(
            10.5
          )
          .fillColor(
            COLORS.dark
          )
          .text(
            "Card Performance - continued",
            PAGE.margin,
            y
          );

        y +=
          20;

        drawHeader();
      }

      /*
       * Top performer
       */

      if (
        index ===
        0
      ) {
        doc
          .rect(
            x,
            y,
            width,
            rowHeight
          )
          .fill(
            COLORS.emeraldSoft
          );
      } else if (
        index %
          2 ===
        0
      ) {
        doc
          .rect(
            x,
            y,
            width,
            rowHeight
          )
          .fill(
            "#FAFAFA"
          );
      }

      const cardName =
        displayName(
          card.label,
          `Card ${card.code.slice(
            0,
            6
          )}`
        );

      drawTableText(
        doc,
        String(
          index +
            1
        ),
        rankX,
        y +
          11,
        24,
        index ===
          0
      );

      drawTableText(
        doc,
        cardName,
        cardX,
        y +
          7,
        190,
        true,
        index ===
          0
          ? COLORS.emeraldDark
          : COLORS.text
      );

      doc
        .font(
          "Helvetica"
        )
        .fontSize(
          6.3
        )
        .fillColor(
          COLORS.lightMuted
        )
        .text(
          `Ref: ${card.code.slice(
            0,
            8
          )}`,
          cardX,
          y +
            21,
          {
            width:
              190,

            lineBreak:
              false,
          }
        );

      drawTableText(
        doc,
        String(
          card.meaningfulInteractions
        ),
        interactionsX,
        y +
          11,
        75,
        false
      );

      drawTableText(
        doc,
        String(
          card.uniqueVisitors
        ),
        visitorsX,
        y +
          11,
        70,
        false
      );

      drawTableText(
        doc,
        `${card.sharePercentage}%`,
        shareX,
        y +
          11,
        65,
        false
      );

      /*
       * Bottom divider
       */

      doc
        .strokeColor(
          COLORS.border
        )
        .lineWidth(
          0.5
        )
        .moveTo(
          x,
          y +
            rowHeight
        )
        .lineTo(
          x +
            width,
          y +
            rowHeight
        )
        .stroke();

      y +=
        rowHeight;
    }
  );

  return y;
}

function drawTableText(
  doc:
    PdfDoc,
  value:
    string,
  x:
    number,
  y:
    number,
  width:
    number,
  bold:
    boolean,
  color:
    string =
      COLORS.text
) {
  doc
    .font(
      bold
        ? "Helvetica-Bold"
        : "Helvetica"
    )
    .fontSize(
      7.8
    )
    .fillColor(
      color
    )
    .text(
      value,
      x,
      y,
      {
        width,

        ellipsis:
          true,

        lineBreak:
          false,
      }
    );
}

/*
 * =======================================================
 * Warning sizing
 * =======================================================
 */

function getWarningCardHeight(
  doc:
    PdfDoc,
  width:
    number,
  description:
    string
) {
  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      8
    );

  const descriptionHeight =
    doc.heightOfString(
      description,
      {
        width:
          width -
          74,
      }
    );

  return Math.max(
    62,
    descriptionHeight +
      42
  );
}

/*
 * =======================================================
 * Warning card
 * =======================================================
 */

function drawWarningCard(
  doc:
    PdfDoc,
  x:
    number,
  y:
    number,
  width:
    number,
  title:
    string,
  description:
    string
) {
  const height =
    getWarningCardHeight(
      doc,
      width,
      description
    );

  doc
    .save()
    .roundedRect(
      x,
      y,
      width,
      height,
      9
    )
    .fillAndStroke(
      COLORS.amberSoft,
      COLORS.amberBorder
    )
    .restore();

  /*
   * Warning badge
   */

  doc
    .circle(
      x +
        25,
      y +
        25,
      12
    )
    .fill(
      "#FEF3C7"
    );

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      11
    )
    .fillColor(
      COLORS.amber
    )
    .text(
      "!",
      x +
        21,
      y +
        17
    );

  /*
   * Content
   */

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      9
    )
    .fillColor(
      COLORS.dark
    )
    .text(
      title,
      x +
        48,
      y +
        12,
      {
        width:
          width -
          64,
      }
    );

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      8
    )
    .fillColor(
      COLORS.muted
    )
    .text(
      description,
      x +
        48,
      y +
        30,
      {
        width:
          width -
          64,

        lineGap:
          1.5,
      }
    );

  return (
    y +
    height
  );
}

/*
 * =======================================================
 * Healthy state
 * =======================================================
 */

function drawHealthyState(
  doc:
    PdfDoc,
  x:
    number,
  y:
    number,
  width:
    number,
  height:
    number
) {
  doc
    .save()
    .roundedRect(
      x,
      y,
      width,
      height,
      10
    )
    .fillAndStroke(
      COLORS.emeraldSoft,
      COLORS.emeraldBorder
    )
    .restore();

  /*
   * Keep this ASCII-friendly.
   * Standard PDF Helvetica does
   * not reliably contain every
   * Unicode icon.
   */

  doc
    .circle(
      x +
        27,
      y +
        27,
      13
    )
    .fill(
      "#D1FAE5"
    );

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      7
    )
    .fillColor(
      COLORS.emeraldDark
    )
    .text(
      "OK",
      x +
        18,
      y +
        24,
      {
        width:
          18,

        align:
          "center",
      }
    );

  doc
    .font(
      "Helvetica-Bold"
    )
    .fontSize(
      9.5
    )
    .fillColor(
      COLORS.dark
    )
    .text(
      "Everything looks healthy",
      x +
        52,
      y +
        15
    );

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      8
    )
    .fillColor(
      COLORS.muted
    )
    .text(
      "No major engagement issues were detected for this location during the selected period.",
      x +
        52,
      y +
        34,
      {
        width:
          width -
          70,
      }
    );
}

/*
 * =======================================================
 * Empty state
 * =======================================================
 */

function drawEmptyState(
  doc:
    PdfDoc,
  x:
    number,
  y:
    number,
  width:
    number,
  height:
    number,
  message:
    string
) {
  doc
    .save()
    .roundedRect(
      x,
      y,
      width,
      height,
      9
    )
    .fillAndStroke(
      COLORS.background,
      COLORS.border
    )
    .restore();

  doc
    .font(
      "Helvetica"
    )
    .fontSize(
      8.5
    )
    .fillColor(
      COLORS.muted
    )
    .text(
      message,
      x +
        20,
      y +
        27,
      {
        width:
          width -
          40,

        align:
          "center",
      }
    );
}

/*
 * =======================================================
 * Footer on every page
 * =======================================================
 */

function addPageFooters(
  doc:
    PdfDoc,
  report:
    Report
) {
  /*
   * IMPORTANT:
   *
   * Get the final page count BEFORE
   * drawing any footer.
   */
  const range =
    doc.bufferedPageRange();

  const totalPages =
    range.count;

  const generatedAt =
    formatGeneratedDate(
      report.generatedAt
    );

  for (
    let index =
      range.start;
    index <
      range.start +
        totalPages;
    index++
  ) {
    doc.switchToPage(
      index
    );

    /*
     * Keep footer INSIDE the page's
     * printable area.
     *
     * A4 height ≈ 842
     * bottom margin = 42
     *
     * usable bottom ≈ 800
     *
     * So ~783-788 is safe.
     */
    const dividerY =
      PAGE.height -
      PAGE.margin -
      18;

    const footerY =
      PAGE.height -
      PAGE.margin -
      10;

    /*
     * Divider
     */

    doc
      .save()
      .strokeColor(
        COLORS.border
      )
      .lineWidth(
        0.6
      )
      .moveTo(
        PAGE.margin,
        dividerY
      )
      .lineTo(
        PAGE.width -
          PAGE.margin,
        dividerY
      )
      .stroke()
      .restore();

    /*
     * Left footer
     */

    doc
      .font(
        "Helvetica"
      )
      .fontSize(
        6.5
      )
      .fillColor(
        COLORS.lightMuted
      )
      .text(
        `Generated by ValYou - ${generatedAt}`,
        PAGE.margin,
        footerY,
        {
          width:
            300,

          height:
            10,

          lineBreak:
            false,
        }
      );

    /*
     * Right footer
     */

    doc
      .font(
        "Helvetica"
      )
      .fontSize(
        6.5
      )
      .fillColor(
        COLORS.lightMuted
      )
      .text(
        `Page ${
          index -
          range.start +
          1
        } of ${totalPages}`,
        PAGE.width -
          PAGE.margin -
          100,
        footerY,
        {
          width:
            100,

          height:
            10,

          align:
            "right",

          lineBreak:
            false,
        }
      );
  }
}