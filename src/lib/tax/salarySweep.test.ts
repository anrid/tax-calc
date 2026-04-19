import { describe, expect, it } from 'vitest';
import { DEFAULT_FX_RATES } from '$lib/fx';
import { buildSalarySweep } from '$lib/tax/salarySweep';
import type { CalculatorInput } from '$lib/types';

const BASE_INPUT: CalculatorInput = {
  salaryAmount: 5_000_000,
  salaryPeriod: 'annual',
  inputCurrency: 'JPY',
  displayCurrency: 'JPY',
  married: false,
  spouseHasIncome: false,
  dependents: 0,
  age: 30,
  residencyMonths: {
    JP: 12,
    SE: 12,
    TH: 12,
    CH: 12,
    UK: 12,
    USCA: 12,
    MY: 12,
    SG: 12,
    IN: 12
  }
};

describe('buildSalarySweep', () => {
  it('builds inclusive 50k..600k annual USD points at 25k steps', () => {
    const sweep = buildSalarySweep(BASE_INPUT, 'USD', DEFAULT_FX_RATES);

    expect(sweep.series).toHaveLength(9);
    expect(sweep.series[0].points).toHaveLength(23);
    expect(sweep.series[0].points[0].annualUSD).toBe(50_000);
    expect(sweep.series[0].points.at(-1)?.annualUSD).toBe(600_000);
  });

  it('converts x-axis annual values into display currency', () => {
    const sweep = buildSalarySweep(BASE_INPUT, 'JPY', DEFAULT_FX_RATES);

    const firstTick = sweep.ticks.find((tick) => tick.annualUSD === 50_000);
    const lastTick = sweep.ticks.find((tick) => tick.annualUSD === 600_000);

    expect(firstTick?.annualDisplay).toBeCloseTo(7_500_000, 4);
    expect(lastTick?.annualDisplay).toBeCloseTo(90_000_000, 4);
  });

  it('keeps stable country series ordering', () => {
    const sweep = buildSalarySweep(BASE_INPUT, 'USD', DEFAULT_FX_RATES);

    expect(sweep.series.map((series) => series.country)).toEqual([
      'JP',
      'SE',
      'TH',
      'CH',
      'UK',
      'USCA',
      'MY',
      'SG',
      'IN'
    ]);
  });

  it('is invariant to input currency and salary period because sweep is USD annual based', () => {
    const a = buildSalarySweep(
      {
        ...BASE_INPUT,
        salaryAmount: 120_000,
        salaryPeriod: 'annual',
        inputCurrency: 'USD'
      },
      'USD',
      DEFAULT_FX_RATES
    );

    const b = buildSalarySweep(
      {
        ...BASE_INPUT,
        salaryAmount: 400_000,
        salaryPeriod: 'monthly',
        inputCurrency: 'JPY'
      },
      'USD',
      DEFAULT_FX_RATES
    );

    const normalize = (value: number) => Number(value.toFixed(4));

    const aShape = a.series.map((series) => {
      return series.points.map((point) => normalize(point.netMonthlyDisplay));
    });
    const bShape = b.series.map((series) => {
      return series.points.map((point) => normalize(point.netMonthlyDisplay));
    });

    expect(aShape).toEqual(bShape);
  });

  it('keeps Switzerland non-decreasing across the sweep range', () => {
    const sweep = buildSalarySweep(BASE_INPUT, 'JPY', DEFAULT_FX_RATES);
    const switzerland = sweep.series.find((series) => series.country === 'CH');

    expect(switzerland).toBeDefined();
    if (!switzerland) return;

    for (let index = 1; index < switzerland.points.length; index += 1) {
      expect(switzerland.points[index].netMonthlyDisplay).toBeGreaterThanOrEqual(
        switzerland.points[index - 1].netMonthlyDisplay
      );
    }

    const at250k = switzerland.points.find((point) => point.annualUSD === 250_000);
    const at600k = switzerland.points.find((point) => point.annualUSD === 600_000);

    expect(at250k).toBeDefined();
    expect(at600k).toBeDefined();
    expect(at600k?.netMonthlyDisplay ?? 0).toBeGreaterThan(at250k?.netMonthlyDisplay ?? 0);
  });
});
