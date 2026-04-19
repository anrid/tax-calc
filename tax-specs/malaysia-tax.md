# Malaysia Income Tax (Cukai Pendapatan) — Implementation Spec

> **Purpose**: Machine-readable reference for implementing a Malaysian income tax calculator.
> Sources: LHDN/IRBM (hasil.gov.my), PwC Malaysian Tax Booklet 2025/2026.
> Effective for Year of Assessment (YA) 2025 — income earned 1 January to 31 December 2025.
> Filed in 2026. Same rates apply for YA 2026.

---

## 1. Tax Residency

```yaml
residency:
  resident_conditions:  # any of the following
    rule_a: "Present in Malaysia ≥ 182 days in the calendar year"
    rule_b: >
      Present in Malaysia < 182 days but linked to a period of ≥ 182
      consecutive days in the preceding or following year.
      Temporary absences count as consecutive days if for:
        - business trips
        - treatment for ill-health
        - social visits not exceeding 14 days
    rule_c: >
      Present ≥ 90 days in the year AND in any 3 of the 4 immediately
      preceding years was present ≥ 90 days OR resident
    rule_d: >
      Resident for the immediately following year AND for each of the
      3 immediately preceding years

  scope:
    resident: "Territorial — Malaysian-sourced income only"
    non_resident: "Malaysian-sourced income only (same scope)"

  note_territorial: >
    Malaysia uses TERRITORIAL taxation — foreign-sourced income is
    generally NOT taxed, even for residents. Exception: foreign-sourced
    income remitted to Malaysia by resident individuals received from
    2022 onwards is tax-exempt until 31 December 2036 (subject to conditions).

  non_resident_rate: 0.30  # flat 30% — no reliefs or rebates
```

---

## 2. Resident Income Tax Brackets (YA 2025 / YA 2026)

Source: https://www.pwc.com/my/en/publications/mtb/personal-income-tax.html

The PwC/LHDN table expresses brackets as "tax at threshold + % on excess".
Converted to bracket form for calculator implementation:

```yaml
resident_brackets_ya2025:
  - { min: 0,         max: 5_000,      rate: 0.00,  cumulative_tax_at_max: 0 }
  - { min: 5_001,     max: 20_000,     rate: 0.01,  cumulative_tax_at_max: 150 }
  - { min: 20_001,    max: 35_000,     rate: 0.03,  cumulative_tax_at_max: 600 }
  - { min: 35_001,    max: 50_000,     rate: 0.06,  cumulative_tax_at_max: 1_500 }
  - { min: 50_001,    max: 70_000,     rate: 0.11,  cumulative_tax_at_max: 3_700 }
  - { min: 70_001,    max: 100_000,    rate: 0.19,  cumulative_tax_at_max: 9_400 }
  - { min: 100_001,   max: 400_000,    rate: 0.25,  cumulative_tax_at_max: 84_400 }
  - { min: 400_001,   max: 600_000,    rate: 0.26,  cumulative_tax_at_max: 136_400 }
  - { min: 600_001,   max: 2_000_000,  rate: 0.28,  cumulative_tax_at_max: 528_400 }
  - { min: 2_000_001, max: null,        rate: 0.30,  cumulative_tax_at_max: null }

max_rate: 0.30
currency: "MYR (RM)"
note: >
  Brackets revised in YA 2023 to reduce tax on middle-income earners
  while increasing tax on the highest earners. Same brackets apply for YA 2026.
```

### Special 15% Flat Rate (Incentive Employment)

```yaml
special_15pct_rate:
  description: "Flat 15% on employment income for qualifying individuals"
  eligibility:
    - "Returning Expert Programme approved individuals — 5 consecutive YAs (applications by 31 Dec 2027)"
    - "Individuals working in specific economic zones (Iskandar, Forest City SFZ)"
    - "Global Services Hub workers"
    - "Knowledge workers in Iskandar Malaysia"
  note: "Major incentive — can reduce effective rate from 25-28% to 15%"
```

---

## 3. Non-Resident Tax Rates (YA 2025)

