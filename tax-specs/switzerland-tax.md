# Switzerland Income Tax (Einkommenssteuer) — Implementation Spec

> **Purpose**: Machine-readable reference for implementing a Swiss income tax calculator.
> Sources: ESTV/AFC (estv.admin.ch), PWC Tax Summaries, KPMG, cantonal authorities.
> Effective for tax year 2025. Tax year = calendar year (Jan 1 – Dec 31).
> Switzerland's tax is levied at THREE levels: federal, cantonal, municipal.
> This spec covers the federal layer in detail and provides a framework for cantonal/municipal.

---

## 1. Tax Residency

```yaml
residency:
  unlimited:
    conditions_any:
      - "Domicile (Wohnsitz) in Switzerland"
      - "Habitual abode (Aufenthalt) in Switzerland — 30 days with gainful activity, or 90 days without"
    scope: "Worldwide income (excluding foreign real estate and foreign PE income — exempt with progression)"
  limited:
    scope: "Swiss-sourced income only"
  quellensteuer:  # withholding tax for foreign workers
    applies_to: "Foreign employees without C permit (and not married to Swiss citizen)"
    threshold: 120_000  # gross salary — above this, must file ordinary return
    note: "Withheld directly from salary by employer, covers federal+cantonal+municipal"
```

---

## 2. Three-Level Tax System

```yaml
tax_levels:
  federal:  # Direkte Bundessteuer (DBSt) / Impôt fédéral direct (IFD)
    legislation: "DBG (SR 642.11)"
    rates: "Progressive, 0% to 11.5%"
    uniform: true  # same throughout Switzerland
    
  cantonal:  # Kantonssteuer / Staatssteuer
    legislation: "Each canton has its own tax law (StHG harmonization framework)"
    rates: "Progressive in most cantons, some flat-rate cantons"
    note: "26 cantons with very different rates — this is the biggest variable"

  municipal:  # Gemeindesteuer
    calculation: "multiplier (Steuerfuss/Steueranlage) × cantonal base tax"
    note: >
      Not a separate bracket calculation — it's a percentage surcharge on
      the cantonal tax. This multiplier varies by municipality and changes
      annually. E.g., City of Zurich: 119%, Zug city: ~60%.

  church:  # Kirchensteuer
    note: "Optional — only for members of recognized churches. 6-17% of cantonal tax."
    can_opt_out: true
```

### Combined Effective Rates (approximate ranges)

```yaml
combined_effective_rates_2025:
  low_tax_cantons:  # Zug, Schwyz, Nidwalden, Obwalden, Appenzell IR
    range: "22-25% at top income levels"
  medium_cantons:  # Zurich, Bern, Luzern, St. Gallen
    range: "30-35%"
  high_tax_cantons:  # Geneva, Vaud, Basel-Stadt, Neuchâtel
    range: "35-42%"
  note: "These include federal + cantonal + municipal. Actual rate depends on exact municipality."
```

---

## 3. Federal Income Tax Brackets (Direkte Bundessteuer 2025)

Source: https://www.estv.admin.ch/estv/de/home/direkte-bundessteuer/dbst-steuertarife.html

### 3.1 Single / Unmarried (Grundtarif — Art. 36 Abs. 1 DBG)

Applies to: single, widowed, divorced, separated without dependents.

```yaml
federal_brackets_single_2025:
  note: >
    The federal tax table is progressive but NOT a simple bracket system.
    It uses a lookup table with marginal rates at specific income levels.
    Below is a simplified bracket approximation extracted from the official table.
    For precise calculation, use the official ESTV table.
  simplified_brackets:
    - { min: 0,       max: 18_400,   rate: 0.00,   note: "tax-free zone" }
    - { min: 18_500,  max: 33_200,   rate: 0.0077, note: "~0.77% marginal" }
    - { min: 33_300,  max: 43_500,   rate: 0.0088, note: "rising to ~2.64%" }
    - { min: 43_600,  max: 58_000,   rate: 0.0264, note: "~2.64%" }
    - { min: 58_100,  max: 76_100,   rate: 0.0297, note: "rising to ~5.94%" }
    - { min: 76_200,  max: 108_600,  rate: 0.066,  note: "~6.6%" }
    - { min: 108_700, max: 141_500,  rate: 0.088,  note: "~8.8%" }
    - { min: 141_600, max: 185_000,  rate: 0.11,   note: "rising to ~13.2%" }
    - { min: 185_100, max: 793_300,  rate: 0.132,  note: "~13.2%" }
    - { min: 793_400, max: 940_800,  rate: 0.115,  note: "flattening to 11.5%" }
    - { min: 940_900, max: null,     rate: 0.115,  note: "flat 11.5% on entire income" }
  max_rate: 0.115
  child_deduction: 263  # CHF per child/dependent person, deducted from tax amount
```

