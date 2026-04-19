import { describe, expect, it } from 'vitest';
import { calcSingaporeYA2026Employment } from '$lib/tax/singapore';

function byLabel(result: ReturnType<typeof calcSingaporeYA2026Employment>, label: string): number {
  const found = result.breakdown.find((item) => item.label === label);
  if (!found) throw new Error(`Missing breakdown label: ${label}`);
  return found.amount;
}

describe('calcSingaporeYA2026Employment', () => {
  it('switches residency status at 6 months proxy threshold', () => {
    const nonResident = calcSingaporeYA2026Employment({
      annualSalarySGD: 120_000,
      age: 30,
      residencyMonths: 5
    });

    const resident = calcSingaporeYA2026Employment({
      annualSalarySGD: 120_000,
      age: 30,
      residencyMonths: 6
    });

    expect(nonResident.residencyStatus).toContain('Non-resident');
    expect(resident.residencyStatus).toContain('resident');
  });

  it('uses higher-of rule for non-resident employment tax', () => {
    const lowerIncome = calcSingaporeYA2026Employment({
      annualSalarySGD: 30_000,
      age: 30,
      residencyMonths: 3
    });

    const highIncome = calcSingaporeYA2026Employment({
      annualSalarySGD: 1_000_000,
      age: 30,
      residencyMonths: 3
    });

    expect(byLabel(lowerIncome, 'Tax used (higher of the two)')).toBe(
      byLabel(lowerIncome, 'Non-resident flat employment tax (15%)')
    );
    expect(byLabel(highIncome, 'Tax used (higher of the two)')).toBe(
      byLabel(highIncome, 'Resident progressive tax comparator on gross')
    );
  });

  it('applies CPF OW ceiling proxy for resident worker', () => {
    const result = calcSingaporeYA2026Employment({
      annualSalarySGD: 200_000,
      age: 30,
      residencyMonths: 12
    });

    expect(byLabel(result, 'CPF employee contribution (proxy)')).toBe(17_760);
  });

  it('keeps resident tax equal to pre-rebate amount in YA 2026 baseline', () => {
    const result = calcSingaporeYA2026Employment({
      annualSalarySGD: 160_000,
      age: 30,
      residencyMonths: 12
    });

    expect(result.taxAnnualLocal).toBe(byLabel(result, 'Income tax before rebate'));
  });

  it('satisfies accounting identity', () => {
    const result = calcSingaporeYA2026Employment({
      annualSalarySGD: 180_000,
      age: 45,
      residencyMonths: 12
    });

    expect(result.netAnnualLocal).toBe(
      result.grossAnnualLocal - result.taxAnnualLocal - result.employeeContribAnnualLocal
    );
  });
});
