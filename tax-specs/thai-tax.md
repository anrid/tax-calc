# Thailand Personal Income Tax (ภาษีเงินได้บุคคลธรรมดา) — Implementation Spec

> **Purpose**: Machine-readable reference for implementing a Thai PIT calculator.
> All rules sourced from กรมสรรพากร (Revenue Department) rd.go.th.
> Effective for tax year 2567 (2024) filing in 2568 (2025), and expected to remain
> stable for 2568 filing in 2569. Brackets unchanged since พ.ร.บ. ฉบับที่ 44 พ.ศ. 2560.

---

## 1. Tax Residency

- **Resident**: stays in Thailand ≥ 180 days in a calendar year.
- **Non-resident**: < 180 days → taxed only on Thai-sourced income.
- **Foreign income rule (from 1 Jan 2024)**: residents are taxed on foreign-sourced
  income if it is remitted to Thailand, regardless of when earned (but only income
  earned from 1 Jan 2024 onwards; pre-2024 foreign income is exempt even if
  remitted later).

---

## 2. Eight Categories of Assessable Income (เงินได้พึงประเมิน มาตรา 40)

Each category has its own expense deduction rules. Use the `income_type` field
(1–8) throughout the calculator.

```
income_type  | thai_name                          | description_en
-------------|------------------------------------|-----------------------------------------
1  (40(1))   | เงินเดือน ค่าจ้าง โบนัส            | Employment: salary, wages, bonus, 
             |                                    | allowances, pension, employer benefits
2  (40(2))   | ค่าธรรมเนียม ค่านายหน้า            | Service fees, commissions, director fees,
             |                                    | freelance work-for-hire
3  (40(3))   | กู๊ดวิลล์ ลิขสิทธิ์ เงินปี           | Goodwill, royalties, IP rights, annuities
4  (40(4))   | ดอกเบี้ย เงินปันผล                  | Interest, dividends, capital gains on
             |                                    | shares, profit-sharing
5  (40(5))   | ค่าเช่าทรัพย์สิน                    | Rental income (property, land, vehicles,
             |                                    | other assets)
6  (40(6))   | วิชาชีพอิสระ                       | Independent professions (medical, legal,
             |                                    | engineering, architecture, accounting,
             |                                    | fine arts)
7  (40(7))   | รับเหมาก่อสร้าง                    | Construction contracting (materials +
             |                                    | labor)
8  (40(8))   | ธุรกิจ พาณิชย์ เกษตร อื่นๆ          | Business, commerce, agriculture,
             |                                    | industry, transport, real estate, other
```

---

## 3. Expense Deductions (การหักค่าใช้จ่าย)

Deducted from gross assessable income BEFORE personal allowances.

### 3.1 Flat-rate (เหมา) expense deductions

```yaml
expense_deductions:
  type_1:  # salary/wages
    method: "flat_rate"
    rate: 0.50
    cap: 100_000  # THB
    note: "Types 1 and 2 share one combined cap of 100,000"

  type_2:  # fees/commissions
    method: "flat_rate"
    rate: 0.50
    cap: 100_000
    note: "Combined with type_1 — total deduction for 1+2 ≤ 100,000"

  type_3:  # goodwill/royalties
    method: "flat_rate_or_actual"
    flat_rate: 0.50
    flat_cap: 100_000
    actual: true  # can choose actual expenses instead

  type_4:  # interest/dividends
    method: "none"
    note: "No expense deduction allowed"

  type_5:  # rental income — sub-rates by asset class
    method: "flat_rate_or_actual"
    sub_rates:
      building:          0.30  # บ้าน โรงเรือน สิ่งปลูกสร้าง แพ
      agricultural_land: 0.20  # ที่ดินเกษตร
      other_land:        0.15  # ที่ดินอื่น
      vehicle:           0.30  # ยานพาหนะ
      other_asset:       0.10  # ทรัพย์สินอื่น
    note: "Sub-lease: can only deduct the rent paid to original lessor"

  type_6:  # independent professions — sub-rates by profession
    method: "flat_rate_or_actual"
    sub_rates:
      medical:  0.60  # ประกอบโรคศิลป
      other:    0.30  # law, engineering, architecture, accounting, fine arts

  type_7:  # construction contracting
    method: "flat_rate_or_actual"
    flat_rate: 0.60

  type_8:  # business/other
    method: "flat_rate_or_actual"
    flat_rate_options: [0.60, 0.40]
    note: >
      Rate depends on sub-activity per Royal Decree 629 (พ.ร.ฎ. ฉบับที่ 629).
      Most business/commerce activities = 60%.
      Some specific activities = 40%.
      For a simplified calculator, use 60% as default or let user choose.
```

