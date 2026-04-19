# United States (California) Income Tax — Implementation Spec

> **Purpose**: Machine-readable reference for implementing a US Federal + California
> state income tax calculator for individuals.
> Sources: IRS (irs.gov), California Franchise Tax Board (ftb.ca.gov), Tax Foundation.
> Effective for tax year 2025 (returns filed in 2026).
> Includes changes from the One Big Beautiful Bill Act (OBBBA) signed July 2025.

---

## 1. Tax Residency

### 1.1 Federal

```yaml
federal_residency:
  citizen_or_resident_alien:
    scope: "Worldwide income"
    tests:
      green_card: "Lawful permanent resident at any time during the year"
      substantial_presence: >
        Present in the US ≥ 31 days in current year AND
        sum of (current year days + 1/3 prior year days + 1/6 two-years-ago days) ≥ 183
  non_resident_alien:
    scope: "US-sourced income only"
    withholding: 0.30  # default, reduced by tax treaties
```

### 1.2 California

```yaml
california_residency:
  resident:
    definition: "Domiciled in California OR present in California for other than temporary/transitory purpose"
    rule_of_thumb: ">9 months in CA generally = resident"
    scope: "Worldwide income"
  part_year_resident: "Taxed on all income while resident + CA-source income while nonresident"
  nonresident: "CA-source income only"
  note: "California has NO reciprocity agreements with other states"
```

---

## 2. Filing Status

Both federal and California use the same filing statuses:

```yaml
filing_statuses:
  - single
  - married_filing_jointly  # (MFJ) — includes qualifying surviving spouse
  - married_filing_separately  # (MFS)
  - head_of_household  # (HoH)
  note: "California also recognizes Registered Domestic Partners (RDP) as married"
```

---

## 3. Federal Income Tax Brackets (2025)

Source: https://www.irs.gov/filing/federal-income-tax-rates-and-brackets

### 3.1 Single

```yaml
federal_brackets_single_2025:
  - { min: 0,        max: 11_925,   rate: 0.10 }
  - { min: 11_926,   max: 48_475,   rate: 0.12 }
  - { min: 48_476,   max: 103_350,  rate: 0.22 }
  - { min: 103_351,  max: 197_300,  rate: 0.24 }
  - { min: 197_301,  max: 250_525,  rate: 0.32 }
  - { min: 250_526,  max: 626_350,  rate: 0.35 }
  - { min: 626_351,  max: null,     rate: 0.37 }
```

### 3.2 Married Filing Jointly

```yaml
federal_brackets_mfj_2025:
  - { min: 0,        max: 23_850,   rate: 0.10 }
  - { min: 23_851,   max: 96_950,   rate: 0.12 }
  - { min: 96_951,   max: 206_700,  rate: 0.22 }
  - { min: 206_701,  max: 394_600,  rate: 0.24 }
  - { min: 394_601,  max: 501_050,  rate: 0.32 }
  - { min: 501_051,  max: 751_600,  rate: 0.35 }
  - { min: 751_601,  max: null,     rate: 0.37 }
```

### 3.3 Head of Household

```yaml
federal_brackets_hoh_2025:
  - { min: 0,        max: 17_000,   rate: 0.10 }
  - { min: 17_001,   max: 64_850,   rate: 0.12 }
  - { min: 64_851,   max: 103_350,  rate: 0.22 }
  - { min: 103_351,  max: 197_300,  rate: 0.24 }
  - { min: 197_301,  max: 250_500,  rate: 0.32 }
  - { min: 250_501,  max: 626_350,  rate: 0.35 }
  - { min: 626_351,  max: null,     rate: 0.37 }
```

---

## 4. Federal Standard Deduction (2025)

Post-OBBBA amounts (higher than original Rev. Proc. 2024-40 amounts):

