import { convertCurrency } from '$lib/fx';
import { compareAllCountries } from '$lib/tax/compare';
import type { CalculatorInput, CountryCode, Currency, FxRates } from '$lib/types';

export interface SalarySweepRange {
  minAnnualUSD: number;
  maxAnnualUSD: number;
  stepAnnualUSD: number;
}

export interface SalarySweepPoint {
  annualUSD: number;
  annualDisplay: number;
  netMonthlyDisplay: number;
}

export interface SalarySweepSeries {
  country: CountryCode;
  points: SalarySweepPoint[];
}

export interface SalarySweepTick {
  annualUSD: number;
  annualDisplay: number;
}

export interface SalarySweepResult {
  range: SalarySweepRange;
  ticks: SalarySweepTick[];
  series: SalarySweepSeries[];
}

export const DEFAULT_SALARY_SWEEP_RANGE: SalarySweepRange = {
  minAnnualUSD: 50_000,
  maxAnnualUSD: 600_000,
  stepAnnualUSD: 25_000
};

function enumerateAnnualUsd(range: SalarySweepRange): number[] {
  const values: number[] = [];
  for (let annualUSD = range.minAnnualUSD; annualUSD <= range.maxAnnualUSD; annualUSD += range.stepAnnualUSD) {
    values.push(annualUSD);
  }
  return values;
}

function createTicks(displayCurrency: Currency, fxRates: FxRates): SalarySweepTick[] {
  const tickUsdValues = [50_000, 150_000, 250_000, 350_000, 450_000, 550_000, 600_000];
  return tickUsdValues.map((annualUSD) => ({
    annualUSD,
    annualDisplay: convertCurrency(annualUSD, 'USD', displayCurrency, fxRates)
  }));
}

export function buildSalarySweep(
  input: CalculatorInput,
  displayCurrency: Currency,
  fxRates: FxRates,
  range: SalarySweepRange = DEFAULT_SALARY_SWEEP_RANGE
): SalarySweepResult {
  const annualUsdValues = enumerateAnnualUsd(range);
  const seriesMap = new Map<CountryCode, SalarySweepSeries>();
  let countryOrder: CountryCode[] = [];

  for (const annualUSD of annualUsdValues) {
    const comparison = compareAllCountries(
      {
        ...input,
        salaryAmount: annualUSD,
        salaryPeriod: 'annual',
        inputCurrency: 'USD',
        displayCurrency
      },
      fxRates
    );

    if (countryOrder.length === 0) {
      countryOrder = comparison.countries.map((country) => country.country);
      for (const country of countryOrder) {
        seriesMap.set(country, {
          country,
          points: []
        });
      }
    }

    const annualDisplay = convertCurrency(annualUSD, 'USD', displayCurrency, fxRates);

    for (const countryResult of comparison.countries) {
      const series = seriesMap.get(countryResult.country);
      if (!series) continue;

      series.points.push({
        annualUSD,
        annualDisplay,
        netMonthlyDisplay: convertCurrency(
          countryResult.netMonthlyLocal,
          countryResult.currency,
          displayCurrency,
          fxRates
        )
      });
    }
  }

  return {
    range,
    ticks: createTicks(displayCurrency, fxRates),
    series: countryOrder.map((country) => {
      return seriesMap.get(country) as SalarySweepSeries;
    })
  };
}
