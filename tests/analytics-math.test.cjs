const test = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('./load-module.cjs');
const math = loadModule('src/modules/analytics/analytics-math.ts');

test('percentage rules preserve empty periods, declines, growth and API rounding', () => {
  for (const [current, previous, expected] of [[0, 0, 0], [10, 0, null], [120, 100, 20], [80, 100, -20], [4, 3, 33.3]]) {
    assert.equal(math.calculateChangePercentage(current, previous), expected);
    assert.equal(math.calculateEngagementChangePercentage(current, previous), expected);
  }
  assert.equal(math.calculatePercentage(0, 0), 0);
  assert.equal(math.calculatePercentage(1, 3), 33.3);
  assert.equal(math.calculateOverviewChangePercentage(0, 0), null);
  assert.equal(math.calculateOverviewChangePercentage(4, 3), 33.33);
});