```yaml
federal_standard_deduction_2025:
  single: 15_750
  married_filing_jointly: 31_500
  married_filing_separately: 15_750
  head_of_household: 23_625
  additional_65_or_blind:
    single_or_hoh: 2_000  # per qualifying condition
    married: 1_600        # per qualifying condition per spouse
  note: >
    OBBBA increased these above the original IRS inflation-adjusted amounts.
    Taxpayers choose the GREATER of standard deduction or itemized deductions.
```

---

## 5. Federal Itemized Deductions (Key Items)

If itemized deductions exceed the standard deduction, taxpayers can choose to itemize.

```yaml
federal_itemized_deductions:
  salt:  # State And Local Tax deduction
    max: 40_000  # OBBBA raised from 10,000 to 40,000 for 2025+
    includes: "State income tax + property tax (combined cap)"
    mfs_max: 20_000
    note: "Major OBBBA change — was capped at $10,000 under TCJA"

  mortgage_interest:
    limit: 750_000  # of acquisition debt (loans originated after Dec 15, 2017)
    pre_tcja_loans: 1_000_000  # grandfathered for loans before Dec 16, 2017

  medical_expenses:
    threshold: 0.075  # deductible portion = expenses exceeding 7.5% of AGI

  charitable_contributions:
    cash_limit: 0.60  # up to 60% of AGI for cash donations to qualifying orgs
    non_cash: 0.30    # up to 30% of AGI
    note: "Starting 2026: non-itemizers can deduct up to $1,000 ($2,000 MFJ) in cash donations"

  casualty_losses:
    condition: "Only federally declared disaster areas"
```

---

## 6. Federal Adjustments to Income (Above-the-Line)

These reduce Adjusted Gross Income (AGI) even if you take the standard deduction.

```yaml
above_the_line_deductions:
  traditional_ira: { max_single: 7_000, max_50plus: 8_000, note: "Phase-out based on AGI if covered by employer plan" }
  student_loan_interest: { max: 2_500, phase_out_single: "85,000-100,000", phase_out_mfj: "170,000-200,000" }
  hsa_contributions: { single: 4_300, family: 8_550, catch_up_55plus: 1_000 }
  self_employment_tax: "50% of SE tax is deductible"
  alimony: "Pre-2019 agreements only"
  educator_expenses: 300
```

---

## 7. Federal Payroll Taxes (FICA + Medicare)

```yaml
payroll_taxes_employee_2025:
  social_security:
    rate: 0.062
    wage_base: 176_100  # max earnings subject to SS tax
    note: "Employer matches 6.2%"
  medicare:
    rate: 0.0145
    wage_base: null  # no cap
    additional_medicare:
      rate: 0.009  # extra 0.9% on wages above threshold
      threshold_single: 200_000
      threshold_mfj: 250_000
    note: "Employer matches 1.45% (not the additional 0.9%)"
  total_employee_fica: "7.65% on first $176,100 + 1.45% on remainder + 0.9% above $200K/$250K"

net_investment_income_tax:
  rate: 0.038
  threshold_single: 200_000
  threshold_mfj: 250_000
  applies_to: "Investment income (interest, dividends, capital gains, rental)"
```

---

## 8. Federal Capital Gains Tax (2025)

```yaml
capital_gains_2025:
  short_term: "Taxed as ordinary income (held ≤ 1 year)"
  long_term:  # held > 1 year
    single:
      - { max: 48_350,   rate: 0.00 }
      - { max: 533_400,  rate: 0.15 }
      - { above: 533_400, rate: 0.20 }
    mfj:
      - { max: 96_700,   rate: 0.00 }
      - { max: 600_050,  rate: 0.15 }
      - { above: 600_050, rate: 0.20 }
  qualified_dividends: "Same rates as long-term capital gains"
  niit: "Additional 3.8% on investment income above $200K/$250K (see Section 7)"
```

---

## 9. Federal Tax Credits (Key Items)

