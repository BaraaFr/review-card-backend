const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./load-module.cjs');

test('analytics crosses a page boundary without losing timestamp ties or double-counting visitors', async () => {
  const timestamp = new Date('2026-09-12T21:30:00Z'); // Sunday in Beirut, Saturday in UTC.
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    id: String(i).padStart(5, '0'), createdAt: timestamp,
    visitorKey: i === 1000 ? 'repeat' : (i === 0 ? 'repeat' : null),
  }));
  const calls = [];
  const prisma = {
    store: { findUnique: async () => ({ id: 's' }) },
    interaction: {
      findMany: async (query) => {
        calls.push(query);
        const after = query.where.OR?.[1].id.gt;
        return rows.filter((row) => !after || row.id > after).slice(0, query.take);
      }
    },
  };
  const prismaMock = { prisma };
  const api = loadModule(
    'src/modules/analytics/analytics.service.ts',
    {
      '../../lib/prisma.js': prismaMock,
  
      '../../../lib/prisma.js': prismaMock,
  
      './dashboard-analytics.service.js': {
        dashboardOverview:
          async () => {
            throw new Error(
              'dashboardOverview should not be called by this test'
            );
          },
  
        dashboardTimeline:
          async () => {
            throw new Error(
              'dashboardTimeline should not be called by this test'
            );
          },
      },
    }
  );
  const from = new Date('2026-09-12T21:00:00Z'), to = new Date('2026-09-13T21:00:00Z');
  const report = await api.getStoreEngagementPatterns('s', {
    preset: 'custom', from: '2026-09-13', to: '2026-09-13', days: 1,
    timeZone: 'Asia/Beirut', fromUtc: from, toExclusiveUtc: to,
    previousFrom: '2026-09-12', previousTo: '2026-09-12',
  });
  assert.equal(calls.length, 2);
  assert.equal(report.summary.totalInteractions, 1001);
  assert.equal(report.summary.totalUniqueVisitors, 1);
  assert.equal(report.dailyTrend[0].uniqueVisitors, 1);
  assert.equal(report.dailyTrend[0].date, '2026-09-13');
  assert.equal(report.summary.peakDay.weekday, 'Sunday');
  for (const query of calls) {
    assert.equal(query.take, 1000);
    assert.equal(query.where.isBot, false);
    assert.equal(query.where.isDuplicate, false);
    assert.deepEqual(query.where.createdAt, { gte: from, lt: to });
  }
});
