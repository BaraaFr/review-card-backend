import {
    createHash,
    randomBytes,
    randomUUID,
    timingSafeEqual,
  } from "node:crypto";
  
  import {
    prisma,
  } from "../../lib/prisma.js";
  
  /*
   * If the owner doesn't use TapReview
   * for 90 days, they need to log in again.
   */
  const REFRESH_IDLE_DAYS =
    90;
  
  /*
   * Even an actively used session must
   * authenticate again after one year.
   */
  const REFRESH_ABSOLUTE_DAYS =
    365;
  
  function addDays(
    date: Date,
    days: number
  ) {
    const result =
      new Date(date);
  
    result.setDate(
      result.getDate() +
        days
    );
  
    return result;
  }
  
  function minimumDate(
    first: Date,
    second: Date
  ) {
    return first <
      second
      ? first
      : second;
  }
  
  function generateRefreshSecret() {
    return randomBytes(
      48
    ).toString(
      "base64url"
    );
  }
  
  function hashRefreshSecret(
    secret: string
  ) {
    return createHash(
      "sha256"
    )
      .update(secret)
      .digest("hex");
  }
  
  function constantTimeHashEquals(
    first: string,
    second: string
  ) {
    const firstBuffer =
      Buffer.from(
        first,
        "utf8"
      );
  
    const secondBuffer =
      Buffer.from(
        second,
        "utf8"
      );
  
    if (
      firstBuffer.length !==
      secondBuffer.length
    ) {
      return false;
    }
  
    return timingSafeEqual(
      firstBuffer,
      secondBuffer
    );
  }
  
  function createRawRefreshToken(
    sessionId: string,
    secret: string
  ) {
    return `${sessionId}.${secret}`;
  }
  
  function parseRawRefreshToken(
    rawToken: string
  ) {
    const separatorIndex =
      rawToken.indexOf(
        "."
      );
  
    if (
      separatorIndex <= 0
    ) {
      return null;
    }
  
    const sessionId =
      rawToken.slice(
        0,
        separatorIndex
      );
  
    const secret =
      rawToken.slice(
        separatorIndex + 1
      );
  
    if (
      !sessionId ||
      !secret
    ) {
      return null;
    }
  
    return {
      sessionId,
      secret,
    };
  }
  
  export async function createAuthSession(
    userId: string,
    userAgent?: string | null
  ) {
    const now =
      new Date();
  
    const sessionId =
      randomUUID();
  
    const secret =
      generateRefreshSecret();
  
    const absoluteExpiresAt =
      addDays(
        now,
        REFRESH_ABSOLUTE_DAYS
      );
  
    const expiresAt =
      minimumDate(
        addDays(
          now,
          REFRESH_IDLE_DAYS
        ),
        absoluteExpiresAt
      );
  
    await prisma.authSession.create({
      data: {
        id:
          sessionId,
  
        userId,
  
        refreshTokenHash:
          hashRefreshSecret(
            secret
          ),
  
        expiresAt,
  
        absoluteExpiresAt,
  
        lastUsedAt:
          now,
  
        userAgent:
          userAgent ??
          null,
      },
    });
  
    return {
      sessionId,
  
      refreshToken:
        createRawRefreshToken(
          sessionId,
          secret
        ),
  
      expiresAt,
  
      absoluteExpiresAt,
    };
  }
  
  export async function rotateAuthSession(
    rawRefreshToken: string
  ) {
    const parsed =
      parseRawRefreshToken(
        rawRefreshToken
      );
  
    if (!parsed) {
      throw new Error(
        "INVALID_REFRESH_TOKEN"
      );
    }
  
    const now =
      new Date();
  
    const session =
      await prisma.authSession.findUnique({
        where: {
          id:
            parsed.sessionId,
        },
  
        include: {
          user: {
            select: {
              id: true,
  
              name: true,
  
              email: true,
  
              role: true,
  
              status: true,
            },
          },
        },
      });
  
    if (!session) {
      throw new Error(
        "INVALID_REFRESH_TOKEN"
      );
    }
  
    if (
      session.revokedAt
    ) {
      throw new Error(
        "REFRESH_SESSION_REVOKED"
      );
    }
  
    if (
      session.expiresAt <=
        now ||
      session.absoluteExpiresAt <=
        now
    ) {
      await prisma.authSession.updateMany({
        where: {
          id:
            session.id,
  
          revokedAt:
            null,
        },
  
        data: {
          revokedAt:
            now,
        },
      });
  
      throw new Error(
        "REFRESH_SESSION_EXPIRED"
      );
    }
  
    const suppliedHash =
      hashRefreshSecret(
        parsed.secret
      );
  
    /*
     * Important:
     *
     * A previous rotated token can reach
     * the server from another browser tab.
     *
     * We reject it but DO NOT revoke the
     * whole valid session.
     */
    if (
      !constantTimeHashEquals(
        suppliedHash,
        session.refreshTokenHash
      )
    ) {
      throw new Error(
        "REFRESH_TOKEN_STALE"
      );
    }
  
    /*
     * Disabled users cannot refresh.
     */
    if (
      session.user.status !==
      "ACTIVE"
    ) {
      await prisma.authSession.updateMany({
        where: {
          id:
            session.id,
  
          revokedAt:
            null,
        },
  
        data: {
          revokedAt:
            now,
        },
      });
  
      throw new Error(
        "ACCOUNT_DISABLED"
      );
    }
  
    /*
     * Rotate the refresh token.
     */
    const newSecret =
      generateRefreshSecret();
  
    const newHash =
      hashRefreshSecret(
        newSecret
      );
  
    /*
     * Sliding 90-day inactivity window,
     * but never exceed the absolute
     * one-year lifetime.
     */
    const newExpiresAt =
      minimumDate(
        addDays(
          now,
          REFRESH_IDLE_DAYS
        ),
  
        session.absoluteExpiresAt
      );
  
    /*
     * Atomic update:
     *
     * only rotate if the token hash
     * still matches the token that
     * reached this request.
     */
    const result =
      await prisma.authSession.updateMany({
        where: {
          id:
            session.id,
  
          refreshTokenHash:
            suppliedHash,
  
          revokedAt:
            null,
  
          expiresAt: {
            gt:
              now,
          },
  
          absoluteExpiresAt: {
            gt:
              now,
          },
        },
  
        data: {
          refreshTokenHash:
            newHash,
  
          expiresAt:
            newExpiresAt,
  
          lastUsedAt:
            now,
        },
      });
  
    if (
      result.count !==
      1
    ) {
      throw new Error(
        "REFRESH_TOKEN_STALE"
      );
    }
  
    return {
      sessionId:
        session.id,
  
      user:
        session.user,
  
      refreshToken:
        createRawRefreshToken(
          session.id,
          newSecret
        ),
  
      expiresAt:
        newExpiresAt,
  
      absoluteExpiresAt:
        session.absoluteExpiresAt,
    };
  }
  
  export async function revokeAuthSession(
    rawRefreshToken:
      | string
      | null
      | undefined
  ) {
    if (!rawRefreshToken) {
      return;
    }
  
    const parsed =
      parseRawRefreshToken(
        rawRefreshToken
      );
  
    if (!parsed) {
      return;
    }
  
    const session =
      await prisma.authSession.findUnique({
        where: {
          id:
            parsed.sessionId,
        },
  
        select: {
          id: true,
  
          refreshTokenHash:
            true,
  
          revokedAt:
            true,
        },
      });
  
    if (
      !session ||
      session.revokedAt
    ) {
      return;
    }
  
    const suppliedHash =
      hashRefreshSecret(
        parsed.secret
      );
  
    /*
     * Don't allow someone with only
     * a guessed session ID to revoke it.
     */
    if (
      !constantTimeHashEquals(
        suppliedHash,
        session.refreshTokenHash
      )
    ) {
      return;
    }
  
    await prisma.authSession.update({
      where: {
        id:
          session.id,
      },
  
      data: {
        revokedAt:
          new Date(),
      },
    });
  }
  
  export async function revokeAllUserSessions(
    userId: string
  ) {
    await prisma.authSession.updateMany({
      where: {
        userId,
  
        revokedAt:
          null,
      },
  
      data: {
        revokedAt:
          new Date(),
      },
    });
  }