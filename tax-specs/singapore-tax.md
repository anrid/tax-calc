# Singapore Income Tax — Implementation Spec

> **Purpose**: Machine-readable reference for implementing a Singapore income tax calculator.
> Sources: IRAS (iras.gov.sg), PwC Tax Summaries, QuickBooks SG.
> Effective for Year of Assessment (YA) 2026 — income earned 1 January to 31 December 2025.
> Currency: SGD (S$).

---

## 1. Tax Residency

```yaml
residency:
  tax_resident:
    conditions_any:
      - "Singapore Citizen (SC) normally residing in Singapore"
      - "Singapore Permanent Resident (SPR) normally residing in Singapore"
      - "Foreigner who stayed/worked in Singapore ≥ 183 days in the calendar year"
      - "Foreigner who worked in Singapore for a continuous period straddling 2 calendar years totaling ≥ 183 days"
    scope: "Singapore-sourced income + foreign income ONLY if received in Singapore"
    note: "Singapore uses TERRITORIAL taxation — foreign-sourced income generally NOT taxed even if remitted (with exemptions for individuals)"

  non_resident:
    employment_income: "15% flat OR progressive resident rates, whichever yields HIGHER tax"
    director_fees: 0.24  # flat 24%
    other_income: 0.24   # flat 24% (rental, consultation, etc.)
    note: "Non-residents cannot claim personal reliefs"

  special_183_day_rule:
    fewer_than_60_days: "Employment income EXEMPT (short-term visit exemption)"
    60_to_182_days: "Non-resident rates apply (15% flat or progressive)"
    183_plus: "Tax resident — progressive rates + reliefs"
```

---

## 2. Tax Year

```yaml
tax_year:
  basis: "Preceding year — YA 2026 covers income earned 1 Jan – 31 Dec 2025"
  note: "Calendar year basis, unlike India (April-March) or UK (April-April)"
```

---

## 3. Resident Income Tax Brackets (YA 2026)

Source: https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates

```yaml
resident_brackets_ya2026:
  - { min: 0,         max: 20_000,     rate: 0.00,   tax_at_max: 0 }
  - { min: 20_001,    max: 30_000,     rate: 0.02,   tax_at_max: 200 }
  - { min: 30_001,    max: 40_000,     rate: 0.035,  tax_at_max: 550 }
  - { min: 40_001,    max: 80_000,     rate: 0.07,   tax_at_max: 3_350 }
  - { min: 80_001,    max: 120_000,    rate: 0.115,  tax_at_max: 7_950 }
  - { min: 120_001,   max: 160_000,    rate: 0.15,   tax_at_max: 13_950 }
  - { min: 160_001,   max: 200_000,    rate: 0.18,   tax_at_max: 21_150 }
  - { min: 200_001,   max: 240_000,    rate: 0.19,   tax_at_max: 28_750 }
  - { min: 240_001,   max: 280_000,    rate: 0.195,  tax_at_max: 36_550 }
  - { min: 280_001,   max: 320_000,    rate: 0.20,   tax_at_max: 44_550 }
  - { min: 320_001,   max: 500_000,    rate: 0.22,   tax_at_max: 84_150 }
  - { min: 500_001,   max: 1_000_000,  rate: 0.23,   tax_at_max: 199_150 }
  - { min: 1_000_001, max: null,        rate: 0.24,   tax_at_max: null }

max_rate: 0.24
note: >
  13 brackets from 0% to 24%. The 23% and 24% brackets were added
  from YA 2024 (previously top rate was 22%). Applied to chargeable income
  (after reliefs and deductions).
```

### YA 2025 Personal Income Tax Rebate

```yaml
ya2025_rebate:
  rate: 0.60  # 60% of tax payable
  cap: 200    # maximum S$200
  note: "Applied automatically by IRAS. Only for tax resident individuals."
  for_ya: "YA 2025 (income earned 2024)"

ya2026_rebate:
  rate: 0.60
  cap: 200
  note: "Also applicable for YA 2026 (income earned 2025)"
```

