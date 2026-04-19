import { describe, expect, it } from 'vitest';
import { calcJapan2025Employment } from '$lib/tax/japan';

function byLabel(result: ReturnType<typeof calcJapan2025Employment>, label: string): number {
  const found = result.breakdown.find((item) => item.label === label);
  if (!found) {
    throw new Error(`Missing breakdown label: ${label}`);
  }
  return found.amount;
}

function employmentDeductionExpected(salary: number): number {
  if (salary <= 1_900_000) return Math.min(salary, 650_000);
  if (salary <= 3_600_000) return salary * 0.3 + 80_000;
  if (salary <= 6_600_000) return salary * 0.2 + 440_000;
  if (salary <= 8_500_000) return salary * 0.1 + 1_100_000;
  return 1_950_000;
}

function basicDeductionExpected(totalIncome: number): number {
  if (totalIncome <= 1_320_000) return 950_000;
  if (totalIncome <= 3_360_000) return 880_000;
  if (totalIncome <= 4_890_000) return 680_000;
  if (totalIncome <= 6_550_000) return 630_000;
  if (totalIncome <= 23_500_000) return 580_000;
  if (totalIncome <= 24_000_000) return 480_000;
  if (totalIncome <= 24_500_000) return 320_000;
  if (totalIncome <= 25_000_000) return 160_000;
  return 0;
}

describe('calcJapan2025Employment', () => {
  it('applies non-resident withholding with floor-to-100 rounding', () => {
    const result = calcJapan2025Employment({
      annualSalaryJPY: 1_234_567,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 3
    });

    const expectedTax = Math.floor((1_234_567 * 0.2042) / 100) * 100;
    expect(result.residencyStatus).toContain('Non-resident');
    expect(result.taxAnnualLocal).toBe(expectedTax);
    expect(result.residentTaxAnnualLocal).toBe(0);
    expect(result.netAnnualLocal).toBe(1_234_567 - expectedTax);
  });

  it('switches resident branch at 12 months threshold', () => {
    const nonResident = calcJapan2025Employment({
      annualSalaryJPY: 5_000_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 11
    });

    const resident = calcJapan2025Employment({
      annualSalaryJPY: 5_000_000,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    expect(nonResident.residencyStatus).toContain('Non-resident');
    expect(nonResident.residentTaxAnnualLocal).toBe(0);
    expect(resident.residencyStatus).toContain('Resident');
    expect(resident.residentTaxAnnualLocal).toBeGreaterThan(0);
  });

  it('follows employment deduction table boundaries', () => {
    const salaries = [1_900_000, 1_900_001, 3_600_000, 3_600_001, 6_600_000, 8_500_000, 8_500_001];

    for (const salary of salaries) {
      const result = calcJapan2025Employment({
        annualSalaryJPY: salary,
        married: false,
        spouseHasIncome: false,
        dependents: 0,
        residencyMonths: 12
      });

      expect(byLabel(result, 'Employment income deduction')).toBe(
        Math.round(employmentDeductionExpected(salary))
      );
    }
  });

  it('follows 2025 basic deduction tiers', () => {
    const salaries = [1_900_000, 3_000_000, 5_000_000, 8_000_000, 10_000_000];

    for (const salary of salaries) {
      const deduction = employmentDeductionExpected(salary);
      const employmentIncome = Math.max(salary - deduction, 0);
      const expectedBasic = basicDeductionExpected(employmentIncome);

      const result = calcJapan2025Employment({
        annualSalaryJPY: salary,
        married: false,
        spouseHasIncome: false,
        dependents: 0,
        residencyMonths: 12
      });

      expect(byLabel(result, 'Basic deduction (2025)')).toBe(expectedBasic);
    }
  });

  it('applies spouse deduction phaseout and spouse-income gating', () => {
    const highBenefit = calcJapan2025Employment({
      annualSalaryJPY: 10_000_000,
      married: true,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const midBenefit = calcJapan2025Employment({
      annualSalaryJPY: 11_200_000,
      married: true,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const lowBenefit = calcJapan2025Employment({
      annualSalaryJPY: 11_500_000,
      married: true,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const spouseHasIncome = calcJapan2025Employment({
      annualSalaryJPY: 10_000_000,
      married: true,
      spouseHasIncome: true,
      dependents: 0,
      residencyMonths: 12
    });

    expect(byLabel(highBenefit, 'Spouse deduction')).toBe(380_000);
    expect(byLabel(midBenefit, 'Spouse deduction')).toBe(260_000);
    expect(byLabel(lowBenefit, 'Spouse deduction')).toBe(130_000);
    expect(byLabel(spouseHasIncome, 'Spouse deduction')).toBe(0);
  });

  it('keeps taxable income truncated to nearest 1,000 JPY', () => {
    const result = calcJapan2025Employment({
      annualSalaryJPY: 5_432_789,
      married: false,
      spouseHasIncome: false,
      dependents: 1,
      residencyMonths: 12
    });

    const taxable = byLabel(result, 'Taxable income after deductions');
    expect(taxable % 1_000).toBe(0);
  });

  it('computes resident tax component and accounting identity', () => {
    const salary = 8_000_000;
    const result = calcJapan2025Employment({
      annualSalaryJPY: salary,
      married: false,
      spouseHasIncome: false,
      dependents: 0,
      residencyMonths: 12
    });

    const deduction = employmentDeductionExpected(salary);
    const employmentIncome = Math.max(salary - deduction, 0);
    const socialInsurance = salary * 0.144;
    const residentTaxBase =
      Math.floor(Math.max(employmentIncome - (430_000 + socialInsurance), 0) / 1_000) * 1_000;
    const expectedResidentTax = Math.floor((residentTaxBase * 0.1 + 6_000) / 100) * 100;

    expect(result.residentTaxAnnualLocal).toBe(expectedResidentTax);

    const nationalTax = byLabel(result, 'National income tax incl. reconstruction surtax');
    const residentTax = byLabel(result, 'Resident tax (10% + per-capita levy)');
    expect(result.taxAnnualLocal).toBe(nationalTax + residentTax);

    expect(result.netAnnualLocal).toBe(
      result.grossAnnualLocal - result.taxAnnualLocal - result.employeeContribAnnualLocal
    );
  });
});
