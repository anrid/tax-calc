# Japan Income Tax (所得税) — Implementation Spec

> **Purpose**: Machine-readable reference for implementing a Japanese income tax calculator.
> All rules sourced from 国税庁 (National Tax Agency / NTA) nta.go.jp and 財務省 (MOF).
> Effective for tax year 令和7年 (2025), incorporating the major 令和7年度税制改正.
> Tax year = calendar year (Jan 1 – Dec 31).

---

## 1. Tax Residency

```yaml
residency:
  resident:
    definition: "Domicile (住所) in Japan OR continuous residence (居所) for ≥ 1 year"
    scope: "Worldwide income"
  non_permanent_resident:
    definition: "Resident without Japanese nationality who has had domicile/residence in Japan for ≤ 5 years out of the last 10"
    scope: "Japan-sourced income + foreign income remitted to Japan"
  non_resident:
    definition: "Not a resident"
    scope: "Japan-sourced income only"
    withholding_rate: 0.2042  # 20.42% flat (income tax 20% + reconstruction surtax 0.42%)
```

---

## 2. Ten Categories of Income (所得の10区分)

Japan classifies income into 10 types. Each has its own calculation method.
Source: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1300.htm

```yaml
income_types:
  1_interest:      # 利子所得
    description: "Interest on deposits, bonds, investment trust distributions"
    taxation: "separate_withholding"  # 20.315% withheld at source (15.315% national + 5% local)
    note: "Generally no further filing needed"

  2_dividend:      # 配当所得
    description: "Dividends from stocks, profit distributions from funds"
    taxation: "comprehensive_or_separate"
    withholding: 0.20315  # at source
    deduction: "borrowing_costs_to_acquire_shares"

  3_real_estate:   # 不動産所得
    description: "Rental income from land, buildings, ships, aircraft"
    taxation: "comprehensive"
    deduction: "actual_expenses"
    note: "Loss can offset other comprehensive income (except land acquisition loan interest portion)"

  4_business:      # 事業所得
    description: "Income from agriculture, manufacturing, retail, services, freelance, etc."
    taxation: "comprehensive"
    deduction: "actual_expenses"
    blue_return_deduction: [100_000, 550_000, 650_000]  # depending on bookkeeping level
    note: "Loss can offset other comprehensive income"

  5_employment:    # 給与所得
    description: "Salary, wages, bonuses, allowances from employer"
    taxation: "comprehensive"
    deduction: "employment_income_deduction"  # see Section 3

  6_retirement:    # 退職所得
    description: "Lump-sum retirement payments"
    taxation: "separate"
    formula: "(retirement_income - retirement_deduction) * 0.5"
    note: "Separate taxation; special deduction based on years of service"

  7_forestry:      # 山林所得
    description: "Income from selling timber (held > 5 years)"
    taxation: "separate_5year_averaging"

  8_capital_gains: # 譲渡所得
    description: "Gains from sale of assets (real estate, stocks, etc.)"
    taxation: "comprehensive_or_separate"
    note: >
      Stocks/real estate = separate taxation at fixed rates.
      Other assets (gold, art, etc.) = comprehensive with 50万 special deduction.
      Long-term (held > 5 years): taxable amount = (gain - 500,000) / 2
      Short-term (held ≤ 5 years): taxable amount = gain - 500,000

  9_occasional:    # 一時所得
    description: "One-time windfalls: insurance maturity, prizes, etc."
    taxation: "comprehensive"
    formula: "(income - expenses - 500_000) / 2"
    note: "Only half the amount is added to comprehensive income"

  10_miscellaneous: # 雑所得
    description: "Public pensions, side-job income, crypto gains, anything not in 1-9"
    taxation: "comprehensive"
    sub_types:
      public_pension: "pension_income_deduction applies"
      other: "actual expenses"
    note: "Crypto profits are classified here for most individuals"
```

### Taxation Methods

