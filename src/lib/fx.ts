import type { Currency, FxRates } from '$lib/types';

export const DEFAULT_FX_RATES: FxRates = {
  // One unit of currency equals this many JPY.
  toJPY: {
    JPY: 1,
    SEK: 14.5,
    THB: 4.2,
    CHF: 170,
    GBP: 190,
    USD: 150,
    MYR: 33,
    SGD: 111,
    INR: 1.75
  },
  updatedAt: 'manual-default'
};

export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
  rates: FxRates
): number {
  if (!Number.isFinite(amount)) return 0;
  if (from === to) return amount;

  const fromToJPY = rates.toJPY[from];
  const toToJPY = rates.toJPY[to];
  if (!fromToJPY || !toToJPY) return 0;

  const amountInJPY = amount * fromToJPY;
  return amountInJPY / toToJPY;
}

export function normalizeAnnualSalary(amount: number, period: 'annual' | 'monthly'): number {
  const safe = Number.isFinite(amount) ? Math.max(amount, 0) : 0;
  return period === 'monthly' ? safe * 12 : safe;
}

export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}
