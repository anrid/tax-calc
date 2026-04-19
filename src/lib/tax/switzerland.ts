import type { CountryResult } from '$lib/types';
import { clampMin, floorTo } from '$lib/tax/shared';

const FEDERAL_CHILD_TAX_DEDUCTION = 263;
const FEDERAL_MARRIED_TARIFF_THRESHOLD = 32_900;

const AHV_IV_EO_RATE_EMPLOYEE = 0.053;
const ALV_RATE_EMPLOYEE = 0.011;
const ALV_SOLIDARITY_RATE_EMPLOYEE = 0.005;
const ALV_SALARY_CAP = 148_200;
const NBU_RATE_ESTIMATE = 0.015;

const BVG_ENTRY_THRESHOLD = 22_680;
const BVG_COORDINATION_DEDUCTION = 26_460;
const BVG_MAX_INSURED_SALARY = 64_260;

const PROFESSIONAL_EXPENSE_RATE = 0.03;
const PROFESSIONAL_EXPENSE_MIN = 2_000;
const PROFESSIONAL_EXPENSE_MAX = 4_000;
const PILLAR_3A_WITH_PILLAR_2 = 7_258;
const HEALTH_INSURANCE_DEDUCTION_SINGLE = 1_900;
const HEALTH_INSURANCE_DEDUCTION_MARRIED = 3_800;
const HEALTH_INSURANCE_DEDUCTION_PER_DEPENDENT = 700;

// Zurich-style approximation layers.
const CANTONAL_MULTIPLIER = 3.5;
const MUNICIPAL_MULTIPLIER = 1.19;

type SwissTariff = 'single' | 'married';

function bvgEmployeeRateByAge(age: number): number {
  if (age < 25) return 0;
  if (age <= 34) return 0.035;
  if (age <= 44) return 0.05;
  if (age <= 54) return 0.075;
  return 0.09;
}

function professionalExpenseDeduction(gross: number): number {
  if (gross <= 0) return 0;
  return Math.min(Math.max(gross * PROFESSIONAL_EXPENSE_RATE, PROFESSIONAL_EXPENSE_MIN), PROFESSIONAL_EXPENSE_MAX);
}

function federalTaxSingle2025(income: number): number {
  if (income <= 18_400) return 0;
  if (income <= 33_200) return (income - 18_400) * 0.0077;
  if (income <= 43_500) return 139 + (income - 33_200) * 0.0088;
  if (income <= 58_000) return 230 + (income - 43_500) * 0.0264;
  if (income <= 76_100) return 613 + (income - 58_000) * 0.0297;
  if (income <= 108_600) return 1_150 + (income - 76_100) * 0.066;
  if (income <= 141_500) return 3_295 + (income - 108_600) * 0.088;
  if (income <= 185_000) return 6_190 + (income - 141_500) * 0.11;
  if (income <= 793_300) return 10_975 + (income - 185_000) * 0.132;
  if (income <= 940_800) return 91_241 + (income - 793_300) * 0.115;
  return income * 0.115;
}

function federalTaxMarried2025(income: number): number {
  if (income <= FEDERAL_MARRIED_TARIFF_THRESHOLD) return 0;
  if (income <= 58_000) return (income - FEDERAL_MARRIED_TARIFF_THRESHOLD) * 0.01;
  if (income <= 82_000) return 251 + (income - 58_000) * 0.02;
  if (income <= 108_600) return 731 + (income - 82_000) * 0.04;
  if (income <= 141_500) return 1_795 + (income - 108_600) * 0.07;
  if (income <= 185_000) return 4_098 + (income - 141_500) * 0.09;
  if (income <= 940_800) return 8_013 + (income - 185_000) * 0.115;
  return income * 0.115;
}

function federalTax2025(income: number, tariff: SwissTariff, dependents: number): number {
  const beforeChildDeduction =
    tariff === 'married' ? federalTaxMarried2025(income) : federalTaxSingle2025(income);
  const afterChildDeduction = clampMin(beforeChildDeduction - dependents * FEDERAL_CHILD_TAX_DEDUCTION, 0);
  // Swiss federal tax payments are rounded down to CHF 0.05.
  return floorTo(afterChildDeduction, 0.05);
}

