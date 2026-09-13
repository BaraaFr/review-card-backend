const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule, response } = require('./load-module.cjs');

test('invalid analytics ranges reach clients as JSON 400 responses', async () => {
  const cache = new Map();
  const mocks = { './engagement-analytics.service.js': { getStoreEngagementSummary: async () => {
    throw new Error('should not query invalid dates');
  } } };
  const { errorHandler } = loadModule('src/middleware/error.middleware.ts', mocks, cache);
  const { getStoreEngagementSummaryController } = loadModule('src/modules/analytics/engagement-analytics.controller.ts', mocks, cache);
  const res = response();
  await getStoreEngagementSummaryController({ params: { storeId: 's' }, query: {} }, res,
    (error) => errorHandler(error, {}, res, () => {}));
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { success: false, message: 'Invalid analytics date range.' });
});

test('unexpected errors hide details and malformed requests preserve their status', (t) => {
  t.mock.method(console, 'error', () => {});
  const { errorHandler } = loadModule('src/middleware/error.middleware.ts');
  const res = response();
  errorHandler(new Error('database credentials in diagnostic'), {}, res, () => {});
  assert.equal(res.statusCode, 500);
  assert.equal(JSON.stringify(res.body).includes('credentials'), false);
  const bad = response();
  errorHandler({ status: 413, expose: true, body: 'private input' }, {}, bad, () => {});
  assert.equal(bad.statusCode, 413);
  assert.equal(JSON.stringify(bad.body).includes('private input'), false);
});

test('errors after headers are sent delegate to Express', () => {
  const { errorHandler } = loadModule('src/middleware/error.middleware.ts');
  const error = new Error('stream failed');
  let delegated;
  errorHandler(error, {}, { headersSent: true }, (value) => { delegated = value; });
  assert.equal(delegated, error);
});