---

## 4. Personal Reliefs (YA 2026)

All amounts in SGD. Total reliefs capped at S$80,000 per YA.

```yaml
personal_reliefs:
  overall_cap: 80_000

  earned_income_relief:
    below_55: 1_000
    age_55_to_59: 6_000
    age_60_plus: 8_000
    condition: "Must have earned income (employment, trade, etc.)"
    disabled: "Additional ₹4,000"

  spouse_relief:
    amount: 2_000
    condition: "Spouse lived with taxpayer, had income ≤ S$4,000"
    disabled_spouse: 5_500

  child_relief:
    qualifying_child: 4_000  # per child
    handicapped_child: 7_500
    working_mother_child_relief:
      rates: "15% of earned income for 1st child, 20% for 2nd, 25% for 3rd+"
      cap: 50_000  # combined across all children
      condition: "Working married/divorced/widowed mother"

  parent_relief:
    living_with: 9_000
    not_living_with: 5_500
    handicapped_parent_living_with: 14_000
    handicapped_parent_not_living_with: 10_000
    condition: "Parent is 55+ or handicapped, income ≤ S$4,000"

  cpf_relief:
    amount: "Actual employee CPF contributions"
    max: "Depends on age and OW ceiling — up to ~S$20,400 for age ≤55"
    note: "This is the largest relief for most salaried SC/SPR workers"

  cpf_cash_top_up_relief:
    self: 8_000
    family_member: 8_000
    total_max: 16_000
    note: "Voluntary top-ups to own or family member's Retirement Account"

  srs_relief:  # Supplementary Retirement Scheme
    sc_spr: 15_300  # max annual contribution
    foreigner: 35_700
    note: "Tax-deductible contribution; only 50% of withdrawals taxed at retirement"

  course_fees_relief:
    max: 5_500
    covers: "Approved courses for professional development"

  life_insurance_relief:
    max: 5_000
    condition: "Only claimable if CPF contributions < S$5,000"
    note: "Most employees won't qualify since CPF exceeds this"

  nsman_relief:  # National Service
    active: 3_000
    key_appointment: 3_500
    wife_of_nsman: 750
    parent_of_nsman: 750

  foreign_domestic_worker_levy_relief:
    amount: "2× annual levy paid"
    condition: "Working married women, widows, divorcees"
```

---

## 5. Central Provident Fund (CPF)

Singapore's mandatory savings system — applies to SC and SPR only. NOT applicable to foreigners on Employment Pass/S Pass.

```yaml
cpf_2025:
  ordinary_wage_ceiling:
    monthly: 7_400  # increases to 8,000 from Jan 2026
    annual: 88_800  # 7,400 × 12
  additional_wage_ceiling: "AW ceiling = S$102,000 – total OW subject to CPF in year"

  contribution_rates_age_55_and_below:
    employee: 0.20  # 20%
    employer: 0.17  # 17%
    total: 0.37     # 37%

  contribution_rates_by_age:
    - { age: "≤ 55",  employee: 0.20, employer: 0.17, total: 0.37 }
    - { age: "56-60", employee: 0.15, employer: 0.15, total: 0.30 }  # increasing from 2026
    - { age: "61-65", employee: 0.095, employer: 0.115, total: 0.21 }  # increasing from 2026
    - { age: "66-70", employee: 0.075, employer: 0.085, total: 0.16 }
    - { age: "> 70",  employee: 0.05, employer: 0.075, total: 0.125 }

  spr_graduated_rates: >
    SPRs in 1st/2nd year of PR have reduced rates. Full rates from 3rd year.
    Employee can opt for full rates during graduated period.

  foreigners: "NO CPF — Employment Pass / S Pass holders are exempt"

  max_employee_contribution_annual: 17_760  # 7,400 × 12 × 20% (age ≤ 55, 2025)

  tax_treatment:
    employee_contribution: "Fully deductible as CPF Relief"
    employer_contribution: "Not taxable to employee (up to statutory limits)"
```

