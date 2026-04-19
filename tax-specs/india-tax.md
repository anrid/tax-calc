# India Income Tax — Implementation Spec

> **Purpose**: Machine-readable reference for implementing an Indian income tax calculator.
> Sources: Income Tax Department (incometax.gov.in), ClearTax, PwC, Budget 2025.
> Effective for Financial Year (FY) 2025-26 / Assessment Year (AY) 2026-27.
> Two regimes: New (default) and Old (optional). Both covered.
> Currency: INR (₹). Amounts in this document use lakhs (1 lakh = 100,000).

---

## 1. Tax Residency

```yaml
residency:
  resident:
    condition: "Present in India ≥ 182 days in the FY, OR ≥ 60 days in FY + ≥ 365 days in preceding 4 FYs"
    scope: "Worldwide income"
    rnor:  # Resident but Not Ordinarily Resident
      condition: "Has been NRI in 9 of 10 preceding FYs, OR was in India < 730 days in preceding 7 FYs"
      scope: "Indian-sourced income + income from business/profession controlled in India"
  non_resident:
    scope: "Indian-sourced income only"
    note: "Cannot claim most deductions under old regime; same slab rates apply"
  deemed_resident:
    condition: "Indian citizen with total income > ₹15 lakh from Indian sources AND not tax resident in any other country"
    scope: "Worldwide income"
```

---

## 2. Two Regime System

```yaml
regime_choice:
  new_regime:
    default: true  # since FY 2023-24
    description: "Lower slab rates, very limited deductions"
    key_deductions_allowed:
      - "Standard deduction ₹75,000 (salaried/pensioners)"
      - "Employer NPS contribution u/s 80CCD(2) — up to 14% of salary"
      - "Family pension deduction ₹25,000"
    deductions_NOT_allowed:
      - "80C (PPF, ELSS, LIC, etc.)"
      - "80D (health insurance)"
      - "HRA exemption"
      - "Home loan interest u/s 24(b) (self-occupied)"
      - "80CCD(1B) (NPS self)"
      - "Most Chapter VI-A deductions"
  old_regime:
    opt_in: "Must explicitly opt; file Form 10-IEA if business income"
    description: "Higher slab rates but full range of deductions and exemptions"
    note: "Better ONLY if total deductions exceed ~₹3-4 lakh at mid-to-high incomes"
```

---

## 3. New Tax Regime — Brackets (FY 2025-26)

Source: Budget 2025 (Section 115BAC, effective 1 April 2025).

```yaml
new_regime_brackets_fy2025_26:
  - { min: 0,          max: 400_000,     rate: 0.00 }
  - { min: 400_001,    max: 800_000,     rate: 0.05 }
  - { min: 800_001,    max: 1_200_000,   rate: 0.10 }
  - { min: 1_200_001,  max: 1_600_000,   rate: 0.15 }
  - { min: 1_600_001,  max: 2_000_000,   rate: 0.20 }
  - { min: 2_000_001,  max: 2_400_000,   rate: 0.25 }
  - { min: 2_400_001,  max: null,         rate: 0.30 }

  standard_deduction: 75_000  # for salaried employees and pensioners
  section_87a_rebate:
    limit: 1_200_000  # taxable income ≤ ₹12 lakh
    max_rebate: 60_000
    effect: "Income up to ₹12 lakh = zero tax; salaried up to ₹12.75 lakh = zero"
  marginal_relief: >
    If income slightly exceeds ₹12 lakh, tax payable is capped at
    the amount by which income exceeds ₹12 lakh (prevents cliff).
```

---

## 4. Old Tax Regime — Brackets (FY 2025-26)

```yaml
old_regime_brackets_fy2025_26:
  under_60:
    - { min: 0,          max: 250_000,     rate: 0.00 }
    - { min: 250_001,    max: 500_000,     rate: 0.05 }
    - { min: 500_001,    max: 1_000_000,   rate: 0.20 }
    - { min: 1_000_001,  max: null,         rate: 0.30 }
  senior_60_to_80:
    - { min: 0,          max: 300_000,     rate: 0.00 }
    - { min: 300_001,    max: 500_000,     rate: 0.05 }
    - { min: 500_001,    max: 1_000_000,   rate: 0.20 }
    - { min: 1_000_001,  max: null,         rate: 0.30 }
  super_senior_above_80:
    - { min: 0,          max: 500_000,     rate: 0.00 }
    - { min: 500_001,    max: 1_000_000,   rate: 0.20 }
    - { min: 1_000_001,  max: null,         rate: 0.30 }

  standard_deduction: 50_000  # lower than new regime
  section_87a_rebate:
    limit: 500_000   # taxable income ≤ ₹5 lakh
    max_rebate: 12_500
```

