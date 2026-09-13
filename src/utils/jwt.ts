import jwt from "jsonwebtoken";

import {
  env,
} from "../config/env.js";

export type AccessTokenPayload = {
  userId: string;

  email: string;

  role:
    | "SUPER_ADMIN"
    | "BUSINESS_OWNER";

  sessionId: string;
};

/*
 * Access JWT:
 *
 * Short-lived on purpose.
 *
 * User remains logged in through
 * the refresh session.
 */
export const ACCESS_TOKEN_TTL_SECONDS =
  60 * 60;

export function signToken(
  payload: AccessTokenPayload
) {
  return jwt.sign(
    payload,
    env.JWT_SECRET,
    {
      expiresIn:
        ACCESS_TOKEN_TTL_SECONDS,
    }
  );
}

export function verifyToken(
  token: string
) {
  return jwt.verify(
    token,
    env.JWT_SECRET
  ) as AccessTokenPayload;
}