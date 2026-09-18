import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import IORedis from "ioredis";

const WINDOW_MS = 15 * 60 * 1000;
const IP_LIMIT = 100;
const ACCOUNT_LIMIT = 10;

// Increment and expire counters atomically across every API instance.
// Already-blocked IPs cannot exhaust more accounts' budgets.
const CONSUME_ATTEMPT = `
local ipCount = redis.call('INCR', KEYS[1])
if ipCount == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
if ipCount > tonumber(ARGV[2]) then
  return {0, redis.call('PTTL', KEYS[1])}
end
local accountCount = redis.call('INCR', KEYS[2])
if accountCount == 1 then redis.call('PEXPIRE', KEYS[2], ARGV[1]) end
if accountCount > tonumber(ARGV[3]) then
  return {0, redis.call('PTTL', KEYS[2])}
end
return {1, 0}
`;

let client: InstanceType<typeof IORedis.default> | undefined;
let ready: Promise<unknown> | undefined;

async function getClient() {
  if (!client || client.status === "end") {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is required for login throttling");
    client = new IORedis.default(url, {
      lazyConnect: true, enableOfflineQueue: false,
      connectTimeout: 2000, commandTimeout: 2000,
      maxRetriesPerRequest: 1, retryStrategy: null,
    });
    // The awaiting request handles connection errors with a generic 503.
    client.on("error", () => {});
    ready = client.connect();
  }
  await ready;
  return client;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function consumeLoginAttempt(ip: string, email: string) {
  const redis = await getClient();
  const [allowed, retryAfterMs] = await redis.eval(
    CONSUME_ATTEMPT, 2,
    `auth:login:ip:${hash(ipKeyGenerator(ip))}`,
    `auth:login:account:${hash(email.trim().toLowerCase())}`,
    WINDOW_MS, IP_LIMIT, ACCOUNT_LIMIT,
  ) as [number, number];
  return {
    allowed: allowed === 1,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  };
}

export const loginRateLimit: RequestHandler = async (req, res, next) => {
  try {
    const result = await consumeLoginAttempt(
      req.ip || req.socket.remoteAddress || "unknown",
      typeof req.body?.email === "string" ? req.body.email : "",
    );
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      return res.status(429).json({
        success: false, code: "LOGIN_RATE_LIMITED",
        message: "Too many login attempts. Please try again later.",
      });
    }
    return next();
  } catch (error) {
    console.error("Login rate limit unavailable", error);
    return res.status(503).json({
      success: false, code: "LOGIN_TEMPORARILY_UNAVAILABLE",
      message: "Login is temporarily unavailable. Please try again shortly.",
    });
  }
};

export function closeLoginRateLimit() {
  client?.disconnect();

  client =
    undefined;

  ready =
    undefined;
}