```yaml
taxation_methods:
  comprehensive:  # 総合課税
    description: "All comprehensive income combined, then progressive rates applied"
    applies_to: [3_real_estate, 4_business, 5_employment, 8_capital_gains_other,
                 9_occasional, 10_miscellaneous, 2_dividend_if_elected]

  separate:       # 分離課税
    description: "Taxed independently at flat rates"
    applies_to:
      interest: "20.315% (15.315% income + 5% local)"
      listed_stock_gains: "20.315%"
      listed_dividends_if_elected: "20.315%"
      real_estate_gains_short: "39.63% (30.63% income + 9% local)"
      real_estate_gains_long: "20.315% (15.315% income + 5% local)"
      retirement: "separate with special formula"
      forestry: "5-year averaging"
```

---

## 3. Employment Income Deduction (給与所得控除)

Source: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm

**Post-令和7年度 reform** (effective from 令和7年/2025):

```yaml
employment_income_deduction:  # 給与所得控除
  note: "Minimum guarantee raised from 550,000 to 650,000 in 2025 reform"
  table:
    - { max_income: 1_900_000,   deduction: 650_000,                      formula: null }
    - { max_income: 3_600_000,   deduction: null, formula: "income * 0.30 + 80_000" }
    - { max_income: 6_600_000,   deduction: null, formula: "income * 0.20 + 440_000" }
    - { max_income: 8_500_000,   deduction: null, formula: "income * 0.10 + 1_100_000" }
    - { max_income: null,        deduction: 1_950_000,                    formula: null }
  implementation: |
    function employment_deduction(income):
        if income <= 1_900_000: return 650_000
        if income <= 3_600_000: return income * 0.30 + 80_000
        if income <= 6_600_000: return income * 0.20 + 440_000
        if income <= 8_500_000: return income * 0.10 + 1_100_000
        return 1_950_000  # cap
```

---

## 4. Progressive Tax Brackets (所得税の速算表)

Source: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm

Applied to 課税所得金額 (taxable income after all deductions). Truncate to nearest 1,000 yen first.

```yaml
brackets:
  - { min: 1_000,       max: 1_949_000,    rate: 0.05,  quick_deduction: 0 }
  - { min: 1_950_000,   max: 3_299_000,    rate: 0.10,  quick_deduction: 97_500 }
  - { min: 3_300_000,   max: 6_949_000,    rate: 0.20,  quick_deduction: 427_500 }
  - { min: 6_950_000,   max: 8_999_000,    rate: 0.23,  quick_deduction: 636_000 }
  - { min: 9_000_000,   max: 17_999_000,   rate: 0.33,  quick_deduction: 1_536_000 }
  - { min: 18_000_000,  max: 39_999_000,   rate: 0.40,  quick_deduction: 2_796_000 }
  - { min: 40_000_000,  max: null,          rate: 0.45,  quick_deduction: 4_796_000 }
```

### Quick calculation method (速算表)

```
income_tax = taxable_income * rate - quick_deduction
```

### Reconstruction Surtax (復興特別所得税)

```yaml
reconstruction_surtax:
  rate: 0.021  # 2.1% of base income tax
  period: "2013 (H25) through 2037 (R19)"
  formula: "reconstruction_tax = income_tax * 0.021"
  note: "Total effective rate = income_tax * 1.021"
```

### Ultra-high-income surtax (令和7年～)

```yaml
ultra_high_income_surtax:
  effective_from: "2025 (R7)"
  threshold: 330_000_000  # 3.3億 yen of 基準所得金額
  rate: 0.225  # 22.5% on the excess
  note: >
    If 22.5% of (基準所得金額 - 330,000,000) exceeds normal income tax + reconstruction
    surtax, the excess is added. Affects very few taxpayers.
```

---

## 5. Income Deductions (所得控除) — 15 Types

Source: https://www.nta.go.jp/publication/pamph/koho/kurashi/html/01_1.htm
and https://www.keisan.nta.go.jp/r7yokuaru/cat2/cat22/cid055.html

These are deducted from total income to arrive at taxable income.

### 5.1 Personal / Family Deductions

