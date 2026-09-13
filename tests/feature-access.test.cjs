const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule, response } = require('./load-module.cjs');

async function request({ query = {}, params = {}, usable = true, role = 'BUSINESS_OWNER' } = {}) {
  const checkedBusinesses = [];
  const { requireFeatureAccess } = loadModule('src/middleware/feature-access.middleware.ts', {
    '../lib/prisma.js': { prisma: {
      store: { findUnique: async ({ where }) => ({
        own: { businessId: 'owned' }, foreign: { businessId: 'other' },
      })[where.id] ?? null },
      card: { findUnique: async () => ({ store: { id: 'foreign', businessId: 'other' } }) },
      business: { findFirst: async ({ where }) => {
        checkedBusinesses.push(where);
        return where.id === 'owned' ? { id: 'owned' } : null;
      } },
    } },
    '../modules/subscriptions/subscription.service.js': {
      subscriptionService: { getCurrentForBusiness: async () => ({ usable }) },
    },
  });
  const res = response();
  let allowed = false;
  await requireFeatureAccess('ANALYTICS')({ query, params, user: { id: 'owner', role } }, res,
    () => { allowed = true; });
  return { allowed, res, checkedBusinesses };
}

test('cannot substitute an owned business for a foreign route store', async () => {
  const result = await request({ query: { businessId: 'owned' }, params: { storeId: 'foreign' } });
  assert.equal(result.allowed, false);
  assert.equal(result.res.statusCode, 400);
});
test('store-only requests check actual ownership', async () => {
  const result = await request({ params: { storeId: 'foreign' } });
  assert.equal(result.res.statusCode, 404);
  assert.deepEqual(result.checkedBusinesses, [{ id: 'other', ownerId: 'owner' }]);
});
test('rejects conflicting card, store, malformed, and missing-resource context', async () => {
  for (const input of [
    { query: { businessId: 'owned', cardId: 'foreign-card' } },
    { query: { storeId: 'foreign' }, params: { storeId: 'own' } },
    { query: { businessId: ['owned'] }, params: { storeId: 'own' } },
    { query: { businessId: 'owned' }, params: { storeId: 'missing' } },
  ]) assert.equal((await request(input)).allowed, false);
});
test('allows consistent owned resources and keeps subscription enforcement', async () => {
  assert.equal((await request({ query: { businessId: 'owned' }, params: { storeId: 'own' } })).allowed, true);
  assert.equal((await request({ query: { businessId: 'owned' }, usable: false })).res.statusCode, 403);
});
test('preserves super-admin access', async () => {
  assert.equal((await request({ role: 'SUPER_ADMIN', params: { storeId: 'foreign' } })).allowed, true);
});