### 3.2 Married / Single Parent (Verheiratetentarif — Art. 36 Abs. 2 DBG)

Applies to: married couples (joint taxation), registered partnerships, single parents with dependents.

```yaml
federal_brackets_married_2025:
  note: >
    Married couples are taxed jointly — all income combined.
    A different (more favorable) rate schedule applies.
    The 'splitting' method is used: rate is determined on 50% of combined income,
    then applied to the full amount.
  simplified_brackets:
    - { min: 0,       max: 32_900,   rate: 0.00 }
    - { min: 33_000,  max: 58_000,   rate: 0.01,  note: "~1%" }
    - { min: 58_100,  max: 82_000,   rate: 0.02,  note: "~2% rising to 4%" }
    - { min: 82_100,  max: 108_600,  rate: 0.04,  note: "~4% rising to 6%" }
    - { min: 108_700, max: 141_500,  rate: 0.07,  note: "~7% rising to 9%" }
    - { min: 141_600, max: 185_000,  rate: 0.09,  note: "~9% rising to 11.5%" }
    - { min: 185_100, max: 940_800,  rate: 0.115, note: "gradually reaching 11.5%" }
    - { min: 940_900, max: null,     rate: 0.115, note: "flat 11.5%" }
  max_rate: 0.115
  child_deduction: 263  # CHF per child
  note_reform: >
    Parliament passed the Federal Act on Individual Taxation on 20 June 2025.
    Popular vote scheduled for 8 March 2026. If approved, joint taxation
    for married couples will be replaced by individual taxation.
```

### 3.3 Implementation Note

```
For precise federal tax: use the official ESTV lookup table (PDF).
The table provides exact tax amounts for each CHF 100 income increment.
For a calculator, interpolate between table entries, or implement
the piecewise-linear marginal rates from the official table.

Amounts below CHF 100 are ignored (truncated).
Annual tax is rounded down to nearest CHF 0.05.
```

---

## 4. Key Federal Deductions (Abzüge — DBG 2025)

Source: https://www.estv.admin.ch/estv/de/home/direkte-bundessteuer/dbst-steuertarife/abzuege.html

### 4.1 Employment Deductions (Berufskosten)

```yaml
employment_deductions:
  professional_expenses_lump_sum: 
    note: "Flat-rate or actual expenses, whichever is higher"
    flat_rate: "3% of net salary, min CHF 2,000, max CHF 4,000"
  commuting:
    max: 3_200  # for federal tax; cantons may differ
    note: "Public transport costs or car if necessary"
  meals:
    lump_sum: 3_200  # if eating away from home due to work
  further_education:
    max: 13_100
  home_office:
    note: "Cantonal rules vary; some allow lump sums"
```

### 4.2 Insurance and Pension Deductions

```yaml
insurance_deductions:
  pillar_3a:  # Säule 3a / restricted pension
    with_pillar_2: 7_258  # employees with employer pension plan
    without_pillar_2: 36_288  # or 20% of earned income, whichever is less
    note: "Most powerful tax deduction for employees — fully deductible"
  
  health_insurance_premiums:
    note: "Varies by canton — federal allows a lump sum"
    federal_lump_sum:
      single: 1_900
      married: 3_800
      per_child: 700
    cantonal: "Often higher — some cantons allow actual premiums"

  pillar_2_buyback:  # Einkauf in die Pensionskasse
    amount: "actual amount paid — fully deductible"
    note: "Very powerful deduction for high earners; must wait 3 years before withdrawal"
```

### 4.3 General Deductions

