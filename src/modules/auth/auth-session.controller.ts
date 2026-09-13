import type {
    NextFunction,
    Request,
    Response,
  } from "express";
  
  import {
    revokeAuthSession,
    rotateAuthSession,
  } from "./auth-session.service.js";
  
  import {
    REFRESH_COOKIE,
    clearAuthCookies,
    setAuthCookies,
  } from "../../utils/auth-cookie.js";
  
  import {
    signToken,
  } from "../../utils/jwt.js";
  
  export async function refreshSessionController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const refreshToken =
        req.cookies?.[
          REFRESH_COOKIE
        ];
  
      if (!refreshToken) {
        return res
          .status(401)
          .json({
            success: false,
  
            code:
              "REFRESH_TOKEN_REQUIRED",
  
            message:
              "Refresh session required.",
          });
      }
  
      const result =
        await rotateAuthSession(
          refreshToken
        );
  
      const accessToken =
        signToken({
          userId:
            result.user.id,
  
          email:
            result.user.email,
  
          role:
            result.user.role,
  
          sessionId:
            result.sessionId,
        });
  
      setAuthCookies(
        res,
  
        accessToken,
  
        result.refreshToken,
  
        result.expiresAt
      );
  
      /*
       * Authentication responses
       * should never be browser/CDN cached.
       */
      res.setHeader(
        "Cache-Control",
        "no-store"
      );
  
      return res.json({
        success: true,
      });
    } catch (error) {
      /*
       * Disabled account.
       *
       * This session is dead, so
       * clear browser cookies.
       */
      if (
        error instanceof Error &&
        error.message ===
          "ACCOUNT_DISABLED"
      ) {
        clearAuthCookies(
          res
        );
  
        return res
          .status(403)
          .json({
            success: false,
  
            code:
              "ACCOUNT_DISABLED",
  
            message:
              "This account is disabled.",
          });
      }
  
      /*
       * Stale refresh token can happen
       * when multiple browser tabs try
       * refreshing nearly simultaneously.
       *
       * DO NOT clear cookies here.
       *
       * Another tab may have already
       * installed the newest valid token.
       */
      if (
        error instanceof Error &&
        error.message ===
          "REFRESH_TOKEN_STALE"
      ) {
        return res
          .status(401)
          .json({
            success: false,
  
            code:
              "REFRESH_TOKEN_STALE",
  
            message:
              "Refresh token was already rotated.",
          });
      }
  
      if (
        error instanceof Error &&
        [
          "INVALID_REFRESH_TOKEN",
          "REFRESH_SESSION_REVOKED",
          "REFRESH_SESSION_EXPIRED",
        ].includes(
          error.message
        )
      ) {
        clearAuthCookies(
          res
        );
  
        return res
          .status(401)
          .json({
            success: false,
  
            code:
              "REFRESH_SESSION_INVALID",
  
            message:
              "Your session has expired. Please log in again.",
          });
      }
  
      return next(
        error
      );
    }
  }
  
  export async function logoutController(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const refreshToken =
        req.cookies?.[
          REFRESH_COOKIE
        ];
  
      await revokeAuthSession(
        refreshToken
      );
  
      clearAuthCookies(
        res
      );
  
      res.setHeader(
        "Cache-Control",
        "no-store"
      );
  
      return res.json({
        success: true,
      });
    } catch (error) {
      /*
       * Even if DB revocation fails,
       * don't accidentally leave the
       * browser authenticated.
       */
      clearAuthCookies(
        res
      );
  
      return next(
        error
      );
    }
  }