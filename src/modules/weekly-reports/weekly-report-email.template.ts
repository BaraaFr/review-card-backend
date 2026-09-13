import type {
    getBusinessWeeklyReport,
  } from "./business-weekly-report.service.js";
  
  type Report =
    Awaited<
      ReturnType<
        typeof getBusinessWeeklyReport
      >
    >;
  
  function escapeHtml(
    value:
      string | number | null | undefined
  ) {
    return String(
      value ??
        ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }
  
  function changeLabel(
    change:
      number | null
  ) {
    if (
      change ===
      null
    ) {
      return "New activity";
    }
  
    if (
      change >
      0
    ) {
      return `↑ ${change}%`;
    }
  
    if (
      change <
      0
    ) {
      return `↓ ${Math.abs(
        change
      )}%`;
    }
  
    return "No change";
  }
  
  export function buildWeeklyReportEmail(
    report: Report
  ) {
    const appUrl =
      process.env.APP_URL ??
      "http://localhost:3000";
  
    const businessName =
      report.business.name ??
      "Your business";
  
    const warningsHtml =
      report.warnings.length >
      0
        ? report.warnings
            .map(
              (
                warning
              ) => `
                <div style="
                  padding:14px 0;
                  border-bottom:1px solid #e5e7eb;
                ">
                  <div style="
                    font-size:14px;
                    font-weight:600;
                    color:#111827;
                  ">
                    ${escapeHtml(
                      warning.title
                    )}
                  </div>
  
                  <div style="
                    margin-top:4px;
                    color:#6b7280;
                    font-size:13px;
                    line-height:20px;
                  ">
                    ${escapeHtml(
                      warning.description
                    )}
                  </div>
                </div>
              `
            )
            .join(
              ""
            )
        : `
          <div style="
            background:#ecfdf5;
            border:1px solid #a7f3d0;
            border-radius:12px;
            padding:16px;
            color:#065f46;
            font-size:14px;
          ">
            Everything looks healthy this week.
          </div>
        `;
  
    const html =
      `
  <!doctype html>
  <html>
  <body style="
    margin:0;
    padding:0;
    background:#f5f7f6;
    font-family:Arial,Helvetica,sans-serif;
    color:#111827;
  ">
  
  <table
    width="100%"
    cellspacing="0"
    cellpadding="0"
    style="
      background:#f5f7f6;
      padding:32px 16px;
    "
  >
  <tr>
  <td align="center">
  
  <table
    width="100%"
    cellspacing="0"
    cellpadding="0"
    style="
      max-width:640px;
      background:#ffffff;
      border-radius:18px;
      overflow:hidden;
      border:1px solid #e5e7eb;
    "
  >
  <tr>
  <td style="
    padding:28px;
    background:linear-gradient(
      135deg,
      #ecfdf5,
      #ffffff
    );
    border-bottom:1px solid #e5e7eb;
  ">
    <div style="
      color:#059669;
      font-size:12px;
      font-weight:700;
      letter-spacing:1px;
      text-transform:uppercase;
    ">
      Your week with ValYou
    </div>
  
    <h1 style="
      margin:8px 0 4px;
      font-size:24px;
    ">
      ${escapeHtml(
        businessName
      )}
    </h1>
  
    <div style="
      color:#6b7280;
      font-size:14px;
    ">
      ${escapeHtml(
        report.period.from
      )}
      –
      ${escapeHtml(
        report.period.to
      )}
    </div>
  </td>
  </tr>
  
  <tr>
  <td style="padding:28px;">
  
  <table
    width="100%"
    cellspacing="0"
    cellpadding="0"
  >
  <tr>
  <td width="50%" style="padding:8px;">
    <div style="
      border:1px solid #e5e7eb;
      border-radius:12px;
      padding:16px;
    ">
      <div style="
        color:#6b7280;
        font-size:12px;
      ">
        Customer interactions
      </div>
  
      <div style="
        font-size:28px;
        font-weight:700;
        margin-top:5px;
      ">
        ${report.overview.interactions}
      </div>
  
      <div style="
        margin-top:5px;
        color:#059669;
        font-size:12px;
        font-weight:600;
      ">
        ${escapeHtml(
          changeLabel(
            report.overview
              .changePercentage
          )
        )}
        vs previous week
      </div>
    </div>
  </td>
  
  <td width="50%" style="padding:8px;">
    <div style="
      border:1px solid #e5e7eb;
      border-radius:12px;
      padding:16px;
    ">
      <div style="
        color:#6b7280;
        font-size:12px;
      ">
        Unique visitors
      </div>
  
      <div style="
        font-size:28px;
        font-weight:700;
        margin-top:5px;
      ">
        ${report.overview.uniqueVisitors}
      </div>
  
      <div style="
        margin-top:5px;
        color:#6b7280;
        font-size:12px;
      ">
        Anonymous customers
      </div>
    </div>
  </td>
  </tr>
  </table>
  
  <div style="
    margin-top:24px;
    font-size:16px;
    font-weight:700;
  ">
    Engagement patterns
  </div>
  
  <table
    width="100%"
    cellspacing="0"
    cellpadding="0"
    style="margin-top:10px;"
  >
  <tr>
  <td width="50%" style="padding:8px;">
    <div style="
      background:#f9fafb;
      border-radius:12px;
      padding:14px;
    ">
      <div style="
        color:#6b7280;
        font-size:12px;
      ">
        Busiest day
      </div>
  
      <div style="
        font-size:16px;
        font-weight:600;
        margin-top:4px;
      ">
        ${
          report.patterns
            .peakDay
            ? escapeHtml(
                report.patterns
                  .peakDay
                  .weekday
              )
            : "No activity"
        }
      </div>
    </div>
  </td>
  
  <td width="50%" style="padding:8px;">
    <div style="
      background:#f9fafb;
      border-radius:12px;
      padding:14px;
    ">
      <div style="
        color:#6b7280;
        font-size:12px;
      ">
        Busiest time
      </div>
  
      <div style="
        font-size:16px;
        font-weight:600;
        margin-top:4px;
      ">
        ${
          report.patterns
            .peakTime
            ? escapeHtml(
                report.patterns
                  .peakTime
                  .label
              )
            : "No activity"
        }
      </div>
    </div>
  </td>
  </tr>
  </table>
  
  ${
    report.performance
      .bestLocation ||
    report.performance
      .bestCard
      ? `
        <div style="
          margin-top:24px;
          font-size:16px;
          font-weight:700;
        ">
          Top performers
        </div>
  
        ${
          report.performance
            .bestLocation
            ? `
              <div style="
                margin-top:10px;
                padding:14px;
                border:1px solid #a7f3d0;
                border-radius:12px;
                background:#ecfdf5;
              ">
                <div style="
                  color:#047857;
                  font-size:12px;
                ">
                  Best location
                </div>
  
                <div style="
                  font-size:15px;
                  font-weight:600;
                  margin-top:4px;
                ">
                  ${escapeHtml(
                    report.performance
                      .bestLocation
                      .name ??
                      "Unnamed location"
                  )}
                </div>
  
                <div style="
                  color:#6b7280;
                  font-size:12px;
                  margin-top:4px;
                ">
                  ${
                    report.performance
                      .bestLocation
                      .interactions
                  }
                  interactions
                </div>
              </div>
            `
            : ""
        }
  
        ${
          report.performance
            .bestCard
            ? `
              <div style="
                margin-top:10px;
                padding:14px;
                border:1px solid #a7f3d0;
                border-radius:12px;
                background:#ecfdf5;
              ">
                <div style="
                  color:#047857;
                  font-size:12px;
                ">
                  Best card
                </div>
  
                <div style="
                  font-size:15px;
                  font-weight:600;
                  margin-top:4px;
                ">
                  ${escapeHtml(
                    report.performance
                      .bestCard
                      .label ??
                      `Card ${report.performance.bestCard.code.slice(
                        0,
                        6
                      )}`
                  )}
                </div>
  
                <div style="
                  color:#6b7280;
                  font-size:12px;
                  margin-top:4px;
                ">
                  ${
                    report.performance
                      .bestCard
                      .interactions
                  }
                  interactions
                </div>
              </div>
            `
            : ""
        }
      `
      : ""
  }
  
  <div style="
    margin-top:24px;
    font-size:16px;
    font-weight:700;
  ">
    Needs your attention
  </div>
  
  <div style="margin-top:8px;">
    ${warningsHtml}
  </div>
  
  <div style="
    margin-top:28px;
    text-align:center;
  ">
    <a
      href="${appUrl}/analytics"
      style="
        display:inline-block;
        padding:12px 20px;
        background:#059669;
        color:#ffffff;
        text-decoration:none;
        border-radius:10px;
        font-size:14px;
        font-weight:600;
      "
    >
      View Analytics
    </a>
  </div>
  
  <div style="
    margin-top:28px;
    border-top:1px solid #e5e7eb;
    padding-top:18px;
    color:#9ca3af;
    font-size:11px;
    text-align:center;
  ">
    This report was generated automatically by ValYou.
  </div>
  
  </td>
  </tr>
  </table>
  
  </td>
  </tr>
  </table>
  
  </body>
  </html>
  `;
  
    const text =
      `
  Your week with ValYou
  
  ${businessName}
  ${report.period.from} - ${report.period.to}
  
  Interactions:
  ${report.overview.interactions}
  
  Change:
  ${changeLabel(
    report.overview
      .changePercentage
  )}
  
  Unique visitors:
  ${report.overview.uniqueVisitors}
  
  Busiest day:
  ${
    report.patterns
      .peakDay
      ?.weekday ??
    "No activity"
  }
  
  Busiest time:
  ${
    report.patterns
      .peakTime
      ?.label ??
    "No activity"
  }
  
  View Analytics:
  ${appUrl}/analytics
  `;
  
    return {
      subject:
        `Your week with ValYou — ${businessName}`,
  
      html,
  
      text,
    };
  }