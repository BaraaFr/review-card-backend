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
  "structured logger redacts secrets",

  (
    t
  ) => {
    const original =
      process.env.JWT_SECRET;

    process.env.JWT_SECRET =
      "very-secret-jwt-value-123456789";

    let output =
      "";

    t.mock.method(
      console,
      "error",

      (
        value
      ) => {
        output =
          String(
            value
          );
      }
    );

    const {
      logError,
    } =
      loadModule(
        "src/lib/logger.ts"
      );

    logError(
      "test_failure",

      new Error(
        `failure using ${process.env.JWT_SECRET}`
      ),

      {
        authorization:
          "Bearer abc123",

        password:
          "password123",
      }
    );

    assert.equal(
      output.includes(
        "very-secret-jwt-value-123456789"
      ),
      false
    );

    assert.equal(
      output.includes(
        "password123"
      ),
      false
    );

    assert.equal(
      output.includes(
        "Bearer abc123"
      ),
      false
    );

    const parsed =
      JSON.parse(
        output
      );

    assert.equal(
      parsed.level,
      "ERROR"
    );

    assert.equal(
      parsed.event,
      "test_failure"
    );

    if (
      original ===
      undefined
    ) {
      delete process.env
        .JWT_SECRET;
    } else {
      process.env.JWT_SECRET =
        original;
    }
  }
);