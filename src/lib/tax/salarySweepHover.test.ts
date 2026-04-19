import { describe, expect, it } from 'vitest';
import { buildSweepHoverSummary, getNearestSweepIndex } from '$lib/tax/salarySweepHover';
import type { SalarySweepRange, SalarySweepSeries } from '$lib/tax/salarySweep';

const RANGE: SalarySweepRange = {
  minAnnualUSD: 50_000,
  maxAnnualUSD: 600_000,
  stepAnnualUSD: 25_000
};

const SERIES: SalarySweepSeries[] = [
  {
    country: 'SG',
    points: [
      { annualUSD: 250_000, annualDisplay: 250_000, netMonthlyDisplay: 5_000 },
      { annualUSD: 275_000, annualDisplay: 275_000, netMonthlyDisplay: 5_300 }
    ]
  },
  {
    country: 'JP',
    points: [
      { annualUSD: 250_000, annualDisplay: 250_000, netMonthlyDisplay: 4_500 },
      { annualUSD: 275_000, annualDisplay: 275_000, netMonthlyDisplay: 4_700 }
    ]
  },
  {
    country: 'CH',
    points: [
      { annualUSD: 250_000, annualDisplay: 250_000, netMonthlyDisplay: 4_000 },
      { annualUSD: 275_000, annualDisplay: 275_000, netMonthlyDisplay: 4_300 }
    ]
  }
];

describe('getNearestSweepIndex', () => {
  it('clamps to sweep bounds and rounds to the nearest point', () => {
    expect(getNearestSweepIndex(RANGE, 40_000)).toBe(0);
    expect(getNearestSweepIndex(RANGE, 62_000)).toBe(0);
    expect(getNearestSweepIndex(RANGE, 63_000)).toBe(1);
    expect(getNearestSweepIndex(RANGE, 610_000)).toBe(22);
  });
});

describe('buildSweepHoverSummary', () => {
  it('returns sorted rows and baseline deltas at a point index', () => {
    const summary = buildSweepHoverSummary(SERIES, 0);

    expect(summary).toBeTruthy();
    if (!summary) return;

    expect(summary.baselineCountry).toBe('SG');
    expect(summary.rows.map((row) => row.country)).toEqual(['SG', 'JP', 'CH']);
    expect(summary.rows[0].deltaPercent).toBeCloseTo(0, 6);
    expect(summary.rows[1].deltaPercent).toBeCloseTo(-10, 6);
    expect(summary.rows[2].deltaPercent).toBeCloseTo(-20, 6);
  });

  it('uses the highest visible country as baseline', () => {
    const summary = buildSweepHoverSummary([SERIES[1], SERIES[2]], 0);

    expect(summary).toBeTruthy();
    if (!summary) return;

    expect(summary.baselineCountry).toBe('JP');
    expect(summary.rows[0].country).toBe('JP');
    expect(summary.rows[1].country).toBe('CH');
  });

  it('returns null when the point index is not available', () => {
    expect(buildSweepHoverSummary(SERIES, 9)).toBeNull();
  });
});
