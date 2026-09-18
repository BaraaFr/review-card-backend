const test =
  require(
    "node:test"
  );

const assert =
  require(
    "node:assert/strict"
  );

const {
  loadModule,
} =
  require(
    "./load-module.cjs"
  );

const {
  resolveWeeklyReportRange,
} =
  loadModule(
    "src/utils/weekly-report-range.ts"
  );

test(
  "weekly reports use seven completed Beirut calendar days",
  () => {
    const range =
      resolveWeeklyReportRange(
        new Date(
          "2026-09-13T12:00:00Z"
        ),

        "Asia/Beirut"
      );

    assert.equal(
      range.from,
      "2026-09-06"
    );

    assert.equal(
      range.to,
      "2026-09-12"
    );

    assert.equal(
      range.days,
      7
    );

    assert.equal(
      range.fromUtc
        .toISOString(),
      "2026-09-05T21:00:00.000Z"
    );

    assert.equal(
      range.toExclusiveUtc
        .toISOString(),
      "2026-09-12T21:00:00.000Z"
    );

    assert.equal(
      range.previousFrom,
      "2026-08-30"
    );

    assert.equal(
      range.previousTo,
      "2026-09-05"
    );
  }
);

test(
  "weekly calendar periods remain correct across DST",
  () => {
    const range =
      resolveWeeklyReportRange(
        new Date(
          "2026-11-02T15:00:00Z"
        ),

        "America/New_York"
      );

    assert.equal(
      range.from,
      "2026-10-26"
    );

    assert.equal(
      range.to,
      "2026-11-01"
    );

    assert.equal(
      range.fromUtc
        .toISOString(),
      "2026-10-26T04:00:00.000Z"
    );

    assert.equal(
      range.toExclusiveUtc
        .toISOString(),
      "2026-11-02T05:00:00.000Z"
    );

    /*
     * DST ends during this period,
     * therefore the UTC duration is
     * 169 hours rather than 168.
     *
     * That's exactly why WEEK_MS
     * must not be used.
     */
    assert.equal(
      (
        range
          .toExclusiveUtc
          .getTime() -
        range
          .fromUtc
          .getTime()
      ) /
        (
          60 *
          60 *
          1000
        ),

      169
    );
  }
);