---

## 5. Surcharge and Cess

Applied on top of income tax in BOTH regimes.

```yaml
surcharge:
  brackets:
    - { income_range: "≤ ₹50 lakh",       rate: 0.00 }
    - { income_range: "₹50L – ₹1 crore",  rate: 0.10 }
    - { income_range: "₹1Cr – ₹2 crore",  rate: 0.15 }
    - { income_range: "₹2Cr – ₹5 crore",  rate: 0.25 }
    - { income_range: "> ₹5 crore",        rate_old: 0.37, rate_new: 0.25 }
  note: "New regime caps surcharge at 25% even for ₹5Cr+; old regime goes to 37%"
  marginal_relief: "Ensures surcharge doesn't cause net income to drop"

cess:
  health_education: 0.04  # 4% on tax + surcharge
  note: "Applied uniformly regardless of income level or regime"
```

---

## 6. Key Deductions — Old Regime Only

```yaml
old_regime_deductions:
  section_80c:
    max: 150_000
    covers: "EPF, PPF, ELSS, NSC, life insurance, tuition fees, home loan principal, SSY, 5-yr FD"
  section_80ccd_1b:
    max: 50_000
    covers: "Additional NPS self-contribution (over 80C limit)"
  section_80d:
    self_family: 25_000  # 50,000 if senior citizen
    parents: 25_000  # 50,000 if parents are senior citizens
    covers: "Health insurance premiums, preventive health check-up (₹5,000 included)"
  section_24b:
    self_occupied: 200_000  # max interest deduction on home loan
    let_out: "No limit (actual interest)"
  hra:
    formula: "Minimum of: (a) actual HRA received, (b) 50% of salary (metro) or 40% (non-metro), (c) rent paid - 10% of salary"
    note: "One of the most valuable exemptions for salaried employees in metros"
  section_80e: "Unlimited — interest on education loan (8 years from repayment start)"
  section_80g: "50% or 100% of donations to specified funds/charities"
  section_80tta: { max: 10_000, covers: "Savings account interest" }
  section_80ttb: { max: 50_000, covers: "Interest for senior citizens (replaces 80TTA)" }
```

---

## 7. Capital Gains

```yaml
capital_gains_fy2025_26:
  equity_shares_equity_mf:  # listed
    stcg: { rate: 0.20, holding: "≤ 12 months" }   # increased from 15% in Budget 2024
    ltcg:
      rate: 0.125  # 12.5% (reduced from 20% with indexation, Budget 2024)
      exemption: 125_000  # ₹1.25 lakh per year tax-free
      holding: "> 12 months"
      note: "No indexation benefit from Budget 2024 onwards"
  debt_mf_gold_other:
    stcg: "Taxed at slab rates"
    ltcg:
      rate: 0.125  # 12.5% without indexation (Budget 2024 change)
      holding: "> 24 months (36 months for debt before Budget 2024)"
  real_estate:
    stcg: "Slab rates"
    ltcg: { rate: 0.125, holding: "> 24 months", note: "No indexation from Budget 2024" }
  section_54_54f: "Exemptions available if LTCG reinvested in residential property"
```

---

## 8. Social Security / Statutory Contributions

```yaml
employee_provident_fund:
  employee_rate: 0.12  # 12% of basic + DA
  employer_rate: 0.12  # 12% (split: 8.33% EPS + 3.67% EPF)
  wage_ceiling: 15_000  # statutory; many companies contribute on full basic
  tax_deductible: "Part of 80C limit (₹1.5 lakh)"

professional_tax:
  max: 2_500  # per year (varies by state; many states charge ₹200/month)
  note: "Deductible from salary income"

esi:  # Employee State Insurance
  employee: 0.0075  # 0.75%
  employer: 0.0325  # 3.25%
  wage_ceiling: 21_000  # per month; only for employees earning ≤ ₹21,000/month
```

