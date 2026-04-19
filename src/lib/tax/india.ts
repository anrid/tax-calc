import type { CountryResult } from '$lib/types';
import { clampMin, progressiveTax } from '$lib/tax/shared';

const STANDARD_DEDUCTION_NEW_REGIME = 75_000;
const SECTION_87A_REBATE_LIMIT = 1_200_000;
const SECTION_87A_REBATE_MAX = 60_000;
const HEALTH_EDUCATION_CESS_RATE = 0.04;

const EPF_EMPLOYEE_RATE_PROXY = 0.12;
const EPF_WAGE_CEILING_ANNUAL_PROXY = 180_000; // 15,000 monthly ceiling proxy.

const NEW_REGIME_BRACKETS_FY2025 = [
  { upTo: 400_000, rate: 0 },
  { upTo: 800_000, rate: 0.05 },
  { upTo: 1_200_000, rate: 0.1 },
  { upTo: 1_600_000, rate: 0.15 },
  { upTo: 2_000_000, rate: 0.2 },
  { upTo: 2_400_000, rate: 0.25 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.3 }
];

function surchargeRate(totalIncome: number): number {
  if (totalIncome > 20_000_000) return 0.25;
  if (totalIncome > 10_000_000) return 0.15;
  if (totalIncome > 5_000_000) return 0.1;
  return 0;
}

function section87ATaxAdjustment(taxableIncome: number, slabTax: number): number {
  if (taxableIncome <= SECTION_87A_REBATE_LIMIT) {
    return -Math.min(slabTax, SECTION_87A_REBATE_MAX);
  }

  // Marginal relief near the 12 lakh threshold.
  const cappedTax = Math.min(slabTax, taxableIncome - SECTION_87A_REBATE_LIMIT);
  return cappedTax - slabTax;
}

export function calcIndiaFY2025NewRegimeEmployment(params: {
  annualSalaryINR: number;
  residencyMonths: number;
}): CountryResult {
  const gross = clampMin(params.annualSalaryINR, 0);
  const isResident = params.residencyMonths >= 6;

  const epfEmployee = Math.min(gross, EPF_WAGE_CEILING_ANNUAL_PROXY) * EPF_EMPLOYEE_RATE_PROXY;
  const taxableIncome = clampMin(gross - STANDARD_DEDUCTION_NEW_REGIME, 0);

  const slabTaxBeforeRebate = progressiveTax(taxableIncome, NEW_REGIME_BRACKETS_FY2025);
  const rebateAdjustment = isResident ? section87ATaxAdjustment(taxableIncome, slabTaxBeforeRebate) : 0;
  const incomeTaxAfterRebate = clampMin(slabTaxBeforeRebate + rebateAdjustment, 0);

  const surcharge = incomeTaxAfterRebate * surchargeRate(taxableIncome);
  const cess = (incomeTaxAfterRebate + surcharge) * HEALTH_EDUCATION_CESS_RATE;
  const incomeTax = incomeTaxAfterRebate + surcharge + cess;

  const netAnnual = gross - incomeTax - epfEmployee;

  return {
    country: 'IN',
    currency: 'INR',
    residencyStatus: isResident
      ? 'Resident proxy (>=182 days)'
      : 'Non-resident proxy (<182 days, India-source salary assumption)',
    grossAnnualLocal: Math.round(gross),
    taxAnnualLocal: Math.round(incomeTax),
    residentTaxAnnualLocal: 0,
    employeeContribAnnualLocal: Math.round(epfEmployee),
    netAnnualLocal: Math.round(netAnnual),
    netMonthlyLocal: Math.round(netAnnual / 12),
    effectiveRate: gross === 0 ? 0 : (incomeTax + epfEmployee) / gross,
    breakdown: [
      { label: 'Standard deduction (new regime)', amount: STANDARD_DEDUCTION_NEW_REGIME },
      { label: 'Taxable income', amount: Math.round(taxableIncome) },
      { label: 'Slab tax before Section 87A', amount: Math.round(slabTaxBeforeRebate) },
      { label: 'Section 87A / marginal-relief adjustment', amount: Math.round(rebateAdjustment) },
      { label: 'Surcharge', amount: Math.round(surcharge) },
      { label: 'Health and education cess (4%)', amount: Math.round(cess) },
      { label: 'EPF employee contribution (proxy)', amount: Math.round(epfEmployee) }
    ],
    assumptions: [
      'Modeled for FY 2025-26 / AY 2026-27 employment income under the new regime only.',
      'Residency uses a >=6 months proxy for the statutory 182-day framework.',
      'Section 87A rebate and marginal relief are applied only in the resident proxy path.',
      'Capital gains, old-regime deductions, and surcharge marginal relief at higher thresholds are not modeled in this employment-core version.',
      'EPF employee contribution is a capped proxy using the statutory wage ceiling reference.'
    ]
  };
}
