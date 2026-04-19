import type { CountryResult } from '$lib/types';
import { clampMin } from '$lib/tax/shared';

const PERSONAL_ALLOWANCE = 12_570;
const ALLOWANCE_TAPER_START = 100_000;
const ALLOWANCE_FULLY_WITHDRAWN = 125_140;

const BASIC_BAND_WIDTH = 37_700;
const HIGHER_BAND_WIDTH = 112_570 - BASIC_BAND_WIDTH;

const BASIC_RATE = 0.2;
const HIGHER_RATE = 0.4;
const ADDITIONAL_RATE = 0.45;

const NIC_PRIMARY_THRESHOLD = 12_570;
const NIC_UPPER_EARNINGS_LIMIT = 50_270;
const NIC_MAIN_RATE = 0.08;
const NIC_ADDITIONAL_RATE = 0.02;

const MARRIAGE_ALLOWANCE_TAX_REDUCTION = 252;

function personalAllowanceWithTaper(adjustedNetIncome: number): number {
  if (adjustedNetIncome <= ALLOWANCE_TAPER_START) return PERSONAL_ALLOWANCE;
  if (adjustedNetIncome >= ALLOWANCE_FULLY_WITHDRAWN) return 0;
  const reduction = Math.floor((adjustedNetIncome - ALLOWANCE_TAPER_START) / 2);
  return clampMin(PERSONAL_ALLOWANCE - reduction, 0);
}

export function calcUK2025Employment(params: {
  annualSalaryGBP: number;
  married: boolean;
  spouseHasIncome: boolean;
  dependents: number;
  residencyMonths: number;
}): CountryResult {
  const gross = clampMin(params.annualSalaryGBP, 0);
  const personalAllowance = personalAllowanceWithTaper(gross);
  const taxableIncome = clampMin(gross - personalAllowance, 0);

  const basicTaxable = Math.min(taxableIncome, BASIC_BAND_WIDTH);
  const higherTaxable = Math.min(clampMin(taxableIncome - BASIC_BAND_WIDTH, 0), HIGHER_BAND_WIDTH);
  const additionalTaxable = clampMin(taxableIncome - BASIC_BAND_WIDTH - HIGHER_BAND_WIDTH, 0);

  const basicTax = basicTaxable * BASIC_RATE;
  const higherTax = higherTaxable * HIGHER_RATE;
  const additionalTax = additionalTaxable * ADDITIONAL_RATE;
  const incomeTaxBeforeCredits = basicTax + higherTax + additionalTax;

  const marriageAllowanceApplied =
    params.married && !params.spouseHasIncome && taxableIncome > 0 && taxableIncome <= BASIC_BAND_WIDTH
      ? MARRIAGE_ALLOWANCE_TAX_REDUCTION
      : 0;
  const incomeTax = clampMin(incomeTaxBeforeCredits - marriageAllowanceApplied, 0);

  const nicMain = clampMin(Math.min(gross, NIC_UPPER_EARNINGS_LIMIT) - NIC_PRIMARY_THRESHOLD, 0) * NIC_MAIN_RATE;
  const nicAdditional = clampMin(gross - NIC_UPPER_EARNINGS_LIMIT, 0) * NIC_ADDITIONAL_RATE;
  const employeeNic = nicMain + nicAdditional;

  const grossRounded = Math.round(gross);
  const incomeTaxRounded = Math.round(incomeTax);
  const employeeNicRounded = Math.round(employeeNic);
  const netAnnualRounded = grossRounded - incomeTaxRounded - employeeNicRounded;
  const marriageAllowanceBreakdown = marriageAllowanceApplied === 0 ? 0 : -Math.round(marriageAllowanceApplied);

  return {
    country: 'UK',
    currency: 'GBP',
    residencyStatus:
      params.residencyMonths >= 6
        ? 'UK resident proxy (>=6 months)'
        : 'Non-resident proxy (<6 months, UK-source employment approximation)',
    grossAnnualLocal: grossRounded,
    taxAnnualLocal: incomeTaxRounded,
    residentTaxAnnualLocal: 0,
    employeeContribAnnualLocal: employeeNicRounded,
    netAnnualLocal: netAnnualRounded,
    netMonthlyLocal: Math.round(netAnnualRounded / 12),
    effectiveRate: gross === 0 ? 0 : (incomeTax + employeeNic) / gross,
    breakdown: [
      { label: 'Personal allowance after taper', amount: Math.round(personalAllowance) },
      { label: 'Taxable income', amount: Math.round(taxableIncome) },
      { label: 'Basic-rate tax (20%)', amount: Math.round(basicTax) },
      { label: 'Higher-rate tax (40%)', amount: Math.round(higherTax) },
      { label: 'Additional-rate tax (45%)', amount: Math.round(additionalTax) },
      { label: 'Marriage allowance transfer credit (if eligible)', amount: marriageAllowanceBreakdown },
      { label: 'Employee NIC main (8%)', amount: Math.round(nicMain) },
      { label: 'Employee NIC additional (2%)', amount: Math.round(nicAdditional) }
    ],
    assumptions: [
      'Modeled for England/Wales/Northern Ireland income tax bands for 2025/26.',
      'Employment income only; savings/dividend stacking and Scotland-specific rates are excluded.',
      'Marriage allowance is approximated as a flat GBP 252 tax reduction when basic-rate eligibility conditions are met.',
      'For <6 months residency proxy, v1 keeps UK-source employment tax logic and changes status label only.'
    ]
  };
}
