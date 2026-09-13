import type {
  NextFunction,
  Request,
  Response,
} from "express";

import jwt from "jsonwebtoken";

import {
  prisma,
} from "../lib/prisma.js";

import {
  AUTH_COOKIE,
} from "../utils/auth-cookie.js";

import {
  verifyToken,
} from "../utils/jwt.js";

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token =
      req.cookies?.[
        AUTH_COOKIE
      ];

    if (!token) {
      return res
        .status(401)
        .json({
          success: false,

          code:
            "AUTHENTICATION_REQUIRED",

          message:
            "Authentication required.",
        });
    }

    let payload;

    try {
      payload =
        verifyToken(
          token
        );
    } catch (error) {
      if (
        error instanceof
        jwt.TokenExpiredError
      ) {
        return res
          .status(401)
          .json({
            success: false,

            code:
              "ACCESS_TOKEN_EXPIRED",

            message:
              "Access token expired.",
          });
      }

      return res
        .status(401)
        .json({
          success: false,

          code:
            "INVALID_ACCESS_TOKEN",

          message:
            "Invalid access token.",
        });
    }

    /*
     * Important:
     *
     * JWT validity alone is not enough.
     *
     * Always check the real user.
     */
    const user =
      await prisma.user.findUnique({
        where: {
          id:
            payload.userId,
        },

        select: {
          id: true,

          name: true,

          email: true,

          role: true,

          status: true,
        },
      });

    if (!user) {
      return res
        .status(401)
        .json({
          success: false,

          code:
            "USER_NOT_FOUND",

          message:
            "User not found.",
        });
    }

    if (
      user.status ===
      "DISABLED"
    ) {
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

    if (
      user.status !==
      "ACTIVE"
    ) {
      return res
        .status(403)
        .json({
          success: false,

          code:
            "ACCOUNT_NOT_ACTIVE",

          message:
            "Account is not active.",
        });
    }

    if (typeof payload.sessionId !== "string" || !payload.sessionId) {
      return res.status(401).json({
        success: false, code: "INVALID_ACCESS_TOKEN", message: "Invalid access token.",
      });
    }
    const now = new Date();
    const session = await prisma.authSession.findFirst({
      where: {
        id: payload.sessionId, userId: user.id, revokedAt: null,
        expiresAt: { gt: now }, absoluteExpiresAt: { gt: now },
      },
      select: { id: true },
    });
    if (!session) {
      return res.status(401).json({
        success: false, code: "SESSION_REVOKED", message: "Please log in again.",
      });
    }

    req.user =
      user;

    return next();
  } catch (error) {
    return next(
      error
    );
  }
}