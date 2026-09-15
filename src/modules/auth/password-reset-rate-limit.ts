import {
    createHash,
  } from "node:crypto";
  
  import type {
    RequestHandler,
  } from "express";
  
  import {
    ipKeyGenerator,
  } from "express-rate-limit";
  
  import IORedis from "ioredis";
  
  /*
   * =========================================================
   * Configuration
   * =========================================================
   */
  
  const WINDOW_MS =
    15 *
    60 *
    1000;
  
  const FORGOT_IP_LIMIT =
    30;
  
  const FORGOT_ACCOUNT_LIMIT =
    5;
  
  const RESET_IP_LIMIT =
    50;
  
  const RESET_TOKEN_LIMIT =
    10;
  
  /*
   * =========================================================
   * Atomic Redis counter
   * =========================================================
   */
  
  const CONSUME_ATTEMPT =
    `
      local ipCount = redis.call('INCR', KEYS[1])
  
      if ipCount == 1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
      end
  
      if ipCount > tonumber(ARGV[2]) then
        return {0, redis.call('PTTL', KEYS[1])}
      end
  
      local identityCount = redis.call('INCR', KEYS[2])
  
      if identityCount == 1 then
        redis.call('PEXPIRE', KEYS[2], ARGV[1])
      end
  
      if identityCount > tonumber(ARGV[3]) then
        return {0, redis.call('PTTL', KEYS[2])}
      end
  
      return {1, 0}
    `;
  
  let client:
    InstanceType<
      typeof IORedis.default
    > |
    undefined;
  
  let ready:
    Promise<unknown> |
    undefined;
  
  /*
   * =========================================================
   * Redis
   * =========================================================
   */
  
  async function getClient() {
    if (
      !client ||
      client.status ===
        "end"
    ) {
      const url =
        process.env
          .REDIS_URL;
  
      if (
        !url
      ) {
        throw new Error(
          "REDIS_URL is required for password reset throttling"
        );
      }
  
      client =
        new IORedis.default(
          url,
          {
            lazyConnect:
              true,
  
            enableOfflineQueue:
              false,
  
            connectTimeout:
              2000,
  
            commandTimeout:
              2000,
  
            maxRetriesPerRequest:
              1,
  
            retryStrategy:
              null,
          }
        );
  
      client.on(
        "error",
        () => {}
      );
  
      ready =
        client.connect();
    }
  
    await ready;
  
    return client;
  }
  
  function hash(
    value: string
  ) {
    return createHash(
      "sha256"
    )
      .update(
        value
      )
      .digest(
        "hex"
      );
  }
  
  /*
   * =========================================================
   * Generic limiter
   * =========================================================
   */
  
  async function consumeAttempt({
    namespace,
    ip,
    identity,
    ipLimit,
    identityLimit,
  }: {
    namespace:
      string;
  
    ip:
      string;
  
    identity:
      string;
  
    ipLimit:
      number;
  
    identityLimit:
      number;
  }) {
    const redis =
      await getClient();
  
    const result =
      await redis.eval(
        CONSUME_ATTEMPT,
  
        2,
  
        `auth:password-reset:${namespace}:ip:${hash(
          ipKeyGenerator(
            ip
          )
        )}`,
  
        `auth:password-reset:${namespace}:identity:${hash(
          identity
        )}`,
  
        WINDOW_MS,
  
        ipLimit,
  
        identityLimit
      ) as [
        number,
        number,
      ];
  
    const [
      allowed,
      retryAfterMs,
    ] =
      result;
  
    return {
      allowed:
        allowed ===
        1,
  
      retryAfterSeconds:
        Math.max(
          1,
  
          Math.ceil(
            retryAfterMs /
              1000
          )
        ),
    };
  }
  
  /*
   * =========================================================
   * Forgot password limiter
   * =========================================================
   */
  
  export const forgotPasswordRateLimit:
    RequestHandler =
    async (
      req,
      res,
      next
    ) => {
      try {
        const email =
          typeof req.body
            ?.email ===
          "string"
            ? req.body.email
                .trim()
                .toLowerCase()
            : "";
  
        const result =
          await consumeAttempt({
            namespace:
              "forgot",
  
            ip:
              req.ip ||
              req.socket
                .remoteAddress ||
              "unknown",
  
            identity:
              email,
  
            ipLimit:
              FORGOT_IP_LIMIT,
  
            identityLimit:
              FORGOT_ACCOUNT_LIMIT,
          });
  
        if (
          !result.allowed
        ) {
          res.setHeader(
            "Retry-After",
            String(
              result.retryAfterSeconds
            )
          );
  
          return res
            .status(
              429
            )
            .json({
              success:
                false,
  
              code:
                "PASSWORD_RESET_RATE_LIMITED",
  
              message:
                "Too many password reset requests. Please try again later.",
            });
        }
  
        return next();
      } catch (
        error
      ) {
        console.error(
          "Password reset rate limit unavailable",
          error
        );
  
        return res
          .status(
            503
          )
          .json({
            success:
              false,
  
            code:
              "PASSWORD_RESET_TEMPORARILY_UNAVAILABLE",
  
            message:
              "Password recovery is temporarily unavailable. Please try again shortly.",
          });
      }
    };
  
  /*
   * =========================================================
   * Reset-password limiter
   * =========================================================
   */
  
  export const resetPasswordRateLimit:
    RequestHandler =
    async (
      req,
      res,
      next
    ) => {
      try {
        const token =
          typeof req.body
            ?.token ===
          "string"
            ? req.body.token
            : "";
  
        const result =
          await consumeAttempt({
            namespace:
              "reset",
  
            ip:
              req.ip ||
              req.socket
                .remoteAddress ||
              "unknown",
  
            /*
             * The raw token is never placed
             * in the Redis key.
             */
            identity:
              token,
  
            ipLimit:
              RESET_IP_LIMIT,
  
            identityLimit:
              RESET_TOKEN_LIMIT,
          });
  
        if (
          !result.allowed
        ) {
          res.setHeader(
            "Retry-After",
            String(
              result.retryAfterSeconds
            )
          );
  
          return res
            .status(
              429
            )
            .json({
              success:
                false,
  
              code:
                "PASSWORD_RESET_RATE_LIMITED",
  
              message:
                "Too many password reset attempts. Please request a new link or try again later.",
            });
        }
  
        return next();
      } catch (
        error
      ) {
        console.error(
          "Password reset rate limit unavailable",
          error
        );
  
        return res
          .status(
            503
          )
          .json({
            success:
              false,
  
            code:
              "PASSWORD_RESET_TEMPORARILY_UNAVAILABLE",
  
            message:
              "Password recovery is temporarily unavailable. Please try again shortly.",
          });
      }
    };