### 3.2 Important constraint

- For income types 1 + 2: the COMBINED flat-rate deduction cannot exceed 100,000 THB.
  ```
  deduction_1_2 = min(0.50 * (income_1 + income_2), 100_000)
  ```
- For types 3, 5, 6, 7, 8: taxpayer chooses the HIGHER of flat-rate or actual expenses.
- For type 4: zero deduction.

---

## 4. Personal Allowances / Deductions (ค่าลดหย่อน)

Applied AFTER expense deductions. These reduce เงินได้สุทธิ (net income).

### 4.1 Core personal allowances

```yaml
allowances:
  personal:
    amount: 60_000
    note: "Every taxpayer gets this"

  spouse:
    amount: 60_000
    condition: "Spouse has no assessable income"
    note: "If both have income and file jointly, combined max = 120,000"

  child:
    amount_per_child: 30_000
    amount_per_child_born_2018_plus: 60_000
    note: >
      30,000 per legitimate or adopted child.
      For 2nd child onward born from 2561 (2018): 60,000 per child.
      No limit on number of legitimate children.
      Adopted children: max 3 (but only if legitimate children < 3).

  pregnancy_and_birth:
    max_per_pregnancy: 60_000
    note: "Actual amount paid for prenatal and delivery care"

  parental_support:
    amount_per_parent: 30_000
    condition: >
      Parent aged ≥ 60, under taxpayer's care,
      parent's assessable income ≤ 30,000/year.
      Can also claim for spouse's parents (if spouse has no income).
    max_parents: 4  # own father, own mother, spouse's father, spouse's mother

  disabled_dependent:
    amount_per_person: 60_000
```

### 4.2 Insurance and retirement

```yaml
  life_insurance:
    max: 100_000
    condition: "Policy term ≥ 10 years"
    note: >
      Includes taxpayer's own premiums only.
      If spouse has no income, can deduct spouse's life insurance up to 10,000.
      Endowment policies with returns: returns must be ≤ 20% of annual premium.

  health_insurance:
    max: 25_000
    constraint: "life_insurance + health_insurance combined ≤ 100,000"

  parent_health_insurance:
    max: 15_000
    condition: "Parents' assessable income ≤ 30,000/year"
    note: "Covers parents of both taxpayer and spouse"

  pension_life_insurance:
    max: 200_000
    rate_cap: 0.15  # max 15% of assessable income
    actual: true
    constraint: "Subject to retirement fund combined cap of 500,000"
    condition: "Coverage ≥ 10 years, pays annuity from age 55 to 85+"

  provident_fund:  # กองทุนสำรองเลี้ยงชีพ (PVF)
    deduction_as_allowance: 10_000  # first 10,000 as ค่าลดหย่อน
    exemption_above: 490_000       # additional up to 490,000 as ยกเว้น
    total_max: 500_000
    constraint: "Subject to retirement fund combined cap of 500,000"

  rmf:  # กองทุนรวมเพื่อการเลี้ยงชีพ
    rate_cap: 0.30  # max 30% of assessable income
    no_fixed_cap: true  # no THB cap on RMF itself
    holding_period: "5 years from first purchase"
    constraint: "Subject to retirement fund combined cap of 500,000"

  ssf:  # กองทุนรวมเพื่อการออม
    rate_cap: 0.30
    max: 200_000
    holding_period: "10 years from purchase date"
    constraint: "Subject to retirement fund combined cap of 500,000"

  gpf:  # กบข. (government pension fund)
    max: 500_000
    constraint: "Subject to retirement fund combined cap of 500,000"

  nsf:  # กองทุนการออมแห่งชาติ (กอช.)
    max: 30_000
    constraint: "Subject to retirement fund combined cap of 500,000"

  private_teacher_fund:  # กองทุนสงเคราะห์ครูเอกชน
    max: 500_000
    constraint: "Subject to retirement fund combined cap of 500,000"
```

### 4.3 RETIREMENT FUND COMBINED CAP (critical rule)

```
retirement_combined_cap = 500_000

The SUM of ALL of these must not exceed 500,000 THB:
  - provident_fund (PVF)
  - rmf
  - ssf
  - gpf (กบข.)
  - nsf (กอช.)
  - private_teacher_fund
  - pension_life_insurance

Implementation:
  total_retirement = pvf + rmf + ssf + gpf + nsf + teacher_fund + pension_insurance
  if total_retirement > 500_000:
      reduce the last-added items to fit within 500,000
```

