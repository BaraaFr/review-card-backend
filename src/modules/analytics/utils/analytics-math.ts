export function calculatePercentage(
  value:
    number,

  total:
    number
) {
  if (
    total ===
    0
  ) {
    return 0;
  }

  return Math.round(
    (
      value /
      total
    ) *
      1000
  ) /
    10;
}

function growthRatio(
  current:
    number,

  previous:
    number
):
  number |
  null {
  /*
   * 0 → 0 = no change.
   */
  if (
    previous ===
    0
  ) {
    return current ===
      0
      ? 0
      : null;
  }

  return (
    current -
    previous
  ) /
    previous;
}

/*
 * Standard one-decimal percentage change.
 */
export function calculateChangePercentage(
  current:
    number,

  previous:
    number
):
  number |
  null {
  const ratio =
    growthRatio(
      current,
      previous
    );

  if (
    ratio ===
    null
  ) {
    return null;
  }

  return Math.round(
    ratio *
      1000
  ) /
    10;
}

/*
 * Engagement endpoint currently uses
 * one decimal too.
 */
export function calculateEngagementChangePercentage(
  current:
    number,

  previous:
    number
):
  number |
  null {
  return calculateChangePercentage(
    current,
    previous
  );
}

/*
 * Keep overview's 2-decimal display precision,
 * but fix the old 0 -> 0 behavior.
 */
export function calculateOverviewChangePercentage(
  current:
    number,

  previous:
    number
): number | null {
  const ratio =
    growthRatio(
      current,
      previous
    );

  if (
    ratio ===
    null
  ) {
    return null;
  }

  return Number(
    (
      ratio *
      100
    ).toFixed(
      2
    )
  );
}