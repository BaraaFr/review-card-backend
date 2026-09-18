const test =
  require(
    "node:test"
  );

const assert =
  require(
    "node:assert/strict"
  );

const {
  loadModule,
} =
  require(
    "./load-module.cjs"
  );

const math =
  loadModule(
    "src/modules/analytics/utils/analytics-math.ts"
  );

test(
  "analytics percentages handle zero, growth, decline and rounding correctly",
  () => {
    assert.equal(
      math.calculatePercentage(
        0,
        0
      ),
      0
    );

    assert.equal(
      math.calculatePercentage(
        1,
        3
      ),
      33.3
    );

    assert.equal(
      math.calculateChangePercentage(
        0,
        0
      ),
      0
    );

    assert.equal(
      math.calculateChangePercentage(
        10,
        0
      ),
      null
    );

    assert.equal(
      math.calculateChangePercentage(
        120,
        100
      ),
      20
    );

    assert.equal(
      math.calculateChangePercentage(
        80,
        100
      ),
      -20
    );

    assert.equal(
      math.calculateChangePercentage(
        4,
        3
      ),
      33.3
    );

    assert.equal(
      math.calculateOverviewChangePercentage(
        0,
        0
      ),
      0
    );

    assert.equal(
      math.calculateOverviewChangePercentage(
        10,
        0
      ),
      null
    );

    assert.equal(
      math.calculateOverviewChangePercentage(
        4,
        3
      ),
      33.33
    );
  }
);