import type { CountryResult } from '$lib/types';
import { clampMin, floorTo } from '$lib/tax/shared';

const NON_RESIDENT_WITHHOLDING_RATE = 0.2042;
const RECONSTRUCTION_SURTAX_RATE = 0.021;
const EMPLOYEE_SOCIAL_INSURANCE_RATE = 0.144;
const RESIDENT_TAX_RATE = 0.1;
const RESIDENT_PER_CAPITA_LEVY = 6_000;
const RESIDENT_BASIC_DEDUCTION = 430_000;

const BRACKETS = [
  { upTo: 1_949_000, rate: 0.05, quickDeduction: 0 },
  { upTo: 3_299_000, rate: 0.1, quickDeduction: 97_500 },
  { upTo: 6_949_000, rate: 0.2, quickDeduction: 427_500 },
  { upTo: 8_999_000, rate: 0.23, quickDeduction: 636_000 },
  { upTo: 17_999_000, rate: 0.33, quickDeduction: 1_536_000 },
  { upTo: 39_999_000, rate: 0.4, quickDeduction: 2_796_000 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.45, quickDeduction: 4_796_000 }
];

function employmentDeduction(salary: number): number {
  if (salary <= 1_900_000) return Math.min(salary, 650_000);
  if (salary <= 3_600_000) return salary * 0.3 + 80_000;
  if (salary <= 6_600_000) return salary * 0.2 + 440_000;
  if (salary <= 8_500_000) return salary * 0.1 + 1_100_000;
  return 1_950_000;
}

function basicDeduction2025(totalIncome: number): number {
  if (totalIncome <= 1_320_000) return 950_000;
  if (totalIncome <= 3_360_000) return 880_000;
  if (totalIncome <= 4_890_000) return 680_000;
  if (totalIncome <= 6_550_000) return 630_000;
  if (totalIncome <= 23_500_000) return 580_000;
  if (totalIncome <= 24_000_000) return 480_000;
  if (totalIncome <= 24_500_000) return 320_000;
  if (totalIncome <= 25_000_000) return 160_000;
  return 0;
}

function spouseDeduction(totalIncome: number, married: boolean, spouseHasIncome: boolean): number {
  if (!married || spouseHasIncome || totalIncome > 10_000_000) return 0;
  if (totalIncome <= 9_000_000) return 380_000;
  if (totalIncome <= 9_500_000) return 260_000;
  return 130_000;
}

export function calcJapan2025Employment(params: {
  annualSalaryJPY: number;
  married: boolean;
  spouseHasIncome: boolean;
  dependents: number;
  residencyMonths: number;
}): CountryResult {
  const gross = clampMin(params.annualSalaryJPY, 0);
  const isResident = params.residencyMonths >= 12;

  if (!isResident) {
    const incomeTax = floorTo(gross * NON_RESIDENT_WITHHOLDING_RATE, 100);
    const netAnnual = gross - incomeTax;
    return {
      country: 'JP',
      currency: 'JPY',
      residencyStatus: 'Non-resident (<12 months)',
      grossAnnualLocal: Math.round(gross),
      taxAnnualLocal: Math.round(incomeTax),
      residentTaxAnnualLocal: 0,
      employeeContribAnnualLocal: 0,
      netAnnualLocal: Math.round(netAnnual),
      netMonthlyLocal: Math.round(netAnnual / 12),
      effectiveRate: gross === 0 ? 0 : incomeTax / gross,
      breakdown: [
        { label: 'Non-resident withholding (20.42%)', amount: Math.round(incomeTax) }
      ],
      assumptions: [
        'Non-resident path uses flat 20.42% withholding from the provided Japan spec.',
        'Non-resident social insurance is not modeled in v1.'
      ]
    };
  }

  const socialInsurance = gross * EMPLOYEE_SOCIAL_INSURANCE_RATE;
  const employmentIncome = clampMin(gross - employmentDeduction(gross), 0);
  const basic = basicDeduction2025(employmentIncome);
  const spouse = spouseDeduction(employmentIncome, params.married, params.spouseHasIncome);
  const dependentDeduction = clampMin(Math.floor(params.dependents), 0) * 380_000;

  const totalDeductions = basic + spouse + dependentDeduction + socialInsurance;
  const taxable = floorTo(clampMin(employmentIncome - totalDeductions, 0), 1_000);

  let incomeTaxBeforeSurtax = 0;
  for (const bracket of BRACKETS) {
    if (taxable <= bracket.upTo) {
      incomeTaxBeforeSurtax = clampMin(taxable * bracket.rate - bracket.quickDeduction, 0);
      break;
    }
  }

  const reconstructionSurtax = Math.floor(incomeTaxBeforeSurtax * RECONSTRUCTION_SURTAX_RATE);
  const nationalIncomeTax = floorTo(incomeTaxBeforeSurtax + reconstructionSurtax, 100);

  const residentTaxBase = floorTo(
    clampMin(
      employmentIncome - (RESIDENT_BASIC_DEDUCTION + spouse + dependentDeduction + socialInsurance),
      0
    ),
    1_000
  );
  const residentTax = floorTo(residentTaxBase * RESIDENT_TAX_RATE + RESIDENT_PER_CAPITA_LEVY, 100);

  const incomeTax = nationalIncomeTax + residentTax;
  const netAnnual = gross - incomeTax - socialInsurance;

  return {
    country: 'JP',
    currency: 'JPY',
    residencyStatus: 'Resident (>=12 months)',
    grossAnnualLocal: Math.round(gross),
    taxAnnualLocal: Math.round(incomeTax),
    residentTaxAnnualLocal: Math.round(residentTax),
    employeeContribAnnualLocal: Math.round(socialInsurance),
    netAnnualLocal: Math.round(netAnnual),
    netMonthlyLocal: Math.round(netAnnual / 12),
    effectiveRate: gross === 0 ? 0 : (incomeTax + socialInsurance) / gross,
    breakdown: [
      { label: 'Employment income deduction', amount: Math.round(employmentDeduction(gross)) },
      { label: 'Basic deduction (2025)', amount: Math.round(basic) },
      { label: 'Spouse deduction', amount: Math.round(spouse) },
      { label: 'Dependent deduction', amount: Math.round(dependentDeduction) },
      { label: 'Employee social insurance (assumed 14.4%)', amount: Math.round(socialInsurance) },
      { label: 'Taxable income after deductions', amount: Math.round(taxable) },
      { label: 'National income tax incl. reconstruction surtax', amount: Math.round(nationalIncomeTax) },
      { label: 'Resident tax (10% + per-capita levy)', amount: Math.round(residentTax) }
    ],
    assumptions: [
      'Modeled for employment income only (2025 baseline).',
      'Employee social insurance is approximated as 14.4% of gross salary.',
      'Resident tax is modeled as 10% income levy plus a 6,000 JPY per-capita levy (approximation).'
    ]
  };
}
