import type { CountryCode } from '$lib/types';
import data from '$lib/data/costOfLiving.json';

export type HouseholdType = 'single' | 'couple' | 'family';

export interface HouseholdCoL {
  rent: number;
  utilities: number;
  groceries: number;
  consumables: number;
}

export interface CityCoL {
  id: string;
  name: string;
  neighbourhoods: string[];
  costs: Record<HouseholdType, HouseholdCoL>;
}

export const COL_VERSION = data.version;
export const COL_UPDATED_AT = data.updatedAt;

export function getHouseholdType(married: boolean, dependents: number): HouseholdType {
  if (dependents >= 1) return 'family';
  if (married) return 'couple';
  return 'single';
}

export const HOUSEHOLD_BEDROOMS: Record<HouseholdType, string> = {
  single: '1BR',
  couple: '2BR',
  family: '3BR'
};

export function totalMonthlyCoL(costs: HouseholdCoL): number {
  return costs.rent + costs.utilities + costs.groceries + costs.consumables;
}

export function getCitiesForCountry(country: CountryCode): CityCoL[] {
  const entry = (data.countries as Record<string, { currency: string; cities: CityCoL[] }>)[country];
  return entry?.cities ?? [];
}
