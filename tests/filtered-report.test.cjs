const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./load-module.cjs');

test('PDF assembly loads card performance once and reuses it for warnings', async () => {
  let cardCalls = 0;
  const cards = { cards: [], summary: { bestCard: null } };
  const api = loadModule('src/modules/analytics/filtered-analytics-report.service.ts', {
    '../../lib/prisma.js': { prisma: { store: { findUnique: async () => ({
      id: 's', name: 'Store', business: { id: 'b', name: 'Business' },
      googleReviewUrl: null, googlePlaceId: null,
    }) } } },
    './card-performance.service.js': { getStoreCardPerformance: async () => { cardCalls++; return cards; } },
    './location-performance.service.js': { getLocationPerformance: async () => ({ locations: [], summary: { bestLocation: null } }) },
    './engagement-analytics.service.js': { getStoreEngagementSummary: async () => ({}) },
    './engagement-patterns.service.js': { getStoreEngagementPatterns: async () => ({}) },
  });
  const report = await api.getFilteredAnalyticsReport('s', { from: '2026-09-01', to: '2026-09-07' });
  assert.equal(cardCalls, 1);
  assert.equal(report.cards, cards);
  assert.deepEqual(report.store, { id: 's', name: 'Store', business: { id: 'b', name: 'Business' } });
  // Existing behavior reports the missing link first; connection is checked
  // only when a link is already configured.
  assert.deepEqual(report.warnings.map((item) => item.type), ['GOOGLE_REVIEW_URL_MISSING']);
});