```yaml
federal_tax_credits:
  child_tax_credit:
    amount: 2_200  # per qualifying child under 17 (OBBBA increased from 2,000)
    refundable_portion: 1_700  # ACTC
    phase_out_single: 200_000
    phase_out_mfj: 400_000

  earned_income_credit:
    max_no_children: 649
    max_1_child: 4_328
    max_2_children: 7_152
    max_3_plus: 8_046
    note: "Income phase-out depends on filing status and number of children"

  child_dependent_care:
    max_expenses: 3_000  # 1 dependent; 6,000 for 2+
    credit_rate: "20-35% depending on AGI"

  education_credits:
    american_opportunity: { max: 2_500, years: 4, refundable_40pct: true }
    lifetime_learning: { max: 2_000, phase_out: "80,000-90,000 single" }

  retirement_savings_credit:
    max: 1_000  # single; 2,000 MFJ
    rate: "10-50% depending on AGI"
```

---

## 10. California State Income Tax Brackets (2025)

Source: https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf

### 10.1 Single / Married Filing Separately (Schedule X)

```yaml
california_brackets_single_2025:
  - { min: 0,        max: 11_079,   rate: 0.01 }
  - { min: 11_080,   max: 26_264,   rate: 0.02 }
  - { min: 26_265,   max: 41_452,   rate: 0.04 }
  - { min: 41_453,   max: 57_542,   rate: 0.06 }
  - { min: 57_543,   max: 72_724,   rate: 0.08 }
  - { min: 72_725,   max: 371_479,  rate: 0.093 }
  - { min: 371_480,  max: 445_771,  rate: 0.103 }
  - { min: 445_772,  max: 742_953,  rate: 0.113 }
  - { min: 742_954,  max: null,     rate: 0.123 }
mental_health_services_tax:
  threshold: 1_000_000
  rate: 0.01
  note: "Additional 1% on taxable income > $1M, making effective top rate 13.3%"
```

### 10.2 Married Filing Jointly / Qualifying Surviving Spouse (Schedule Y)

```yaml
california_brackets_mfj_2025:
  - { min: 0,        max: 22_158,     rate: 0.01 }
  - { min: 22_159,   max: 52_528,     rate: 0.02 }
  - { min: 52_529,   max: 82_904,     rate: 0.04 }
  - { min: 82_905,   max: 115_084,    rate: 0.06 }
  - { min: 115_085,  max: 145_448,    rate: 0.08 }
  - { min: 145_449,  max: 742_958,    rate: 0.093 }
  - { min: 742_959,  max: 891_542,    rate: 0.103 }
  - { min: 891_543,  max: 1_485_906,  rate: 0.113 }
  - { min: 1_485_907, max: null,      rate: 0.123 }
mental_health_services_tax:
  threshold: 1_000_000
  rate: 0.01
```

### 10.3 Head of Household (Schedule Z)

```yaml
california_brackets_hoh_2025:
  - { min: 0,        max: 22_173,     rate: 0.01 }
  - { min: 22_174,   max: 52_530,     rate: 0.02 }
  - { min: 52_531,   max: 67_716,     rate: 0.04 }
  - { min: 67_717,   max: 83_805,     rate: 0.06 }
  - { min: 83_806,   max: 98_990,     rate: 0.08 }
  - { min: 98_991,   max: 505_208,    rate: 0.093 }
  - { min: 505_209,  max: 606_251,    rate: 0.103 }
  - { min: 606_252,  max: 1_010_417,  rate: 0.113 }
  - { min: 1_010_418, max: null,      rate: 0.123 }
mental_health_services_tax:
  threshold: 1_000_000
  rate: 0.01
```

---

## 11. California Standard Deduction & Exemptions (2025)

```yaml
california_standard_deduction_2025:
  single: 5_706
  married_filing_jointly: 11_412
  married_filing_separately: 5_706
  head_of_household: 11_412
  note: "Much lower than federal — many CA filers who take federal standard still itemize for CA"

california_exemption_credits_2025:
  personal: 144  # per taxpayer (tax credit, not deduction)
  dependent: 433  # per dependent (tax credit)
  note: >
    California uses exemption CREDITS (reducing tax) rather than exemption
    deductions (reducing income). Very small amounts.
```

---

## 12. California-Specific Rules

