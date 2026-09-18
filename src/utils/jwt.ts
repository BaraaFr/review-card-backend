import jwt
  from "jsonwebtoken";

import {
  env,
} from "../config/env.js";

export type AccessTokenPayload = {
  userId:
    string;

  email:
    string;

  role:
    | "SUPER_ADMIN"
    | "BUSINESS_OWNER";

  sessionId:
    string;
};

/*
 * =========================================================
 * JWT configuration
 * =========================================================
 */

const JWT_ALGORITHM =
  "HS256" as const;

const JWT_ISSUER =
  "valyou-api";

const JWT_AUDIENCE =
  "valyou-web";

/*
 * Access tokens are intentionally
 * short lived.
 *
 * The persistent login state lives
 * in AuthSession + refresh_token.
 */
export const ACCESS_TOKEN_TTL_SECONDS =
  60 * 60;

/*
 * =========================================================
 * Sign
 * =========================================================
 */

export function signToken(
  payload:
    AccessTokenPayload
) {
  return jwt.sign(
    payload,

    env.JWT_SECRET,

    {
      algorithm:
        JWT_ALGORITHM,

      issuer:
        JWT_ISSUER,

      audience:
        JWT_AUDIENCE,

      expiresIn:
        ACCESS_TOKEN_TTL_SECONDS,
    }
  );
}

/*
 * =========================================================
 * Verify
 * =========================================================
 */

export function verifyToken(
  token:
    string
) {
  return jwt.verify(
    token,

    env.JWT_SECRET,

    {
      algorithms: [
        JWT_ALGORITHM,
      ],

      issuer:
        JWT_ISSUER,

      audience:
        JWT_AUDIENCE,
    }
  ) as AccessTokenPayload;
}