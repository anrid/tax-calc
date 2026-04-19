import type { CountryCode } from '$lib/types';
import type { SalarySweepRange, SalarySweepSeries } from '$lib/tax/salarySweep';

export interface SweepHoverRow {
  country: CountryCode;
  monthlyValue: number;
  deltaPercent: number;
  isBaseline: boolean;
}

export interface SweepHoverSummary {
  annualUSD: number;
  annualDisplay: number;
  baselineCountry: CountryCode;
  baselineValue: number;
  rows: SweepHoverRow[];
}

export function getNearestSweepIndex(range: SalarySweepRange, annualUSD: number): number {
  const span = range.maxAnnualUSD - range.minAnnualUSD;
  if (span <= 0 || range.stepAnnualUSD <= 0) return 0;

  const normalized = (annualUSD - range.minAnnualUSD) / range.stepAnnualUSD;
  const maxIndex = Math.round(span / range.stepAnnualUSD);
  return Math.max(0, Math.min(maxIndex, Math.round(normalized)));
}

export function buildSweepHoverSummary(
  visibleSeries: SalarySweepSeries[],
  pointIndex: number
): SweepHoverSummary | null {
  if (visibleSeries.length === 0) return null;

  const basePoint = visibleSeries[0].points[pointIndex];
  if (!basePoint) return null;

  const pointRows = visibleSeries
    .map((series) => {
      const point = series.points[pointIndex];
      if (!point) return null;
      return {
        country: series.country,
        monthlyValue: point.netMonthlyDisplay
      };
    })
    .filter((row): row is { country: CountryCode; monthlyValue: number } => row !== null);

  if (pointRows.length === 0) return null;

  let baseline = pointRows[0];
  for (const row of pointRows) {
    if (row.monthlyValue > baseline.monthlyValue) {
      baseline = row;
    }
  }

  const rows: SweepHoverRow[] = pointRows
    .slice()
    .sort((a, b) => b.monthlyValue - a.monthlyValue)
    .map((row) => {
      const deltaPercent =
        baseline.monthlyValue <= 0 ? 0 : ((row.monthlyValue / baseline.monthlyValue) - 1) * 100;

      return {
        country: row.country,
        monthlyValue: row.monthlyValue,
        deltaPercent,
        isBaseline: row.country === baseline.country
      };
    });

  return {
    annualUSD: basePoint.annualUSD,
    annualDisplay: basePoint.annualDisplay,
    baselineCountry: baseline.country,
    baselineValue: baseline.monthlyValue,
    rows
  };
}
