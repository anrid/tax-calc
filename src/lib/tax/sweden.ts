import type { CountryResult } from '$lib/types';
import { ceilTo, clampMin, floorTo } from '$lib/tax/shared';

const MUNICIPAL_RATE_DEFAULT = 0.3241;
const STATE_TAX_RATE = 0.2;
const STATE_TAX_THRESHOLD = 625_800;
const PBB_2025 = 58_800;
const SINK_RATE = 0.25;

function standardGrundavdrag(ffi: number): number {
  let ga = 0;

  if (ffi <= 0.99 * PBB_2025) {
    ga = 0.423 * PBB_2025;
  } else if (ffi <= 2.72 * PBB_2025) {
    ga = 0.423 * PBB_2025 + 0.2 * (ffi - 0.99 * PBB_2025);
  } else if (ffi <= 3.11 * PBB_2025) {
    ga = 0.77 * PBB_2025;
  } else if (ffi <= 7.88 * PBB_2025) {
    ga = 0.77 * PBB_2025 - 0.1 * (ffi - 3.11 * PBB_2025);
  } else {
    ga = 0.293 * PBB_2025;
  }

  return ceilTo(Math.min(ga, ffi), 100);
}

function jobbskatteavdrag(ai: number, ga: number, municipalRate: number): number {
  if (ai <= 0) return 0;

  if (ai <= 0.91 * PBB_2025) {
    return (ai + ga) * municipalRate;
  }

  if (ai <= 3.24 * PBB_2025) {
    return (0.91 * PBB_2025 + ga) * municipalRate + 0.3251 * (ai - 0.91 * PBB_2025);
  }

  if (ai <= 10.67 * PBB_2025) {
    return (
      (0.91 * PBB_2025 + ga) * municipalRate +
      0.3251 * (3.24 - 0.91) * PBB_2025 +
      0.0651 * (ai - 3.24 * PBB_2025)
    );
  }

  return (
    (0.91 * PBB_2025 + ga) * municipalRate +
    0.3251 * (3.24 - 0.91) * PBB_2025 +
    0.0651 * (10.67 - 3.24) * PBB_2025
  );
}

export function calcSweden2025Employment(params: {
  annualSalarySEK: number;
  age: number;
  residencyMonths: number;
  municipalRate?: number;
}): CountryResult {
  const gross = clampMin(params.annualSalarySEK, 0);
  const municipalRate = params.municipalRate ?? MUNICIPAL_RATE_DEFAULT;
  const isResident = params.residencyMonths >= 6;

  if (!isResident) {
    const sinkTax = Math.round(gross * SINK_RATE);
    const netAnnual = gross - sinkTax;

    return {
      country: 'SE',
      currency: 'SEK',
      residencyStatus: 'Limited tax liability / SINK (<6 months)',
      grossAnnualLocal: Math.round(gross),
      taxAnnualLocal: Math.round(sinkTax),
      residentTaxAnnualLocal: 0,
      employeeContribAnnualLocal: 0,
      netAnnualLocal: Math.round(netAnnual),
      netMonthlyLocal: Math.round(netAnnual / 12),
      effectiveRate: gross === 0 ? 0 : sinkTax / gross,
      breakdown: [{ label: 'SINK flat tax (25%)', amount: Math.round(sinkTax) }],
      assumptions: [
        'Non-resident path uses SINK 25% from the provided Sweden spec.',
        'Potential treaty relief and SINK application details are not modeled in v1.'
      ]
    };
  }

  const ffi = floorTo(gross, 100);
  const isAge66Plus = params.age >= 66;
  const standardGA = standardGrundavdrag(ffi);
  const grundavdrag = isAge66Plus ? ceilTo(Math.min(ffi, standardGA * 2.5), 100) : standardGA;

  const taxable = clampMin(ffi - grundavdrag, 0);
  const municipalTax = taxable * municipalRate;
  const stateTax = clampMin(taxable - STATE_TAX_THRESHOLD, 0) * STATE_TAX_RATE;

  const pensionFee = Math.min(gross, 8.07 * 80_600) * 0.07;
  const pensionFeeCredit = pensionFee;
  const publicServiceFee = Math.min(taxable * 0.01, 1_184);
  const burialFee = ffi * 0.0025;

  const jsa = isAge66Plus
    ? 0
    : Math.min(jobbskatteavdrag(gross, grundavdrag, municipalRate), municipalTax, 48_000);

  const incomeTax = Math.round(
    clampMin(
      municipalTax + stateTax + pensionFee + publicServiceFee + burialFee - pensionFeeCredit - jsa,
      0
    )
  );

  const netAnnual = gross - incomeTax;

  return {
    country: 'SE',
    currency: 'SEK',
    residencyStatus: 'Unlimited tax liability (>=6 months)',
    grossAnnualLocal: Math.round(gross),
    taxAnnualLocal: Math.round(incomeTax),
    residentTaxAnnualLocal: Math.round(municipalTax),
    employeeContribAnnualLocal: 0,
    netAnnualLocal: Math.round(netAnnual),
    netMonthlyLocal: Math.round(netAnnual / 12),
    effectiveRate: gross === 0 ? 0 : incomeTax / gross,
    breakdown: [
      { label: 'Faststalld forvarvsinkomst (FFI)', amount: Math.round(ffi) },
      { label: 'Grundavdrag', amount: Math.round(grundavdrag) },
      { label: 'Taxable earned income', amount: Math.round(taxable) },
      { label: 'Municipal tax', amount: Math.round(municipalTax) },
      { label: 'State income tax', amount: Math.round(stateTax) },
      { label: 'Public service fee', amount: Math.round(publicServiceFee) },
      { label: 'Burial fee (approx.)', amount: Math.round(burialFee) },
      { label: 'Jobbskatteavdrag', amount: Math.round(jsa) }
    ],
    assumptions: [
      'Modeled for employment income only (2025 baseline).',
      'Enhanced grundavdrag for age 66+ is approximated at 2.5x standard formula.',
      'Employer social contributions are excluded from take-home because they are employer-paid.'
    ]
  };
}