```yaml
general_deductions:
  private_debt_interest:
    max: "CHF 50,000 + gross capital income"
    note: "Mortgage interest is deductible (up to limit)"
  
  charitable_donations:
    min: 100
    max_rate: 0.20  # up to 20% of net income
    note: "Must be to recognized Swiss charities"

  childcare:
    max: 25_800  # per child, federal
    condition: "Child under 14, parents both working"

  alimony:
    amount: "actual payments — fully deductible by payer, taxed to recipient"

  married_couple_dual_income:
    max: 14_600  # federal deduction for dual-earner married couples
```

### 4.4 Personal Deductions (from tax, not income)

```yaml
personal_deductions_from_tax:
  child_deduction: 263  # CHF deducted from federal tax per child/dependent
  note: >
    Unlike income deductions, this is subtracted from the calculated tax amount.
    Cantonal child deductions are typically much larger (varies by canton).
```

---

## 5. Social Security Contributions (Sozialversicherungen)

These are deducted from salary BEFORE income tax and are also tax-deductible.

```yaml
social_security_2025:
  ahv_iv_eo:  # AHV = old age, IV = disability, EO = income compensation
    total_rate: 0.106  # 10.6% of gross salary
    employee_share: 0.053  # 5.3%
    employer_share: 0.053  # 5.3%
    note: "No salary cap — applies to entire gross salary"

  alv:  # Unemployment insurance (Arbeitslosenversicherung)
    rate: 0.022  # 2.2% total
    employee_share: 0.011  # 1.1%
    employer_share: 0.011  # 1.1%
    salary_cap: 148_200  # no ALV contributions above this
    solidarity_contribution:
      rate: 0.01  # 1% total on salary above cap
      employee_share: 0.005
      note: "Only applies to salary portion above CHF 148,200"

  bvg:  # Occupational pension (2nd pillar / Berufliche Vorsorge)
    note: "Rates vary by age and pension fund"
    entry_threshold: 22_680  # minimum annual salary to be insured
    coordination_deduction: 26_460
    max_insured_salary: 64_260
    contribution_rates_by_age:
      - { age: "25-34", rate: 0.07 }
      - { age: "35-44", rate: 0.10 }
      - { age: "45-54", rate: 0.15 }
      - { age: "55-65", rate: 0.18 }
    split: "employer pays at least 50%"

  uvg_nbu:  # Non-occupational accident insurance
    rate: "~1-3% of salary — paid by employee"
    note: "Employer pays occupational accident insurance (BU) separately"

  total_employee_deductions_approx: >
    AHV/IV/EO: 5.3% + ALV: 1.1% + BVG: ~7-18% (age-dependent) + NBU: ~1-2%
    = roughly 14-26% of gross salary
```

---

## 6. Capital Income — No Capital Gains Tax on Securities

```yaml
capital_taxation:
  capital_gains_on_securities:
    private_individuals: "TAX-FREE"
    note: >
      Switzerland does NOT tax capital gains on privately held movable assets
      (stocks, bonds, crypto, funds) for private individuals. This is one of
      Switzerland's most unique and attractive features.
    exception: "Professional securities traders (gewerbsmässiger Wertschriftenhandel) are taxed"
  
  capital_gains_on_real_estate:
    taxed: true
    method: "Grundstückgewinnsteuer — separate cantonal tax, rates vary"
    note: "Taxed by canton of property location, not residence. Progressive rates, holding period discounts."

  dividend_income:
    taxed: true
    method: "Added to ordinary income (partial taxation method)"
    qualified_participation: "Dividends from ≥10% shareholdings taxed at only 50-70% (varies by canton)"
    verrechnungssteuer: 0.35  # 35% withholding tax at source, refundable when declared

  interest_income:
    taxed: true
    method: "Added to ordinary income at full rate"
    verrechnungssteuer: 0.35  # refundable

  wealth_tax:
    level: "Cantonal + municipal only (no federal wealth tax)"
    rates: "~0.1% to 0.88% depending on canton"
    base: "Net assets (assets minus debts)"
    note: "Unique to Switzerland — most other countries don't have this"
```

---

## 7. Cantonal Tax — Framework for Zurich (Example)