```yaml
basic_deduction:  # 基礎控除 — REFORMED in R7
  note: "Major change in 2025: raised from flat 480,000 to income-dependent amounts"
  r7_r8_amounts:  # 令和7年・8年 (transitional with bonus top-up)
    - { max_income: 1_320_000,    amount: 950_000 }
    - { max_income: 3_360_000,    amount: 880_000 }
    - { max_income: 4_890_000,    amount: 680_000 }
    - { max_income: 6_550_000,    amount: 630_000 }
    - { max_income: 23_500_000,   amount: 580_000 }
    - { max_income: 24_000_000,   amount: 480_000 }
    - { max_income: 24_500_000,   amount: 320_000 }
    - { max_income: 25_000_000,   amount: 160_000 }
    - { above: 25_000_000,        amount: 0 }
  r9_onwards:  # 令和9年～ (permanent, without top-up for most brackets)
    - { max_income: 23_500_000,   amount: 580_000 }
    - { max_income: 24_000_000,   amount: 480_000 }
    - { max_income: 24_500_000,   amount: 320_000 }
    - { max_income: 25_000_000,   amount: 160_000 }
    - { above: 25_000_000,        amount: 0 }

spouse_deduction:  # 配偶者控除
  condition: >
    Spouse's total income ≤ 580,000 yen (raised from 480,000 in R7 reform).
    Salary-only spouse: income ≤ 1,230,000 yen (was 1,030,000).
    Taxpayer's income must be ≤ 10,000,000.
  amounts:
    - { taxpayer_income_max: 9_000_000,   amount: 380_000, elderly_amount: 480_000 }
    - { taxpayer_income_max: 9_500_000,   amount: 260_000, elderly_amount: 320_000 }
    - { taxpayer_income_max: 10_000_000,  amount: 130_000, elderly_amount: 160_000 }
  note: "Elderly = spouse aged 70+ as of Dec 31"

special_spouse_deduction:  # 配偶者特別控除
  condition: "Spouse income > 580,000 but ≤ 1,330,000. Taxpayer income ≤ 10,000,000."
  note: "Graduated deduction declining as spouse income rises. Max 380,000."
  phase_out: "Deduction decreases in steps from 380,000 to 0 as spouse income rises"

dependent_deduction:  # 扶養控除
  condition: "Dependent with total income ≤ 580,000 (raised from 480,000 in R7)"
  types:
    general:          { age: "16-18 or 23+", amount: 380_000 }
    specified:        { age: "19-22", amount: 630_000, label: "特定扶養" }
    elderly:          { age: "70+", amount: 480_000 }
    elderly_cohabit:  { age: "70+ living together", amount: 580_000 }
  note: "Children under 16 are not eligible for dependent deduction (covered by child allowance)"

specific_relative_special_deduction:  # 特定親族特別控除 — NEW in R7
  description: >
    New deduction for dependents aged 19-22 whose income exceeds the dependent
    threshold (580,000) but is ≤ 1,230,000. Graduated deduction up to 630,000.
    Functions like a bridge between dependent deduction and loss of all deductions.
  max_amount: 630_000
  phase_out: "Decreases as the relative's income rises from 580,001 to 1,230,000"
```

### 5.2 Disability / Status Deductions

```yaml
disability_deduction:  # 障害者控除
  general: 270_000
  special: 400_000
  special_cohabit: 750_000  # living with special disability dependent

widow_deduction:  # 寡婦控除
  amount: 270_000
  condition: "Widowed woman (certain conditions), income ≤ 5,000,000"

single_parent_deduction:  # ひとり親控除
  amount: 350_000
  condition: "Unmarried parent with child (child's income ≤ 580,000), parent's income ≤ 5,000,000"

working_student_deduction:  # 勤労学生控除
  amount: 270_000
  condition: "Student with total income ≤ 850,000 (raised from 750,000 in R7)"
```

### 5.3 Insurance & Pension Deductions