---

## 6. Capital Gains and Other Income

```yaml
capital_gains:
  general: "NO capital gains tax in Singapore"
  note: >
    Singapore does not impose capital gains tax. Profits from sale of
    shares, property (except property within 3 years via SSD), investments,
    and crypto are NOT taxable — unless IRAS determines the taxpayer is
    trading as a business (badges of trade test).

  seller_stamp_duty:
    residential_property:
      holding_1_year: 0.12
      holding_2_years: 0.08
      holding_3_years: 0.04
      after_3_years: 0.00
    industrial_property:
      holding_1_year: 0.15
      holding_2_years: 0.10
      holding_3_years: 0.05
      after_3_years: 0.00
    note: "SSD is NOT income tax but acts as a short-term CGT equivalent for property"

dividends:
  single_tier: "Tax-exempt — Singapore-sourced dividends from companies that paid corporate tax are not taxed again"
  foreign_dividends: "Generally exempt if received by individuals (not business income)"

interest_income:
  singapore_banks: "Tax-exempt for individuals (deposits with approved banks)"
  foreign_interest: "Exempt if received by individuals"

rental_income:
  taxable: true
  deductions: "Mortgage interest, property tax, maintenance, agent commission (actual expenses)"
  note: "Added to employment income and taxed at progressive rates"
```

---

## 7. Calculation Flow

```
STEP 1: Total Income
  total = employment + trade/business + rental + other (interest, royalties)
  NOTE: dividends, bank interest, capital gains generally exempt

STEP 2: Subtract allowable expenses
  employment_income = salary + bonus + benefits - employment_expenses

STEP 3: Subtract personal reliefs (capped at S$80,000 total)
  chargeable_income = total_income - earned_income_relief - cpf_relief
                    - spouse/child/parent reliefs - srs - course_fees - ...

STEP 4: Apply progressive tax brackets

STEP 5: Apply YA rebate (60%, max S$200 for YA 2025/2026)

STEP 6: Tax payable = bracket tax - rebate

STEP 7: Subtract withholding / GIRO payments
  Balance = tax due or credit
```

---

## 8. Pseudocode

```python
def singapore_income_tax(
    employment_income: float = 0,
    rental_income: float = 0,
    other_taxable_income: float = 0,
    is_resident: bool = True,
    age: int = 35,
    is_sc_spr: bool = True,
    # Reliefs
    cpf_employee_contributions: float = 0,
    cpf_cash_top_up: float = 0,
    srs_contributions: float = 0,
    spouse_relief: float = 0,
    child_relief: float = 0,
    parent_relief: float = 0,
    course_fees: float = 0,
    # Rebate
    apply_ya2025_rebate: bool = True,
) -> dict:

    total_income = employment_income + rental_income + other_taxable_income

    if not is_resident:
        # Non-resident: 15% flat on employment or progressive, whichever higher
        nr_flat = employment_income * 0.15
        nr_other = (rental_income + other_taxable_income) * 0.24
        return {
            "is_resident": False,
            "total_income": total_income,
            "tax": round(nr_flat + nr_other, 2),
        }

    # --- Reliefs ---
    earned_income = 1_000 if age < 55 else (6_000 if age < 60 else 8_000)
    cpf = min(cpf_employee_contributions, 20_400)
    srs = min(srs_contributions, 15_300 if is_sc_spr else 35_700)
    top_up = min(cpf_cash_top_up, 16_000)
    courses = min(course_fees, 5_500)

    total_reliefs = (earned_income + cpf + srs + top_up + courses
                     + spouse_relief + child_relief + parent_relief)
    total_reliefs = min(total_reliefs, 80_000)  # overall cap

    chargeable = max(total_income - total_reliefs, 0)

    # --- Progressive brackets (YA 2026) ---
    BRACKETS = [
        (20_000, 0), (30_000, 0.02), (40_000, 0.035), (80_000, 0.07),
        (120_000, 0.115), (160_000, 0.15), (200_000, 0.18),
        (240_000, 0.19), (280_000, 0.195), (320_000, 0.20),
        (500_000, 0.22), (1_000_000, 0.23), (float("inf"), 0.24)
    ]

    tax = 0
    prev = 0
    for upper, rate in BRACKETS:
        if chargeable <= prev:
            break
        tax += (min(chargeable, upper) - prev) * rate
        prev = upper

    # --- Rebate (YA 2025/2026) ---
    if apply_ya2025_rebate:
        rebate = min(tax * 0.60, 200)
        tax = max(tax - rebate, 0)
    else:
        rebate = 0

    return {
        "is_resident": True,
        "total_income": round(total_income),
        "total_reliefs": round(total_reliefs),
        "chargeable_income": round(chargeable),
        "gross_tax": round(tax + rebate),
        "rebate": round(rebate),
        "tax_payable": round(tax),
        "effective_rate": round(tax / total_income * 100, 2) if total_income > 0 else 0,
    }
```