Since each canton is different, a full calculator needs canton-specific data. Here is Zurich as an example to illustrate the pattern.

```yaml
zurich_example:
  cantonal_base_tax:
    note: "Progressive rates defined by cantonal tax law"
    simple_rates: "~2% to ~13% on taxable income (before multiplier)"
  
  cantonal_multiplier: 100  # percent — this IS the base (Zurich state = 100%)
  
  municipal_multiplier:
    zurich_city: 119  # 119% of cantonal base tax
    kuesnacht: 79
    zollikon: 83
  
  church_tax:
    protestant: "~10% of cantonal base tax"
    catholic: "~10%"
    none: 0

  total_zurich_city_single_100k:
    federal: "~1,500"
    cantonal: "~7,000"
    municipal: "~8,300 (119% of cantonal)"
    church: "~700 (if member)"
    total_income_tax: "~17,500"
    plus_social_security: "~14,000"
    
  implementation_note: >
    For a multi-canton calculator, you need:
    1. Federal tax (one lookup table — same everywhere)
    2. Cantonal tax (26 different rate schedules)
    3. Municipal multiplier (thousands of municipalities)
    Use the ESTV online calculator for precise results:
    https://swisstaxcalculator.estv.admin.ch/
```

---

## 8. Calculation Flow

```
STEP 1: Calculate gross income
  gross = salary + business_income + rental_income + interest + dividends + pensions + other

STEP 2: Subtract social security contributions (employee share)
  social = gross * (AHV 5.3% + ALV 1.1% + BVG ~7-18% + NBU ~1-2%)

STEP 3: Subtract deductions
  deductions = professional_expenses + pillar_3a + health_insurance_deduction
             + debt_interest + childcare + alimony + charitable_donations + ...

STEP 4: Calculate taxable income (steuerbares Einkommen)
  taxable = gross - social - deductions
  taxable = floor(taxable / 100) * 100  # truncate to nearest 100

STEP 5: Calculate FEDERAL tax from ESTV table
  federal_tax = estv_lookup(taxable, filing_status)
  federal_tax -= 263 * num_children  # child deduction from tax

STEP 6: Calculate CANTONAL base tax
  cantonal_base = cantonal_lookup(taxable, canton, filing_status)

STEP 7: Apply MUNICIPAL multiplier
  municipal_tax = cantonal_base * municipal_multiplier / 100

STEP 8: Apply CHURCH tax (if applicable)
  church_tax = cantonal_base * church_multiplier / 100

STEP 9: Total
  total_income_tax = federal_tax + cantonal_base + municipal_tax + church_tax
  total_with_social = total_income_tax + social_security_contributions
```

---

## 9. Pseudocode (Federal Tax Only)