```yaml
social_insurance_deduction:  # 社会保険料控除
  amount: "actual_amount_paid"
  note: "Full deduction for all social insurance: health, pension, employment, nursing care"

small_enterprise_mutual_aid:  # 小規模企業共済等掛金控除
  amount: "actual_amount_paid"
  includes: ["iDeCo contributions", "小規模企業共済", "企業型DC employee contributions"]

life_insurance_deduction:  # 生命保険料控除
  categories:
    general_life:     { max: 40_000, label: "一般生命保険料" }
    medical_nursing:  { max: 40_000, label: "介護医療保険料" }
    pension_insurance: { max: 40_000, label: "個人年金保険料" }
  combined_max: 120_000
  note: >
    Old contracts (pre-2012) use different calculation tables.
    For R8 (2026): families with children under 23 get enhanced general_life max of 60,000
    (combined max stays at 120,000).
  calculation_new_contract:  # 新契約 (2012+)
    - { max_premium: 20_000,   deduction: "premium" }
    - { max_premium: 40_000,   deduction: "premium * 0.5 + 10_000" }
    - { max_premium: 80_000,   deduction: "premium * 0.25 + 20_000" }
    - { above: 80_000,         deduction: 40_000 }

earthquake_insurance_deduction:  # 地震保険料控除
  max: 50_000
  note: "Actual premiums paid, max 50,000"
```

### 5.4 Other Deductions

```yaml
casualty_loss_deduction:  # 雑損控除
  formula: "max(loss - income * 0.10, disaster_expenses - 50_000)"
  note: "For theft, natural disaster, etc."

medical_expense_deduction:  # 医療費控除
  formula: "medical_expenses - max(total_income * 0.05, 100_000)"
  max: 2_000_000
  note: "Alternative: self-medication tax system (セルフメディケーション) max 88,000"

donation_deduction:  # 寄附金控除
  formula: "min(donations, total_income * 0.40) - 2_000"
  note: "Includes furusato nozei (ふるさと納税). 2,000 yen floor."
```

---

## 6. Tax Credits (税額控除)

These are subtracted from calculated tax, NOT from income.

```yaml
tax_credits:
  dividend_credit:  # 配当控除
    rate: "varies 5-10% of dividend income depending on taxable income level"
    condition: "Only for dividends elected into comprehensive taxation"

  housing_loan_credit:  # 住宅借入金等特別控除 (住宅ローン控除)
    rate: 0.007  # 0.7% of year-end loan balance
    max_years: 13  # for new construction
    balance_cap: "varies 20M-50M depending on house type and year"
    note: "Directly reduces tax. Significant for homeowners."

  foreign_tax_credit:  # 外国税額控除
    formula: "min(foreign_tax_paid, income_tax * foreign_income / total_income)"
    note: "Prevents double taxation on foreign-sourced income"

  donation_special_credit:  # 寄附金特別控除 (政党・認定NPO等)
    formula: "(donation - 2_000) * 0.40"
    max: "income_tax * 0.25"
```

---

## 7. Calculation Flow (Complete)

```
STEP 1: Calculate income amount (所得金額) for each of the 10 types
  - Employment: gross_salary - employment_income_deduction
  - Business: revenue - expenses [- blue_return_deduction]
  - Real estate: rental_revenue - expenses
  - etc.

STEP 2: Sum comprehensive income types (総合課税の所得を合算)
  total_income = sum of comprehensive income types
  (Apply loss offset rules: business/real-estate losses can offset other income)

STEP 3: Subtract income deductions (所得控除を差し引く)
  taxable_income = total_income - sum_of_all_15_deductions
  taxable_income = floor(taxable_income / 1000) * 1000  # truncate to nearest 1,000

STEP 4: Apply progressive tax rate (税率を適用)
  income_tax = taxable_income * rate - quick_deduction

STEP 5: Subtract tax credits (税額控除を差し引く)
  income_tax -= housing_loan_credit + dividend_credit + foreign_tax_credit + ...

STEP 6: Add reconstruction surtax (復興特別所得税)
  total_tax = income_tax + income_tax * 0.021

STEP 7: Add separate taxation items
  total_tax += tax_on_retirement_income
  total_tax += tax_on_stock_gains (20.315%)
  total_tax += tax_on_real_estate_gains
  etc.

STEP 8: Subtract withholding and prepayments
  tax_due = total_tax - withholding_tax_paid - advance_payments
  if tax_due < 0: refund
```

---

## 8. Pseudocode (Comprehensive Income Focus)

