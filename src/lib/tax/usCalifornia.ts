import type { CountryResult } from '$lib/types';
import { clampMin, progressiveTax } from '$lib/tax/shared';

type FilingStatus = 'single' | 'mfj' | 'hoh';

const FEDERAL_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 15_750,
  mfj: 31_500,
  hoh: 23_625
};

const FEDERAL_BRACKETS_2025: Record<FilingStatus, Array<{ upTo: number; rate: number }>> = {
  single: [
    { upTo: 11_925, rate: 0.1 },
    { upTo: 48_475, rate: 0.12 },
    { upTo: 103_350, rate: 0.22 },
    { upTo: 197_300, rate: 0.24 },
    { upTo: 250_525, rate: 0.32 },
    { upTo: 626_350, rate: 0.35 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.37 }
  ],
  mfj: [
    { upTo: 23_850, rate: 0.1 },
    { upTo: 96_950, rate: 0.12 },
    { upTo: 206_700, rate: 0.22 },
    { upTo: 394_600, rate: 0.24 },
    { upTo: 501_050, rate: 0.32 },
    { upTo: 751_600, rate: 0.35 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.37 }
  ],
  hoh: [
    { upTo: 17_000, rate: 0.1 },
    { upTo: 64_850, rate: 0.12 },
    { upTo: 103_350, rate: 0.22 },
    { upTo: 197_300, rate: 0.24 },
    { upTo: 250_500, rate: 0.32 },
    { upTo: 626_350, rate: 0.35 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.37 }
  ]
};

const CTC_AMOUNT_PER_CHILD = 2_200;
const CTC_PHASEOUT_THRESHOLD: Record<FilingStatus, number> = {
  single: 200_000,
  mfj: 400_000,
  hoh: 200_000
};

const SOCIAL_SECURITY_RATE = 0.062;
const SOCIAL_SECURITY_WAGE_BASE = 176_100;
const MEDICARE_RATE = 0.0145;
const ADDITIONAL_MEDICARE_RATE = 0.009;
const ADDITIONAL_MEDICARE_THRESHOLD: Record<FilingStatus, number> = {
  single: 200_000,
  mfj: 250_000,
  hoh: 200_000
};

const CA_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 5_706,
  mfj: 11_412,
  hoh: 11_412
};

const CA_BRACKETS_2025: Record<FilingStatus, Array<{ upTo: number; rate: number }>> = {
  single: [
    { upTo: 11_079, rate: 0.01 },
    { upTo: 26_264, rate: 0.02 },
    { upTo: 41_452, rate: 0.04 },
    { upTo: 57_542, rate: 0.06 },
    { upTo: 72_724, rate: 0.08 },
    { upTo: 371_479, rate: 0.093 },
    { upTo: 445_771, rate: 0.103 },
    { upTo: 742_953, rate: 0.113 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.123 }
  ],
  mfj: [
    { upTo: 22_158, rate: 0.01 },
    { upTo: 52_528, rate: 0.02 },
    { upTo: 82_904, rate: 0.04 },
    { upTo: 115_084, rate: 0.06 },
    { upTo: 145_448, rate: 0.08 },
    { upTo: 742_958, rate: 0.093 },
    { upTo: 891_542, rate: 0.103 },
    { upTo: 1_485_906, rate: 0.113 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.123 }
  ],
  hoh: [
    { upTo: 22_173, rate: 0.01 },
    { upTo: 52_530, rate: 0.02 },
    { upTo: 67_716, rate: 0.04 },
    { upTo: 83_805, rate: 0.06 },
    { upTo: 98_990, rate: 0.08 },
    { upTo: 505_208, rate: 0.093 },
    { upTo: 606_251, rate: 0.103 },
    { upTo: 1_010_417, rate: 0.113 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.123 }
  ]
};

const CA_MENTAL_HEALTH_TAX_THRESHOLD = 1_000_000;
const CA_MENTAL_HEALTH_TAX_RATE = 0.01;
const CA_PERSONAL_EXEMPTION_CREDIT = 144;
const CA_DEPENDENT_EXEMPTION_CREDIT = 433;
const CA_SDI_RATE = 0.011;

function deriveFilingStatus(married: boolean, dependents: number): FilingStatus {
  if (married) return 'mfj';
  if (dependents > 0) return 'hoh';
  return 'single';
}

function ctcPhaseoutReduction(agiProxy: number, filingStatus: FilingStatus): number {
  const threshold = CTC_PHASEOUT_THRESHOLD[filingStatus];
  if (agiProxy <= threshold) return 0;
  const increments = Math.ceil((agiProxy - threshold) / 1_000);
  return increments * 50;
}

function residencyStatusForCalifornia(months: number): string {
  if (months >= 10) return 'California resident proxy (>=10 months)';
  if (months >= 6) return 'California part-year resident proxy (6-9 months)';
  return 'California nonresident proxy (<6 months)';
}

