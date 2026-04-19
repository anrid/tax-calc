import { describe, expect, it } from 'vitest';
import { calcUSCalifornia2025Employment } from '$lib/tax/usCalifornia';

function byLabel(result: ReturnType<typeof calcUSCalifornia2025Employment>, label: string): number {
  const found = result.breakdown.find((item) => item.label === label);
  if (!found) {
    throw new Error(`Missing breakdown label: ${label}`);
  }
  return found.amount;
}

describe('calcUSCalifornia2025Employment', () => {
  it('uses inferred filing status and produces lower tax for HoH proxy than single at same salary', () => {
    const single = calcUSCalifornia2025Employment({
      annualSalaryUSD: 120_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const hoh = calcUSCalifornia2025Employment({
      annualSalaryUSD: 120_000,
      married: false,
      spouseHasIncome: false,
      dependents: 1,
      residencyMonths: 12
    });

    expect(hoh.taxAnnualLocal).toBeLessThan(single.taxAnnualLocal);
  });

  it('prorates California tax and SDI by residency months', () => {
    const fullYear = calcUSCalifornia2025Employment({
      annualSalaryUSD: 150_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const halfYear = calcUSCalifornia2025Employment({
      annualSalaryUSD: 150_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 6
    });

    expect(byLabel(halfYear, 'CA income tax (prorated)')).toBeCloseTo(
      byLabel(fullYear, 'CA income tax (prorated)') / 2,
      -1
    );
    expect(byLabel(halfYear, 'CA SDI (1.1%, prorated)')).toBeCloseTo(
      byLabel(fullYear, 'CA SDI (1.1%, prorated)') / 2,
      -1
    );
  });

  it('applies California 1% mental health tax above USD 1,000,000 taxable income', () => {
    const below = calcUSCalifornia2025Employment({
      annualSalaryUSD: 1_000_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const above = calcUSCalifornia2025Employment({
      annualSalaryUSD: 1_300_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const belowCaFull = byLabel(below, 'CA income tax (full-year before proration)');
    const aboveCaFull = byLabel(above, 'CA income tax (full-year before proration)');
    expect(aboveCaFull).toBeGreaterThan(belowCaFull);
  });

  it('satisfies accounting identity', () => {
    const result = calcUSCalifornia2025Employment({
      annualSalaryUSD: 220_000,
      married: true,
      spouseHasIncome: true,
      dependents: 2,
      residencyMonths: 10
    });

    expect(result.netAnnualLocal).toBe(
      result.grossAnnualLocal - result.taxAnnualLocal - result.employeeContribAnnualLocal
    );
  });
});
