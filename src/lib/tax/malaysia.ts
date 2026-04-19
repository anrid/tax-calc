import type { CountryResult } from '$lib/types';
import { clampMin, progressiveTax } from '$lib/tax/shared';

const RESIDENT_RELIEF_SELF = 9_000;
const RESIDENT_RELIEF_SPOUSE = 4_000;
const RESIDENT_RELIEF_PER_DEPENDENT = 2_000;
const RESIDENT_RELIEF_EPF_CAP = 4_000;
const RESIDENT_RELIEF_SOCSO_CAP = 350;
const RESIDENT_TAX_REBATE_INCOME_LIMIT = 35_000;
const RESIDENT_TAX_REBATE_AMOUNT = 400;

const NON_RESIDENT_EMPLOYMENT_RATE = 0.30;

const EPF_EMPLOYEE_RATE_UNDER_60 = 0.11;
const SOCSO_EMPLOYEE_RATE = 0.005;
const EIS_EMPLOYEE_RATE = 0.002;
const SOCSO_EIS_WAGE_CAP_ANNUAL = 72_000; // RM6,000 monthly cap proxy.

const RESIDENT_BRACKETS = [
  { upTo: 5_000, rate: 0 },
  { upTo: 20_000, rate: 0.01 },
  { upTo: 35_000, rate: 0.03 },
  { upTo: 50_000, rate: 0.06 },
  { upTo: 70_000, rate: 0.11 },
  { upTo: 100_000, rate: 0.19 },
  { upTo: 400_000, rate: 0.25 },
  { upTo: 600_000, rate: 0.26 },
  { upTo: 2_000_000, rate: 0.28 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.30 }
];

function employeeContributions(gross: number, age: number): {
  epf: number;
  socso: number;
  eis: number;
  total: number;
} {
  const epf = age < 60 ? gross * EPF_EMPLOYEE_RATE_UNDER_60 : 0;
  const socso = Math.min(gross, SOCSO_EIS_WAGE_CAP_ANNUAL) * SOCSO_EMPLOYEE_RATE;
  const eis = age < 60 ? Math.min(gross, SOCSO_EIS_WAGE_CAP_ANNUAL) * EIS_EMPLOYEE_RATE : 0;

  return {
    epf,
    socso,
    eis,
    total: epf + socso + eis
  };
}

export function calcMalaysiaYA2025Employment(params: {
  annualSalaryMYR: number;
  married: boolean;
  spouseHasIncome: boolean;
  dependents: number;
  age: number;
  residencyMonths: number;
}): CountryResult {
  const gross = clampMin(params.annualSalaryMYR, 0);
  const isResident = params.residencyMonths >= 6;
  const dependents = clampMin(Math.floor(params.dependents), 0);

  const contributions = employeeContributions(gross, params.age);

  if (!isResident) {
    const incomeTax = gross * NON_RESIDENT_EMPLOYMENT_RATE;
    const grossRounded = Math.round(gross);
    const taxRounded = Math.round(incomeTax);
    const contribRounded = Math.round(contributions.total);
    const netAnnualRounded = grossRounded - taxRounded - contribRounded;

    return {
      country: 'MY',
      currency: 'MYR',
      residencyStatus: 'Non-resident proxy (<182 days)',
      grossAnnualLocal: grossRounded,
      taxAnnualLocal: taxRounded,
      residentTaxAnnualLocal: 0,
      employeeContribAnnualLocal: contribRounded,
      netAnnualLocal: netAnnualRounded,
      netMonthlyLocal: Math.round(netAnnualRounded / 12),
      effectiveRate: gross === 0 ? 0 : (incomeTax + contributions.total) / gross,
      breakdown: [
        { label: 'Non-resident employment tax (30%)', amount: Math.round(incomeTax) },
        { label: 'EPF employee contribution (proxy)', amount: Math.round(contributions.epf) },
        { label: 'SOCSO employee contribution (proxy)', amount: Math.round(contributions.socso) },
        { label: 'EIS employee contribution (proxy)', amount: Math.round(contributions.eis) }
      ],
      assumptions: [
        'Non-resident path uses a flat 30% employment tax proxy from LHDN non-resident guidance.',
        'No resident reliefs/rebates are applied for non-residents.',
        'SOCSO/EIS are approximated using percentage proxies with the RM6,000 monthly wage cap.'
      ]
    };
  }

  const spouseRelief = params.married && !params.spouseHasIncome ? RESIDENT_RELIEF_SPOUSE : 0;
  const dependentRelief = dependents * RESIDENT_RELIEF_PER_DEPENDENT;
  const epfRelief = Math.min(contributions.epf, RESIDENT_RELIEF_EPF_CAP);
  const socsoRelief = Math.min(contributions.socso, RESIDENT_RELIEF_SOCSO_CAP);

  const totalReliefs =
    RESIDENT_RELIEF_SELF + spouseRelief + dependentRelief + epfRelief + socsoRelief;
  const chargeableIncome = clampMin(gross - totalReliefs, 0);

  const residentTaxBeforeRebate = progressiveTax(chargeableIncome, RESIDENT_BRACKETS);
  const residentRebate =
    chargeableIncome <= RESIDENT_TAX_REBATE_INCOME_LIMIT ? RESIDENT_TAX_REBATE_AMOUNT : 0;
  const incomeTax = clampMin(residentTaxBeforeRebate - residentRebate, 0);
  const grossRounded = Math.round(gross);
  const taxRounded = Math.round(incomeTax);
  const contribRounded = Math.round(contributions.total);
  const netAnnualRounded = grossRounded - taxRounded - contribRounded;

  return {
    country: 'MY',
    currency: 'MYR',
    residencyStatus: 'Resident proxy (>=182 days)',
    grossAnnualLocal: grossRounded,
    taxAnnualLocal: taxRounded,
    residentTaxAnnualLocal: 0,
    employeeContribAnnualLocal: contribRounded,
    netAnnualLocal: netAnnualRounded,
    netMonthlyLocal: Math.round(netAnnualRounded / 12),
    effectiveRate: gross === 0 ? 0 : (incomeTax + contributions.total) / gross,
    breakdown: [
      { label: 'Self relief', amount: RESIDENT_RELIEF_SELF },
      { label: 'Spouse relief', amount: Math.round(spouseRelief) },
      { label: 'Dependent relief', amount: Math.round(dependentRelief) },
      { label: 'EPF relief (capped)', amount: Math.round(epfRelief) },
      { label: 'SOCSO relief (capped)', amount: Math.round(socsoRelief) },
      { label: 'Chargeable income', amount: Math.round(chargeableIncome) },
      { label: 'Resident tax before rebate', amount: Math.round(residentTaxBeforeRebate) },
      { label: 'Resident rebate', amount: -Math.round(residentRebate) },
      { label: 'EPF employee contribution (proxy)', amount: Math.round(contributions.epf) },
      { label: 'SOCSO employee contribution (proxy)', amount: Math.round(contributions.socso) },
      { label: 'EIS employee contribution (proxy)', amount: Math.round(contributions.eis) }
    ],
    assumptions: [
      'Modeled for employment income only (YA 2025 baseline).',
      'Residency uses a >=6 months proxy for the statutory 182-day test.',
      'Resident relief modeling is intentionally narrow: self, spouse, dependents, EPF and SOCSO only.',
      'SOCSO/EIS use percentage-and-cap proxies; official schedules are wage-band tables and can differ slightly.'
    ]
  };
}