### 4.4 Investment / special deductions

```yaml
  thai_esg:  # กองทุนรวมไทยเพื่อความยั่งยืน
    rate_cap: 0.30
    max: 300_000
    holding_period: "5 years from purchase"
    note: "Separate from the 500,000 retirement cap"

  social_enterprise:
    max: 100_000
    note: "Investment in registered social enterprises"
```

### 4.5 Housing

```yaml
  mortgage_interest:
    max: 100_000
    condition: >
      Interest on loans from banks, financial institutions, insurance companies,
      cooperatives, or employers. For purchase/hire-purchase/construction of
      residential property. Property must be mortgaged as collateral.
```

### 4.6 Social security

```yaml
  social_security:
    max: 9_000  # standard annual cap for section 33 employees
    note: "Deduct actual contributions. Cap may change by government decree."
```

### 4.7 Donations (เงินบริจาค)

> **Important**: Donations are deducted LAST, after all other allowances.
> The cap is based on income after expenses and all other allowances.

```yaml
  donations:
    education_sport_hospital:
      multiplier: 2  # deduct 2x the donated amount
      max_rate: 0.10  # but ≤ 10% of (income after expenses and other allowances)
      condition: "Must be via e-Donation system"

    political_party:
      max: 10_000

    general_donations:
      multiplier: 1
      max_rate: 0.10  # ≤ 10% of (income after expenses and other allowances)
```

### 4.8 Temporary/stimulus measures (ปีภาษี 2567)

These are year-specific and may change. Flag them as `temporary: true`.

```yaml
  easy_e_receipt_2567:
    max: 50_000
    period: "1 Jan 2567 – 15 Feb 2567"
    temporary: true

  secondary_city_tourism_2567:
    max: 15_000
    period: "1 May 2567 – 30 Nov 2567"
    temporary: true

  new_home_construction_2567_2568:
    max: 100_000
    rate: "10,000 per 1,000,000 THB of construction cost (incl. VAT)"
    property_cap: 10_000_000
    max_properties: 1
    period: "9 Apr 2567 – 31 Dec 2568"
    temporary: true

  flood_home_repair_2567:
    max: 100_000
    period: "16 Aug 2567 – 31 Dec 2567"
    temporary: true

  flood_car_repair_2567:
    max: 30_000
    period: "16 Aug 2567 – 31 Dec 2567"
    temporary: true
```

---

## 5. Progressive Tax Brackets (อัตราภาษีเงินได้บุคคลธรรมดา)

Applied to เงินได้สุทธิ (net income after all deductions and allowances).

```yaml
brackets:
  - { min: 0,          max: 150_000,    rate: 0.00, label: "exempt" }
  - { min: 150_001,    max: 300_000,    rate: 0.05 }
  - { min: 300_001,    max: 500_000,    rate: 0.10 }
  - { min: 500_001,    max: 750_000,    rate: 0.15 }
  - { min: 750_001,    max: 1_000_000,  rate: 0.20 }
  - { min: 1_000_001,  max: 2_000_000,  rate: 0.25 }
  - { min: 2_000_001,  max: 5_000_000,  rate: 0.30 }
  - { min: 5_000_001,  max: null,       rate: 0.35 }
```

### Implementation note

The first bracket (0–150,000) exemption is from Royal Decree 470 (พ.ร.ฎ. ฉบับที่ 470).
The Revenue Code table itself starts at 5% for 0–300,000. The exemption layer sits
on top. For calculation purposes, just use the table above as-is.

```
function calculate_tax(net_income):
    tax = 0
    for bracket in brackets:
        upper = bracket.max ?? Infinity
        if net_income > bracket.min:
            taxable_in_bracket = min(net_income, upper) - bracket.min
            tax += taxable_in_bracket * bracket.rate
    return tax
```

---

## 6. Two-Method Tax Calculation (วิธีที่ 1 vs วิธีที่ 2)

Thailand requires comparing two methods and paying the HIGHER amount.

### Method 1 (primary — progressive brackets)

```
gross_income                              # sum of all income types
- expense_deductions                      # per Section 3 above
= income_after_expenses
- personal_allowances (excl. donations)   # per Section 4 above
= income_before_donations
- donations (capped at 10% of above)      # per Section 4.7
= net_income (เงินได้สุทธิ)
→ apply progressive brackets (Section 5)
= tax_method_1
```

