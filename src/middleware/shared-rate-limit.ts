import {
    createHash,
  } from "node:crypto";
  
  import type {
    Request,
    RequestHandler,
  } from "express";
  
  import {
    ipKeyGenerator,
  } from "express-rate-limit";
  
  import {
    requestRedis,
  } from "../lib/request-redis.js";
  
  import {
    DomainError,
  } from "../lib/domain-error.js";
  
  /*
   * Atomic Redis rate-limit operation.
   *
   * Important:
   * multiple API instances all use
   * the same Redis counter.
   */
  const script = `
  local count = tonumber(redis.call('GET', KEYS[1]) or '0')
  
  if count >= tonumber(ARGV[1]) then
    return math.max(1, redis.call('PTTL', KEYS[1]))
  end
  
  count = redis.call('INCR', KEYS[1])
  
  if count == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[2])
  end
  
  return 0
  `;

  function getLimitKey(
    namespace:
      string,
  
    subject:
      string
  ) {
    const hash =
      createHash(
        "sha256"
      )
        .update(
          subject
        )
        .digest(
          "hex"
        );
  
    return `valyou:limit:${namespace}:${hash}`;
  }
  
  export async function consumeLimit(
    namespace:
      string,
  
    subject:
      string,
  
    limit:
      number,
  
    windowMs:
      number
  ) {
    try {
      const client =
        await requestRedis();
  
      /*
       * Do not put email addresses,
       * IP addresses or user IDs
       * directly into Redis keys.
       */
      
      const retryMs =
        Number(
          await client.eval(
            script,
  
            1,
  
            getLimitKey(
              namespace,
              subject
            ),
  
            limit,
  
            windowMs
          )
        );
  
      return Math.ceil(
        retryMs /
          1000
      );
    } catch {
      /*
       * Security controls fail closed.
       *
       * If Redis is unavailable,
       * protected actions return 503
       * instead of silently disabling
       * rate limiting.
       */
      throw new DomainError(
        503,
        "RATE_LIMIT_UNAVAILABLE",
        "Service temporarily unavailable. Please try again."
      );
    }
  }
  
  export const clientIp =
    (
      req:
        Request
    ) =>
      ipKeyGenerator(
        req.ip ??
          req.socket
            .remoteAddress ??
          "unknown"
      );
  
  export function sharedRateLimit(
    namespace:
      string,
  
    limit:
      number,
  
    windowMs:
      number,
  
    subject:
      (
        req:
          Request
      ) => string =
        clientIp
  ): RequestHandler {
    return async (
      req,
      res,
      next
    ) => {
      try {
        const retryAfter =
          await consumeLimit(
            namespace,
            subject(
              req
            ),
            limit,
            windowMs
          );
  
        if (
          retryAfter
        ) {
          res.setHeader(
            "Retry-After",
            String(
              retryAfter
            )
          );
  
          return next(
            new DomainError(
              429,
              "RATE_LIMITED",
              "Too many requests. Please try again later."
            )
          );
        }
  
        next();
      } catch (
        error
      ) {
        next(
          error
        );
      }
    };
  }

  export async function getLimitUsage(
    namespace:
      string,
  
    subject:
      string,
  
    limit:
      number
  ) {
    const client =
      await requestRedis();
  
    const key =
      getLimitKey(
        namespace,
        subject
      );
  
    const [
      rawCount,
      ttlMs,
    ] =
      await Promise.all([
        client.get(
          key
        ),
  
        client.pttl(
          key
        ),
      ]);
  
    const used =
      Math.max(
        0,
        Number(
          rawCount ??
          0
        ) ||
        0
      );
  
    const remaining =
      Math.max(
        0,
        limit -
        used
      );
  
    const percentage =
      limit ===
        0
        ? 0
        : Math.min(
            100,
            Number(
              (
                (
                  used /
                  limit
                ) *
                100
              ).toFixed(
                1
              )
            )
          );
  
    return {
      limit,
  
      used,
  
      remaining,
  
      percentage,
  
      resetInSeconds:
        ttlMs >
        0
          ? Math.ceil(
              ttlMs /
              1000
            )
          : null,
    };
  }