---

## 9. Test Cases

### Case A: SC, S$80,000 salary, age 35

```
Employment: 80,000
CPF employee (20%): 16,000 (on OW up to S$80,000)
Earned income relief: 1,000
Total reliefs: 17,000

Chargeable: 63,000
Tax:
  First 40,000: 550
  Next 23,000 at 7%: 1,610
  Total: 2,160
YA rebate: min(2,160 × 60%, 200) = 200
Tax payable: 1,960
Effective rate: 2.45%
```

### Case B: SC, S$200,000 salary, age 40

```
Employment: 200,000
CPF employee: 17,760 (OW ceiling 7,400/month × 12 × 20%)
SRS: 15,300
Earned income: 1,000
Reliefs: 34,060

Chargeable: 165,940
Tax:
  First 160,000: 13,950
  Next 5,940 at 18%: 1,069
  Total: 15,019
YA rebate: 200
Tax payable: 14,819
Effective rate: 7.41%
```

### Case C: Foreigner on EP, S$150,000 salary

```
No CPF (foreigner). No reliefs (non-resident or minimal).
If resident (≥183 days):
  Chargeable: 150,000 - 1,000 (earned income) = 149,000
  Tax: 13,950 + (149,000 - 160,000 is negative, so...)
    Actually: first 120,000 = 7,950 + next 29,000 at 15% = 4,350 = 12,300
  Effective: ~8.2%

If non-resident:
  15% flat: 22,500 (higher than progressive)
  Must use 15% flat = 22,500
```

---

## 10. Filing

```yaml
filing:
  deadline:
    paper: "15 April"
    e_filing: "18 April"
    note: "For income earned in preceding calendar year"
  portal: "https://www.iras.gov.sg/taxes/individual-income-tax"
  no_filing_service:
    description: >
      Most employees need not file if employer participates in Auto-Inclusion
      Scheme (AIS). IRAS sends a pre-filled assessment (No-Filing Service).
    eligibility: "Employment income only, no other income, no reliefs to claim beyond auto-included"
  payment: "By GIRO (monthly instalments) or one-time payment"
  penalties:
    late_filing: "Fine up to S$1,000; court summons for persistent non-filing"
    late_payment: "5% penalty, additional 1% per month (max 12%)"
```

---

## 11. Key Singapore-Specific Concepts