```yaml
non_resident_rates:
  general: 0.30  # business income, employment, rents, pensions, annuities
  public_entertainer: 0.15
  interest: 0.15
  royalties: 0.10
  rental_of_movable_property: 0.10
  services_in_malaysia: 0.10
  dividends_single_tier:
    up_to_100000: "Exempt"
    excess: 0.02  # 2% on dividend income > RM100,000
  other_income: 0.10
  note: "Non-residents get NO personal relief or rebates"
```

---

## 4. Personal Reliefs (YA 2025 — Resident Only)

Reliefs reduce chargeable income BEFORE tax is calculated. All amounts in RM.

### 4.1 Self and Family

```yaml
self_and_family_reliefs:
  self: 9_000  # automatic for all taxpayers
  disabled_individual_additional: 7_000  # on top of self
  spouse: 4_000  # if spouse has no income (or joint assessment)
  disabled_spouse_additional: 6_000
  children_under_18: 2_000  # per child
  children_over_18_preuni: 2_000  # per child (matriculation/A-Level)
  children_over_18_higher_ed: 8_000  # per child (diploma+ in Malaysia, degree+ overseas)
  disabled_child: 8_000
  disabled_child_higher_ed: 16_000
```

### 4.2 Insurance, Pension, EPF

```yaml
insurance_pension_reliefs:
  life_insurance_takaful_epf_voluntary: 3_000
  epf_mandatory_or_voluntary: 4_000  # for private-sector workers or civil servants
  private_retirement_scheme_deferred_annuity: 3_000  # until YA 2030
  education_medical_insurance: 4_000
  socso_employee: 350
  note: "EPF mandatory 11% contribution counts toward the RM4,000 EPF relief"
```

### 4.3 Medical Expenses

```yaml
medical_expense_reliefs:
  parents_grandparents:
    max: 8_000
    covers: "Medical/dental treatment, complete medical exam (incl. vaccination up to RM1,000), special needs/carer expenses"
  self_spouse_child:
    max: 10_000
    covers: >
      - Serious disease treatment
      - Fertility treatment (self/spouse)
      - Vaccination (up to RM1,000 — Budget 2026 expands to all NPRA-registered vaccines)
      - Dental examination/treatment (up to RM1,000)
      - Complete medical exam/self-testing devices/mental health (up to RM1,000)
      - Learning disability diagnosis/intervention for children ≤18 (up to RM6,000, Budget 2026 proposes RM10,000)
```

### 4.4 Education

```yaml
education_reliefs:
  self_education:
    max: 7_000
    covers: >
      - Tertiary level (except Masters/Doctorate) — legal/accounting/technical/scientific
      - Masters/Doctorate degree (any field)
      - Upskilling courses recognised by Director General of Skills Development (up to RM2,000, until YA 2026)
  child_skim_simpanan_pendidikan: 8_000  # SSPN deposits, until YA 2027
  childcare_kindergarten_fees: 3_000  # Budget 2026 expands to care centres for children ≤12
```

### 4.5 Lifestyle and Other

```yaml
lifestyle_and_other:
  lifestyle:
    max: 2_500
    covers: "Books, smartphone/PC/tablet, internet subscription, upskilling courses"
  sports:
    max: 1_000
    covers: "Sports equipment, facility rental, competition fees, gym membership, training"
  breastfeeding_equipment: 1_000  # once every 2 YAs
  disabled_supporting_equipment: 6_000  # for disabled self/spouse/child/parent
  ev_charging_equipment:
    max: 2_500
    covers: "Installation, rental, hire-purchase, subscription (until YA 2027); Budget 2026 adds food waste grinders + home CCTV"
  food_waste_composting_machine: 2_500  # included in EV charging cap
```

### 4.6 Housing (Limited — New from YA 2025)

```yaml
housing_loan_interest:
  condition: "First 3 consecutive YAs for residential property purchased 1 Jan 2025 – 31 Dec 2027"
  property_value_500k_or_below:
    max: 7_000  # per year
  property_value_500k_to_750k:
    max: 5_000  # per year
  property_above_750k: 0
  note: "New relief — major incentive for first-time homebuyers"
```