```python
import math

def swiss_federal_tax(
    taxable_income: float,
    filing_status: str = "single",  # "single" or "married"
    num_children: int = 0,
) -> float:
    """
    Calculate Swiss direct federal tax (DBSt) for 2025.
    This is a simplified approximation. For production use,
    implement the full ESTV lookup table.
    """
    income = math.floor(taxable_income / 100) * 100  # truncate to nearest 100
    
    if filing_status == "single":
        # Simplified piecewise approximation from official table
        if income <= 18_400: return 0
        elif income <= 33_200: return (income - 18_400) * 0.0077
        elif income <= 43_500: return 139 + (income - 33_200) * 0.0088
        elif income <= 58_000: return 230 + (income - 43_500) * 0.0264
        elif income <= 76_100: return 613 + (income - 58_000) * 0.0297
        elif income <= 108_600: return 1_150 + (income - 76_100) * 0.066
        elif income <= 141_500: return 3_295 + (income - 108_600) * 0.088
        elif income <= 185_000: return 6_190 + (income - 141_500) * 0.11
        elif income <= 793_300: return 10_975 + (income - 185_000) * 0.132
        elif income <= 940_800: return 91_241 + (income - 793_300) * 0.115
        else: return income * 0.115  # flat 11.5%
    
    elif filing_status == "married":
        # Married tariff — more favorable
        if income <= 32_900: return 0
        elif income <= 58_000: return (income - 32_900) * 0.01
        elif income <= 82_000: return 251 + (income - 58_000) * 0.02
        elif income <= 108_600: return 731 + (income - 82_000) * 0.04
        elif income <= 141_500: return 1_795 + (income - 108_600) * 0.07
        elif income <= 185_000: return 4_098 + (income - 141_500) * 0.09
        elif income <= 940_800: return 8_013 + (income - 185_000) * 0.115
        else: return income * 0.115

    # Child deduction (from tax, not income)
    tax = max(tax - num_children * 263, 0)
    return round(tax, 2)


def swiss_total_tax_estimate(
    gross_salary: float,
    canton: str = "zurich",
    municipality_multiplier: float = 119,  # e.g., Zurich city
    church_multiplier: float = 0,  # 0 if not church member
    filing_status: str = "single",
    num_children: int = 0,
    age: int = 35,
    pillar_3a: float = 7_258,
) -> dict:
    
    # Social security (employee share)
    ahv = gross_salary * 0.053
    alv = min(gross_salary, 148_200) * 0.011
    bvg_rates = {25: 0.035, 35: 0.05, 45: 0.075, 55: 0.09}
    bvg_rate = bvg_rates.get(min(k for k in bvg_rates if k >= age // 10 * 10), 0.05)
    coordinated_salary = min(max(gross_salary - 26_460, 3_780), 64_260)
    bvg = coordinated_salary * bvg_rate
    nbu = gross_salary * 0.015  # approximate
    total_social = ahv + alv + bvg + nbu
    
    # Deductions
    professional = min(max(gross_salary * 0.03, 2_000), 4_000)
    health_ins = 1_900 if filing_status == "single" else 3_800
    
    taxable = gross_salary - total_social - professional - pillar_3a - health_ins
    taxable = max(taxable, 0)
    
    # Federal tax
    federal = swiss_federal_tax(taxable, filing_status, num_children)
    
    # Cantonal + municipal (rough estimate — use actual cantonal tables in production)
    # Approximate: cantonal base ≈ federal × 3-5 depending on canton
    cantonal_estimate = federal * 3.5  # very rough for Zurich
    municipal = cantonal_estimate * municipality_multiplier / 100
    church = cantonal_estimate * church_multiplier / 100
    
    total_tax = federal + cantonal_estimate + municipal + church
    
    return {
        "gross_salary": gross_salary,
        "social_security_employee": round(total_social),
        "taxable_income": round(taxable),
        "federal_tax": round(federal),
        "cantonal_tax_estimate": round(cantonal_estimate),
        "municipal_tax_estimate": round(municipal),
        "church_tax": round(church),
        "total_income_tax": round(total_tax),
        "total_deductions": round(total_social + total_tax),
        "net_income_estimate": round(gross_salary - total_social - total_tax),
        "effective_rate": round(total_tax / gross_salary * 100, 1),
    }
```

---

## 10. Test Case

### Single person, CHF 120,000 salary, Zurich city, age 35, no children

```
Social Security:
  AHV: 120,000 × 5.3% = 6,360
  ALV: 120,000 × 1.1% = 1,320
  BVG: ~(120,000 - 26,460) × 5% ≈ 4,677
  NBU: ~1,800
  Total: ~14,157

Deductions:
  Professional: 3,600 (3% of salary)
  Pillar 3a: 7,258
  Health insurance: 1,900
  Total deductions: ~12,758

Taxable: 120,000 - 14,157 - 12,758 ≈ 93,085 → 93,000

Federal tax: ~2,300 (from table)
Cantonal (Zurich): ~7,200
Municipal (119%): ~8,570
Total income tax: ~18,070
Effective income tax rate: ~15.1%
Total burden (tax + social): ~32,227 → ~26.9%
```

---

## 11. Filing

```yaml
filing:
  deadline: "March 31 of following year (extensions widely available)"
  method: "Annual tax return (Steuererklärung) — one form covers federal + cantonal + municipal"
  note: >
    Unlike US/UK, there is generally NO withholding for Swiss/C-permit residents.
    Tax is paid based on annual assessment, typically in instalments.
    Quellensteuer (source tax) applies only to foreign workers without C permit.
  payment: "Provisional bill in February, final assessment after filing"
  penalties:
    late_filing: "Reminder fees; potential penalty assessment (Ermessenseinschätzung)"
    late_payment: "Interest (varies by canton, typically 3-5%)"
  online_filing: "Most cantons support electronic filing (eTax/eFiling)"
  estv_calculator: "https://swisstaxcalculator.estv.admin.ch/"
```

