const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule, response } = require('./load-module.cjs');

const user = { id: 'u', name: 'Owner', email: 'owner@example.com', role: 'BUSINESS_OWNER', status: 'ACTIVE' };
function subject(prisma, bcrypt = { compare: async () => true, hash: async () => 'new-hash' }) {
  return loadModule('src/modules/auth/auth.controller.ts', {
    '../../lib/prisma.js': { prisma }, bcryptjs: bcrypt,
    './establish-session.js': { establishSession: async () => {} },
  });
}
const loginRequest = { body: { email: ' OWNER@example.com ', password: 'password' }, get: () => '' };
const activationRequest = { body: { token: 'a'.repeat(64), password: 'password', confirmPassword: 'password' }, get: () => '' };
const unexpected = (error) => { throw error; };

test('login preserves normalized lookup and response, without returning password hashes', async () => {
  const api = subject({ user: { findUnique: async ({ where }) => {
    assert.equal(where.email, 'owner@example.com');
    return { ...user, passwordHash: 'hash' };
  } } });
  const res = response();
  await api.loginController(loginRequest, res, unexpected);
  assert.deepEqual(res.body, { success: true, message: 'Logged in successfully.', user });
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('login keeps error status and code contracts', async () => {
  for (const [record, valid, status, code] of [
    [null, true, 401, 'INVALID_CREDENTIALS'],
    [{ ...user, passwordHash: null }, true, 401, 'INVALID_CREDENTIALS'],
    [{ ...user, passwordHash: 'hash', status: 'DISABLED' }, true, 403, 'ACCOUNT_DISABLED'],
    [{ ...user, passwordHash: 'hash', status: 'PENDING' }, true, 403, 'ACCOUNT_NOT_ACTIVE'],
    [{ ...user, passwordHash: 'hash' }, false, 401, 'INVALID_CREDENTIALS'],
  ]) {
    const api = subject({ user: { findUnique: async () => record } }, { compare: async () => valid });
    const res = response();
    await api.loginController(loginRequest, res, unexpected);
    assert.equal(res.statusCode, status);
    assert.equal(res.body.code, code);
  }
});

test('only one concurrent activation claims the invitation and changes the password', async () => {
  let claimed = false, updates = 0;
  const tx = {
    accountInvitation: { updateMany: async ({ where, data }) => {
      assert.equal(where.usedAt, null);
      assert.ok(data.usedAt instanceof Date);
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    } },
    user: { update: async () => { updates++; return user; } },
  };
  const api = subject({
    accountInvitation: { findFirst: async ({ where }) => {
      assert.equal(where.usedAt, null);
      assert.equal(where.tokenHash.length, 64);
      return { id: 'invite', user: { ...user, status: 'PENDING' } };
    } },
    $transaction: async (fn) => fn(tx),
  });
  const responses = [response(), response()];
  await Promise.all(responses.map((res) => api.activateAccountController(activationRequest, res, unexpected)));
  assert.deepEqual(responses.map((res) => res.statusCode).sort(), [200, 409]);
  assert.equal(updates, 1);
  assert.equal(responses.find((res) => res.statusCode === 409).body.code, 'INVITATION_ALREADY_USED');
});

test('invalid invitations and disabled/active users cannot change a password', async () => {
  for (const [invitation, code] of [
    [null, 'INVALID_OR_EXPIRED_INVITATION'],
    [{ user: { ...user, status: 'DISABLED' } }, 'ACCOUNT_DISABLED'],
    [{ user }, 'ACCOUNT_ALREADY_ACTIVE'],
  ]) {
    const api = subject({ accountInvitation: { findFirst: async () => invitation } });
    const res = response();
    await api.activateAccountController(activationRequest, res, unexpected);
    assert.equal(res.body.code, code);
  }
});