### 4.7 Budget 2026 Additions (YA 2026 only)

```yaml
budget_2026_additions:
  tourism_arts_culture: 1_000  # entrance fees to tourist attractions or arts/cultural programmes
```

---

## 5. Tax Rebates (YA 2025)

Rebates are deducted FROM TAX (not from income), applied after tax calculation.

```yaml
tax_rebates:
  individual:
    chargeable_income_limit: 35_000
    rebate: 400
    note: "Applies when chargeable income ≤ RM35,000"

  separate_assessment_spouses:
    per_spouse_limit: 35_000
    rebate_each: 400  # RM400 each (RM800 total possible)

  joint_assessment:
    joint_income_limit: 35_000
    rebate: 800

  zakat_fitrah:
    amount: "actual amount paid"
    note: "Islamic religious dues — deducted from tax directly"

  departure_levy_umrah:
    amount: "actual amount"
    lifetime_limit: "2 trips"

  note: "Rebates are non-refundable — excess not returned"
```

---

## 6. Special Tax Features

### 6.1 Dividend Tax (New from YA 2025)

```yaml
dividend_tax_from_ya2025:
  description: "2% tax on dividend income above RM100,000 from resident companies"
  threshold: 100_000  # RM
  rate_on_excess: 0.02
  applies_to: "Individual shareholders (resident and non-resident), including via nominees"
  calculation_base: "Chargeable dividend income AFTER eligible deductions"
  note: "Major NEW tax — previously dividends from single-tier companies were tax-exempt"
```

### 6.2 Real Property Gains Tax (RPGT)

```yaml
rpgt:
  description: "Separate tax on gains from disposing real property or shares in RPCs"
  rates_for_citizens_prs:
    year_1_to_3: 0.30  # holding ≤ 3 years
    year_4: 0.20
    year_5: 0.15
    year_6_and_after: 0.00
  rates_for_non_citizens_non_prs:
    year_1_to_5: 0.30
    year_6_and_after: 0.10
  note: "Companies have different rates. No RPGT on normal stock/share investments."
```

### 6.3 No Capital Gains Tax on Securities (mostly)

```yaml
capital_gains_individuals:
  listed_shares: "No tax for individual investors"
  unlisted_shares:
    from_2024: "Capital Gains Tax introduced for disposal of unlisted shares of Malaysian companies"
    rate: 0.10  # 10% on net gain OR 2% on gross
    applies_to: "Companies only, not individual investors (as of current law)"
  crypto: "Generally not taxed for individuals (unless treated as trading income)"
  bonds: "Generally not taxed for individuals"
```

---

## 7. Social Security Contributions (Statutory)

### 7.1 EPF (Employees Provident Fund / KWSP)

```yaml
epf:
  malaysian_citizens_prs_under_60:
    employee_rate: 0.11  # 11% of monthly wages
    employer_rate: 0.13  # 13% for salaries ≤ RM5,000; 12% above
    note: "Retirement savings; also counts toward RM4,000 EPF tax relief"
  
  malaysians_60_and_above:
    employee_rate: 0.00
    employer_rate: 0.04
  
  foreign_workers:
    from_oct_2025:
      employee_rate: 0.02  # 2% — newly mandatory from Oct 2025
      employer_rate: 0.02
      note: "Previously voluntary; now mandatory for employment pass holders"
      withdrawal: "Can apply for full withdrawal when leaving Malaysia permanently"
```

### 7.2 SOCSO (Social Security Organisation / PERKESO)

```yaml
socso:
  wage_ceiling: 6_000  # increased from RM4,000 in October 2024
  employee_rate: 0.005   # 0.5%
  employer_rate: 0.0175  # 1.75% (≤ RM3,000 salary bracket used in simple cases)
  note: >
    Uses an official contribution table with fixed amounts per wage band.
    Actual contribution amounts may differ slightly from percentage math.
  coverage: "Employment injury + invalidity schemes"
  
socso_foreign_workers:
  rate: 0.0125  # 1.25% employer-only
  coverage: "Employment Injury (EI) scheme only under Act 4"
  note: "Foreign workers NOT covered by EIS"
```

