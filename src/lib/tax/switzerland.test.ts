import { describe, expect, it } from 'vitest';
import { calcSwitzerland2025ZurichEstimate } from '$lib/tax/switzerland';

function byLabel(result: ReturnType<typeof calcSwitzerland2025ZurichEstimate>, label: string): number {
  const found = result.breakdown.find((item) => item.label === label);
  if (!found) {
    throw new Error(`Missing breakdown label: ${label}`);
  }
  return found.amount;
}

describe('calcSwitzerland2025ZurichEstimate', () => {
  it('switches residency status at 3 months threshold', () => {
    const limited = calcSwitzerland2025ZurichEstimate({
      annualSalaryCHF: 120_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      age: 35,
      residencyMonths: 2
    });

    const resident = calcSwitzerland2025ZurichEstimate({
      annualSalaryCHF: 120_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      age: 35,
      residencyMonths: 3
    });

    expect(limited.residencyStatus).toContain('Limited');
    expect(resident.residencyStatus).toContain('Unlimited');
  });

  it('reports resident/local component as cantonal + municipal estimates', () => {
    const result = calcSwitzerland2025ZurichEstimate({
      annualSalaryCHF: 140_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      age: 35,
      residencyMonths: 12
    });

    const cantonal = byLabel(result, 'Cantonal tax estimate (Zurich-style calibrated split)');
    const municipal = byLabel(result, 'Municipal tax estimate (Zurich city 119%)');
    expect(result.residentTaxAnnualLocal).toBe(cantonal + municipal);
    expect(result.taxAnnualLocal).toBeGreaterThan(result.residentTaxAnnualLocal);
  });

  it('applies married tariff and child deduction to reduce tax burden', () => {
    const single = calcSwitzerland2025ZurichEstimate({
      annualSalaryCHF: 180_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      age: 40,
      residencyMonths: 12
    });

    const marriedWithChildren = calcSwitzerland2025ZurichEstimate({
      annualSalaryCHF: 180_000,
      married: true,
      spouseHasIncome: false,
      dependents: 2,
      age: 40,
      residencyMonths: 12
    });

    expect(marriedWithChildren.taxAnnualLocal).toBeLessThan(single.taxAnnualLocal);
  });

  it('satisfies accounting identity', () => {
    const result = calcSwitzerland2025ZurichEstimate({
      annualSalaryCHF: 120_000,
      married: false,
      spouseHasIncome: false,
      dependents: 1,
      age: 45,
      residencyMonths: 12
    });

    expect(result.netAnnualLocal).toBe(
      result.grossAnnualLocal - result.taxAnnualLocal - result.employeeContribAnnualLocal
    );
  });

  it('keeps federal tax continuous near the upper married bracket threshold', () => {
    const lower = calcSwitzerland2025ZurichEstimate({
      annualSalaryCHF: 1_048_600,
      married: true,
      spouseHasIncome: false,
      dependents: 0,
      age: 40,
      residencyMonths: 12
    });

    const higher = calcSwitzerland2025ZurichEstimate({
      annualSalaryCHF: 1_048_900,
      married: true,
      spouseHasIncome: false,
      dependents: 0,
      age: 40,
      residencyMonths: 12
    });

    const federalLower = byLabel(lower, 'Federal income tax (DBSt estimate)');
    const federalHigher = byLabel(higher, 'Federal income tax (DBSt estimate)');

    expect(federalHigher).toBeGreaterThanOrEqual(federalLower);
    expect(federalHigher - federalLower).toBeLessThan(200);
  });

  it('keeps net annual income increasing across high-income levels', () => {
    const salaries = [250_000, 400_000, 600_000, 900_000];
    const nets = salaries.map((annualSalaryCHF) => {
      return calcSwitzerland2025ZurichEstimate({
        annualSalaryCHF,
        married: false,
        spouseHasIncome: false,
        dependents: 0,
        age: 40,
        residencyMonths: 12
      }).netAnnualLocal;
    });

    for (let index = 1; index < nets.length; index += 1) {
      expect(nets[index]).toBeGreaterThan(nets[index - 1]);
    }
  });
});
