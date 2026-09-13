import type {
  CookieOptions,
  Response,
} from "express";

import {
  env,
} from "../config/env.js";

import {
  ACCESS_TOKEN_TTL_SECONDS,
} from "./jwt.js";

export const AUTH_COOKIE =
  "auth_token";

export const REFRESH_COOKIE =
  "refresh_token";

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly:
      true,

    secure:
      env.NODE_ENV ===
      "production",

    sameSite:
      "lax",

    path:
      "/",

    /*
     * Leave undefined locally.
     *
     * Production example:
     *
     * .tapreview.com
     */
    domain: env.COOKIE_DOMAIN ||
      undefined,
  };
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  refreshExpiresAt: Date
) {
  res.cookie(
    AUTH_COOKIE,
    accessToken,
    {
      ...baseCookieOptions(),

      maxAge:
        ACCESS_TOKEN_TTL_SECONDS *
        1000,
    }
  );

  res.cookie(
    REFRESH_COOKIE,
    refreshToken,
    {
      ...baseCookieOptions(),

      maxAge:
        Math.max(
          0,

          refreshExpiresAt.getTime() -
            Date.now()
        ),
    }
  );
}

export function clearAuthCookies(
  res: Response
) {
  res.clearCookie(
    AUTH_COOKIE,
    baseCookieOptions()
  );

  res.clearCookie(
    REFRESH_COOKIE,
    baseCookieOptions()
  );
}