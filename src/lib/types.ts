export type Currency = 'JPY' | 'SEK' | 'THB' | 'CHF' | 'GBP' | 'USD' | 'MYR' | 'SGD' | 'INR';

export type CountryCode = 'JP' | 'SE' | 'TH' | 'CH' | 'UK' | 'USCA' | 'MY' | 'SG' | 'IN';

export type SalaryPeriod = 'annual' | 'monthly';

export interface ResidencyMonths {
  JP: number;
  SE: number;
  TH: number;
  CH: number;
  UK: number;
  USCA: number;
  MY: number;
  SG: number;
  IN: number;
}

export interface CalculatorInput {
  salaryAmount: number;
  salaryPeriod: SalaryPeriod;
  inputCurrency: Currency;
  displayCurrency: Currency;
  married: boolean;
  spouseHasIncome: boolean;
  dependents: number;
  age: number;
  residencyMonths: ResidencyMonths;
}

export interface FxRates {
  toJPY: Record<Currency, number>;
  updatedAt: string;
}

export type FxSource = 'live' | 'saved' | 'default';

export interface BreakdownItem {
  label: string;
  amount: number;
}

export interface CountryResult {
  country: CountryCode;
  currency: Currency;
  residencyStatus: string;
  grossAnnualLocal: number;
  taxAnnualLocal: number;
  residentTaxAnnualLocal: number;
  employeeContribAnnualLocal: number;
  netAnnualLocal: number;
  netMonthlyLocal: number;
  effectiveRate: number;
  breakdown: BreakdownItem[];
  assumptions: string[];
}

export interface ComparisonResult {
  annualInputInEnteredCurrency: number;
  displayCurrency: Currency;
  countries: CountryResult[];
}

export interface CountryMetadata {
  code: CountryCode;
  countryName: string;
  effectiveTaxYear: string;
  jurisdiction: string;
  sources: Array<{ title: string; url: string }>;
}
