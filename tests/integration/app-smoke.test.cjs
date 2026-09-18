const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const {
  loadModule,
} = require("../load-module.cjs");

test(
  "Express serves health/readiness and safely handles request errors",
  async (t) => {
    t.mock.method(
      console,
      "error",
      () => {}
    );

    const routes =
      express.Router();

    /*
     * Used to verify that unexpected
     * diagnostics never leak to users.
     */
    routes.get(
      "/failure",
      (_req, _res, next) =>
        next(
          new Error(
            "private diagnostic"
          )
        )
    );

    /*
     * Used for malformed JSON /
     * trusted-origin tests.
     */
    routes.post(
      "/failure",
      (_req, res) =>
        res.json({
          success:
            true,
        })
    );

    let ready =
      true;

    const app =
      loadModule(
        "src/app.ts",
        {
          "./config/env.js": {
            env: {
              FRONTEND_URL:
                "http://localhost:3000",

              PUBLIC_API_URL:
                "http://localhost:4000",
            },
          },

          /*
           * trusted-origin.ts imports
           * config/env itself.
           */
          "../config/env.js": {
            env: {
              FRONTEND_URL:
                "http://localhost:3000",

              PUBLIC_API_URL:
                "http://localhost:4000",
            },
          },

          "./routes/index.js":
            routes,

          "./lib/readiness.js": {
            isReady:
              async () =>
                ready,
          },

          "./modules/redirect/redirect.routes.js":
            express.Router(),

          "./modules/queues/queue-dashboard.js":
            {
              queueDashboardAdapter:
                {
                  getRouter:
                    () =>
                      express.Router(),
                },
            },

          "./middleware/auth.middleware.js":
            {
              authenticate:
                (
                  _req,
                  _res,
                  next
                ) =>
                  next(),
            },

          "./middleware/role.middleware.js":
            {
              authorize:
                () =>
                  (
                    _req,
                    _res,
                    next
                  ) =>
                    next(),
            },
        }
      ).default;

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
          ) =>
            server.close(
              (
                error
              ) =>
                error
                  ? reject(
                      error
                    )
                  : resolve()
            )
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

    /*
     * =====================================================
     * Liveness
     * =====================================================
     */

    const health =
      await fetch(
        `${base}/api/health`
      );

    assert.equal(
      health.status,
      200
    );

    assert.equal(
      (
        await health.json()
      ).success,
      true
    );

    assert.equal(
      health.headers.get(
        "cache-control"
      ),
      "no-store"
    );

    /*
     * =====================================================
     * Readiness - healthy
     * =====================================================
     */

    const healthyReady =
      await fetch(
        `${base}/api/ready`
      );

    assert.equal(
      healthyReady.status,
      200
    );

    assert.deepEqual(
      await healthyReady.json(),
      {
        success:
          true,
      }
    );

    /*
     * =====================================================
     * Readiness - dependency unavailable
     * =====================================================
     */

    ready =
      false;

    const unhealthyReady =
      await fetch(
        `${base}/api/ready`
      );

    assert.equal(
      unhealthyReady.status,
      503
    );

    assert.deepEqual(
      await unhealthyReady.json(),
      {
        success:
          false,
      }
    );

    ready =
      true;

    /*
     * =====================================================
     * Trusted Origin
     * =====================================================
     *
     * No Origin on an unsafe request
     * must be blocked before reaching
     * the route.
     */

    const untrusted =
      await fetch(
        `${base}/api/failure`,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",
          },

          body:
            "{}",
        }
      );

    assert.equal(
      untrusted.status,
      403
    );

    assert.equal(
      (
        await untrusted.json()
      ).code,
      "UNTRUSTED_ORIGIN"
    );

    /*
     * =====================================================
     * Malformed JSON
     * =====================================================
     */

    const invalid =
      await fetch(
        `${base}/api/failure`,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",

            origin:
              "http://localhost:3000",
          },

          body:
            "{bad",
        }
      );

    assert.equal(
      invalid.status,
      400
    );

    assert.equal(
      (
        await invalid.json()
      ).code,
      "INVALID_REQUEST"
    );

    /*
     * =====================================================
     * Body size
     * =====================================================
     */

    const oversized =
      await fetch(
        `${base}/api/failure`,
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",

            origin:
              "http://localhost:3000",
          },

          body:
            JSON.stringify({
              data:
                "x".repeat(
                  150_000
                ),
            }),
        }
      );

    assert.equal(
      oversized.status,
      413
    );

    const oversizedBody =
      await oversized.json();

    assert.equal(
      oversizedBody.code,
      "INVALID_REQUEST"
    );

    /*
     * Ensure the original request
     * body is not reflected.
     */
    assert.equal(
      JSON.stringify(
        oversizedBody
      ).includes(
        "xxxxx"
      ),
      false
    );

    /*
     * =====================================================
     * Internal failure
     * =====================================================
     */

    const failed =
      await fetch(
        `${base}/api/failure`
      );

    assert.equal(
      failed.status,
      500
    );

    const failedBody =
      await failed.json();

    assert.equal(
      failedBody.code,
      "INTERNAL_SERVER_ERROR"
    );

    assert.equal(
      JSON.stringify(
        failedBody
      ).includes(
        "private diagnostic"
      ),
      false
    );
  }
);