```yaml
california_differences:
  no_capital_gains_preference:
    description: "CA taxes capital gains as ordinary income — no special rate"
    note: "This is a MAJOR difference from federal. Long-term gains up to 13.3%."

  no_social_security_tax:
    description: "CA does not tax Social Security benefits"

  retirement_income:
    description: "401(k), IRA, pension distributions are fully taxable at regular rates"

  mortgage_interest:
    limit: 1_000_000  # CA kept the pre-TCJA $1M limit (federal is $750K)

  salt_deduction:
    description: "CA does not allow deduction of state income tax on state return"
    note: "You CAN deduct property tax and other state/local taxes"

  ca_sdi:  # State Disability Insurance
    rate: 0.011  # 1.1% on ALL wages (no cap since 2024)
    note: >
      SDI is a payroll deduction, not income tax, but reduces take-home pay.
      Since 2024, the wage ceiling was removed — all wages are subject.

  ca_earned_income_credit:
    max: 3_756
    income_limit: 32_900
    refundable: true

  young_child_credit:
    max: 1_189
    condition: "Child under 6 + qualifies for CalEITC"

  renters_credit:
    single: 60
    joint_hoh: 120
    income_limit_single: 53_994
    income_limit_joint: 107_987
```

---

## 13. Calculation Flow

```
=== FEDERAL ===

STEP 1: Total gross income (wages, business, investments, etc.)

STEP 2: Subtract above-the-line deductions → Adjusted Gross Income (AGI)
  AGI = gross_income - ira_deduction - student_loan_interest - hsa - se_tax_deduction - ...

STEP 3: Subtract greater of standard deduction or itemized deductions → Taxable Income
  taxable_income = AGI - max(standard_deduction, itemized_deductions)

STEP 4: Apply federal progressive brackets → Federal income tax

STEP 5: Subtract federal tax credits
  federal_tax = bracket_tax - child_tax_credit - education_credits - ...

STEP 6: Add other taxes
  total_federal = federal_tax + self_employment_tax + NIIT + AMT (if applicable)

STEP 7: Subtract withholding and estimated payments
  federal_due = total_federal - federal_withholding - estimated_payments

=== CALIFORNIA ===

STEP 8: Start from federal AGI (California uses federal AGI as starting point)
  ca_agi = federal_agi + ca_additions - ca_subtractions

STEP 9: Subtract CA standard deduction or CA itemized deductions → CA Taxable Income
  ca_taxable = ca_agi - max(ca_standard_deduction, ca_itemized)

STEP 10: Apply CA progressive brackets (9 brackets: 1% to 12.3%)

STEP 11: Add Mental Health Services Tax (1% on income > $1M)

STEP 12: Subtract CA exemption credits + other CA credits
  ca_tax = bracket_tax + mhst - exemption_credits - ca_eitc - renters_credit - ...

STEP 13: Subtract CA withholding
  ca_due = ca_tax - ca_withholding - ca_estimated_payments

=== TOTAL ===
total_tax = federal_due + ca_due
total_effective_rate = (total_federal + ca_tax) / gross_income
```

---

## 14. Pseudocode

