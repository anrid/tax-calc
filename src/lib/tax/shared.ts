export function floorTo(value: number, unit: number): number {
  if (unit <= 0) return value;
  return Math.floor(value / unit) * unit;
}

export function ceilTo(value: number, unit: number): number {
  if (unit <= 0) return value;
  return Math.ceil(value / unit) * unit;
}

export function clampMin(value: number, min: number): number {
  return value < min ? min : value;
}

export function progressiveTax(
  taxableIncome: number,
  brackets: Array<{ upTo: number; rate: number }>
): number {
  let tax = 0;
  let lower = 0;

  for (const bracket of brackets) {
    if (taxableIncome <= lower) break;
    const upper = bracket.upTo;
    const taxedPortion = Math.min(taxableIncome, upper) - lower;
    tax += taxedPortion * bracket.rate;
    lower = upper;
  }

  return tax;
}