```python
import math

def japan_income_tax(
    salary: float = 0,
    business_income: float = 0,       # after expenses
    real_estate_income: float = 0,     # after expenses
    misc_income: float = 0,            # pensions, side income
    occasional_income: float = 0,      # before 50万 deduction
    occasional_expenses: float = 0,
    dividend_income_comprehensive: float = 0,  # if electing comprehensive
    # --- Deductions ---
    social_insurance: float = 0,
    ideco: float = 0,
    life_insurance_premiums: dict = None,  # {general, medical, pension}
    earthquake_insurance: float = 0,
    medical_expenses: float = 0,
    donations: float = 0,
    spouse_income: float = 0,          # spouse's total income
    num_dependents_general: int = 0,
    num_dependents_specified: int = 0, # age 19-22
    num_dependents_elderly: int = 0,
    num_dependents_elderly_cohabit: int = 0,
    has_disability: str = None,        # "general", "special", "special_cohabit"
    is_single_parent: bool = False,
    is_widow: bool = False,
    # --- Credits ---
    housing_loan_credit: float = 0,
    foreign_tax_credit: float = 0,
    # --- Withholding ---
    withholding_paid: float = 0,
    tax_year: int = 2025,
) -> dict:

    # --- STEP 1: Employment income ---
    def employment_deduction(income):
        if income <= 1_900_000: return min(income, 650_000)
        if income <= 3_600_000: return income * 0.30 + 80_000
        if income <= 6_600_000: return income * 0.20 + 440_000
        if income <= 8_500_000: return income * 0.10 + 1_100_000
        return 1_950_000

    employment_income = max(salary - employment_deduction(salary), 0)

    # --- Occasional income (1/2 rule) ---
    occasional_taxable = max(occasional_income - occasional_expenses - 500_000, 0) / 2

    # --- STEP 2: Total comprehensive income ---
    total_income = (
        employment_income
        + business_income
        + real_estate_income
        + misc_income
        + occasional_taxable
        + dividend_income_comprehensive
    )
    total_income = max(total_income, 0)

    # --- STEP 3: Income deductions ---
    # Basic deduction (R7-R8 transitional)
    def basic_deduction_r7(income):
        if income <= 1_320_000:  return 950_000
        if income <= 3_360_000:  return 880_000
        if income <= 4_890_000:  return 680_000
        if income <= 6_550_000:  return 630_000
        if income <= 23_500_000: return 580_000
        if income <= 24_000_000: return 480_000
        if income <= 24_500_000: return 320_000
        if income <= 25_000_000: return 160_000
        return 0

    basic = basic_deduction_r7(total_income) if tax_year in (2025, 2026) else 580_000

    # Spouse deduction
    spouse_ded = 0
    if spouse_income <= 580_000 and total_income <= 10_000_000:
        if total_income <= 9_000_000:   spouse_ded = 380_000
        elif total_income <= 9_500_000: spouse_ded = 260_000
        else:                           spouse_ded = 130_000

    # Dependent deductions
    dependent_ded = (
        num_dependents_general * 380_000
        + num_dependents_specified * 630_000
        + num_dependents_elderly * 480_000
        + num_dependents_elderly_cohabit * 580_000
    )

    # Disability
    disability_ded = 0
    if has_disability == "general":         disability_ded = 270_000
    elif has_disability == "special":       disability_ded = 400_000
    elif has_disability == "special_cohabit": disability_ded = 750_000

    # Single parent / widow
    single_parent_ded = 350_000 if is_single_parent else 0
    widow_ded = 270_000 if is_widow and not is_single_parent else 0

    # Social insurance (full amount)
    social_ins_ded = social_insurance

    # Small enterprise / iDeCo
    ideco_ded = ideco

    # Life insurance
    def calc_life_ins(premium):
        if premium <= 20_000: return premium
        if premium <= 40_000: return premium * 0.5 + 10_000
        if premium <= 80_000: return premium * 0.25 + 20_000
        return 40_000

    li = life_insurance_premiums or {}
    life_ins_ded = min(
        calc_life_ins(li.get("general", 0))
        + calc_life_ins(li.get("medical", 0))
        + calc_life_ins(li.get("pension", 0)),
        120_000
    )

    # Earthquake insurance
    earthquake_ded = min(earthquake_insurance, 50_000)

    # Medical expenses
    medical_ded = max(medical_expenses - max(total_income * 0.05, 100_000), 0)
    medical_ded = min(medical_ded, 2_000_000)

    # Donations
    donation_ded = max(min(donations, total_income * 0.40) - 2_000, 0)

    total_deductions = (
        basic + spouse_ded + dependent_ded + disability_ded
        + single_parent_ded + widow_ded
        + social_ins_ded + ideco_ded + life_ins_ded + earthquake_ded
        + medical_ded + donation_ded
    )

    # --- STEP 4: Taxable income ---
    taxable_income = max(total_income - total_deductions, 0)
    taxable_income = math.floor(taxable_income / 1000) * 1000  # truncate

    # --- STEP 5: Tax calculation (速算表) ---
    BRACKETS = [
        (1_949_000,   0.05,  0),
        (3_299_000,   0.10,  97_500),
        (6_949_000,   0.20,  427_500),
        (8_999_000,   0.23,  636_000),
        (17_999_000,  0.33,  1_536_000),
        (39_999_000,  0.40,  2_796_000),
        (float("inf"), 0.45, 4_796_000),
    ]
    income_tax = 0
    for upper, rate, qd in BRACKETS:
        if taxable_income <= upper:
            income_tax = taxable_income * rate - qd
            break

    income_tax = max(income_tax, 0)

    # --- STEP 6: Tax credits ---
    income_tax -= housing_loan_credit
    income_tax -= foreign_tax_credit
    income_tax = max(income_tax, 0)

    # --- STEP 7: Reconstruction surtax ---
    reconstruction = math.floor(income_tax * 0.021)
    total_tax = income_tax + reconstruction

    # Round down to nearest 100 yen
    total_tax = math.floor(total_tax / 100) * 100

    # --- STEP 8: Net payable ---
    tax_payable = total_tax - withholding_paid

    return {
        "employment_income": employment_income,
        "total_income": total_income,
        "total_deductions": total_deductions,
        "taxable_income": taxable_income,
        "income_tax_before_credits": income_tax + housing_loan_credit + foreign_tax_credit,
        "income_tax_after_credits": income_tax,
        "reconstruction_surtax": reconstruction,
        "total_national_tax": total_tax,
        "withholding_paid": withholding_paid,
        "tax_payable": tax_payable,
        "refund": abs(tax_payable) if tax_payable < 0 else 0,
    }
```

