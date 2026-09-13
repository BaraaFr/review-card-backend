const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { loadModule } = require('../load-module.cjs');

test('Express starts and serves health plus JSON request/server errors', async (t) => {
  t.mock.method(console, 'error', () => {});
  const routes = express.Router();
  routes.get('/failure', (_req, _res, next) => next(new Error('private diagnostic')));
  const app = loadModule('src/app.ts', {
    './config/env.js': { env: { FRONTEND_URL: 'http://localhost:3000' } },
    './routes/index.js': routes,
    './modules/redirect/redirect.routes.js': express.Router(),
    './modules/weekly-reports/weekly-report.scheduler.js': { startWeeklyReportScheduler() {} },
    './modules/weekly-reports/weekly-report.worker.js': { startWeeklyReportWorker() {} },
    './modules/queues/queue-dashboard.js': { queueDashboardAdapter: { getRouter: () => express.Router() } },
    './middleware/auth.middleware.js': { authenticate: (_req, _res, next) => next() },
  }).default;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).success, true);
  const invalid = await fetch(`${base}/api/failure`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'INVALID_REQUEST');
  const failed = await fetch(`${base}/api/failure`);
  assert.equal(failed.status, 500);
  assert.equal((await failed.json()).code, 'INTERNAL_SERVER_ERROR');
});
