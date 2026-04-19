import type { CountryResult } from '$lib/types';
import { clampMin, progressiveTax } from '$lib/tax/shared';

const PERSONAL_ALLOWANCE = 60_000;
const SPOUSE_ALLOWANCE = 60_000;
const DEPENDENT_ALLOWANCE = 30_000;
const SOCIAL_SECURITY_MAX = 9_000;

const BRACKETS = [
  { upTo: 150_000, rate: 0 },
  { upTo: 300_000, rate: 0.05 },
  { upTo: 500_000, rate: 0.1 },
  { upTo: 750_000, rate: 0.15 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: 2_000_000, rate: 0.25 },
  { upTo: 5_000_000, rate: 0.3 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.35 }
];

export function calcThailandEmployment(params: {
  annualSalaryTHB: number;
  married: boolean;
  spouseHasIncome: boolean;
  dependents: number;
  residencyMonths: number;
}): CountryResult {
  const gross = clampMin(params.annualSalaryTHB, 0);

  const socialSecurityContribution = Math.min(gross * 0.05, SOCIAL_SECURITY_MAX);
  const expenseDeduction = Math.min(gross * 0.5, 100_000);

  const spouseAllowance = params.married && !params.spouseHasIncome ? SPOUSE_ALLOWANCE : 0;
  const dependentAllowance = clampMin(Math.floor(params.dependents), 0) * DEPENDENT_ALLOWANCE;

  const totalAllowances =
    PERSONAL_ALLOWANCE + spouseAllowance + dependentAllowance + socialSecurityContribution;

  const taxableIncome = clampMin(gross - expenseDeduction - totalAllowances, 0);
  const taxMethod1 = progressiveTax(taxableIncome, BRACKETS);

  // Employment-only v1: no non-salary income, so method 2 is always 0.
  const taxMethod2 = 0;
  const incomeTax = taxMethod1;

  const netAnnual = gross - incomeTax - socialSecurityContribution;

  const residencyStatus =
    params.residencyMonths >= 6
      ? 'Resident (>=180 days proxy)'
      : 'Non-resident (<180 days proxy)';

  return {
    country: 'TH',
    currency: 'THB',
    residencyStatus,
    grossAnnualLocal: Math.round(gross),
    taxAnnualLocal: Math.round(incomeTax),
    residentTaxAnnualLocal: 0,
    employeeContribAnnualLocal: Math.round(socialSecurityContribution),
    netAnnualLocal: Math.round(netAnnual),
    netMonthlyLocal: Math.round(netAnnual / 12),
    effectiveRate: gross === 0 ? 0 : (incomeTax + socialSecurityContribution) / gross,
    breakdown: [
      { label: 'Expense deduction (50%, cap 100,000)', amount: Math.round(expenseDeduction) },
      { label: 'Personal allowance', amount: PERSONAL_ALLOWANCE },
      { label: 'Spouse allowance', amount: Math.round(spouseAllowance) },
      { label: 'Dependent allowance', amount: Math.round(dependentAllowance) },
      { label: 'Social security contribution (5%, cap 9,000)', amount: Math.round(socialSecurityContribution) },
      { label: 'Net taxable income', amount: Math.round(taxableIncome) },
      { label: 'Tax method 1', amount: Math.round(taxMethod1) },
      { label: 'Tax method 2', amount: Math.round(taxMethod2) }
    ],
    assumptions: [
      'Modeled for employment income only (2567/2024 baseline from provided spec).',
      'Dependent allowance is simplified to 30,000 THB per dependent in v1.',
      'Salary-only input means Thai method 2 (0.5% non-salary) is zero in v1.'
    ]
  };
}