### 7.3 EIS (Employment Insurance System)

```yaml
eis:
  wage_ceiling: 6_000
  employee_rate: 0.002  # 0.2%
  employer_rate: 0.002  # 0.2%
  eligible_age: "18 to 60 years"
  coverage: "Unemployment benefits (job loss protection)"
  not_for: "Foreign workers"
```

### 7.4 HRD Levy

```yaml
hrd_levy:
  description: "Human Resources Development Fund"
  rate_employer: 0.01  # 1% of monthly wages
  employee: 0
  applies_to: "Registered employers in 63 industries with ≥10 Malaysian employees"
```

### 7.5 Total Employee Deductions Summary

```yaml
employee_deduction_summary:
  malaysian_employee_under_60:
    epf: "11%"
    socso: "~0.5% (capped at RM6,000 wage)"
    eis: "~0.2% (capped at RM6,000 wage)"
    approximate_total: "~11.7% of wages"
  
  employer_cost_malaysian:
    approximate: "~15-17% above gross salary (EPF + SOCSO + EIS + HRD)"
```

---

## 8. Calculation Flow

```
STEP 1: Calculate total income from all sources
  total = employment + business + rental + interest + dividends + other

STEP 2: Calculate gross income less allowable expenses (for business/rental)
  statutory_income = income - allowable_expenses

STEP 3: Total income = sum of statutory income from all sources

STEP 4: Subtract EPF mandatory contributions (already covered by RM4,000 relief)
  # Malaysian employees: 11% of salary
  # This is mandatory deduction before arriving at taxable income

STEP 5: Subtract all eligible reliefs
  chargeable_income = total_income - sum(reliefs)

STEP 6: Apply progressive tax brackets to chargeable income
  tax = lookup_brackets(chargeable_income, resident_brackets_ya2025)

STEP 7: Add 2% dividend tax (if applicable)
  if dividend_income > 100_000:
      dividend_tax = (dividend_income - 100_000) * 0.02
      tax += dividend_tax

STEP 8: Subtract rebates
  if chargeable_income <= 35_000:
      tax -= 400  # individual rebate
  tax -= zakat_paid  # capped at tax amount
  tax = max(tax, 0)

STEP 9: Subtract MTD/PCB withheld (monthly tax deductions)
  balance = tax - mtd_withheld
  # Positive = balance due; negative = refund
```

---

## 9. Pseudocode

