const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./load-module.cjs');

test('recovers a committed delivery after enqueue fails, even outside its schedule window', async (t) => {
  t.mock.method(console, 'error', () => {});
  let row = null, available = false, due = true, creates = 0;
  const queued = new Set();
  const api = loadModule('src/modules/weekly-reports/weekly-report.scheduler.ts', {
    '../../lib/prisma.js': { prisma: {
      weeklyReportDelivery: {
        findMany: async () => row?.status === 'PENDING' ? [row] : [],
        create: async ({ data }) => {
          creates++;
          row = { ...data, id: 'delivery', business: { weeklyReportEnabled: true } };
          return row;
        },
      },
      business: { findMany: async () => [{ id: 'b', owner: { email: 'owner@example.com' } }] },
    } },
    '../../../generated/prisma/client.js': { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
    '../subscriptions/subscription.service.js': { subscriptionService: { getCurrentForBusiness: async () => ({ usable: true }) } },
    './weekly-report-time.util.js': { normalizeTimeZone: () => 'UTC', getDueScheduleKey: () => due ? '2026-09-14' : null },
    './weekly-report.queue.js': { enqueueWeeklyReportDelivery: async (id) => {
      if (!available) throw new Error('Redis unavailable');
      queued.add(id);
    } },
  });
  await api.scanWeeklyReports();
  assert.equal(row.status, 'PENDING');
  assert.equal(queued.size, 0);
  available = true;
  due = false;
  await api.scanWeeklyReports();
  await api.scanWeeklyReports();
  assert.deepEqual([...queued], ['delivery']);
  assert.equal(creates, 1);
  row.status = 'SENT';
  await api.scanWeeklyReports();
  assert.equal(queued.size, 1);
});

test('scan lock is released after database failure', async () => {
  let reads = 0;
  const api = loadModule('src/modules/weekly-reports/weekly-report.scheduler.ts', {
    '../../lib/prisma.js': { prisma: { weeklyReportDelivery: { findMany: async () => {
      reads++;
      throw new Error('database unavailable');
    } } } },
    '../../../generated/prisma/client.js': { Prisma: {} },
    '../subscriptions/subscription.service.js': { subscriptionService: {} },
    './weekly-report.queue.js': {},
  });
  await assert.rejects(api.scanWeeklyReports(), /database unavailable/);
  await assert.rejects(api.scanWeeklyReports(), /database unavailable/);
  assert.equal(reads, 2);
});