```yaml
implementation_notes:
  territorial_taxation:
    description: >
      Singapore taxes only Singapore-sourced income for individuals.
      Foreign-sourced income received in Singapore by individuals is
      generally EXEMPT (unlike companies which may be taxed).
    significance: "No tax on overseas investment gains, foreign dividends, offshore interest"

  no_capital_gains_tax:
    description: "No CGT on shares, property (after SSD period), crypto, investments"
    exception: "If IRAS deems you a trader (badges of trade), gains become business income"
    ssd: "Seller's Stamp Duty on property held < 3 years acts as a pseudo-CGT"

  cpf_is_the_biggest_relief:
    description: >
      For SC/SPR employees, CPF employee contribution (20% of wages up to
      OW ceiling) is the single largest tax deduction. This means most
      Singaporean workers have an effective tax rate much lower than the
      headline bracket suggests.

  extremely_low_effective_rates:
    description: >
      Most professionals earning S$60K-120K pay only 3-7% effective tax.
      Singapore's effective rates are among the lowest in developed nations.

  foreigners_no_cpf:
    description: >
      Foreigners on Employment Pass do NOT contribute to CPF, cannot claim
      CPF Relief, and therefore have a higher chargeable income — but still
      benefit from low progressive rates (if resident).

  no_inheritance_estate_tax:
    description: "Abolished in 2008. No estate tax, no gift tax."
```

---

## 12. Key Differences from Other Countries

```yaml
comparison:
  tax_scope:
    singapore: "Territorial — foreign income generally exempt for individuals"
    malaysia: "Also territorial with remittance exemption until 2036"
    thailand: "Territorial with remittance basis (from 2024)"
    all_others: "Worldwide (Japan, Sweden, US, UK, Switzerland, India)"

  top_rate:
    singapore: "24% (only on income > S$1M ≈ USD 750K)"
    malaysia: "30% (> RM2M)"
    thailand: "35%"
    india_new: "30% + surcharge + cess ≈ 39%"
    japan: "45% + 10% resident"
    uk: "45%"
    us_ca: "37% + 13.3%"
    sweden: "~52%"
    switzerland: "22-42% depending on canton"

  capital_gains:
    singapore: "NONE (except SSD on property)"
    switzerland: "None on securities"
    malaysia: "None on listed shares"
    all_others: "Various rates from 12.5% to 30%"

  social_security:
    singapore: "CPF 37% total (SC/SPR only) — highest in this series but is SAVINGS not tax"
    india: "EPF 24% total — but only on basic up to ₹15K ceiling usually"
    note: "CPF is refundable retirement savings; unlike tax, it belongs to the employee"

  dividends:
    singapore: "TAX-FREE (single-tier, already corporate-taxed)"
    malaysia: "Tax-free up to RM100K, 2% on excess"
    india: "Taxed at slab rates (since 2020)"
    uk: "8.75-39.35%"

  filing_simplicity:
    singapore: "Many employees auto-assessed — No-Filing Service"
    sweden: "Pre-filled, one-click approval"
    uk: "PAYE for most"
    india: "Self-filing required; complex regime choice"
    us: "Most complex (dual federal+state)"
```

---

## 13. Official Sources

| Topic | URL |
|---|---|
| IRAS Individual Income Tax Rates | https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates |
| IRAS Tax Residency | https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/working-out-my-tax-residency |
| IRAS Personal Reliefs | https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs |
| IRAS YA 2026 Calculator (XLSM) | https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates |
| PwC Singapore Tax Summary | https://taxsummaries.pwc.com/singapore/individual/taxes-on-personal-income |
| CPF Contribution Rates | https://www.cpf.gov.sg/employer/employer-guides/pay-cpf-contributions/cpf-contribution-and-allocation-rates |
| SRS Information | https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-reliefs-rebates-and-deductions/tax-reliefs/supplementary-retirement-scheme-(srs)-relief |
| Budget 2025 | https://www.pwc.com/sg/en/publications/singapore-budget/commentary.html |
| ASEAN Briefing SG Tax Guide | https://www.aseanbriefing.com/doing-business-guide/singapore/taxation-and-accounting/individual-income-tax |