```python
def malaysia_income_tax(
    employment_income: float = 0,
    business_income: float = 0,
    rental_income: float = 0,
    dividend_income: float = 0,  # from resident companies
    interest_income: float = 0,
    other_income: float = 0,
    # Filing status and family
    is_resident: bool = True,
    is_malaysian_citizen: bool = True,
    filing_status: str = "single",  # "single", "joint", "separate"
    has_non_working_spouse: bool = False,
    num_children_under_18: int = 0,
    num_children_higher_ed: int = 0,
    num_disabled_children: int = 0,
    is_disabled: bool = False,
    has_disabled_spouse: bool = False,
    # Reliefs (claimed amounts, subject to caps)
    epf_contributions: float = 0,  # capped at 4,000
    life_insurance: float = 0,  # capped at 3,000
    education_medical_insurance: float = 0,  # capped at 4,000
    socso_contributions: float = 0,  # capped at 350
    medical_parents: float = 0,  # capped at 8,000
    medical_self: float = 0,  # capped at 10,000
    education_self: float = 0,  # capped at 7,000
    childcare_fees: float = 0,  # capped at 3,000
    lifestyle_expenses: float = 0,  # capped at 2,500
    sports_expenses: float = 0,  # capped at 1,000
    ev_charging: float = 0,  # capped at 2,500
    sspn_deposit: float = 0,  # capped at 8,000
    housing_loan_interest: float = 0,  # up to 7,000 (property ≤500K) or 5,000 (500K-750K)
    housing_property_value: float = 0,
    # Tax rebates
    zakat_paid: float = 0,
    mtd_withheld: float = 0,
) -> dict:
    
    # Non-resident: flat 30%, no reliefs
    if not is_resident:
        total_income = (employment_income + business_income + rental_income 
                        + dividend_income + interest_income + other_income)
        nr_tax = total_income * 0.30
        # Dividend tax on excess over RM100,000
        if dividend_income > 100_000:
            nr_tax += (dividend_income - 100_000) * 0.02
        return {
            "is_resident": False,
            "total_income": total_income,
            "tax": round(nr_tax, 2),
        }
    
    # --- Resident calculation ---
    
    # STEP 1-3: Total income
    total_income = (employment_income + business_income + rental_income 
                    + dividend_income + interest_income + other_income)
    
    # --- STEP 5: Reliefs ---
    reliefs = 0
    
    # Self relief
    reliefs += 9_000
    if is_disabled:
        reliefs += 7_000
    
    # Spouse
    if has_non_working_spouse or filing_status == "joint":
        reliefs += 4_000
        if has_disabled_spouse:
            reliefs += 6_000
    
    # Children
    reliefs += num_children_under_18 * 2_000
    reliefs += num_children_higher_ed * 8_000
    reliefs += num_disabled_children * 8_000  # 16,000 if also higher ed
    
    # Insurance, pension, EPF
    reliefs += min(epf_contributions, 4_000)
    reliefs += min(life_insurance, 3_000)
    reliefs += min(education_medical_insurance, 4_000)
    reliefs += min(socso_contributions, 350)
    
    # Medical
    reliefs += min(medical_parents, 8_000)
    reliefs += min(medical_self, 10_000)
    
    # Education
    reliefs += min(education_self, 7_000)
    reliefs += min(childcare_fees, 3_000)
    reliefs += min(sspn_deposit, 8_000)
    
    # Lifestyle
    reliefs += min(lifestyle_expenses, 2_500)
    reliefs += min(sports_expenses, 1_000)
    reliefs += min(ev_charging, 2_500)
    
    # Housing loan interest
    if housing_property_value <= 500_000:
        reliefs += min(housing_loan_interest, 7_000)
    elif housing_property_value <= 750_000:
        reliefs += min(housing_loan_interest, 5_000)
    
    # --- Chargeable income ---
    chargeable_income = max(total_income - reliefs, 0)
    
    # --- STEP 6: Progressive tax brackets (YA 2025) ---
    BRACKETS = [
        (5_000, 0.00, 0),
        (20_000, 0.01, 150),
        (35_000, 0.03, 600),
        (50_000, 0.06, 1_500),
        (70_000, 0.11, 3_700),
        (100_000, 0.19, 9_400),
        (400_000, 0.25, 84_400),
        (600_000, 0.26, 136_400),
        (2_000_000, 0.28, 528_400),
        (float("inf"), 0.30, None),
    ]
    
    def calc_bracket_tax(income):
        prev_threshold = 0
        prev_cumulative = 0
        for threshold, rate, cumulative in BRACKETS:
            if income <= threshold:
                return prev_cumulative + (income - prev_threshold) * rate
            prev_threshold = threshold
            prev_cumulative = cumulative if cumulative is not None else prev_cumulative
        # Above 2M
        return prev_cumulative + (income - 2_000_000) * 0.30
    
    income_tax = calc_bracket_tax(chargeable_income)
    
    # --- STEP 7: Dividend tax (from YA 2025) ---
    dividend_tax = 0
    if dividend_income > 100_000:
        # Tax on dividend income after relief (simplified — full rule is complex)
        dividend_tax = (dividend_income - 100_000) * 0.02
    
    total_tax = income_tax + dividend_tax
    
    # --- STEP 8: Rebates ---
    if chargeable_income <= 35_000:
        total_tax = max(total_tax - 400, 0)  # individual rebate
    total_tax = max(total_tax - zakat_paid, 0)
    
    # --- STEP 9: Balance due/refund ---
    balance = total_tax - mtd_withheld
    
    return {
        "is_resident": True,
        "total_income": round(total_income, 2),
        "total_reliefs": round(reliefs, 2),
        "chargeable_income": round(chargeable_income, 2),
        "income_tax": round(income_tax, 2),
        "dividend_tax": round(dividend_tax, 2),
        "rebate_applied": 400 if chargeable_income <= 35_000 else 0,
        "total_tax": round(total_tax, 2),
        "mtd_withheld": round(mtd_withheld, 2),
        "balance_due_refund": round(balance, 2),
        "effective_rate": round(total_tax / total_income * 100, 1) if total_income > 0 else 0,
    }
```