```python
import math

def us_california_tax(
    filing_status: str,  # "single", "mfj", "mfs", "hoh"
    wages: float = 0,
    other_income: float = 0,  # business, rental, etc.
    capital_gains_lt: float = 0,
    capital_gains_st: float = 0,
    qualified_dividends: float = 0,
    interest_income: float = 0,
    # Above-the-line
    traditional_ira: float = 0,
    hsa: float = 0,
    student_loan_interest: float = 0,
    # Deductions
    use_standard_deduction: bool = True,
    state_local_taxes_paid: float = 0,
    mortgage_interest: float = 0,
    charitable: float = 0,
    medical_expenses: float = 0,
    # Credits
    num_children: int = 0,
    # Withholding
    federal_withholding: float = 0,
    ca_withholding: float = 0,
) -> dict:

    # ===== FEDERAL =====

    gross_income = wages + other_income + capital_gains_st + interest_income
    # Qualified dividends and LTCG taxed separately
    ordinary_income = gross_income

    # AGI
    above_line = traditional_ira + hsa + min(student_loan_interest, 2_500)
    agi = gross_income + capital_gains_lt + qualified_dividends - above_line

    # Standard vs Itemized
    std_ded = {"single": 15_750, "mfj": 31_500, "mfs": 15_750, "hoh": 23_625}
    salt_cap = 20_000 if filing_status == "mfs" else 40_000
    itemized = (
        min(state_local_taxes_paid, salt_cap)
        + mortgage_interest
        + charitable
        + max(medical_expenses - agi * 0.075, 0)
    )
    deduction = max(std_ded[filing_status], itemized) if not use_standard_deduction else std_ded[filing_status]
    if not use_standard_deduction:
        deduction = max(std_ded[filing_status], itemized)

    taxable_ordinary = max(ordinary_income - above_line - deduction, 0)

    # Federal brackets (single example — select by filing_status in production)
    BRACKETS = {
        "single": [
            (11_925, 0.10), (48_475, 0.12), (103_350, 0.22), (197_300, 0.24),
            (250_525, 0.32), (626_350, 0.35), (float("inf"), 0.37)
        ],
        "mfj": [
            (23_850, 0.10), (96_950, 0.12), (206_700, 0.22), (394_600, 0.24),
            (501_050, 0.32), (751_600, 0.35), (float("inf"), 0.37)
        ],
        "hoh": [
            (17_000, 0.10), (64_850, 0.12), (103_350, 0.22), (197_300, 0.24),
            (250_500, 0.32), (626_350, 0.35), (float("inf"), 0.37)
        ],
        "mfs": [
            (11_925, 0.10), (48_475, 0.12), (103_350, 0.22), (197_300, 0.24),
            (250_525, 0.32), (375_800, 0.35), (float("inf"), 0.37)
        ],
    }

    def calc_bracket_tax(taxable, brackets):
        tax = 0
        prev = 0
        for upper, rate in brackets:
            if taxable <= prev:
                break
            tax += (min(taxable, upper) - prev) * rate
            prev = upper
        return tax

    fed_ordinary_tax = calc_bracket_tax(taxable_ordinary, BRACKETS[filing_status])

    # Long-term capital gains + qualified dividends (simplified)
    ltcg_total = capital_gains_lt + qualified_dividends
    # Simplified: 15% for most, 0% and 20% brackets omitted for brevity
    fed_ltcg_tax = ltcg_total * 0.15  # simplified; use proper brackets in production

    fed_income_tax = fed_ordinary_tax + fed_ltcg_tax

    # Child tax credit
    ctc = num_children * 2_200
    fed_income_tax = max(fed_income_tax - ctc, 0)

    # FICA (employee portion)
    ss_tax = min(wages, 176_100) * 0.062
    medicare_tax = wages * 0.0145
    threshold = 200_000 if filing_status != "mfj" else 250_000
    additional_medicare = max(wages - threshold, 0) * 0.009
    fica = ss_tax + medicare_tax + additional_medicare

    # NIIT
    investment_income = capital_gains_lt + capital_gains_st + qualified_dividends + interest_income
    niit_threshold = 200_000 if filing_status != "mfj" else 250_000
    niit = max(min(investment_income, agi - niit_threshold), 0) * 0.038

    total_federal = fed_income_tax + fica + niit

    # ===== CALIFORNIA =====

    ca_agi = agi  # simplified; some CA adjustments may apply

    ca_std = {"single": 5_706, "mfj": 11_412, "mfs": 5_706, "hoh": 11_412}
    ca_taxable = max(ca_agi - ca_std[filing_status], 0)

    CA_BRACKETS = {
        "single": [
            (11_079, 0.01), (26_264, 0.02), (41_452, 0.04), (57_542, 0.06),
            (72_724, 0.08), (371_479, 0.093), (445_771, 0.103),
            (742_953, 0.113), (float("inf"), 0.123)
        ],
        "mfj": [
            (22_158, 0.01), (52_528, 0.02), (82_904, 0.04), (115_084, 0.06),
            (145_448, 0.08), (742_958, 0.093), (891_542, 0.103),
            (1_485_906, 0.113), (float("inf"), 0.123)
        ],
        "hoh": [
            (22_173, 0.01), (52_530, 0.02), (67_716, 0.04), (83_805, 0.06),
            (98_990, 0.08), (505_208, 0.093), (606_251, 0.103),
            (1_010_417, 0.113), (float("inf"), 0.123)
        ],
        "mfs": [  # same as single
            (11_079, 0.01), (26_264, 0.02), (41_452, 0.04), (57_542, 0.06),
            (72_724, 0.08), (371_479, 0.093), (445_771, 0.103),
            (742_953, 0.113), (float("inf"), 0.123)
        ],
    }

    ca_tax = calc_bracket_tax(ca_taxable, CA_BRACKETS[filing_status])

    # Mental Health Services Tax
    if ca_taxable > 1_000_000:
        ca_tax += (ca_taxable - 1_000_000) * 0.01

    # CA exemption credits
    ca_exemptions = 144  # per taxpayer
    if filing_status in ("mfj",):
        ca_exemptions = 144 * 2
    ca_exemptions += num_children * 433
    ca_tax = max(ca_tax - ca_exemptions, 0)

    # CA SDI (payroll)
    ca_sdi = wages * 0.011

    total_ca = ca_tax + ca_sdi

    # ===== TOTALS =====
    total_all_taxes = total_federal + ca_tax  # SDI is payroll, counted separately
    gross = wages + other_income + capital_gains_lt + capital_gains_st + qualified_dividends + interest_income

    return {
        "federal_agi": round(agi),
        "federal_taxable_income": round(taxable_ordinary),
        "federal_income_tax": round(fed_income_tax),
        "federal_fica": round(fica),
        "federal_niit": round(niit),
        "total_federal": round(total_federal),
        "california_taxable_income": round(ca_taxable),
        "california_income_tax": round(ca_tax),
        "california_sdi": round(ca_sdi),
        "total_california": round(total_ca),
        "combined_income_tax": round(fed_income_tax + ca_tax),
        "combined_all_taxes": round(total_federal + total_ca),
        "effective_rate": round((fed_income_tax + ca_tax) / gross * 100, 1) if gross > 0 else 0,
        "federal_due": round(total_federal - federal_withholding - fica),
        "california_due": round(ca_tax - ca_withholding),
    }
```

