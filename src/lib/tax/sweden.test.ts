import { describe, expect, it } from 'vitest';
import { calcSweden2025Employment } from '$lib/tax/sweden';

const PBB_2025 = 58_800;
const MUNICIPAL_RATE = 0.3241;

function byLabel(result: ReturnType<typeof calcSweden2025Employment>, label: string): number {
  const found = result.breakdown.find((item) => item.label === label);
  if (!found) {
    throw new Error(`Missing breakdown label: ${label}`);
  }
  return found.amount;
}

function expectedStandardGA(ffi: number): number {
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

  const bounded = Math.min(ga, ffi);
  return Math.ceil(bounded / 100) * 100;
}

describe('calcSweden2025Employment', () => {
  it('switches to resident calculation at 6 months threshold', () => {
    const nonResident = calcSweden2025Employment({
      annualSalarySEK: 600_000,
      age: 30,
      residencyMonths: 5
    });

    const resident = calcSweden2025Employment({
      annualSalarySEK: 600_000,
      age: 30,
      residencyMonths: 6
    });

    expect(nonResident.residencyStatus).toContain('SINK');
    expect(nonResident.taxAnnualLocal).toBe(150_000);
    expect(resident.residencyStatus).toContain('Unlimited');
    expect(resident.taxAnnualLocal).toBeLessThan(150_000);
  });

  it('uses standard grundavdrag piecewise formula values', () => {
    const ffiCases = [50_000, 100_000, 170_000, 300_000, 500_000];

    for (const ffi of ffiCases) {
      const result = calcSweden2025Employment({
        annualSalarySEK: ffi,
        age: 30,
        residencyMonths: 12,
        municipalRate: MUNICIPAL_RATE
      });

      expect(byLabel(result, 'Grundavdrag')).toBe(expectedStandardGA(Math.floor(ffi / 100) * 100));
    }
  });

  it('computes state tax from taxable earned income threshold', () => {
    const below = calcSweden2025Employment({
      annualSalarySEK: 650_000,
      age: 30,
      residencyMonths: 12,
      municipalRate: MUNICIPAL_RATE
    });

    const above = calcSweden2025Employment({
      annualSalarySEK: 900_000,
      age: 30,
      residencyMonths: 12,
      municipalRate: MUNICIPAL_RATE
    });

    const taxableBelow = byLabel(below, 'Taxable earned income');
    const taxableAbove = byLabel(above, 'Taxable earned income');

    const expectedStateBelow = Math.round(Math.max(taxableBelow - 625_800, 0) * 0.2);
    const expectedStateAbove = Math.round(Math.max(taxableAbove - 625_800, 0) * 0.2);

    expect(byLabel(below, 'State income tax')).toBe(expectedStateBelow);
    expect(byLabel(above, 'State income tax')).toBe(expectedStateAbove);
    expect(byLabel(above, 'State income tax')).toBeGreaterThan(0);
  });

  it('caps jobbskatteavdrag at 48,000 for high salary', () => {
    const result = calcSweden2025Employment({
      annualSalarySEK: 2_000_000,
      age: 35,
      residencyMonths: 12,
      municipalRate: MUNICIPAL_RATE
    });

    expect(byLabel(result, 'Jobbskatteavdrag')).toBe(48_000);
  });

  it('sets jobbskatteavdrag to 0 for age 66+ branch and increases grundavdrag', () => {
    const younger = calcSweden2025Employment({
      annualSalarySEK: 500_000,
      age: 40,
      residencyMonths: 12,
      municipalRate: MUNICIPAL_RATE
    });

    const older = calcSweden2025Employment({
      annualSalarySEK: 500_000,
      age: 67,
      residencyMonths: 12,
      municipalRate: MUNICIPAL_RATE
    });

    expect(byLabel(older, 'Jobbskatteavdrag')).toBe(0);
    expect(byLabel(older, 'Grundavdrag')).toBeGreaterThan(byLabel(younger, 'Grundavdrag'));
  });

  it('reports resident/local tax component as municipal tax', () => {
    const result = calcSweden2025Employment({
      annualSalarySEK: 800_000,
      age: 30,
      residencyMonths: 12,
      municipalRate: MUNICIPAL_RATE
    });

    expect(result.residentTaxAnnualLocal).toBe(byLabel(result, 'Municipal tax'));
    expect(result.residentTaxAnnualLocal).toBeGreaterThan(0);
  });

  it('satisfies accounting identity for resident and non-resident paths', () => {
    const resident = calcSweden2025Employment({
      annualSalarySEK: 800_000,
      age: 30,
      residencyMonths: 12,
      municipalRate: MUNICIPAL_RATE
    });
    const nonResident = calcSweden2025Employment({
      annualSalarySEK: 800_000,
      age: 30,
      residencyMonths: 2,
      municipalRate: MUNICIPAL_RATE
    });

    expect(resident.netAnnualLocal).toBe(resident.grossAnnualLocal - resident.taxAnnualLocal);
    expect(nonResident.netAnnualLocal).toBe(nonResident.grossAnnualLocal - nonResident.taxAnnualLocal);
  });
});