---

## 10. Test Cases

### Case A: Single Malaysian earning RM80,000/year, no dependents

```
Employment income: 80,000
Reliefs:
  Self: 9,000
  EPF (11% = 8,800, capped): 4,000
  SOCSO: 350
  Lifestyle: 2,500
  Total: 15,850

Chargeable income: 80,000 - 15,850 = 64,150

Tax:
  First 50,000: 1,500
  Next 14,150 at 11%: 1,556.50
  Total: 3,056.50

No rebate (chargeable > 35,000)
Effective rate: 3.82%
```

### Case B: Married Malaysian earning RM150,000, 2 children, non-working spouse

```
Employment income: 150,000
Reliefs:
  Self: 9,000
  Spouse: 4,000
  Children (2 × 2,000): 4,000
  EPF: 4,000
  SOCSO: 350
  Medical insurance: 3,000
  Lifestyle: 2,500
  Childcare: 3,000
  Sports: 1,000
  Total: 30,850

Chargeable income: 150,000 - 30,850 = 119,150

Tax:
  First 100,000: 9,400
  Next 19,150 at 25%: 4,787.50
  Total: 14,187.50

Effective rate: 9.46%
```

### Case C: High earner RM500,000, single

```
Employment income: 500,000
Reliefs: ~20,000 (self, EPF, various)

Chargeable income: ~480,000

Tax:
  First 400,000: 84,400
  Next 80,000 at 26%: 20,800
  Total: 105,200

Effective rate: ~21.0%
```

---

## 11. Filing Deadlines and Process

```yaml
filing:
  year_of_assessment: "Calendar year (Jan 1 – Dec 31)"

  forms:
    form_be: "Residents with no business income (employees)"
    form_b: "Residents with business/self-employment income"
    form_m: "Non-residents"
    form_bt: "Residents with employment income under special schemes (e.g., knowledge workers)"

  deadlines:
    paper_filing_be: "April 30 following year"
    e_filing_be: "May 15 following year (15-day extension)"
    paper_filing_b: "June 30 following year"
    e_filing_b: "July 15 following year"

  payment_system:
    mtd_pcb:
      description: "Monthly Tax Deduction (Potongan Cukai Bulanan)"
      mechanism: "Employer withholds tax monthly, remits to LHDN"
      adjustment: "Actual tax determined at annual filing; refund or balance due"
    cp500:
      description: "6 bimonthly instalments for non-salary income (business/rental)"

  portal: "MyTax at https://mytax.hasil.gov.my"

  penalties:
    late_filing: "Fine RM200-RM20,000 or prison ≤ 6 months (or both)"
    underpayment: "10% penalty of unpaid tax + 5% after 60 days"
    tax_evasion: "Fine + 3x tax undercharged + imprisonment up to 3 years"
```

---

## 12. Key Malaysia-Specific Concepts