### Method 2 (alternative — 0.5% of non-salary income)

```
non_salary_income = total_assessable_income - income_type_1
if non_salary_income >= 120_000:
    tax_method_2 = non_salary_income * 0.005
else:
    tax_method_2 = 0   # method 2 does not apply
```

### Final tax

```
if tax_method_2 > 0 AND tax_method_2 <= 5_000:
    # Method 2 is waived — pay method 1 only
    final_tax = tax_method_1
else:
    final_tax = max(tax_method_1, tax_method_2)
```

---

## 7. Tax Credits and Withholding (เครดิตภาษี)

After calculating `final_tax`, subtract:

```yaml
credits:
  withholding_tax:     # ภาษีหัก ณ ที่จ่าย (from ใบ 50 ทวิ)
    note: "Tax already withheld by payer throughout the year"

  mid_year_tax:        # ภาษีเงินได้ครึ่งปี (ภ.ง.ด.94)
    note: "Mid-year tax paid (for income types 5–8)"

  advance_tax:         # ภาษีชำระล่วงหน้า
    note: "Any advance payments"

  dividend_credit:     # เครดิตภาษีเงินปันผล
    note: >
      For dividends from Thai companies that paid 20% corporate tax:
      credit = dividend * (tax_rate / (1 - tax_rate))
      where tax_rate = corporate tax rate (typically 0.20)
      So credit = dividend * (0.20 / 0.80) = dividend * 0.25
      Taxpayer must include gross-up amount in assessable income.

  foreign_tax_credit:
    note: >
      For income taxed in a DTA country, credit the lesser of:
      (a) foreign tax paid, or
      (b) Thai tax attributable to that foreign income.
      Thailand has DTAs with 60+ countries including Japan and Sweden.
```

```
tax_payable = final_tax - withholding - mid_year - advance - dividend_credit - foreign_credit
if tax_payable < 0:
    refund = abs(tax_payable)
else:
    amount_due = tax_payable
```

---

## 8. Filing Deadlines

```yaml
filing:
  annual:
    paper: "1 January – 31 March of following year"
    online: "1 January – 8 April of following year (extended)"
    form_salary_only: "ภ.ง.ด.91"
    form_all_income: "ภ.ง.ด.90"

  mid_year:  # only for income types 5–8
    period: "1 July – 30 September"
    covers: "Income from 1 January – 30 June"
    form: "ภ.ง.ด.94"

  penalties:
    late_filing: "up to 2,000 THB per occurrence"
    late_payment_surcharge: "1.5% per month on unpaid tax"

  installment:
    condition: "Tax payable ≥ 3,000 THB"
    installments: 3
    late_interest: "1.5% per month on remaining balance"
```

---

## 9. Dividend Tax — Separate Filing Option

For income type 4(ข) dividends from Thai companies:

```yaml
dividend_options:
  option_a:  # include in annual return
    method: "Add gross-up dividend to assessable income, claim dividend credit"
    note: "Better if effective tax rate < withholding rate"

  option_b:  # final withholding
    withholding_rate: 0.10
    method: "10% withheld at source = final tax. Do not include in return."
    note: "Better if marginal tax rate > 10%"
```

---

## 10. Calculation Pseudocode (Complete)

