import { convertCurrency, normalizeAnnualSalary } from '$lib/fx';
import { calcJapan2025Employment } from '$lib/tax/japan';
import { calcMalaysiaYA2025Employment } from '$lib/tax/malaysia';
import { calcIndiaFY2025NewRegimeEmployment } from '$lib/tax/india';
import { calcSingaporeYA2026Employment } from '$lib/tax/singapore';
import { calcSweden2025Employment } from '$lib/tax/sweden';
import { calcSwitzerland2025ZurichEstimate } from '$lib/tax/switzerland';
import { calcThailandEmployment } from '$lib/tax/thailand';
import { calcUK2025Employment } from '$lib/tax/uk';
import { calcUSCalifornia2025Employment } from '$lib/tax/usCalifornia';
import type { CalculatorInput, ComparisonResult, CountryResult, Currency, FxRates } from '$lib/types';

export const COUNTRY_CURRENCY: Record<CountryResult['country'], Currency> = {
  JP: 'JPY',
  SE: 'SEK',
  TH: 'THB',
  CH: 'CHF',
  UK: 'GBP',
  USCA: 'USD',
  MY: 'MYR',
  SG: 'SGD',
  IN: 'INR'
};

export function compareAllCountries(input: CalculatorInput, fxRates: FxRates): ComparisonResult {
  const annualInInputCurrency = normalizeAnnualSalary(input.salaryAmount, input.salaryPeriod);

  const salaryJPY = convertCurrency(annualInInputCurrency, input.inputCurrency, 'JPY', fxRates);
  const salarySEK = convertCurrency(annualInInputCurrency, input.inputCurrency, 'SEK', fxRates);
  const salaryTHB = convertCurrency(annualInInputCurrency, input.inputCurrency, 'THB', fxRates);
  const salaryCHF = convertCurrency(annualInInputCurrency, input.inputCurrency, 'CHF', fxRates);
  const salaryGBP = convertCurrency(annualInInputCurrency, input.inputCurrency, 'GBP', fxRates);
  const salaryUSD = convertCurrency(annualInInputCurrency, input.inputCurrency, 'USD', fxRates);
  const salaryMYR = convertCurrency(annualInInputCurrency, input.inputCurrency, 'MYR', fxRates);
  const salarySGD = convertCurrency(annualInInputCurrency, input.inputCurrency, 'SGD', fxRates);
  const salaryINR = convertCurrency(annualInInputCurrency, input.inputCurrency, 'INR', fxRates);

  const countries: CountryResult[] = [
    calcJapan2025Employment({
      annualSalaryJPY: salaryJPY,
      married: input.married,
      spouseHasIncome: input.spouseHasIncome,
      dependents: input.dependents,
      residencyMonths: input.residencyMonths.JP
    }),
    calcSweden2025Employment({
      annualSalarySEK: salarySEK,
      age: input.age,
      residencyMonths: input.residencyMonths.SE
    }),
    calcThailandEmployment({
      annualSalaryTHB: salaryTHB,
      married: input.married,
      spouseHasIncome: input.spouseHasIncome,
      dependents: input.dependents,
      residencyMonths: input.residencyMonths.TH
    }),
    calcSwitzerland2025ZurichEstimate({
      annualSalaryCHF: salaryCHF,
      married: input.married,
      spouseHasIncome: input.spouseHasIncome,
      dependents: input.dependents,
      age: input.age,
      residencyMonths: input.residencyMonths.CH
    }),
    calcUK2025Employment({
      annualSalaryGBP: salaryGBP,
      married: input.married,
      spouseHasIncome: input.spouseHasIncome,
      dependents: input.dependents,
      residencyMonths: input.residencyMonths.UK
    }),
    calcUSCalifornia2025Employment({
      annualSalaryUSD: salaryUSD,
      married: input.married,
      spouseHasIncome: input.spouseHasIncome,
      dependents: input.dependents,
      residencyMonths: input.residencyMonths.USCA
    }),
    calcMalaysiaYA2025Employment({
      annualSalaryMYR: salaryMYR,
      married: input.married,
      spouseHasIncome: input.spouseHasIncome,
      dependents: input.dependents,
      age: input.age,
      residencyMonths: input.residencyMonths.MY
    }),
    calcSingaporeYA2026Employment({
      annualSalarySGD: salarySGD,
      age: input.age,
      residencyMonths: input.residencyMonths.SG
    }),
    calcIndiaFY2025NewRegimeEmployment({
      annualSalaryINR: salaryINR,
      residencyMonths: input.residencyMonths.IN
    })
  ];

  return {
    annualInputInEnteredCurrency: annualInInputCurrency,
    displayCurrency: input.displayCurrency,
    countries
  };
}
