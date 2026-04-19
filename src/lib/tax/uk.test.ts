import { describe, expect, it } from 'vitest';
import { calcUK2025Employment } from '$lib/tax/uk';

function byLabel(result: ReturnType<typeof calcUK2025Employment>, label: string): number {
  const found = result.breakdown.find((item) => item.label === label);
  if (!found) {
    throw new Error(`Missing breakdown label: ${label}`);
  }
  return found.amount;
}

describe('calcUK2025Employment', () => {
  it('switches residency status at 6 months threshold', () => {
    const nonResident = calcUK2025Employment({
      annualSalaryGBP: 80_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 5
    });

    const resident = calcUK2025Employment({
      annualSalaryGBP: 80_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 6
    });

    expect(nonResident.residencyStatus).toContain('Non-resident');
    expect(resident.residencyStatus).toContain('resident');
  });

  it('applies personal allowance taper above GBP 100,000 and removes at GBP 125,140+', () => {
    const belowTaper = calcUK2025Employment({
      annualSalaryGBP: 100_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const withinTaper = calcUK2025Employment({
      annualSalaryGBP: 120_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const fullyWithdrawn = calcUK2025Employment({
      annualSalaryGBP: 130_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    expect(byLabel(belowTaper, 'Personal allowance after taper')).toBe(12_570);
    expect(byLabel(withinTaper, 'Personal allowance after taper')).toBe(2_570);
    expect(byLabel(fullyWithdrawn, 'Personal allowance after taper')).toBe(0);
  });

  it('applies marriage allowance reduction only for eligible basic-rate proxy case', () => {
    const eligible = calcUK2025Employment({
      annualSalaryGBP: 40_000,
      married: true,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const ineligible = calcUK2025Employment({
      annualSalaryGBP: 80_000,
      married: true,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    expect(byLabel(eligible, 'Marriage allowance transfer credit (if eligible)')).toBe(-252);
    expect(byLabel(ineligible, 'Marriage allowance transfer credit (if eligible)')).toBe(0);
  });

  it('satisfies accounting identity', () => {
    const result = calcUK2025Employment({
      annualSalaryGBP: 90_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    expect(result.netAnnualLocal).toBe(
      result.grossAnnualLocal - result.taxAnnualLocal - result.employeeContribAnnualLocal
    );
  });
});
