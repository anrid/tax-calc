import { describe, expect, it } from 'vitest';
import { calcIndiaFY2025NewRegimeEmployment } from '$lib/tax/india';

function byLabel(result: ReturnType<typeof calcIndiaFY2025NewRegimeEmployment>, label: string): number {
  const found = result.breakdown.find((item) => item.label === label);
  if (!found) throw new Error(`Missing breakdown label: ${label}`);
  return found.amount;
}

describe('calcIndiaFY2025NewRegimeEmployment', () => {
  it('applies Section 87A so resident salaried income up to 12.75L gross becomes zero tax', () => {
    const result = calcIndiaFY2025NewRegimeEmployment({
      annualSalaryINR: 1_275_000,
      residencyMonths: 12
    });

    expect(result.taxAnnualLocal).toBe(0);
    expect(byLabel(result, 'Section 87A / marginal-relief adjustment')).toBe(-60_000);
  });

  it('applies marginal relief just above 12L taxable threshold for residents', () => {
    const result = calcIndiaFY2025NewRegimeEmployment({
      annualSalaryINR: 1_285_000,
      residencyMonths: 12
    });

    expect(byLabel(result, 'Slab tax before Section 87A')).toBe(61_500);
    expect(byLabel(result, 'Section 87A / marginal-relief adjustment')).toBe(-51_500);
    expect(result.taxAnnualLocal).toBe(10_400);
  });

  it('does not apply Section 87A in non-resident proxy path', () => {
    const resident = calcIndiaFY2025NewRegimeEmployment({
      annualSalaryINR: 1_285_000,
      residencyMonths: 12
    });

    const nonResident = calcIndiaFY2025NewRegimeEmployment({
      annualSalaryINR: 1_285_000,
      residencyMonths: 3
    });

    expect(byLabel(nonResident, 'Section 87A / marginal-relief adjustment')).toBe(0);
    expect(nonResident.taxAnnualLocal).toBeGreaterThan(resident.taxAnnualLocal);
  });

  it('applies surcharge above 50 lakh taxable income', () => {
    const result = calcIndiaFY2025NewRegimeEmployment({
      annualSalaryINR: 5_500_000,
      residencyMonths: 12
    });

    expect(byLabel(result, 'Surcharge')).toBeGreaterThan(0);
    expect(byLabel(result, 'Health and education cess (4%)')).toBeGreaterThan(0);
  });

  it('satisfies accounting identity', () => {
    const result = calcIndiaFY2025NewRegimeEmployment({
      annualSalaryINR: 2_500_000,
      residencyMonths: 12
    });

    expect(result.netAnnualLocal).toBe(
      result.grossAnnualLocal - result.taxAnnualLocal - result.employeeContribAnnualLocal
    );
  });
});
