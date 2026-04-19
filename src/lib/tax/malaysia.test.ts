import { describe, expect, it } from 'vitest';
import { calcMalaysiaYA2025Employment } from '$lib/tax/malaysia';

function byLabel(result: ReturnType<typeof calcMalaysiaYA2025Employment>, label: string): number {
  const found = result.breakdown.find((item) => item.label === label);
  if (!found) throw new Error(`Missing breakdown label: ${label}`);
  return found.amount;
}

describe('calcMalaysiaYA2025Employment', () => {
  it('switches residency status at 6 months proxy threshold', () => {
    const nonResident = calcMalaysiaYA2025Employment({
      annualSalaryMYR: 120_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      age: 30,
      residencyMonths: 5
    });

    const resident = calcMalaysiaYA2025Employment({
      annualSalaryMYR: 120_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      age: 30,
      residencyMonths: 6
    });

    expect(nonResident.residencyStatus).toContain('Non-resident');
    expect(resident.residencyStatus).toContain('Resident');
    expect(resident.taxAnnualLocal).toBeLessThan(nonResident.taxAnnualLocal);
  });

  it('applies resident low-income rebate and reliefs', () => {
    const result = calcMalaysiaYA2025Employment({
      annualSalaryMYR: 40_000,
      married: true,
      spouseHasIncome: false,
      dependents: 1,
      age: 30,
      residencyMonths: 12
    });

    expect(byLabel(result, 'Resident rebate')).toBe(-400);
    expect(byLabel(result, 'Spouse relief')).toBe(4_000);
    expect(byLabel(result, 'Dependent relief')).toBe(2_000);
  });

  it('caps SOCSO and EIS contribution proxies at RM6,000 monthly wage equivalent', () => {
    const result = calcMalaysiaYA2025Employment({
      annualSalaryMYR: 300_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      age: 30,
      residencyMonths: 12
    });

    expect(byLabel(result, 'SOCSO employee contribution (proxy)')).toBe(360);
    expect(byLabel(result, 'EIS employee contribution (proxy)')).toBe(144);
  });

  it('satisfies accounting identity', () => {
    const result = calcMalaysiaYA2025Employment({
      annualSalaryMYR: 180_000,
      married: true,
      spouseHasIncome: true,
      dependents: 2,
      age: 30,
      residencyMonths: 12
    });

    expect(result.netAnnualLocal).toBe(
      result.grossAnnualLocal - result.taxAnnualLocal - result.employeeContribAnnualLocal
    );
  });
});