---

## 9. Calculation Flow

```
STEP 1: Gross Total Income = sum of 5 heads
  Salary + House Property + Business/Profession + Capital Gains + Other Sources

STEP 2 (Old Regime): Subtract exemptions
  - HRA exemption from salary
  - LTA, standard deduction ₹50,000

STEP 3 (Old Regime): Subtract Chapter VI-A deductions
  - 80C, 80D, 80CCD, 80E, 80G, etc.

STEP 2 (New Regime): Only standard deduction ₹75,000 + employer NPS 80CCD(2)

STEP 4: Taxable Income = Gross Total Income - Deductions
  (Capital gains taxed separately at special rates)

STEP 5: Apply slab rates (old or new regime)

STEP 6: Add tax on capital gains at special rates

STEP 7: Apply Section 87A rebate

STEP 8: Add surcharge (if applicable)

STEP 9: Add 4% health & education cess

STEP 10: Subtract TDS + advance tax paid
  Balance = tax due or refund
```

---

## 10. Pseudocode

```python
def india_income_tax(
    salary_income: float = 0,
    house_property_income: float = 0,
    business_income: float = 0,
    stcg_equity: float = 0,
    ltcg_equity: float = 0,
    other_income: float = 0,
    regime: str = "new",  # "new" or "old"
    age: int = 35,
    # Old regime deductions
    section_80c: float = 0,
    section_80d: float = 0,
    section_80ccd_1b: float = 0,
    hra_exemption: float = 0,
    home_loan_interest: float = 0,
    tds_paid: float = 0,
) -> dict:

    # --- Standard deduction ---
    if regime == "new":
        std_ded = 75_000
    else:
        std_ded = 50_000

    salary_taxable = max(salary_income - std_ded - (hra_exemption if regime == "old" else 0), 0)
    hp_taxable = house_property_income - (min(home_loan_interest, 200_000) if regime == "old" else 0)

    gross_total = salary_taxable + hp_taxable + business_income + other_income
    # Capital gains taxed separately

    # --- Deductions ---
    if regime == "old":
        deductions = (
            min(section_80c, 150_000)
            + min(section_80d, 25_000)
            + min(section_80ccd_1b, 50_000)
        )
    else:
        deductions = 0  # employer NPS handled separately if applicable

    taxable = max(gross_total - deductions, 0)

    # --- Slab tax ---
    def calc_slab(income, brackets):
        tax = 0
        prev = 0
        for upper, rate in brackets:
            if income <= prev: break
            tax += (min(income, upper) - prev) * rate
            prev = upper
        return tax

    if regime == "new":
        brackets = [
            (400_000, 0), (800_000, 0.05), (1_200_000, 0.10),
            (1_600_000, 0.15), (2_000_000, 0.20), (2_400_000, 0.25),
            (float("inf"), 0.30)
        ]
        rebate_limit, max_rebate = 1_200_000, 60_000
    else:
        if age < 60:
            brackets = [(250_000, 0), (500_000, 0.05), (1_000_000, 0.20), (float("inf"), 0.30)]
        elif age < 80:
            brackets = [(300_000, 0), (500_000, 0.05), (1_000_000, 0.20), (float("inf"), 0.30)]
        else:
            brackets = [(500_000, 0), (1_000_000, 0.20), (float("inf"), 0.30)]
        rebate_limit, max_rebate = 500_000, 12_500

    slab_tax = calc_slab(taxable, brackets)

    # Capital gains tax (separate)
    stcg_tax = stcg_equity * 0.20
    ltcg_tax = max(ltcg_equity - 125_000, 0) * 0.125

    total_basic_tax = slab_tax + stcg_tax + ltcg_tax

    # --- 87A rebate (on slab tax only, NOT capital gains) ---
    if taxable <= rebate_limit:
        slab_tax = max(slab_tax - max_rebate, 0)
        total_basic_tax = slab_tax + stcg_tax + ltcg_tax

    # --- Surcharge ---
    total_income = taxable + stcg_equity + ltcg_equity
    if total_income > 50_00_000:
        if total_income <= 1_00_00_000: surcharge_rate = 0.10
        elif total_income <= 2_00_00_000: surcharge_rate = 0.15
        else: surcharge_rate = 0.25 if regime == "new" else 0.25
        surcharge = total_basic_tax * surcharge_rate
    else:
        surcharge = 0

    # --- Cess ---
    cess = (total_basic_tax + surcharge) * 0.04

    total_tax = round(total_basic_tax + surcharge + cess)
    balance = total_tax - tds_paid

    return {
        "regime": regime,
        "taxable_income": round(taxable),
        "slab_tax": round(slab_tax),
        "capital_gains_tax": round(stcg_tax + ltcg_tax),
        "surcharge": round(surcharge),
        "cess": round(cess),
        "total_tax": total_tax,
        "tds_paid": round(tds_paid),
        "balance_due_refund": round(balance),
        "effective_rate": round(total_tax / max(total_income, 1) * 100, 1),
    }
```