---

## 12. Key Differences from Other Countries

```yaml
comparison:
  three_level_system:
    switzerland: "Federal + cantonal + municipal (truly independent tax calculations)"
    us_ca: "Federal + state (two separate returns)"
    japan: "National + resident tax (10% flat local)"
    uk: "Single national system (no local income tax)"
    sweden: "Municipal + state (computed together)"
    thailand: "Single national system"

  no_capital_gains_on_securities:
    switzerland: "TAX-FREE for private individuals on stocks, bonds, crypto, funds"
    all_others: "All other countries tax capital gains in some form"
    note: "This is Switzerland's single most attractive feature for investors"

  wealth_tax:
    switzerland: "Yes — cantonal/municipal, ~0.1-0.88% of net assets"
    all_others: "No wealth tax in Japan, UK, US, Thailand, Sweden"
    note: "Unique burden that partially offsets the capital gains exemption"

  joint_taxation:
    switzerland: "Married couples taxed jointly (with favorable rate schedule)"
    note: "Reform pending — popular vote on individual taxation March 2026"

  cantonal_competition:
    description: >
      The most distinctive feature: 26 cantons compete on tax rates.
      A person earning CHF 200K pays ~25% in Zug vs ~40% in Geneva.
      Choice of residence is a primary tax planning lever.
    no_equivalent: "No other country in this series has this level of internal tax competition"

  social_security:
    switzerland: "AHV 5.3% + ALV 1.1% + BVG 3.5-9% + NBU ~1-2% = 11-17% employee"
    us: "FICA 7.65%"
    uk: "NIC 8%/2%"
    sweden: "31.42% employer-only"
    japan: "~15% employee"
    thailand: "5% employee (capped at 9,000 THB)"

  pillar_system:
    pillar_1: "AHV/IV — state pension (mandatory, pay-as-you-go)"
    pillar_2: "BVG — occupational pension (mandatory for employees)"
    pillar_3a: "Voluntary restricted pension (tax-deductible, max CHF 7,258)"
    note: "3-pillar system is integral to tax planning"
```

---

## 13. Official Sources

| Topic | URL |
|---|---|
| Federal tax tariffs 2025 (ESTV) | https://www.estv.admin.ch/estv/de/home/direkte-bundessteuer/dbst-steuertarife.html |
| Federal tax table 2025 (PDF) | https://www.estv.admin.ch/dam/estv/de/dokumente/dbst/tarife/dbst-tarife-58c-2025-de.pdf |
| Federal deductions and allowances | https://www.estv.admin.ch/estv/de/home/direkte-bundessteuer/dbst-steuertarife/abzuege.html |
| ESTV online tax calculator | https://swisstaxcalculator.estv.admin.ch/ |
| Income tax overview (ESTV PDF) | https://www.estv2.admin.ch/stp/ds/d-einkommenssteuer-natuerlicher-personen-gesamter-text-de.pdf |
| PWC Switzerland tax summary | https://taxsummaries.pwc.com/switzerland/individual/taxes-on-personal-income |
| Social security key figures 2025 (KPMG PDF) | https://assets.kpmg.com/content/dam/kpmgsites/ch/pdf/kpmg-ch-social-security-2025.pdf |
| Social security overview (BSV) | https://www.bsv.admin.ch/en/contributions-overview |
| PwC social security 2025 (PDF) | https://www.pwc.ch/en/publications/2024/Key_figures_social_insurance_EN_2025.pdf |
| Zurich cantonal tax calculator | https://www.zh.ch/de/steuern-finanzen/steuern/steuern-berechnen.html |
| How income tax works (Taxea.ch) | https://www.taxea.ch/en/faq-taxes/how-income-tax-works-in-switzerland |
| Swiss Tax Map (calculator) | https://www.swisstaxmap.ch/swiss_incometax |
