import { describe, expect, it } from 'vitest';
import { calcThailandEmployment } from '$lib/tax/thailand';

function byLabel(result: ReturnType<typeof calcThailandEmployment>, label: string): number {
  const found = result.breakdown.find((item) => item.label === label);
  if (!found) {
    throw new Error(`Missing breakdown label: ${label}`);
  }
  return found.amount;
}

function progressiveTaxExpected(netIncome: number): number {
  const brackets = [
    { upTo: 150_000, rate: 0 },
    { upTo: 300_000, rate: 0.05 },
    { upTo: 500_000, rate: 0.1 },
    { upTo: 750_000, rate: 0.15 },
    { upTo: 1_000_000, rate: 0.2 },
    { upTo: 2_000_000, rate: 0.25 },
    { upTo: 5_000_000, rate: 0.3 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.35 }
  ];

  let total = 0;
  let lower = 0;
  for (const bracket of brackets) {
    if (netIncome <= lower) break;
    const amount = Math.min(netIncome, bracket.upTo) - lower;
    total += amount * bracket.rate;
    lower = bracket.upTo;
  }
  return total;
}

describe('calcThailandEmployment', () => {
  it('switches resident status at 6 months threshold', () => {
    const nonResident = calcThailandEmployment({
      annualSalaryTHB: 600_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 5
    });

    const resident = calcThailandEmployment({
      annualSalaryTHB: 600_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 6
    });

    expect(nonResident.residencyStatus).toContain('Non-resident');
    expect(resident.residencyStatus).toContain('Resident');
  });

  it('applies expense deduction cap at 100,000 THB', () => {
    const low = calcThailandEmployment({
      annualSalaryTHB: 199_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const boundary = calcThailandEmployment({
      annualSalaryTHB: 200_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const high = calcThailandEmployment({
      annualSalaryTHB: 800_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    expect(byLabel(low, 'Expense deduction (50%, cap 100,000)')).toBe(99_500);
    expect(byLabel(boundary, 'Expense deduction (50%, cap 100,000)')).toBe(100_000);
    expect(byLabel(high, 'Expense deduction (50%, cap 100,000)')).toBe(100_000);
  });

  it('applies social security cap at 9,000 THB', () => {
    const low = calcThailandEmployment({
      annualSalaryTHB: 100_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const boundary = calcThailandEmployment({
      annualSalaryTHB: 180_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const high = calcThailandEmployment({
      annualSalaryTHB: 1_200_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    expect(byLabel(low, 'Social security contribution (5%, cap 9,000)')).toBe(5_000);
    expect(byLabel(boundary, 'Social security contribution (5%, cap 9,000)')).toBe(9_000);
    expect(byLabel(high, 'Social security contribution (5%, cap 9,000)')).toBe(9_000);
  });

  it('applies progressive tax brackets to net taxable income', () => {
    const salaries = [319_000, 320_000, 469_000, 670_000, 2_300_000, 5_500_000];

    for (const salary of salaries) {
      const result = calcThailandEmployment({
        annualSalaryTHB: salary,
        married: false,
        spouseHasIncome: false,
        dependents: 0,
        residencyMonths: 12
      });

      const taxable = byLabel(result, 'Net taxable income');
      const expectedTax = progressiveTaxExpected(taxable);

      expect(byLabel(result, 'Tax method 1')).toBe(Math.round(expectedTax));
      expect(byLabel(result, 'Tax method 2')).toBe(0);
    }
  });

  it('applies spouse and dependent allowances', () => {
    const single = calcThailandEmployment({
      annualSalaryTHB: 800_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const marriedWithDependents = calcThailandEmployment({
      annualSalaryTHB: 800_000,
      married: true,
      spouseHasIncome: false,
      dependents: 2,
      residencyMonths: 12
    });

    expect(byLabel(marriedWithDependents, 'Spouse allowance')).toBe(60_000);
    expect(byLabel(marriedWithDependents, 'Dependent allowance')).toBe(60_000);
    expect(marriedWithDependents.taxAnnualLocal).toBeLessThan(single.taxAnnualLocal);
  });

  it('satisfies accounting identity and resident tax component behavior', () => {
    const result = calcThailandEmployment({
      annualSalaryTHB: 1_200_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    expect(result.residentTaxAnnualLocal).toBe(0);
    expect(result.netAnnualLocal).toBe(
      result.grossAnnualLocal - result.taxAnnualLocal - result.employeeContribAnnualLocal
    );
  });
});