```python
def thai_pit(
    incomes: dict[int, float],          # {1: salary, 2: fees, ...8: business}
    rental_sub: dict[str, float] | None, # for type 5: {building: x, land_ag: y, ...}
    profession_sub: str | None,          # for type 6: "medical" or "other"
    expense_method: dict[int, str],      # {3: "flat"|"actual", 5: "flat"|"actual", ...}
    actual_expenses: dict[int, float],   # if choosing actual
    allowances: dict[str, float],        # all allowance inputs
    credits: dict[str, float],           # withholding, etc.
) -> dict:

    # --- STEP 1: Expense deductions ---
    exp = {}

    # Types 1+2 combined
    combined_12 = incomes.get(1, 0) + incomes.get(2, 0)
    exp[12] = min(combined_12 * 0.50, 100_000)

    # Type 3
    if expense_method.get(3) == "actual":
        exp[3] = actual_expenses.get(3, 0)
    else:
        exp[3] = min(incomes.get(3, 0) * 0.50, 100_000)

    # Type 4 — no deduction
    exp[4] = 0

    # Type 5 — sum sub-rates or actual
    if expense_method.get(5) == "actual":
        exp[5] = actual_expenses.get(5, 0)
    else:
        RATES_5 = {
            "building": 0.30, "agricultural_land": 0.20,
            "other_land": 0.15, "vehicle": 0.30, "other_asset": 0.10
        }
        exp[5] = sum(
            rental_sub.get(k, 0) * r for k, r in RATES_5.items()
        ) if rental_sub else 0

    # Type 6
    if expense_method.get(6) == "actual":
        exp[6] = actual_expenses.get(6, 0)
    else:
        rate_6 = 0.60 if profession_sub == "medical" else 0.30
        exp[6] = incomes.get(6, 0) * rate_6

    # Type 7
    if expense_method.get(7) == "actual":
        exp[7] = actual_expenses.get(7, 0)
    else:
        exp[7] = incomes.get(7, 0) * 0.60

    # Type 8
    if expense_method.get(8) == "actual":
        exp[8] = actual_expenses.get(8, 0)
    else:
        exp[8] = incomes.get(8, 0) * 0.60  # default; user may specify 0.40

    total_income = sum(incomes.values())
    total_expenses = sum(exp.values())
    income_after_expenses = total_income - total_expenses

    # --- STEP 2: Personal allowances ---
    a = allowances
    personal = a.get("personal", 60_000)
    spouse = a.get("spouse", 0)  # 60,000 if qualifying
    children = a.get("children", 0)
    pregnancy = a.get("pregnancy", 0)
    parents = a.get("parents", 0)
    disabled = a.get("disabled", 0)
    life_ins = min(a.get("life_insurance", 0), 100_000)
    health_ins = min(a.get("health_insurance", 0), 25_000)
    # Combined constraint
    if life_ins + health_ins > 100_000:
        health_ins = 100_000 - life_ins
    parent_health = min(a.get("parent_health_insurance", 0), 15_000)
    social_security = min(a.get("social_security", 0), 9_000)
    mortgage = min(a.get("mortgage_interest", 0), 100_000)

    # Retirement funds (combined cap 500,000)
    pvf = min(a.get("provident_fund", 0), 500_000)
    rmf = min(a.get("rmf", 0), total_income * 0.30)
    ssf = min(a.get("ssf", 0), min(total_income * 0.30, 200_000))
    gpf = min(a.get("gpf", 0), 500_000)
    nsf = min(a.get("nsf", 0), 30_000)
    teacher = min(a.get("teacher_fund", 0), 500_000)
    pension_ins = min(a.get("pension_insurance", 0), min(total_income * 0.15, 200_000))
    retirement_total = pvf + rmf + ssf + gpf + nsf + teacher + pension_ins
    if retirement_total > 500_000:
        # Pro-rata reduction or cap at 500,000 — simplest: hard cap
        scale = 500_000 / retirement_total
        pvf *= scale; rmf *= scale; ssf *= scale
        gpf *= scale; nsf *= scale; teacher *= scale; pension_ins *= scale
        retirement_total = 500_000

    # Thai ESG (separate from retirement cap)
    thai_esg = min(a.get("thai_esg", 0), min(total_income * 0.30, 300_000))

    # Social enterprise
    social_enterprise = min(a.get("social_enterprise", 0), 100_000)

    # Temporary measures
    easy_e_receipt = min(a.get("easy_e_receipt", 0), 50_000)
    tourism = min(a.get("tourism", 0), 15_000)
    home_construction = min(a.get("home_construction", 0), 100_000)
    flood_home = min(a.get("flood_home", 0), 100_000)
    flood_car = min(a.get("flood_car", 0), 30_000)

    total_allowances_excl_donations = sum([
        personal, spouse, children, pregnancy, parents, disabled,
        life_ins, health_ins, parent_health, social_security, mortgage,
        pvf, rmf, ssf, gpf, nsf, teacher, pension_ins,
        thai_esg, social_enterprise,
        easy_e_receipt, tourism, home_construction, flood_home, flood_car,
    ])

    income_before_donations = income_after_expenses - total_allowances_excl_donations
    income_before_donations = max(income_before_donations, 0)

    # --- STEP 3: Donations ---
    donation_2x_raw = a.get("donation_education_sport_hospital", 0) * 2
    donation_general = a.get("donation_general", 0)
    donation_political = min(a.get("donation_political", 0), 10_000)
    donation_cap = income_before_donations * 0.10
    donations = min(donation_2x_raw + donation_general, donation_cap) + donation_political

    net_income = income_before_donations - donations
    net_income = max(net_income, 0)

    # --- STEP 4: Method 1 tax ---
    BRACKETS = [
        (150_000,     0.00),
        (300_000,     0.05),
        (500_000,     0.10),
        (750_000,     0.15),
        (1_000_000,   0.20),
        (2_000_000,   0.25),
        (5_000_000,   0.30),
        (float("inf"), 0.35),
    ]
    tax_m1 = 0
    prev = 0
    for upper, rate in BRACKETS:
        if net_income <= prev:
            break
        taxable = min(net_income, upper) - prev
        tax_m1 += taxable * rate
        prev = upper

    # --- STEP 5: Method 2 tax ---
    non_salary = total_income - incomes.get(1, 0)
    if non_salary >= 120_000:
        tax_m2 = non_salary * 0.005
    else:
        tax_m2 = 0

    # --- STEP 6: Final tax ---
    if tax_m2 > 0 and tax_m2 <= 5_000:
        final_tax = tax_m1  # method 2 waived
    else:
        final_tax = max(tax_m1, tax_m2)

    # --- STEP 7: Credits ---
    c = credits
    total_credits = sum([
        c.get("withholding", 0),
        c.get("mid_year_tax", 0),
        c.get("advance_tax", 0),
        c.get("dividend_credit", 0),
        c.get("foreign_tax_credit", 0),
    ])

    tax_payable = final_tax - total_credits

    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "income_after_expenses": income_after_expenses,
        "total_allowances": total_allowances_excl_donations + donations,
        "net_income": net_income,
        "tax_method_1": tax_m1,
        "tax_method_2": tax_m2,
        "final_tax": final_tax,
        "total_credits": total_credits,
        "tax_payable": tax_payable,
        "refund": abs(tax_payable) if tax_payable < 0 else 0,
    }
```