export function calcUSCalifornia2025Employment(params: {
  annualSalaryUSD: number;
  married: boolean;
  spouseHasIncome: boolean;
  dependents: number;
  residencyMonths: number;
}): CountryResult {
  const gross = clampMin(params.annualSalaryUSD, 0);
  const dependents = clampMin(Math.floor(params.dependents), 0);
  const filingStatus = deriveFilingStatus(params.married, dependents);
  const residencyFactor = Math.max(0, Math.min(params.residencyMonths / 12, 1));

  const federalTaxableIncome = clampMin(gross - FEDERAL_STANDARD_DEDUCTION[filingStatus], 0);
  const federalTaxBeforeCredits = progressiveTax(federalTaxableIncome, FEDERAL_BRACKETS_2025[filingStatus]);

  const ctcNominal = dependents * CTC_AMOUNT_PER_CHILD;
  const ctcReduction = ctcPhaseoutReduction(gross, filingStatus);
  const ctcApplied = Math.min(clampMin(ctcNominal - ctcReduction, 0), federalTaxBeforeCredits);
  const federalIncomeTax = clampMin(federalTaxBeforeCredits - ctcApplied, 0);

  const socialSecurity = Math.min(gross, SOCIAL_SECURITY_WAGE_BASE) * SOCIAL_SECURITY_RATE;
  const medicare = gross * MEDICARE_RATE;
  const additionalMedicare =
    clampMin(gross - ADDITIONAL_MEDICARE_THRESHOLD[filingStatus], 0) * ADDITIONAL_MEDICARE_RATE;
  const fica = socialSecurity + medicare + additionalMedicare;

  const caTaxableIncome = clampMin(gross - CA_STANDARD_DEDUCTION[filingStatus], 0);
  const caBracketTax = progressiveTax(caTaxableIncome, CA_BRACKETS_2025[filingStatus]);
  const caMentalHealthTax =
    clampMin(caTaxableIncome - CA_MENTAL_HEALTH_TAX_THRESHOLD, 0) * CA_MENTAL_HEALTH_TAX_RATE;
  const caExemptionCredits =
    (filingStatus === 'mfj' ? 2 : 1) * CA_PERSONAL_EXEMPTION_CREDIT +
    dependents * CA_DEPENDENT_EXEMPTION_CREDIT;
  const caIncomeTaxFullYear = clampMin(caBracketTax + caMentalHealthTax - caExemptionCredits, 0);
  const caIncomeTaxProrated = caIncomeTaxFullYear * residencyFactor;

  const caSdiProrated = gross * CA_SDI_RATE * residencyFactor;

  const totalIncomeTax = federalIncomeTax + caIncomeTaxProrated;
  const employeeContrib = fica + caSdiProrated;
  const grossRounded = Math.round(gross);
  const totalIncomeTaxRounded = Math.round(totalIncomeTax);
  const caIncomeTaxRounded = Math.round(caIncomeTaxProrated);
  const employeeContribRounded = Math.round(employeeContrib);
  const netAnnualRounded = grossRounded - totalIncomeTaxRounded - employeeContribRounded;

  return {
    country: 'USCA',
    currency: 'USD',
    residencyStatus: residencyStatusForCalifornia(params.residencyMonths),
    grossAnnualLocal: grossRounded,
    taxAnnualLocal: totalIncomeTaxRounded,
    residentTaxAnnualLocal: caIncomeTaxRounded,
    employeeContribAnnualLocal: employeeContribRounded,
    netAnnualLocal: netAnnualRounded,
    netMonthlyLocal: Math.round(netAnnualRounded / 12),
    effectiveRate: gross === 0 ? 0 : (totalIncomeTax + employeeContrib) / gross,
    breakdown: [
      { label: 'Federal taxable income', amount: Math.round(federalTaxableIncome) },
      { label: 'Federal tax before credits', amount: Math.round(federalTaxBeforeCredits) },
      { label: 'Federal child tax credit applied', amount: -Math.round(ctcApplied) },
      { label: 'FICA Social Security (6.2%, cap)', amount: Math.round(socialSecurity) },
      { label: 'FICA Medicare (1.45%)', amount: Math.round(medicare) },
      { label: 'Additional Medicare (0.9%)', amount: Math.round(additionalMedicare) },
      { label: 'CA taxable income (full-year basis)', amount: Math.round(caTaxableIncome) },
      { label: 'CA income tax (full-year before proration)', amount: Math.round(caIncomeTaxFullYear) },
      { label: 'CA income tax (prorated)', amount: Math.round(caIncomeTaxProrated) },
      { label: 'CA SDI (1.1%, prorated)', amount: Math.round(caSdiProrated) }
    ],
    assumptions: [
      'Filing status is inferred from existing shared inputs: married -> MFJ, otherwise dependents > 0 -> HoH, else single.',
      'Model assumes employment-only income and uses standard deductions (no itemized deductions).',
      'Federal child tax credit is simplified as non-refundable and applied against computed federal income tax.',
      'California income tax and CA SDI are prorated by residency months / 12 per the requested v1 behavior.',
      'Spouse-income flag is not modeled separately in US calculation because filing status and household salary are already shared inputs.'
    ]
  };
}