---

## 9. Resident Tax (住民税) — Brief Overview

Resident tax is separate but follows similar structure. A full calculator would need this too.

```yaml
resident_tax:
  components:
    income_levy:  # 所得割
      rate: 0.10  # flat 10% (municipal 6% + prefectural 4%)
      note: "Applied to taxable income (similar deductions, slightly different amounts)"
    per_capita_levy:  # 均等割
      amount: 5_000  # standard (varies slightly by municipality)
      note: "Flat amount per person. Forest tax (森林環境税) 1,000 yen added from R6."
  filing: "Calculated by municipality based on income tax return data"
  note: >
    住民税 deduction amounts differ from income tax.
    E.g., basic deduction is 430,000 (vs 580,000 for income tax in R7+).
    For a precise calculator, implement住民税 deductions separately.
```

---

## 10. Test Cases

### Case A: Salaried employee, 8,000,000 yen/year (2025)

```
Salary: 8,000,000
Employment deduction: 8,000,000 * 0.10 + 1,100,000 = 1,900,000
Employment income: 6,100,000

Social insurance: ~1,150,000 (approx 14.4%)
Basic deduction: 630,000 (income 6.1M → bracket 4,890,001-6,550,000)
No spouse, no dependents

Total deductions: 630,000 + 1,150,000 = 1,780,000
Taxable income: 6,100,000 - 1,780,000 = 4,320,000
Truncated: 4,320,000

Tax (速算表): 4,320,000 * 0.20 - 427,500 = 436,500
Reconstruction: 436,500 * 0.021 = 9,166 → 9,166
Total: 445,666 → 445,600 (rounded to 100)
```

### Case B: Salaried employee, 5,000,000 yen/year, married, 1 child age 20

