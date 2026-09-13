const test = require('node:test');
const assert = require('node:assert/strict');
const RealRedis = require('ioredis');
const { loadModule } = require('../load-module.cjs');

const socket = process.env.TEST_REDIS_SOCKET;
test('Redis atomically enforces account/IP budgets across API instances and expires counters', { skip: !socket }, async (t) => {
  // Explicitly use an isolated Unix socket, never the application's REDIS_URL.
  assert.ok(socket.startsWith('/private/tmp/'));
  const oldUrl = process.env.REDIS_URL;
  process.env.REDIS_URL = 'redis://unused.invalid';
  const clients = [];
  class Redis extends RealRedis {
    constructor(_url, options) { super(socket, options); clients.push(this); }
  }
  t.after(async () => {
    await Promise.all(clients.map((client) => client.quit()));
    if (oldUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = oldUrl;
  });
  const first = loadModule('src/modules/auth/login-rate-limit.ts', { ioredis: { default: Redis } });
  const second = loadModule('src/modules/auth/login-rate-limit.ts', { ioredis: { default: Redis } });
  const email = `parallel-${Date.now()}@example.com`;
  const attempts = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    (i % 2 ? first : second).consumeLoginAttempt(`192.0.2.${i + 1}`, email)));
  assert.equal(attempts.filter((result) => result.allowed).length, 10);
  assert.ok(attempts.filter((result) => !result.allowed).every((result) => result.retryAfterSeconds > 0));

  const ipAttempts = await Promise.all(Array.from({ length: 101 }, (_, i) =>
    first.consumeLoginAttempt('198.51.100.1', `ip-${Date.now()}-${i}@example.com`)));
  assert.equal(ipAttempts.filter((result) => result.allowed).length, 100);

  const keys = await clients[0].keys('auth:login:*');
  const expirations = await Promise.all(keys.map((key) => clients[0].pttl(key)));
  assert.ok(expirations.every((ttl) => ttl > 0 && ttl <= 900000));
  assert.ok(keys.every((key) => !key.includes('@') && !key.includes('198.51.100.1')));
});
