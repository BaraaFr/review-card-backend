const test =
  require(
    "node:test"
  );

const assert =
  require(
    "node:assert/strict"
  );

const express =
  require(
    "express"
  );

const {
  loadModule,
} =
  require(
    "./load-module.cjs"
  );

test(
  "every analytics HTTP endpoint passes through ANALYTICS feature authorization",

  async (
    t
  ) => {
    const protectedRequests =
      [];

    const handler =
      (
        _req,
        res
      ) =>
        res.json({
          success:
            true,
        });

    const controllerMocks = {
      getActionCenterController:
        handler,

      getCardAnalytics:
        handler,

      getOverview:
        handler,

      getStoreAnalytics:
        handler,

      getTimeline:
        handler,

      getStoreCardPerformanceController:
        handler,

      getStoreEngagementSummaryController:
        handler,

      getStoreEngagementPatternsController:
        handler,

      downloadAnalyticsReportController:
        handler,

      getLocationPerformanceController:
        handler,

      getWeeklyReportController:
        handler,

      getDataReportController:
        handler,
    };

    const router =
      loadModule(
        "src/modules/analytics/analytics.routes.ts",

        {
          "./analytics.controller.js":
            controllerMocks,

          "../../middleware/auth.middleware.js":
            {
              authenticate:
                (
                  req,
                  _res,
                  next
                ) => {
                  req.user = {
                    id:
                      "owner",

                    role:
                      "BUSINESS_OWNER",
                  };

                  next();
                },
            },

          "../../middleware/feature-access.middleware.js":
            {
              requireFeatureAccess:
                (
                  feature
                ) =>
                  (
                    req,
                    _res,
                    next
                  ) => {
                    protectedRequests.push({
                      feature,

                      path:
                        req.path,
                    });

                    next();
                  },
            },
        }
      ).default;

    const app =
      express();

    app.use(
      router
    );

    const server =
      app.listen(
        0,
        "127.0.0.1"
      );

    await new Promise(
      (
        resolve,
        reject
      ) => {
        server.once(
          "listening",
          resolve
        );

        server.once(
          "error",
          reject
        );
      }
    );

    t.after(
      () =>
        new Promise(
          (
            resolve,
            reject
          ) => {
            server.close(
              (
                error
              ) => {
                if (
                  error
                ) {
                  reject(
                    error
                  );

                  return;
                }

                resolve();
              }
            );
          }
        )
    );

    const address =
      server.address();

    assert.ok(
      address &&
      typeof address !==
        "string"
    );

    const base =
      `http://127.0.0.1:${address.port}`;

    const paths = [
      "/overview",
      "/cards",
      "/stores",
      "/timeline",

      "/stores/store-1/engagement-summary",
      "/stores/store-1/card-performance",
      "/stores/store-1/location-performance",
      "/stores/store-1/action-center",
      "/stores/store-1/engagement-patterns",
      "/stores/store-1/data-report",
      "/stores/store-1/weekly-report",
      "/stores/store-1/report.pdf",
    ];

    for (
      const path
      of paths
    ) {
      const before =
        protectedRequests.length;

      const response =
        await fetch(
          `${base}${path}`
        );

      assert.equal(
        response.status,
        200,
        path
      );

      assert.equal(
        protectedRequests.length,
        before +
          1,
        `Missing requireFeatureAccess on ${path}`
      );

      assert.equal(
        protectedRequests.at(
          -1
        ).feature,
        "ANALYTICS",
        path
      );
    }
  }
);