---

## 11. Test Cases

### Case A: Salaried ₹15 lakh, New Regime

```
Salary: 15,00,000
Standard deduction: 75,000
Taxable: 14,25,000

Tax (new regime):
  0-4L: 0
  4-8L: 20,000
  8-12L: 40,000
  12-14.25L: 2,25,000 × 15% = 33,750
  Total: 93,750
No 87A rebate (taxable > 12L)
Cess: 93,750 × 4% = 3,750
Total: 97,500
Effective: 6.5%
```

### Case B: Salaried ₹12.75 lakh, New Regime (zero tax)

```
Salary: 12,75,000
Standard deduction: 75,000
Taxable: 12,00,000
Tax before rebate: 60,000
87A rebate: -60,000
Tax: 0
```

---

## 12. Filing

```yaml
filing:
  financial_year: "1 April 2025 – 31 March 2026"
  assessment_year: "2026-27"
  forms:
    itr_1_sahaj: "Salary + one house property + other sources; income ≤ ₹50 lakh"
    itr_2: "No business income; includes capital gains and multiple properties"
    itr_3: "Business/profession income"
  deadline:
    individuals: "31 July 2026"
    audit_cases: "31 October 2026"
    belated: "31 December 2026 (with penalty)"
  portal: "https://www.incometax.gov.in"
  tds: "Tax Deducted at Source — employer deducts monthly, adjusts at year-end"
  advance_tax: "Required if tax liability > ₹10,000 (15% by June, 45% by Sep, 75% by Dec, 100% by Mar)"
  penalties:
    late_filing: "₹5,000 (₹1,000 if income ≤ ₹5 lakh)"
    interest: "1% per month under sections 234A/B/C"
```

---

## 13. Key Differences

```yaml
comparison:
  dual_regime:
    india: "Unique — taxpayer chooses between new (simple, lower rates) and old (complex, deductions)"
    others: "No other country in this series offers this choice"

  rebate_cliff:
    india: "₹12L income = zero tax; ₹12.01L = tax kicks in (with marginal relief)"
    note: "The 87A rebate creates a sharp transition — must implement marginal relief"

  cess:
    india: "4% health + education cess on ALL tax — unique extra layer"
    others: "Japan has 2.1% reconstruction surtax (similar concept)"

  capital_gains:
    india: "Complex — different rates for equity STCG (20%), LTCG (12.5%), debt (slab), property"
    note: "Budget 2024 simplified by removing indexation and unifying LTCG at 12.5%"

  surcharge:
    india: "Up to 37% surcharge on tax (old regime) = effective 42.7% top rate"
    note: "New regime caps at 25% surcharge = ~39% effective top rate"
```

---

## 14. Official Sources

| Topic | URL |
|---|---|
| Income Tax Portal | https://www.incometax.gov.in |
| Tax slabs (ClearTax) | https://cleartax.in/s/income-tax-slabs |
| Budget 2025 highlights | https://www.indiabudget.gov.in |
| Section 115BAC (new regime) | https://incometaxindia.gov.in/Pages/Acts/income-tax-act.aspx |
| PwC India tax summary | https://taxsummaries.pwc.com/india/individual/taxes-on-personal-income |
| ITR filing guide | https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable |
