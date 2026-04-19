# United Kingdom Income Tax — Implementation Spec

> **Purpose**: Machine-readable reference for implementing a UK income tax calculator.
> Sources: HMRC (gov.uk), House of Commons Library, Hargreaves Lansdown, Deloitte.
> Effective for tax year 2025/26 (6 April 2025 – 5 April 2026).
> Covers England, Wales and Northern Ireland. Scotland has different income tax
> rates (noted separately). All thresholds frozen until April 2028.

---

## 1. Tax Residency

```yaml
residency:
  uk_resident:
    statutory_residence_test:
      automatic_overseas: "Present in UK < 16 days (or < 46 days if not resident in any of prior 3 years)"
      automatic_uk: "Present in UK ≥ 183 days"
      sufficient_ties: "Between 16-182 days — depends on number of ties to UK (family, accommodation, work, 90-day, country)"
    scope: "Worldwide income (subject to new 4-year FIG regime from 2025/26)"
  non_resident:
    scope: "UK-sourced income only"

  new_fig_regime:  # Foreign Income and Gains — replaced remittance basis from 2025/26
    description: >
      Individuals in their first 4 years of UK residence (having been non-resident
      for prior 10 years) can claim exemption on most foreign income and gains.
    temporary_repatriation_facility:
      rate_2025_26: 0.12  # 12% on designated pre-2025 foreign income/gains brought to UK
      rate_2026_27: 0.12
      rate_2027_28: 0.15
```

---

## 2. Tax Year

```yaml
tax_year:
  start: "6 April 2025"
  end: "5 April 2026"
  note: "UK tax year runs April to April, NOT calendar year"
```

---

## 3. Income Tax Rates and Bands (England, Wales, Northern Ireland)

Source: https://www.gov.uk/income-tax-rates

```yaml
income_tax_bands_2025_26:
  personal_allowance:
    amount: 12_570
    taper:
      starts_at: 100_000
      rate: "£1 reduction per £2 above £100,000"
      fully_withdrawn_at: 125_140
      effective_marginal_rate: 0.60  # 40% tax + losing £1 allowance per £2 = 60% effective
    note: "Frozen at £12,570 until April 2028"

  basic_rate:
    range: "£12,571 – £50,270"
    band_width: 37_700
    rate: 0.20

  higher_rate:
    range: "£50,271 – £125,140"
    rate: 0.40

  additional_rate:
    range: "Above £125,140"
    rate: 0.45

brackets_for_calculator:
  # Applied to taxable income (income minus personal allowance)
  - { min: 0,       max: 37_700,    rate: 0.20, label: "basic" }
  - { min: 37_701,  max: 112_570,   rate: 0.40, label: "higher" }
  - { min: 112_571, max: null,       rate: 0.45, label: "additional" }
  note: >
    These are the bands AFTER the personal allowance is deducted.
    The higher-rate band upper limit = £125,140 - £12,570 = £112,570 of taxable income.
    But if PA is tapered, the bands shift. For implementation, calculate PA first,
    then apply bands to (gross_income - PA).
```

### Scotland (for reference — different rates)

```yaml
scotland_income_tax_2025_26:
  note: "Scotland sets its own rates for non-savings, non-dividend income"
  bands:
    - { range: "£12,571 – £15,397",  rate: 0.19, label: "starter" }
    - { range: "£15,398 – £27,491",  rate: 0.20, label: "basic" }
    - { range: "£27,492 – £43,662",  rate: 0.21, label: "intermediate" }
    - { range: "£43,663 – £75,000",  rate: 0.42, label: "higher" }
    - { range: "£75,001 – £125,140", rate: 0.45, label: "advanced" }
    - { range: "Above £125,140",     rate: 0.48, label: "top" }
```

---

## 4. National Insurance Contributions (NICs) — Employee Class 1

Source: https://www.gov.uk/national-insurance-rates-letters

```yaml
employee_nic_2025_26:
  class_1:
    primary_threshold: 12_570  # £242/week, £1,048/month — aligned with PA
    upper_earnings_limit: 50_270  # £967/week — aligned with higher-rate threshold
    main_rate: 0.08  # 8% between PT and UEL
    additional_rate: 0.02  # 2% above UEL
    lower_earnings_limit: 6_500  # £125/week — credits without payment
  note: >
    Rate was reduced from 12% → 10% (Jan 2024) → 8% (Apr 2024).
    NIC stops at State Pension age for employees (employer continues paying).

employer_nic_2025_26:
  secondary_threshold: 5_000  # reduced from £9,100 in 2024/25
  rate: 0.15  # increased from 13.8% in 2024/25
  employment_allowance: 10_500  # increased from £5,000; now available to most employers
  note: "Major change in 2025/26: higher rate + lower threshold = significantly higher employer costs"
```

### Self-employed NICs

```yaml
self_employed_nic_2025_26:
  class_2: "Abolished from April 2024 — voluntary only at £3.45/week"
  class_4:
    lower_profits_limit: 12_570
    upper_profits_limit: 50_270
    main_rate: 0.06  # 6% (reduced from 8% in 2024/25)
    additional_rate: 0.02  # 2% above UPL
```

---

## 5. Personal Allowance and Deductions

### 5.1 Personal Allowance

```yaml
personal_allowance:
  standard: 12_570
  blind_persons_allowance: 3_130  # additional
  marriage_allowance:
    transferable: 1_260  # 10% of PA
    condition: "Can transfer to spouse/civil partner if recipient is basic-rate taxpayer only"
    tax_saving: 252  # £1,260 × 20%
  taper:
    description: "PA reduced by £1 for every £2 above £100,000 adjusted net income"
    implementation: |
      if adjusted_net_income > 100_000:
          pa_reduction = min((adjusted_net_income - 100_000) / 2, 12_570)
          personal_allowance = 12_570 - pa_reduction
      # PA = 0 when income ≥ £125,140
```

### 5.2 Income Tax Reliefs and Deductions

```yaml
pension_contributions:
  annual_allowance: 60_000
  tax_relief: "At marginal rate (20/40/45%)"
  carry_forward: "Unused allowance from previous 3 years"
  tapered_annual_allowance:
    threshold_income: 200_000
    adjusted_income: 260_000
    taper: "£1 reduction per £2 above adjusted income threshold"
    minimum: 10_000
  note: >
    Pension contributions are deducted from income before tax is calculated.
    This also extends the basic-rate band for CGT purposes.
    Strategy: Contributing to bring income below £100,000 restores the PA.

gift_aid:
  description: "Extends basic-rate band by gross amount of donation"
  formula: "Gross donation = net donation × 100/80"
  note: "Higher/additional-rate taxpayers claim extra relief via Self Assessment"

isa_allowance:
  annual: 20_000
  note: "All income and gains within ISA are tax-free. No reporting needed."

venture_capital_schemes:
  eis: { relief: 0.30, max_investment: 1_000_000, hold_period: 3 }
  seis: { relief: 0.50, max_investment: 200_000, hold_period: 3 }
  vct: { relief: 0.30, max_investment: 200_000, hold_period: 5 }
```

---

## 6. Savings and Dividend Income

UK has special rules for stacking income types and applying different rates.

### 6.1 Income Stacking Order

```
1. Non-savings, non-dividend income (employment, pensions, property, business)
   → Uses Personal Allowance first
   → Taxed at 20/40/45%

2. Savings income (interest)
   → Stacked on top of non-savings income
   → May benefit from savings starter rate and PSA

3. Dividend income
   → Stacked on top of savings income
   → Different rates apply
```

### 6.2 Savings Income

```yaml
savings_income:
  personal_savings_allowance:
    basic_rate_taxpayer: 1_000
    higher_rate_taxpayer: 500
    additional_rate_taxpayer: 0
  savings_starter_rate:
    band: 5_000  # 0% rate on first £5,000 of savings income
    condition: "Only if non-savings income ≤ £17,570 (PA + £5,000)"
    note: "Reduced £1 for £1 by non-savings income above PA"
  rates_above_allowances:
    basic: 0.20
    higher: 0.40
    additional: 0.45
```

### 6.3 Dividend Income

```yaml
dividend_income:
  dividend_allowance: 500  # 0% rate on first £500
  rates:
    basic: 0.0875     # 8.75%
    higher: 0.3375    # 33.75%
    additional: 0.3935 # 39.35%
  note: "Allowance reduced from £2,000 (2022/23) → £1,000 (2023/24) → £500 (2024/25+)"
```

---

## 7. Capital Gains Tax (CGT)

```yaml
capital_gains_tax_2025_26:
  annual_exempt_amount: 3_000  # was £12,300 in 2022/23, £6,000 in 2023/24
  rates:
    standard_assets:
      basic_rate: 0.18  # increased from 10% in Oct 2024
      higher_rate: 0.24  # increased from 20% in Oct 2024
    residential_property:
      basic_rate: 0.18
      higher_rate: 0.24
    business_asset_disposal_relief:
      rate: 0.14  # increasing to 14% from 10% (transitional from Apr 2025)
      lifetime_limit: 1_000_000
  note: >
    The rate depends on which income tax band the gain falls into when
    stacked on top of income. If total income + gains exceeds £50,270,
    the excess is taxed at the higher rate.
  reporting:
    property: "Must report and pay within 60 days of completion"
    other: "Reported on Self Assessment tax return"
```

---

## 8. Calculation Flow

```
STEP 1: Calculate total income
  total_income = employment + self_employment + rental + pension + savings + dividends + other

STEP 2: Subtract allowable deductions (pension contributions, trading losses)
  adjusted_net_income = total_income - pension_contributions_gross - losses

STEP 3: Calculate Personal Allowance (with taper if applicable)
  if adjusted_net_income > 100,000:
      pa = max(12,570 - (adjusted_net_income - 100,000) / 2, 0)
  else:
      pa = 12,570

STEP 4: Calculate taxable income by type (stacking order)
  taxable_non_savings = max(non_savings_income - pa, 0)
  remaining_pa = max(pa - non_savings_income, 0)
  taxable_savings = max(savings_income - remaining_pa, 0)
  taxable_dividends = dividend_income  # PA already used; dividend allowance applied to tax

STEP 5: Apply income tax bands to non-savings income
  (Apply 20% / 40% / 45% to taxable_non_savings)

STEP 6: Apply savings rates (considering PSA and starter rate)

STEP 7: Apply dividend rates (considering £500 allowance)

STEP 8: Total income tax = sum of all three

STEP 9: Calculate Employee NICs
  nic = (min(gross_employment, 50_270) - 12_570) * 0.08
      + max(gross_employment - 50_270, 0) * 0.02

STEP 10: Subtract tax credits and reliefs

STEP 11: Total tax = income_tax + nic
```

---

## 9. Pseudocode

```python
import math

def uk_income_tax(
    employment_income: float = 0,
    self_employment_profit: float = 0,
    rental_income: float = 0,
    savings_income: float = 0,
    dividend_income: float = 0,
    pension_contributions_gross: float = 0,
    is_scottish: bool = False,
    age_over_state_pension: bool = False,
) -> dict:

    # --- STEP 1-2: Adjusted net income ---
    total_income = employment_income + self_employment_profit + rental_income + savings_income + dividend_income
    adjusted = total_income - pension_contributions_gross
    adjusted = max(adjusted, 0)

    # --- STEP 3: Personal Allowance ---
    pa = 12_570
    if adjusted > 100_000:
        pa = max(12_570 - math.floor((adjusted - 100_000) / 2), 0)

    # --- STEP 4: Taxable income by type ---
    non_savings = employment_income + self_employment_profit + rental_income - pension_contributions_gross
    non_savings = max(non_savings, 0)

    taxable_non_savings = max(non_savings - pa, 0)
    remaining_pa = max(pa - non_savings, 0)
    taxable_savings = max(savings_income - remaining_pa, 0)
    # Dividends: PA already used above

    # --- STEP 5: Income tax on non-savings ---
    def calc_ewni_tax(taxable):
        """England/Wales/NI bands"""
        tax = 0
        bands = [(37_700, 0.20), (112_570, 0.40), (float("inf"), 0.45)]
        prev = 0
        for upper, rate in bands:
            if taxable <= prev: break
            tax += (min(taxable, upper) - prev) * rate
            prev = upper
        return tax

    non_savings_tax = calc_ewni_tax(taxable_non_savings)

    # Band position after non-savings (for savings/dividends stacking)
    used_basic = min(taxable_non_savings, 37_700)
    remaining_basic = 37_700 - used_basic

    # --- STEP 6: Savings tax (simplified — ignoring starter rate/PSA for brevity) ---
    psa = 1_000 if taxable_non_savings <= 37_700 else (500 if taxable_non_savings <= 112_570 else 0)
    taxable_savings_after_psa = max(taxable_savings - psa, 0)

    savings_in_basic = min(taxable_savings_after_psa, remaining_basic)
    savings_in_higher = max(taxable_savings_after_psa - remaining_basic, 0)
    savings_tax = savings_in_basic * 0.20 + savings_in_higher * 0.40
    remaining_basic -= savings_in_basic

    # --- STEP 7: Dividend tax ---
    dividend_allowance = 500
    taxable_dividends = max(dividend_income - dividend_allowance, 0)

    div_in_basic = min(taxable_dividends, remaining_basic)
    div_in_higher = max(taxable_dividends - remaining_basic, 0)
    # Simplified: not splitting higher vs additional for dividends
    dividend_tax = div_in_basic * 0.0875 + div_in_higher * 0.3375

    total_income_tax = non_savings_tax + savings_tax + dividend_tax

    # --- STEP 8: Employee NICs ---
    if age_over_state_pension:
        employee_nic = 0
    else:
        earnings = employment_income
        nic_main = max(min(earnings, 50_270) - 12_570, 0) * 0.08
        nic_additional = max(earnings - 50_270, 0) * 0.02
        employee_nic = nic_main + nic_additional

    # Self-employed Class 4
    se_nic = 0
    if self_employment_profit > 0:
        se_main = max(min(self_employment_profit, 50_270) - 12_570, 0) * 0.06
        se_additional = max(self_employment_profit - 50_270, 0) * 0.02
        se_nic = se_main + se_additional

    total_nic = employee_nic + se_nic
    total_tax = total_income_tax + total_nic

    return {
        "total_income": round(total_income),
        "adjusted_net_income": round(adjusted),
        "personal_allowance": pa,
        "taxable_non_savings": round(taxable_non_savings),
        "income_tax": round(total_income_tax),
        "employee_nic": round(employee_nic),
        "self_employed_nic": round(se_nic),
        "total_nic": round(total_nic),
        "total_tax_and_nic": round(total_tax),
        "effective_rate": round(total_tax / total_income * 100, 1) if total_income > 0 else 0,
    }
```

---

## 10. Test Cases

### Case A: Employee earning £50,000

```
Personal Allowance: £12,570
Taxable: £37,430

Income Tax:
  £37,430 × 20% = £7,486

NICs:
  (£50,000 - £12,570) × 8% = £2,994.40

Total: £7,486 + £2,994 = £10,480
Effective rate: 21.0%
```

### Case B: Employee earning £120,000

```
Personal Allowance: 12,570 - (120,000 - 100,000)/2 = 12,570 - 10,000 = £2,570
Taxable: £117,430

Income Tax:
  £37,700 × 20% = £7,540
  £79,730 × 40% = £31,892
  Total: £39,432

NICs:
  (£50,270 - £12,570) × 8% = £3,016
  (£120,000 - £50,270) × 2% = £1,394.60
  Total: £4,411

Total: £39,432 + £4,411 = £43,843
Effective rate: 36.5%
```

### Case C: The £100K trap — Employee earning £125,140

```
Personal Allowance: £0 (fully tapered away)
Taxable: £125,140

Income Tax:
  £37,700 × 20% = £7,540
  £87,440 × 40% = £34,976
  Total: £42,516

Note: Between £100K and £125,140, the effective marginal rate is 60%
(40% tax + losing £1 PA per £2 = extra 20% effective tax on the lost PA)
```

---

## 11. Filing

```yaml
filing:
  self_assessment:
    registration_deadline: "5 October following end of tax year"
    paper_deadline: "31 October"
    online_deadline: "31 January following end of tax year"
    payment_deadline: "31 January"
    payments_on_account:
      dates: ["31 January", "31 July"]
      condition: "If tax bill > £1,000 and < 80% collected via PAYE"

  paye:
    description: "Most employees — tax collected automatically by employer each pay period"
    year_end: "Employer submits P60 by 31 May"

  who_must_file:
    - "Self-employed income"
    - "Rental income"
    - "Total income > £150,000"
    - "Capital gains above annual exempt amount"
    - "Claiming tax reliefs not handled through PAYE"
    - "High Income Child Benefit Charge applies"

  penalties:
    late_filing: "£100 initial, then £10/day after 3 months, then % of tax owed"
    late_payment: "5% of unpaid tax at 30 days, further 5% at 6 months and 12 months"
```

---

## 12. Key UK-Specific Concepts for Calculator

```yaml
implementation_notes:
  income_stacking:
    description: >
      UK taxes different income types at different rates, stacked in order:
      1) Non-savings/non-dividend (employment, business, rental)
      2) Savings (interest)
      3) Dividends
      The BAND that applies depends on where each type falls in the stack.
    importance: "Critical for correct calculation — cannot just sum income and apply one rate"

  the_100k_trap:
    description: >
      Between £100,000 and £125,140, the PA taper creates an effective 60% marginal rate.
      This is HIGHER than the 45% additional rate. Key planning opportunity:
      pension contributions can bring adjusted income below £100K.
    implementation: "Must calculate PA taper before applying bands"

  no_standard_deduction:
    description: >
      Unlike the US or Thailand, the UK has NO standard deduction.
      The Personal Allowance is the tax-free amount — there is no separate
      choice between standard vs itemized.

  nic_is_separate:
    description: >
      NICs are a completely separate tax from income tax, with different
      thresholds and rates. They must be calculated independently.
      NICs do NOT apply to savings, dividends, or rental income.

  employer_nic_invisible:
    description: >
      Employer NICs (15%) are paid ON TOP of salary — not deducted from it.
      Like Sweden's arbetsgivaravgifter, invisible to the employee but real cost.
```

---

## 13. Key Differences from Other Countries

```yaml
comparison:
  tax_year:
    uk: "6 April – 5 April (unique)"
    all_others: "Calendar year (Jan–Dec)"

  income_stacking:
    uk: "Three income types taxed at different rates, stacked in specific order"
    us: "Ordinary income + separate LTCG rates"
    japan: "10 types, comprehensive vs separate taxation"
    sweden: "3 categories, capital completely separate at 30%"
    thailand: "All income combined into one progressive calculation"

  personal_allowance_taper:
    uk: "PA tapered £1 per £2 above £100K → 60% effective rate trap"
    others: "No equivalent trap in other countries covered"

  nic_vs_payroll:
    uk: "Employee 8%/2% + Employer 15% (separate from income tax)"
    us: "FICA 7.65% employee + 7.65% employer"
    japan: "~15% employee social insurance"
    sweden: "31.42% employer-only"
    thailand: "5% employee, 5% employer (capped)"

  capital_gains:
    uk: "18%/24% (residential property same rates from Oct 2024)"
    us: "0/15/20% federal LTCG + CA taxes as ordinary income"
    japan: "20.315% flat"
    sweden: "30% flat (within capital income)"
    thailand: "Generally added to progressive rates"

  dividends:
    uk: "Special dividend rates: 8.75/33.75/39.35% (unique system)"
    us: "Qualified dividends at LTCG rates (0/15/20%)"
    japan: "20.315% separate or comprehensive option"
    sweden: "30% flat capital income"
    thailand: "10% withholding or add to progressive"
```

---

## 14. Official Sources

| Topic | URL |
|---|---|
| Income tax rates and PA (GOV.UK) | https://www.gov.uk/income-tax-rates |
| Employer rates and thresholds 2025/26 | https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2025-to-2026 |
| NIC rates and categories | https://www.gov.uk/national-insurance-rates-letters |
| House of Commons — Direct taxes 2025/26 | https://commonslibrary.parliament.uk/research-briefings/cbp-10237/ |
| House of Commons — CGT developments | https://commonslibrary.parliament.uk/research-briefings/sn05572/ |
| Hargreaves Lansdown tax facts | https://www.hl.co.uk/tools/tax-facts |
| Deloitte tax rates 2026/27 (PDF) | https://taxscape.deloitte.com/taxtables/deloitte-uk-tax-rates-2026-27.pdf |
| Bishop Fleming tax tables 2025/26 (PDF) | https://www.bishopfleming.co.uk/sites/default/files/2024-11/bishop_fleming_tax_tables_2025_to_2026.pdf |
| HMRC Self Assessment overview | https://www.gov.uk/self-assessment-tax-returns |
| FIG regime (new from 2025/26) | https://www.gov.uk/government/publications/changes-to-the-taxation-of-non-uk-domiciled-individuals |