---

## 15. Test Cases

### Case A: Single filer, $120,000 W-2 salary, no dependents

```
Federal:
  AGI: 120,000
  Standard deduction: 15,750
  Taxable: 104,250
  Tax: 11,925×0.10 + 36,550×0.12 + 54,875×0.22 + 900×0.24
     = 1,192.50 + 4,386 + 12,072.50 + 216 = 17,867
  FICA: 120,000×0.0765 = 9,180

California:
  Standard deduction: 5,706
  Taxable: 114,294
  Tax (Schedule X):
    11,079×0.01 + 15,185×0.02 + 15,188×0.04 + 16,090×0.06 + 15,182×0.08 + 41,570×0.093
    = 110.79 + 303.70 + 607.52 + 965.40 + 1,214.56 + 3,866.01 ≈ 7,068
  SDI: 120,000×0.011 = 1,320

Combined income tax: ~24,935
Combined all: ~34,115 + 1,320 = ~35,435
Effective income tax rate: ~20.8%
```

### Case B: Married filing jointly, $300,000 combined W-2, 2 children

```
Federal:
  AGI: 300,000
  Standard deduction: 31,500
  Taxable: 268,500
  Tax: 23,850×0.10 + 73,100×0.12 + 109,750×0.22 + 61,950×0.24
     = 2,385 + 8,772 + 24,145 + 14,868 = 50,170
  CTC: 2×2,200 = 4,400
  Net federal: 45,770
  FICA (per earner, assuming 150K each): 2×(150,000×0.0765) = 22,950

California:
  Standard deduction: 11,412
  Taxable: 288,588
  Tax (Schedule Y):
    22,158×0.01 + 30,370×0.02 + 30,376×0.04 + 32,180×0.06 + 30,364×0.08 + 143,140×0.093
    ≈ 221.58 + 607.40 + 1,215.04 + 1,930.80 + 2,429.12 + 13,312.02 ≈ 19,716
  SDI: 300,000×0.011 = 3,300

Combined income tax: ~65,486
```

