import type { CountryResult } from '$lib/types';
import { clampMin, progressiveTax } from '$lib/tax/shared';

const NON_RESIDENT_EMPLOYMENT_FLAT_RATE = 0.15;
const CPF_OW_CEILING_ANNUAL_2025 = 88_800; // 7,400 x 12.

const RESIDENT_BRACKETS = [
  { upTo: 20_000, rate: 0 },
  { upTo: 30_000, rate: 0.02 },
  { upTo: 40_000, rate: 0.035 },
  { upTo: 80_000, rate: 0.07 },
  { upTo: 120_000, rate: 0.115 },
  { upTo: 160_000, rate: 0.15 },
  { upTo: 200_000, rate: 0.18 },
  { upTo: 240_000, rate: 0.19 },
  { upTo: 280_000, rate: 0.195 },
  { upTo: 320_000, rate: 0.2 },
  { upTo: 500_000, rate: 0.22 },
  { upTo: 1_000_000, rate: 0.23 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.24 }
];

function cpfEmployeeRateByAge(age: number): number {
  if (age <= 55) return 0.2;
  if (age <= 60) return 0.17;
  if (age <= 65) return 0.115;
  if (age <= 70) return 0.075;
  return 0.05;
}

function earnedIncomeRelief(age: number): number {
  if (age < 55) return 1_000;
  if (age < 60) return 6_000;
  return 8_000;
}

export function calcSingaporeYA2026Employment(params: {
  annualSalarySGD: number;
  age: number;
  residencyMonths: number;
}): CountryResult {
  const gross = clampMin(params.annualSalarySGD, 0);
  const isResident = params.residencyMonths >= 6;

  if (!isResident) {
    const flatTax = gross * NON_RESIDENT_EMPLOYMENT_FLAT_RATE;
    const residentScaleOnGross = progressiveTax(gross, RESIDENT_BRACKETS);
    const incomeTax = Math.max(flatTax, residentScaleOnGross);
    const netAnnual = gross - incomeTax;

    return {
      country: 'SG',
      currency: 'SGD',
      residencyStatus: 'Non-resident proxy (<183 days)',
      grossAnnualLocal: Math.round(gross),
      taxAnnualLocal: Math.round(incomeTax),
      residentTaxAnnualLocal: 0,
      employeeContribAnnualLocal: 0,
      netAnnualLocal: Math.round(netAnnual),
      netMonthlyLocal: Math.round(netAnnual / 12),
      effectiveRate: gross === 0 ? 0 : incomeTax / gross,
      breakdown: [
        { label: 'Non-resident flat employment tax (15%)', amount: Math.round(flatTax) },
        {
          label: 'Resident progressive tax comparator on gross',
          amount: Math.round(residentScaleOnGross)
        },
        { label: 'Tax used (higher of the two)', amount: Math.round(incomeTax) }
      ],
      assumptions: [
        'Non-resident employment tax follows IRAS rule: higher of 15% flat or resident progressive computation.',
        'No personal reliefs or CPF deduction is applied in the non-resident proxy path.'
      ]
    };
  }

  const cpfRate = cpfEmployeeRateByAge(params.age);
  const cpfEmployee = Math.min(gross, CPF_OW_CEILING_ANNUAL_2025) * cpfRate;
  const earnedRelief = earnedIncomeRelief(params.age);

  const chargeableIncome = clampMin(gross - earnedRelief - cpfEmployee, 0);
  const incomeTax = progressiveTax(chargeableIncome, RESIDENT_BRACKETS);

  const netAnnual = gross - incomeTax - cpfEmployee;

  return {
    country: 'SG',
    currency: 'SGD',
    residencyStatus: 'Tax resident proxy (>=183 days)',
    grossAnnualLocal: Math.round(gross),
    taxAnnualLocal: Math.round(incomeTax),
    residentTaxAnnualLocal: 0,
    employeeContribAnnualLocal: Math.round(cpfEmployee),
    netAnnualLocal: Math.round(netAnnual),
    netMonthlyLocal: Math.round(netAnnual / 12),
    effectiveRate: gross === 0 ? 0 : (incomeTax + cpfEmployee) / gross,
    breakdown: [
      { label: 'Earned income relief', amount: Math.round(earnedRelief) },
      { label: 'CPF employee contribution (proxy)', amount: Math.round(cpfEmployee) },
      { label: 'Chargeable income', amount: Math.round(chargeableIncome) },
      { label: 'Income tax before rebate', amount: Math.round(incomeTax) }
    ],
    assumptions: [
      'Modeled for employment income only (YA 2026 baseline using resident rate table from YA 2024 onwards).',
      'CPF contribution is approximated using OW-ceiling logic and age-band employee rates for SC/SPR workers.',
      'No additional reliefs beyond earned income relief and CPF relief are modeled in this employment-core path.',
      'No YA 2026 personal income tax rebate is applied unless IRAS publishes one for YA 2026.'
    ]
  };
}