export function calcSwitzerland2025ZurichEstimate(params: {
  annualSalaryCHF: number;
  married: boolean;
  spouseHasIncome: boolean;
  dependents: number;
  age: number;
  residencyMonths: number;
}): CountryResult {
  const gross = clampMin(params.annualSalaryCHF, 0);
  const isResidentProxy = params.residencyMonths >= 3;
  const dependents = clampMin(Math.floor(params.dependents), 0);
  const tariff: SwissTariff = params.married ? 'married' : 'single';

  const ahvIvEo = gross * AHV_IV_EO_RATE_EMPLOYEE;
  const alv = Math.min(gross, ALV_SALARY_CAP) * ALV_RATE_EMPLOYEE;
  const alvSolidarity = clampMin(gross - ALV_SALARY_CAP, 0) * ALV_SOLIDARITY_RATE_EMPLOYEE;
  const nbu = gross * NBU_RATE_ESTIMATE;

  const bvgCoordinatedSalary =
    gross >= BVG_ENTRY_THRESHOLD
      ? Math.min(Math.max(gross - BVG_COORDINATION_DEDUCTION, 3_780), BVG_MAX_INSURED_SALARY)
      : 0;
  const bvg = bvgCoordinatedSalary * bvgEmployeeRateByAge(params.age);

  const employeeSocialContrib = ahvIvEo + alv + alvSolidarity + bvg + nbu;

  const professionalExpenses = professionalExpenseDeduction(gross);
  const pillar3a = gross > 0 ? PILLAR_3A_WITH_PILLAR_2 : 0;
  const healthInsuranceDeduction =
    (params.married ? HEALTH_INSURANCE_DEDUCTION_MARRIED : HEALTH_INSURANCE_DEDUCTION_SINGLE) +
    dependents * HEALTH_INSURANCE_DEDUCTION_PER_DEPENDENT;

  const taxableIncome = floorTo(
    clampMin(
      gross - employeeSocialContrib - professionalExpenses - pillar3a - healthInsuranceDeduction,
      0
    ),
    100
  );

  const federalTax = federalTax2025(taxableIncome, tariff, dependents);
  const cantonalTaxEstimate = federalTax * CANTONAL_MULTIPLIER;
  const municipalTaxEstimate = cantonalTaxEstimate * MUNICIPAL_MULTIPLIER;
  const federalTaxRounded = Math.round(federalTax);
  const cantonalTaxRounded = Math.round(cantonalTaxEstimate);
  const municipalTaxRounded = Math.round(municipalTaxEstimate);
  const employeeSocialContribRounded = Math.round(employeeSocialContrib);

  const grossRounded = Math.round(gross);
  const totalIncomeTaxRounded = federalTaxRounded + cantonalTaxRounded + municipalTaxRounded;
  const residentTaxRounded = cantonalTaxRounded + municipalTaxRounded;
  const netAnnualRounded = grossRounded - totalIncomeTaxRounded - employeeSocialContribRounded;

  return {
    country: 'CH',
    currency: 'CHF',
    residencyStatus: isResidentProxy
      ? 'Unlimited tax liability proxy (>=3 months)'
      : 'Limited liability / Quellensteuer proxy (<3 months, estimated with resident formula)',
    grossAnnualLocal: grossRounded,
    taxAnnualLocal: totalIncomeTaxRounded,
    residentTaxAnnualLocal: residentTaxRounded,
    employeeContribAnnualLocal: employeeSocialContribRounded,
    netAnnualLocal: netAnnualRounded,
    netMonthlyLocal: Math.round(netAnnualRounded / 12),
    effectiveRate: gross === 0 ? 0 : (federalTax + cantonalTaxEstimate + municipalTaxEstimate + employeeSocialContrib) / gross,
    breakdown: [
      { label: 'AHV/IV/EO employee (5.3%)', amount: Math.round(ahvIvEo) },
      { label: 'ALV employee (1.1%, cap CHF 148,200)', amount: Math.round(alv) },
      { label: 'ALV solidarity employee (0.5% above cap)', amount: Math.round(alvSolidarity) },
      { label: 'BVG employee contribution (age + coordinated salary)', amount: Math.round(bvg) },
      { label: 'NBU estimate (1.5%)', amount: Math.round(nbu) },
      { label: 'Professional expenses deduction (3%, min 2,000, max 4,000)', amount: Math.round(professionalExpenses) },
      { label: 'Pillar 3a deduction (with pillar 2)', amount: Math.round(pillar3a) },
      { label: 'Health insurance lump-sum deduction', amount: Math.round(healthInsuranceDeduction) },
      { label: 'Taxable income (truncated to CHF 100)', amount: Math.round(taxableIncome) },
      { label: 'Federal income tax (DBSt estimate)', amount: Math.round(federalTax) },
      { label: 'Cantonal tax estimate (Zurich-style multiplier)', amount: Math.round(cantonalTaxEstimate) },
      { label: 'Municipal tax estimate (Zurich city 119%)', amount: Math.round(municipalTaxEstimate) }
    ],
    assumptions: [
      'Federal tax uses a simplified 2025 table approximation from the repository spec; not ESTV full lookup precision.',
      'Cantonal and municipal taxes are Zurich-style estimates (cantonal ≈ 3.5x federal, municipal 119% of cantonal).',
      'Church tax is excluded (assumed non-member).',
      'For <3 months residency proxy, v1 keeps the same formula and changes status/interpretation only.',
      'Married + spouse income flags do not add separate Swiss spouse-income deductions in this v1 model.'
    ]
  };
}
