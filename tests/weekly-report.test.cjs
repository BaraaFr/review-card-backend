const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./load-module.cjs');
const { now, database } = require('./weekly-report-fixture.cjs');

for (const empty of [false, true]) {
  test(`weekly report preserves ${empty ? 'empty' : 'populated'} output including timezone, rankings and warnings`, async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now });
    const api = loadModule('src/modules/weekly-reports/business-weekly-report.service.ts', {
      '../../lib/prisma.js': { prisma: database(empty) },
    });
    const actual = await api.getBusinessWeeklyReport('b1', 'Asia/Beirut');
    const expected = require(`./fixtures/weekly-report${empty ? '-empty' : ''}.json`);
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
  });
}