```
Salary: 5,000,000
Employment deduction: 5,000,000 * 0.20 + 440,000 = 1,440,000
Employment income: 3,560,000

Social insurance: ~720,000
Basic deduction: 880,000 (income 3.56M → bracket 1,320,001-3,360,000... wait, 3,560,000 > 3,360,000)
  → Actually 3,560,000 is in bracket 3,360,001-4,890,000 → basic = 680,000
Spouse deduction: 380,000 (assuming spouse income ≤ 580,000)
Specified dependent (age 20): 630,000

Total deductions: 680,000 + 720,000 + 380,000 + 630,000 = 2,410,000
Taxable income: 3,560,000 - 2,410,000 = 1,150,000
Truncated: 1,150,000

Tax: 1,150,000 * 0.05 - 0 = 57,500
Reconstruction: 57,500 * 0.021 = 1,207
Total: 58,707 → 58,700
```

---

## 11. Filing Deadlines

```yaml
filing:
  final_return:  # 確定申告
    period: "February 16 – March 15 of following year"
    form: "確定申告書"
    note: "Salaried employees with only employment income generally do not need to file (年末調整 covers it)"

  year_end_adjustment:  # 年末調整
    timing: "December, performed by employer"
    note: "Settles tax for most salaried workers. Does NOT cover medical, donation, or first-year housing loan deductions."

  must_file_if:
    - "Total income > 20,000,000 yen"
    - "Income from 2+ employers"
    - "Non-employment income > 200,000 yen"
    - "Claiming medical expense deduction"
    - "First year of housing loan credit"
    - "Furusato nozei without one-stop exception"

  penalties:
    late_filing_surcharge: "5-20% of unpaid tax"
    delinquent_tax: "~8.7% annual (varies by period)"
    fraud: "35-40% surcharge"
```

---

## 12. Key Differences from Thai Tax (for cross-reference)

```yaml
comparison_with_thai_tax:
  currency: "JPY (no sub-units in tax calc) vs THB"
  income_types: "10 categories (Japan) vs 8 categories (Thailand)"
  brackets: "7 brackets 5-45% (Japan) vs 8 brackets 0-35% (Thailand)"
  reconstruction_surtax: "Japan adds 2.1% surtax — Thailand has none"
  resident_tax: "Japan has separate ~10% local tax — Thailand has none"
  employment_deduction: "Japan uses sliding scale formula vs Thailand's flat 50% cap 100K"
  social_insurance: "Japan: full deduction, no cap vs Thailand: capped at 9,000 THB"
  filing: "Japan: most employees don't file (年末調整) vs Thailand: everyone files"
  foreign_income: "Japan residents: worldwide income always vs Thailand: only if remitted"
```

---

## 13. Official Sources

| Topic | URL |
|---|---|
| Income tax rates (速算表) | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm |
| 10 income types overview | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1300.htm |
| Employment income deduction | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1410.htm |
| Basic deduction (R7 reform) | https://www.nta.go.jp/users/gensen/2025kiso/index.htm |
| Spouse deduction | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1191.htm |
| Special spouse deduction | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1195.htm |
| Income deductions overview (R7) | https://www.keisan.nta.go.jp/r7yokuaru/cat2/cat22/cid055.html |
| R7 tax reform overview (NTA) | https://www.nta.go.jp/users/gensen/2025kiso/index.htm |
| R7 tax reform outline (MOF) | https://www.mof.go.jp/tax_policy/tax_reform/outline/fy2025/07taikou_01.htm |
| R7 tax reform pamphlet (MOF PDF) | https://www.mof.go.jp/tax_policy/publication/brochure/zeisei2025_pdf/zeisei25_all.pdf |
| Tax structure overview (NTA) | https://www.nta.go.jp/publication/pamph/koho/kurashi/html/01_1.htm |
| R7 filing guide | https://www.nta.go.jp/taxes/shiraberu/shinkoku/tebiki/2025/index.htm |
| Year-end adjustment tables (R7 PDF) | https://www.nta.go.jp/publication/pamph/gensen/nencho2025/pdf/115.pdf |
| Reconstruction surtax | https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm (note 2) |