```yaml
implementation_notes:
  territorial_taxation:
    description: >
      Malaysia taxes only Malaysian-sourced income — a major benefit.
      Foreign-sourced income remitted to Malaysia from 2022+ is TAX-EXEMPT
      until 31 December 2036 (with conditions).
    significance: "Very attractive for individuals with foreign investments"

  reliefs_vs_rebates:
    reliefs: "Reduce chargeable income BEFORE tax calculation"
    rebates: "Reduce tax AFTER calculation (e.g., RM400 for income ≤ RM35,000)"
    order: "Apply reliefs first, calculate tax, then subtract rebates"

  budget_2026_changes:
    - "2% dividend tax on excess over RM100,000 (from YA 2025)"
    - "Budget 2026: 2% tax extended to LLP profit distributions (from YA 2026)"
    - "Housing loan interest relief (7K/5K based on property value)"
    - "Various medical/insurance relief expansions"

  returning_expert_programme:
    description: "15% flat rate for 5 years — major incentive for Malaysians returning from overseas"
    application_deadline: "31 December 2027"
    note: "Significantly reduces tax burden vs standard progressive rates"

  15_pct_incentives:
    special_zones: ["Iskandar Malaysia", "Forest City SFZ", "Global Services Hub"]
    note: "Choice of employment location can dramatically affect tax liability"

  territorial_vs_worldwide:
    malaysia: "Territorial — foreign income exempt"
    thailand: "Remittance basis (from 2024)"
    singapore: "Also territorial"
    japan_sweden_us_uk_ch: "Worldwide income taxation"
```

---

## 13. Key Differences from Other Countries

```yaml
comparison:
  tax_scope:
    malaysia: "TERRITORIAL — only Malaysian-sourced income taxed (with foreign-remitted exemption until 2036)"
    thailand: "Also territorial, but remittance basis applies from 2024"
    sweden_us_uk_ch_japan: "Worldwide income taxation"
    note: "Malaysia + Thailand = most favorable for cross-border individuals"

  top_rate:
    malaysia: "30% (only on income > RM2M ≈ USD 470K)"
    thailand: "35%"
    japan: "45%"
    sweden: "~52% combined"
    us_ca: "37% + up to 13.3% state"
    uk: "45%"
    switzerland: "~40-42% in high-tax cantons, ~22% in low-tax"
    note: "Malaysia's top rate is relatively low AND kicks in at a high threshold"

  reliefs_system:
    malaysia: "Many itemized reliefs (9K self + many small amounts)"
    us: "Single standard deduction OR itemized"
    uk: "Single Personal Allowance (no itemized choice)"
    sweden: "Grundavdrag formula (income-dependent)"
    thailand: "Expense deductions by type + many allowances (similar to Malaysia)"

  epf_contribution:
    malaysia: "11% employee (Malaysians); 2% employee (foreigners from Oct 2025)"
    singapore: "Similar CPF system"
    us_uk: "Voluntary 401k/pension (no mandatory equivalent)"

  capital_gains:
    malaysia: "Generally tax-free on securities for individuals"
    switzerland: "Fully tax-free on securities for individuals"
    japan: "20.315% flat"
    sweden: "30% flat"
    uk: "18%/24%"
    us: "0/15/20% LTCG"
    thailand: "Added to progressive rates"

  filing:
    malaysia: "Self-assessment via MyTax online (BE/B/M forms)"
    japan: "Year-end adjustment by employer for most; online Kokuzei"
    sweden: "Pre-filled online — one-click approval"
    uk: "PAYE for most, Self Assessment if required"
    us: "Form 1040 + state return"
    switzerland: "Paper/electronic Steuererklärung"
    thailand: "Paper/online ภ.ง.ด.90/91"
```

---

## 14. Official Sources

| Topic | URL |
|---|---|
| LHDN/IRBM main site | https://www.hasil.gov.my |
| MyTax portal (e-Filing) | https://mytax.hasil.gov.my |
| PwC Malaysian Tax Booklet 2025/2026 | https://www.pwc.com/my/en/publications/mtb.html |
| PwC Personal Income Tax 2025/26 | https://www.pwc.com/my/en/publications/mtb/personal-income-tax.html |
| Public Ruling 7/2025 (deductions for parents/grandparents) | https://www.hasil.gov.my/media/0jbegsui/pr-7-2025.pdf |
| Income Tax Act 1967 | https://www.hasil.gov.my/en/laws-and-regulations/income-tax-act-1967 |
| EPF/KWSP official | https://www.kwsp.gov.my |
| SOCSO/PERKESO official | https://www.perkeso.gov.my |
| PwC territorial taxation note | https://www.pwc.com/my/en/publications/2025/doing-business-in-malaysia.html |
| Budget 2026 summary (PwC) | https://www.pwc.com/my/en/issues/budget.html |
