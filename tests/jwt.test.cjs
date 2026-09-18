const test =
  require(
    "node:test"
  );

const assert =
  require(
    "node:assert/strict"
  );

const jwt =
  require(
    "jsonwebtoken"
  );

const {
  loadModule,
} =
  require(
    "./load-module.cjs"
  );

const secret =
  "test-secret-012345678901234567890123456789";

function subject() {
  return loadModule(
    "src/utils/jwt.ts",

    {
      "../config/env.js":
        {
          env: {
            JWT_SECRET:
              secret,
          },
        },
    }
  );
}

test(
  "ValYou access tokens require the expected algorithm, issuer and audience",
  () => {
    const {
      signToken,
      verifyToken,
    } =
      subject();

    const token =
      signToken({
        userId:
          "user-1",

        email:
          "owner@example.com",

        role:
          "BUSINESS_OWNER",

        sessionId:
          "session-1",
      });

    const payload =
      verifyToken(
        token
      );

    assert.equal(
      payload.userId,
      "user-1"
    );

    assert.equal(
      payload.sessionId,
      "session-1"
    );

    /*
     * Wrong algorithm.
     */
    const wrongAlgorithm =
      jwt.sign(
        {
          userId:
            "user-1",

          email:
            "owner@example.com",

          role:
            "BUSINESS_OWNER",

          sessionId:
            "session-1",
        },

        secret,

        {
          algorithm:
            "HS384",

          issuer:
            "valyou-api",

          audience:
            "valyou-web",
        }
      );

    assert.throws(
      () =>
        verifyToken(
          wrongAlgorithm
        )
    );

    /*
     * Wrong issuer.
     */
    const wrongIssuer =
      jwt.sign(
        {
          userId:
            "user-1",

          email:
            "owner@example.com",

          role:
            "BUSINESS_OWNER",

          sessionId:
            "session-1",
        },

        secret,

        {
          algorithm:
            "HS256",

          issuer:
            "another-api",

          audience:
            "valyou-web",
        }
      );

    assert.throws(
      () =>
        verifyToken(
          wrongIssuer
        )
    );

    /*
     * Wrong audience.
     */
    const wrongAudience =
      jwt.sign(
        {
          userId:
            "user-1",

          email:
            "owner@example.com",

          role:
            "BUSINESS_OWNER",

          sessionId:
            "session-1",
        },

        secret,

        {
          algorithm:
            "HS256",

          issuer:
            "valyou-api",

          audience:
            "another-app",
        }
      );

    assert.throws(
      () =>
        verifyToken(
          wrongAudience
        )
    );
  }
);