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

test(
  "request observability creates a safe request ID and never logs query parameters",

  () => {
    const logs =
      [];

    const api =
      loadModule(
        "src/middleware/request-observability.ts",

        {
          "../lib/logger.js":
            {
              logInfo:
                (
                  event,
                  context
                ) => {
                  logs.push({
                    event,
                    context,
                  });
                },

              logWarn:
                (
                  event,
                  context
                ) => {
                  logs.push({
                    event,
                    context,
                  });
                },
            },
        }
      );

    let finish;

    const headers =
      {};

    const req = {
      method:
        "GET",

      originalUrl:
        "/api/analytics/overview?secret=value",

      path:
        "/api/analytics/overview",

      get:
        () =>
          undefined,

      user:
        {
          id:
            "owner-1",
        },
    };

    const res = {
      statusCode:
        200,

      setHeader:
        (
          name,
          value
        ) => {
          headers[
            name
          ] =
            value;
        },

      once:
        (
          event,
          callback
        ) => {
          assert.equal(
            event,
            "finish"
          );

          finish =
            callback;
        },
    };

    let nextCalled =
      false;

    api.requestObservability(
      req,
      res,
      () => {
        nextCalled =
          true;
      }
    );

    assert.equal(
      nextCalled,
      true
    );

    assert.ok(
      req.requestId
    );

    assert.equal(
      headers[
        "X-Request-Id"
      ],
      req.requestId
    );

    finish();

    assert.equal(
      logs.length,
      1
    );

    assert.equal(
      logs[0]
        .event,
      "http_request"
    );

    assert.equal(
      logs[0]
        .context
        .path,
      "/api/analytics/overview"
    );

    assert.equal(
      JSON.stringify(
        logs
      ).includes(
        "secret=value"
      ),
      false
    );
  }
);

test(
  "safe incoming request ID is preserved",

  () => {
    const api =
      loadModule(
        "src/middleware/request-observability.ts",

        {
          "../lib/logger.js":
            {
              logInfo:
                () => {},

              logWarn:
                () => {},
            },
        }
      );

    const req = {
      method:
        "GET",

      originalUrl:
        "/api/test",

      path:
        "/api/test",

      get:
        (
          name
        ) =>
          name ===
          "x-request-id"
            ? "request-12345678"
            : undefined,
    };

    const res = {
      statusCode:
        200,

      setHeader:
        () => {},

      once:
        () => {},
    };

    api.requestObservability(
      req,
      res,
      () => {}
    );

    assert.equal(
      req.requestId,
      "request-12345678"
    );
  }
);