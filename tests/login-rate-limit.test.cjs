const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule, response } = require('./load-module.cjs');

test('login limits use private, normalized account and IPv6 subnet keys', async (t) => {
  const previous = process.env.REDIS_URL;
  process.env.REDIS_URL = 'redis://test.invalid';
  t.after(() => { if (previous === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = previous; });
  const calls = [];
  class Redis {
    status = 'ready';
    on() {}
    async connect() {}
    async eval(...args) { calls.push(args); return [1, 0]; }
  }
  const { consumeLoginAttempt } = loadModule('src/modules/auth/login-rate-limit.ts', { ioredis: { default: Redis } });
  await consumeLoginAttempt('2001:db8::1', ' OWNER@example.com ');
  await consumeLoginAttempt('2001:db8::2', 'owner@example.com');
  assert.equal(calls[0][2], calls[1][2]);
  assert.equal(calls[0][3], calls[1][3]);
  assert.equal(calls[0][3].includes('owner@example.com'), false);
  assert.deepEqual(calls[0].slice(4), [900000, 100, 10]);
});

test('blocked attempts return Retry-After, and store outages fail closed', async (t) => {
  t.mock.method(console, 'error', () => {});
  const previous = process.env.REDIS_URL;
  process.env.REDIS_URL = 'redis://test.invalid';
  t.after(() => { if (previous === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = previous; });
  let unavailable = false;
  class Redis {
    status = 'ready';
    on() {}
    async connect() {}
    async eval() { if (unavailable) throw new Error('Redis down'); return [0, 1501]; }
  }
  const { loginRateLimit } = loadModule('src/modules/auth/login-rate-limit.ts', { ioredis: { default: Redis } });
  const req = { ip: '192.0.2.1', body: { email: 'owner@example.com' } };
  const blocked = response();
  const next = () => { throw new Error('must not reach password verification'); };
  await loginRateLimit(req, blocked, next);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers['Retry-After'], '2');
  unavailable = true;
  const failed = response();
  await loginRateLimit(req, failed, next);
  assert.equal(failed.statusCode, 503);
});