---

## 16. Filing Deadlines

```yaml
filing:
  federal:
    deadline: "April 15, 2026"
    extension: "October 15, 2026 (automatic 6-month extension for filing, NOT for payment)"
    form: "Form 1040"
    estimated_payments: "April 15, June 15, Sept 15, Jan 15 of following year"

  california:
    deadline: "April 15, 2026 (follows federal)"
    extension: "October 15, 2026 (automatic 6-month)"
    form: "Form 540 (residents), 540NR (nonresidents/part-year)"
    estimated_payments: "Same as federal schedule"

  penalties:
    failure_to_file: "5% per month, max 25%"
    failure_to_pay: "0.5% per month + interest"
    underpayment: "Penalty varies by quarter and federal rate"
```

---

## 17. Key Differences from Other Countries

```yaml
comparison:
  dual_system:
    us_ca: "Federal + state = TWO separate returns, TWO sets of brackets"
    japan: "National + local resident tax (10% flat)"
    thailand: "Single national tax only"
    sweden: "Municipal + state (computed together in one return)"

  standard_deduction:
    us_federal: "$15,750 (single) — very generous, most taxpayers use this"
    california: "$5,706 (single) — very low, many CA filers must itemize separately"
    japan: "Employment income deduction (sliding scale)"
    thailand: "50% of salary capped at 100,000 THB"
    sweden: "Grundavdrag (income-dependent formula)"

  capital_gains:
    us_federal: "Preferential rates (0/15/20%) for long-term gains"
    california: "NO preference — taxed as ordinary income up to 13.3%"
    japan: "Flat 20.315% (separate taxation)"
    thailand: "Generally added to progressive rates"
    sweden: "Flat 30% (separate capital income category)"

  payroll_taxes:
    us: "FICA 7.65% employee + 7.65% employer + 0.9% additional Medicare"
    california_sdi: "1.1% on all wages (no cap since 2024)"
    japan: "~15% employee share of social insurance"
    sweden: "31.42% employer-only (not deducted from salary)"

  salt_deduction:
    description: >
      US is unique: federal allows deduction for state/local taxes paid (SALT),
      creating interaction between federal and state tax.
      OBBBA raised the cap to $40,000 from $10,000, making itemizing more
      attractive for CA taxpayers who pay high state income tax.
```

---

## 18. Official Sources

| Topic | URL |
|---|---|
| Federal tax brackets (IRS) | https://www.irs.gov/filing/federal-income-tax-rates-and-brackets |
| 2025 standard deduction + OBBBA changes | https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill |
| Rev. Proc. 2024-40 (original 2025 adjustments) | https://www.irs.gov/pub/irs-drop/rp-24-40.pdf |
| Publication 17 (Your Federal Income Tax) | https://www.irs.gov/forms-pubs/about-publication-17 |
| Federal credits & deductions | https://www.irs.gov/credits-and-deductions-for-individuals |
| California tax rate schedules 2025 (FTB PDF) | https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf |
| California tax calculator | https://www.ftb.ca.gov/file/personal/tax-calculator-tables-rates.asp |
| California Form 540 Booklet 2025 | https://www.ftb.ca.gov/forms/2025/2025-540-booklet.html |
| Tax Foundation 2025 summary | https://taxfoundation.org/data/all/federal/2025-tax-brackets/ |
| Bipartisan Policy Center 2025 guide | https://bipartisanpolicy.org/explainer/2025-federal-income-tax-brackets-and-other-2025-tax-rules/ |
