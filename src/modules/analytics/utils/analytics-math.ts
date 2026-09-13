export function calculatePercentage(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 1000) / 10;
}

function growthRatio(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

export function calculateChangePercentage(current: number, previous: number): number | null {
  const ratio = growthRatio(current, previous);
  return ratio === null ? null : Math.round(ratio * 1000) / 10;
}

// Preserve the engagement endpoint's floating-point operation order.
export function calculateEngagementChangePercentage(current: number, previous: number): number | null {
  const ratio = growthRatio(current, previous);
  return ratio === null ? null : Math.round((ratio * 100) * 10) / 10;
}

// Overview has a distinct, existing API contract: two decimals and null
// whenever the comparison period is empty. Do not change it in a refactor.
export function calculateOverviewChangePercentage(current: number, previous: number): number | null {
  const ratio = growthRatio(current, previous);
  return previous === 0 || ratio === null ? null : Number((ratio * 100).toFixed(2));
}