---

## 11. Test Cases

### Case A: Salaried employee, 1,200,000 THB/year

```
Income type 1: 1,200,000
Expense deduction: min(600,000, 100,000) = 100,000
After expenses: 1,100,000
Allowances: personal 60,000 + social security 9,000 = 69,000
Before donations: 1,031,000
Donations: 0
Net income: 1,031,000

Tax method 1:
  0–150,000      @ 0%  =       0
  150,001–300,000 @ 5%  =   7,500
  300,001–500,000 @10%  =  20,000
  500,001–750,000 @15%  =  37,500
  750,001–1,000,000 @20% = 50,000
  1,000,001–1,031,000 @25% = 7,750
  Total = 122,750

Method 2: non-salary = 0 → does not apply
Final tax = 122,750
```

### Case B: Freelancer (type 2) earning 600,000 + salary 400,000

```
Income type 1: 400,000
Income type 2: 600,000
Combined 1+2: 1,000,000
Expense deduction: min(500,000, 100,000) = 100,000
After expenses: 900,000
Allowances: personal 60,000 + social security 9,000 = 69,000
Net income: 831,000

Tax method 1:
  0–150,000      @ 0%  =       0
  150,001–300,000 @ 5%  =   7,500
  300,001–500,000 @10%  =  20,000
  500,001–750,000 @15%  =  37,500
  750,001–831,000 @20%  =  16,200
  Total = 81,200

Method 2: non-salary = 1,000,000 - 400,000 = 600,000 (≥120,000)
  tax_m2 = 600,000 * 0.005 = 3,000
  But 3,000 ≤ 5,000 → method 2 waived

Final tax = 81,200
```

---

## 12. Official Sources

| Topic | URL |
|---|---|
| PIT overview | https://www.rd.go.th/548.html |
| Income types (มาตรา 40) | https://www.rd.go.th/553.html |
| Tax calculation method | https://www.rd.go.th/555.html |
| Expense deductions | https://www.rd.go.th/556.html |
| Flat-rate rental deductions | https://www.rd.go.th/6054.html |
| Allowances/deductions PDF | https://www.rd.go.th/fileadmin/download/tax_deductions_update280168.pdf |
| Tax rate schedule (Revenue Code) | https://www.rd.go.th/5938.html |
| Tax rate table with 150K exemption | https://www.rd.go.th/59670.html |
| Exempt income types PDF | https://www.rd.go.th/fileadmin/user_upload/borkor/taxreturn23072567.pdf |
| Foreign tax credit calculator | https://www.rd.go.th/68221.html |
| ภ.ง.ด.90 filing guide (2568) | https://www.rd.go.th/fileadmin/tax_pdf/pit/2568/Ins90_241268.pdf |
