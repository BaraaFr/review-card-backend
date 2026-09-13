const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule, response } = require('./load-module.cjs');

test('password update and revocation commit together, only for the changing user', async () => {
  let state = { passwordHash: 'old', sessions: [{ userId: 'u', revokedAt: null }, { userId: 'other', revokedAt: null }] };
  let failRevocation = true;
  const prisma = {
    user: { findUnique: async () => ({ id: 'u', passwordHash: state.passwordHash }) },
    $transaction: async (fn) => {
      const draft = structuredClone(state);
      const result = await fn({
        user: { updateMany: async ({ where, data }) => {
          assert.equal(where.id, 'u');
          if (where.passwordHash !== draft.passwordHash) return { count: 0 };
          draft.passwordHash = data.passwordHash;
          return { count: 1 };
        } },
        authSession: { updateMany: async ({ where, data }) => {
          if (failRevocation) throw new Error('revocation failed');
          assert.equal(where.revokedAt, null);
          for (const session of draft.sessions) if (session.userId === where.userId) session.revokedAt = data.revokedAt;
        } },
      });
      state = draft;
      return result;
    },
  };
  const { changeAccountPassword } = loadModule('src/modules/accounts/account.service.ts', {
    '../../lib/prisma.js': { prisma },
    bcrypt: { compare: async (value) => value === 'old-password', hash: async () => 'new' },
  });
  const input = { currentPassword: 'old-password', newPassword: 'new-password' };
  await assert.rejects(changeAccountPassword('u', input), /revocation failed/);
  assert.equal(state.passwordHash, 'old');
  assert.equal(state.sessions[0].revokedAt, null);
  failRevocation = false;
  await changeAccountPassword('u', input);
  assert.equal(state.passwordHash, 'new');
  assert.ok(state.sessions[0].revokedAt instanceof Date);
  assert.equal(state.sessions[1].revokedAt, null);
});

test('access tokens from revoked sessions fail immediately instead of waiting for JWT expiry', async () => {
  let revoked = false;
  const { authenticate } = loadModule('src/middleware/auth.middleware.ts', {
    '../utils/jwt.js': { verifyToken: () => ({ userId: 'u', sessionId: 'session' }) },
    '../utils/auth-cookie.js': { AUTH_COOKIE: 'auth_token' },
    '../lib/prisma.js': { prisma: {
      user: { findUnique: async () => ({ id: 'u', status: 'ACTIVE' }) },
      authSession: { findFirst: async ({ where }) => {
        assert.equal(where.id, 'session');
        assert.equal(where.userId, 'u');
        assert.equal(where.revokedAt, null);
        assert.ok(where.expiresAt.gt instanceof Date);
        assert.ok(where.absoluteExpiresAt.gt instanceof Date);
        return revoked ? null : { id: 'session' };
      } },
    } },
  });
  let allowed = 0;
  await authenticate({ cookies: { auth_token: 'signed-token' } }, response(), () => { allowed++; });
  revoked = true;
  const res = response();
  await authenticate({ cookies: { auth_token: 'signed-token' } }, res, () => { allowed++; });
  assert.equal(allowed, 1);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'SESSION_REVOKED');
});
