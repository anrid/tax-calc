import { describe, expect, it } from 'vitest';
import { DEFAULT_FX_RATES } from '$lib/fx';
import { compareAllCountries } from '$lib/tax/compare';

const ALL_RESIDENCY_MONTHS = {
  JP: 12,
  SE: 12,
  TH: 12,
  CH: 12,
  UK: 12,
  USCA: 12,
  MY: 12,
  SG: 12,
  IN: 12
} as const;

describe('compareAllCountries', () => {
  it('returns all nine countries with stable order', () => {
    const result = compareAllCountries(
      {
        salaryAmount: 5_000_000,
        salaryPeriod: 'annual',
        inputCurrency: 'JPY',
        displayCurrency: 'JPY',
        married: false,
        spouseHasIncome: false,
        dependents: 0,
        age: 30,
        residencyMonths: { ...ALL_RESIDENCY_MONTHS }
      },
      DEFAULT_FX_RATES
    );

    expect(result.countries).toHaveLength(9);
    expect(result.countries.map((x) => x.country)).toEqual([
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

  it('normalizes monthly salary to annual before calculation', () => {
    const annual = compareAllCountries(
      {
        salaryAmount: 500_000,
        salaryPeriod: 'annual',
        inputCurrency: 'JPY',
        displayCurrency: 'JPY',
        married: false,
        spouseHasIncome: false,
        dependents: 0,
        age: 30,
        residencyMonths: { ...ALL_RESIDENCY_MONTHS }
      },
      DEFAULT_FX_RATES
    );

    const monthly = compareAllCountries(
      {
        salaryAmount: 500_000 / 12,
        salaryPeriod: 'monthly',
        inputCurrency: 'JPY',
        displayCurrency: 'JPY',
        married: false,
        spouseHasIncome: false,
        dependents: 0,
        age: 30,
        residencyMonths: { ...ALL_RESIDENCY_MONTHS }
      },
      DEFAULT_FX_RATES
    );

    expect(monthly.annualInputInEnteredCurrency).toBeCloseTo(annual.annualInputInEnteredCurrency, 6);
  });

  it('keeps local-country calculations independent of display currency', () => {
    const jpyDisplay = compareAllCountries(
      {
        salaryAmount: 1_000_000,
        salaryPeriod: 'annual',
        inputCurrency: 'JPY',
        displayCurrency: 'JPY',
        married: true,
        spouseHasIncome: false,
        dependents: 1,
        age: 35,
        residencyMonths: { ...ALL_RESIDENCY_MONTHS }
      },
      DEFAULT_FX_RATES
    );

    const sekDisplay = compareAllCountries(
      {
        salaryAmount: 1_000_000,
        salaryPeriod: 'annual',
        inputCurrency: 'JPY',
        displayCurrency: 'SEK',
        married: true,
        spouseHasIncome: false,
        dependents: 1,
        age: 35,
        residencyMonths: { ...ALL_RESIDENCY_MONTHS }
      },
      DEFAULT_FX_RATES
    );

    expect(sekDisplay.countries).toEqual(jpyDisplay.countries);
  });

  it('satisfies accounting identity and resident-tax relationship for every country', () => {
    const result = compareAllCountries(
      {
        salaryAmount: 5_000_000,
        salaryPeriod: 'annual',
        inputCurrency: 'JPY',
        displayCurrency: 'THB',
        married: true,
        spouseHasIncome: false,
        dependents: 2,
        age: 30,
        residencyMonths: { ...ALL_RESIDENCY_MONTHS }
      },
      DEFAULT_FX_RATES
    );

    for (const country of result.countries) {
      expect(country.netAnnualLocal).toBe(
        country.grossAnnualLocal - country.taxAnnualLocal - country.employeeContribAnnualLocal
      );
      if (country.country === 'SE') {
        expect(country.residentTaxAnnualLocal).toBeGreaterThanOrEqual(0);
      } else {
        expect(country.residentTaxAnnualLocal).toBeLessThanOrEqual(country.taxAnnualLocal);
      }
    }
  });
});
