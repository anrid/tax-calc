# Sweden Income Tax (Inkomstskatt) — Implementation Spec

> **Purpose**: Machine-readable reference for implementing a Swedish income tax calculator.
> All rules sourced from Skatteverket (Swedish Tax Agency) skatteverket.se and
> Finansdepartementet/Regeringen.
> Effective for tax year 2025 (inkomstår 2025, deklaration 2026).

---

## 1. Tax Residency

```yaml
residency:
  unlimited_tax_liability:  # obegränsad skattskyldighet
    conditions_any:
      - "Domiciled (bosatt) in Sweden"
      - "Habitual abode (stadigvarande vistelse) in Sweden"
      - "Essential connection (väsentlig anknytning) to Sweden after emigrating"
    scope: "Worldwide income"

  limited_tax_liability:  # begränsad skattskyldighet
    definition: "Not meeting any unlimited criteria"
    scope: "Swedish-sourced income only"
    sink_rate: 0.25  # SINK = Särskild Inkomstskatt för utomlands Bosatta
    note: "SINK rate drops to 22.5% from 2026 and 20% from 2027"

  six_month_rule:
    description: >
      Employment income from a Swedish employer for stays ≤ 183 days in a
      12-month period may be exempt under tax treaties (183-day rule).
```

---

## 2. Three Income Categories (Inkomstslag)

Sweden has only 3 income categories, much simpler than Japan (10) or Thailand (8).

```yaml
income_categories:
  employment:  # inkomst av tjänst
    includes: "Salary, wages, benefits-in-kind, pensions, sick pay, unemployment benefits"
    taxation: "progressive (municipal + state)"
    note: "Employer pays arbetsgivaravgifter (31.42%) ON TOP of salary — not deducted from salary"

  business:  # inkomst av näringsverksamhet
    includes: "Self-employment, sole proprietorship, partnerships"
    taxation: "progressive (like employment) + self-employment contributions (egenavgifter 28.97%)"
    note: "Active business income treated similarly to employment for tax purposes"

  capital:  # inkomst av kapital
    includes: "Interest, dividends, capital gains, rental income from private property"
    taxation: "flat 30%"
    note: "Completely separate from employment/business income — no progressive rates"
```

---

## 3. Key Parameters for 2025

Source: https://www.skatteverket.se/privat/skatter/beloppochprocent/2025

```yaml
parameters_2025:
  prisbasbelopp: 58_800          # Price base amount (PBB) — used in many formulas
  inkomstbasbelopp: 80_600       # Income base amount
  skiktgrans: 625_800            # Threshold for state income tax (after grundavdrag)
  brytpunkt_under_66: 643_100    # Breakpoint: income before grundavdrag where state tax starts
  brytpunkt_over_66: 733_200     # Higher breakpoint for those aged 66+ at year start
  avg_municipal_tax: 0.3241      # Average municipal tax rate (kommunalskatt)
  state_income_tax: 0.20         # Flat 20% on taxable income above skiktgräns
  capital_income_tax: 0.30       # Flat 30% on net capital income
  employer_contributions: 0.3142 # Arbetsgivaravgifter (born 1959+)
  self_employment_contrib: 0.2897 # Egenavgifter (born 1959+)
  general_pension_fee: 0.07      # Allmän pensionsavgift (7% of earned income, max ~604,000)
  public_service_fee_max: 1_184  # Max public service avgift per year
  burial_fee_avg: 0.0025         # ~0.25% begravningsavgift (varies)
```

---

## 4. Grundavdrag (Basic Deduction)

Source: https://www.skatteverket.se/privat/skatter/arbeteochinkomst/askattsedelochskattetabeller/grundavdrag

The grundavdrag is deducted from fastställd förvärvsinkomst (assessed earned income) to
produce beskattningsbar förvärvsinkomst (taxable earned income). It varies by income level
and is linked to prisbasbeloppet (PBB).

### 4.1 Standard grundavdrag (age < 66 at year start)

```yaml
grundavdrag_2025:  # PBB = 58,800 for 2025
  note: >
    Formula-based on fractions of PBB. Skatteverket publishes lookup tables.
    Simplified approximation for calculator:
  ranges:
    - { income_max: 24_800,   deduction: "equal to income (no tax)" }
    - { income_range: "24,801 – ~151,000", deduction: "increases from ~24,800 to ~43,300" }
    - { income_range: "~151,000 – ~426,900", deduction: "decreases from ~43,300 to ~17,300" }
    - { income_above: "~426,900", deduction: 17_300, note: "flat for higher incomes" }
  formula_segments:
    # Based on IL 63 kap. 3 § — fractions of PBB
    - { condition: "FFI ≤ 0.99 PBB",  ga: "0.423 PBB" }
    - { condition: "0.99 PBB < FFI ≤ 2.72 PBB", ga: "0.423 PBB + 0.20 × (FFI - 0.99 PBB)" }
    - { condition: "2.72 PBB < FFI ≤ 3.11 PBB", ga: "0.77 PBB" }
    - { condition: "3.11 PBB < FFI ≤ 7.88 PBB", ga: "0.77 PBB - 0.10 × (FFI - 3.11 PBB)" }
    - { condition: "FFI > 7.88 PBB", ga: "0.293 PBB" }
  note: "FFI = fastställd förvärvsinkomst. Round GA up to nearest 100 SEK."
```

### 4.2 Förhöjt grundavdrag (enhanced deduction, age 66+ at year start)

```yaml
enhanced_grundavdrag:
  eligibility: "Born 1958 or earlier for tax year 2025 (i.e., turned 66 before Jan 1, 2025)"
  note: >
    Substantially higher deduction — replaces jobbskatteavdrag for pensioners.
    Separate lookup table from Skatteverket. Max ~110,000+ SEK.
  table_url: "https://www.skatteverket.se/download/18.262c54c219391f2e96325f8/grundavdragstabell-forhojt-grundavdrag.pdf"
```

---

## 5. Employment Income Tax (Inkomst av Tjänst)

### 5.1 Municipal tax (Kommunalskatt)

```yaml
municipal_tax:
  description: "Flat rate applied to ALL taxable earned income (after grundavdrag)"
  rate: "varies by municipality, 29-35%, average 32.41% in 2025"
  components:
    municipal: "~20-23%"
    regional: "~9-12%"
  note: >
    For a calculator, use a configurable rate with 32.41% as default.
    Everyone pays this — there is no zero-bracket or exemption below the threshold.
    The grundavdrag effectively creates the zero-tax zone.
```

### 5.2 State income tax (Statlig inkomstskatt)

```yaml
state_income_tax:
  rate: 0.20
  threshold: 625_800  # skiktgräns (after grundavdrag)
  note: >
    Only paid on beskattningsbar förvärvsinkomst exceeding 625,800 SEK.
    The "brytpunkt" (breakpoint) = skiktgräns + grundavdrag, so roughly
    643,100 SEK in gross income (for those under 66 with flat grundavdrag).
    Sweden abolished the top bracket (värnskatt, 5% extra) in 2020.
    Now there is only ONE state tax level at 20%.
```

### 5.3 Marginal tax summary

```
Income zone                          | Approximate marginal tax
-------------------------------------|---------------------------
0 – ~25,000 (below grundavdrag)     | 0%
~25,000 – ~643,100 (below brytpunkt)| ~32% (municipal only, reduced by jobbskatteavdrag)
Above ~643,100 (above brytpunkt)     | ~52% (32% municipal + 20% state)
```

---

## 6. Jobbskatteavdrag (Employment Tax Credit)

Source: https://www.skatteverket.se/privat/skatter/arbeteochinkomst/skattereduktioner/jobbskatteavdrag

A tax CREDIT (skattereduktion) that reduces the final tax — only applies to
arbetsinkomst (earned work income), NOT pensions, unemployment benefits, or sick pay.

```yaml
jobbskatteavdrag:
  description: >
    Automatically calculated by Skatteverket. Reduces municipal tax.
    Effect: up to ~3,900 SEK/month reduction for middle-income earners.
    Cannot reduce state tax, only municipal tax.
  phase_in: "Increases with income up to ~40,000 SEK/month, then plateaus"
  phase_out: "Abolished from 2025 — no longer decreases at higher incomes"
  formula:
    note: >
      The exact formula from IL 67 kap 7 § uses PBB, arbetsinkomst (AI),
      grundavdrag (GA), and kommunal skattesats (KI).
      For simplicity, approximate as:
    under_66:
      segment_1: { ai_max: "0.91 PBB",  jsa: "(AI + GA) × KI" }
      segment_2: { ai_max: "3.24 PBB",  jsa: "(0.91 PBB + GA) × KI + 0.3251 × (AI - 0.91 PBB)" }
      segment_3: { ai_max: "10.67 PBB", jsa: "(0.91 PBB + GA) × KI + 0.3251 × (3.24 - 0.91) × PBB + 0.0651 × (AI - 3.24 PBB)" }
      segment_4: { ai_above: "10.67 PBB", jsa: "segment_3 result at 10.67 PBB (plateau)" }
    note_on_ki: "KI = municipal tax rate. Higher municipal tax → higher jobbskatteavdrag"
  max_2025_approx: "~46,000-48,000 SEK/year at average municipal tax"
```

---

## 7. Capital Income Tax (Inkomst av Kapital)

```yaml
capital_income:
  tax_rate: 0.30
  description: "Flat 30% on net capital income (surplus)"
  deficit_rules:
    deficit_up_to_100k:
      credit_rate: 0.30  # 30% of deficit reduces total tax
    deficit_above_100k:
      credit_rate: 0.21  # 21% of deficit above 100,000 reduces total tax
  components:
    interest_income: "fully taxable"
    dividend_income: "fully taxable (already has 30% withholding for listed shares)"
    capital_gains: "gain = sale price - acquisition cost"
    rental_income_private: "taxable after 40,000 SEK deduction + 20% of gross rent"
  special_rates:
    private_residence_sale:
      taxable_portion: "22/30 of gain"
      effective_rate: 0.22  # 30% × 22/30 = 22%
      loss_deductible: 0.50  # 50% of loss is deductible
    commercial_property_sale:
      taxable_portion: 0.90
      loss_deductible: 0.63
  isk:  # Investeringssparkonto
    description: "Tax-advantaged investment account — no tax on gains/dividends"
    schablonintakt: "statslåneränta Nov 30 prev year + 1%, min 1.25%"
    tax: "30% of schablonintäkt × capital base"
    note: "For 2025: first 150,000 SEK on ISK is tax-free"
```

### Interest deduction (Ränteavdrag) — key 2025 change

```yaml
interest_deduction:
  secured_loans:  # lån med säkerhet (mortgages)
    deduction: "full interest amount creates capital deficit → 30%/21% credit"
    note: "No cap on deductible amount. 30% on first 100K deficit, 21% above."
  unsecured_loans:  # lån utan säkerhet (2025 transitional)
    deduction_2025: "50% of interest amount (halved from 2024)"
    deduction_2026: "0% — no deduction for unsecured loans from 2026"
  csn_student_loans: "NOT deductible (CSN-ränta is not a real interest under tax law)"
```

---

## 8. Other Deductions and Credits

### 8.1 Allmänna avdrag (General deductions — from income)

```yaml
general_deductions:
  private_pension_savings:
    max: 588_000  # for 2025 (10 PBB)
    condition: "Only if not covered by employer pension"
    note: "Very few people qualify for max; most employees are covered by employer plans"
  alimony:
    amount: "actual_paid"
    condition: "Court-ordered maintenance to ex-spouse"
  foreign_social_insurance:
    amount: "actual_paid"
    condition: "Mandatory foreign contributions on income taxed in Sweden"
```

### 8.2 Avdrag under tjänst (Employment deductions — from employment income)

```yaml
employment_deductions:
  commuting:
    threshold: 11_000  # only expenses above 11,000 SEK are deductible
    rate_own_car: 25  # SEK per Swedish mile (10 km)
    condition: "Distance > 5 km, time saved > 2 hours vs public transport"
    note: "Threshold increases to 15,000 SEK from 2026"
  home_office:
    standard: "2,000 (house) or 4,000 (apartment) SEK/year if ≥800 hours worked from home"
  work_tools:
    amount: "actual cost of computer/equipment if employer doesn't provide"
  union_fees:
    amount: "NOT deductible (abolished 2019, briefly reinstated, varies)"
  double_housing:
    max_months: 24
    amount: "actual rent for second dwelling, reasonable amount"
```

### 8.3 Skattereduktioner (Tax credits — reduce final tax)

```yaml
tax_credits:
  jobbskatteavdrag:
    see: "Section 6 above"

  general_pension_fee_credit:
    rate: 1.00  # 100% of allmän pensionsavgift paid
    note: "Effectively makes the 7% pension fee cost-neutral for the taxpayer"

  rot_avdrag:  # Renovation tax credit
    rate: 0.30  # 30% of labor cost
    max_per_person: 50_000
    combined_rot_rut_max: 75_000
    applies_to: "Repair, maintenance, extension of owned home"

  rut_avdrag:  # Household services tax credit
    rate: 0.50  # 50% of labor cost
    max_per_person: 75_000
    combined_rot_rut_max: 75_000
    applies_to: "Cleaning, gardening, childcare, laundry, moving help, IT services"

  green_technology_credit:
    rate: 0.50  # 50% of installation cost
    max: 50_000
    applies_to: "Solar panels, battery storage, EV charging"

  public_service_fee:  # replaces old TV license
    max: 1_184  # SEK/year
    rate: 0.01  # 1% of taxable earned income, capped
```

---

## 9. Employer Contributions (Arbetsgivaravgifter)

These are paid BY the employer ON TOP of salary. Not deducted from salary.
Important for total cost-of-employment calculations.

```yaml
employer_contributions:
  born_1959_or_later: 0.3142  # 31.42%
  born_1938_to_1958: 0.1021   # 10.21% (reduced for older workers)
  components:
    pension: 0.1021
    health_insurance: 0.0355
    parental_insurance: 0.0260
    labor_market: 0.0264
    survivor_pension: 0.0060
    work_injury: 0.0020
    general_payroll_tax: 0.1162
  note: "For self-employed (egenavgifter): 28.97% instead of 31.42%"
```

---

## 10. Calculation Flow (Complete)

```
STEP 1: Determine total earned income (förvärvsinkomst)
  earned_income = salary + benefits_in_kind + business_income + pension + ...

STEP 2: Subtract employment-specific deductions
  assessed_income = earned_income - commuting_above_threshold - other_tjänst_deductions

STEP 3: Subtract general deductions (allmänna avdrag)
  fastställd_förvärvsinkomst (FFI) = assessed_income - pension_savings - alimony - ...
  FFI = floor(FFI / 100) * 100  # round down to nearest 100

STEP 4: Calculate grundavdrag
  GA = grundavdrag_formula(FFI)  # see Section 4
  GA = ceil(GA / 100) * 100  # round UP to nearest 100

STEP 5: Calculate taxable earned income
  beskattningsbar_förvärvsinkomst = FFI - GA

STEP 6: Calculate municipal tax
  municipal_tax = beskattningsbar × municipal_rate

STEP 7: Calculate state income tax
  if beskattningsbar > 625_800:
      state_tax = (beskattningsbar - 625_800) * 0.20
  else:
      state_tax = 0

STEP 8: Calculate capital income tax (separate)
  net_capital = capital_income - capital_expenses - interest_expenses
  if net_capital > 0:
      capital_tax = net_capital * 0.30
  else:
      capital_deficit = abs(net_capital)
      capital_credit = min(capital_deficit, 100_000) * 0.30
                     + max(capital_deficit - 100_000, 0) * 0.21

STEP 9: Calculate allmän pensionsavgift
  pension_fee = min(earned_income, ~604_000) * 0.07
  pension_fee_credit = pension_fee  # 100% credit

STEP 10: Calculate jobbskatteavdrag
  jsa = jobbskatteavdrag_formula(arbetsinkomst, GA, municipal_rate)

STEP 11: Apply all tax credits
  total_tax = municipal_tax + state_tax + capital_tax + pension_fee
            - pension_fee_credit
            - jsa (only against municipal_tax)
            - rot_rut_credits
            - capital_deficit_credit
            - public_service_fee
            + burial_fee + church_fee (if member)

STEP 12: Compare with withholding
  tax_due = total_tax - preliminary_tax_paid
```

---

## 11. Pseudocode

```python
import math

def sweden_income_tax(
    salary: float = 0,
    other_earned_income: float = 0,  # pension, sick pay, etc.
    business_income: float = 0,      # active näringsverksamhet
    arbetsinkomst: float = 0,        # work income only (for jobbskatteavdrag)
    capital_income: float = 0,       # interest, dividends, gains
    capital_expenses: float = 0,     # interest paid (secured loans)
    unsecured_interest: float = 0,   # interest on unsecured loans (2025: 50% deductible)
    municipal_rate: float = 0.3241,  # default average
    age_66_plus: bool = False,
    commuting_expenses: float = 0,   # above 11,000 threshold
    pension_savings: float = 0,
    rot_credit: float = 0,
    rut_credit: float = 0,
    preliminary_tax_paid: float = 0,
    pbb: float = 58_800,             # prisbasbelopp 2025
) -> dict:

    # --- STEP 1-3: Earned income ---
    total_earned = salary + other_earned_income + business_income
    commuting_deduction = max(commuting_expenses - 11_000, 0)
    assessed = total_earned - commuting_deduction
    ffi = max(math.floor(assessed / 100) * 100, 0)  # round down to 100

    # --- STEP 4: Grundavdrag ---
    def grundavdrag(ffi, pbb):
        if ffi <= 0.99 * pbb:
            ga = 0.423 * pbb
        elif ffi <= 2.72 * pbb:
            ga = 0.423 * pbb + 0.20 * (ffi - 0.99 * pbb)
        elif ffi <= 3.11 * pbb:
            ga = 0.77 * pbb
        elif ffi <= 7.88 * pbb:
            ga = 0.77 * pbb - 0.10 * (ffi - 3.11 * pbb)
        else:
            ga = 0.293 * pbb
        ga = min(ga, ffi)  # can't exceed income
        return math.ceil(ga / 100) * 100  # round up to 100

    if age_66_plus:
        # Enhanced grundavdrag — use Skatteverket lookup table
        # Simplified: roughly 2-4x the standard for most income levels
        ga = grundavdrag(ffi, pbb) * 2.5  # APPROXIMATION — use table in production
        ga = min(ga, ffi)
        ga = math.ceil(ga / 100) * 100
    else:
        ga = grundavdrag(ffi, pbb)

    # --- STEP 5: Taxable earned income ---
    taxable = max(ffi - ga, 0)

    # --- STEP 6-7: Income tax ---
    municipal_tax = taxable * municipal_rate
    skiktgrans = 625_800
    state_tax = max(taxable - skiktgrans, 0) * 0.20

    # --- STEP 8: Capital income ---
    effective_unsecured = unsecured_interest * 0.50  # 2025 rule
    total_capital_expenses = capital_expenses + effective_unsecured
    net_capital = capital_income - total_capital_expenses

    capital_tax = 0
    capital_credit = 0
    if net_capital > 0:
        capital_tax = net_capital * 0.30
    else:
        deficit = abs(net_capital)
        capital_credit = min(deficit, 100_000) * 0.30 + max(deficit - 100_000, 0) * 0.21

    # --- STEP 9: Pension fee ---
    pension_ceiling = 8.07 * 80_600  # ~604,000 for 2025
    pension_fee = min(total_earned, pension_ceiling) * 0.07
    pension_fee_credit = pension_fee  # 100% credit

    # --- STEP 10: Jobbskatteavdrag (simplified) ---
    ai = arbetsinkomst or salary  # work income
    if not age_66_plus and ai > 0:
        if ai <= 0.91 * pbb:
            jsa = (ai + ga) * municipal_rate
        elif ai <= 3.24 * pbb:
            jsa = (0.91 * pbb + ga) * municipal_rate + 0.3251 * (ai - 0.91 * pbb)
        elif ai <= 10.67 * pbb:
            jsa = ((0.91 * pbb + ga) * municipal_rate
                   + 0.3251 * (3.24 - 0.91) * pbb
                   + 0.0651 * (ai - 3.24 * pbb))
        else:
            jsa = ((0.91 * pbb + ga) * municipal_rate
                   + 0.3251 * (3.24 - 0.91) * pbb
                   + 0.0651 * (10.67 - 3.24) * pbb)
        jsa = min(jsa, municipal_tax)  # can't exceed municipal tax
    else:
        jsa = 0  # pensioners get benefit via förhöjt grundavdrag instead

    # --- STEP 11: Total tax ---
    rot_rut = min(rot_credit + rut_credit, 75_000)
    burial_fee = ffi * 0.0025  # approximate

    total_tax = (
        municipal_tax
        + state_tax
        + capital_tax
        + pension_fee
        + burial_fee
        - pension_fee_credit
        - jsa
        - capital_credit
        - rot_rut
    )
    total_tax = max(total_tax, 0)
    total_tax = round(total_tax)

    # --- STEP 12: Net ---
    tax_payable = total_tax - preliminary_tax_paid

    return {
        "fastställd_förvärvsinkomst": ffi,
        "grundavdrag": ga,
        "taxable_earned_income": taxable,
        "municipal_tax": round(municipal_tax),
        "state_tax": round(state_tax),
        "capital_tax": round(capital_tax),
        "capital_credit": round(capital_credit),
        "pension_fee": round(pension_fee),
        "jobbskatteavdrag": round(jsa),
        "rot_rut_credit": rot_rut,
        "total_tax": total_tax,
        "preliminary_paid": preliminary_tax_paid,
        "tax_payable": round(tax_payable),
        "refund": abs(round(tax_payable)) if tax_payable < 0 else 0,
    }
```

---

## 12. Test Cases

### Case A: Employee earning 500,000 SEK/year, Stockholm (municipal rate 30.40%)

```
FFI: 500,000
Grundavdrag: 0.77 × 58,800 - 0.10 × (500,000 - 3.11 × 58,800)
           = 45,276 - 0.10 × (500,000 - 182,868) = 45,276 - 31,713 = 13,563 → 13,600
Taxable: 500,000 - 13,600 = 486,400

Municipal tax: 486,400 × 0.304 = 147,866
State tax: 0 (486,400 < 625,800)
Pension fee: 500,000 × 0.07 = 35,000
Pension credit: -35,000
Jobbskatteavdrag: ~38,000 (approximate)
Burial fee: ~1,250

Total ≈ 147,866 + 0 + 35,000 - 35,000 - 38,000 + 1,250 ≈ 111,116
Effective rate ≈ 22.2%
```

### Case B: Employee earning 800,000 SEK/year, average municipality (32.41%)

```
FFI: 800,000
Grundavdrag: 0.293 × 58,800 = 17,228 → 17,300 (FFI > 7.88 × PBB)
Taxable: 800,000 - 17,300 = 782,700

Municipal tax: 782,700 × 0.3241 = 253,731
State tax: (782,700 - 625,800) × 0.20 = 31,380
Pension fee: ~604,000 × 0.07 = 42,280 (capped)
Pension credit: -42,280
Jobbskatteavdrag: ~47,000 (plateau)
Burial fee: ~2,000

Total ≈ 253,731 + 31,380 + 42,280 - 42,280 - 47,000 + 2,000 ≈ 240,111
Effective rate ≈ 30.0%
```

---

## 13. Filing

```yaml
filing:
  deadline: "May 2 (2026 for tax year 2025); digital without changes: March 31 for early refund"
  form: "Inkomstdeklaration 1 (individuals)"
  method: "Digital via Skatteverket app/website, or paper"
  pre_filled: true  # employer/bank data is pre-populated
  note: >
    Most employees with only salary income can approve the pre-filled return
    with a single click/SMS — no manual filing needed.
  refund_timing: "April (if filed digitally by March 31) or June-August otherwise"
  penalties:
    late_filing: "625 SEK, doubled to 1,250 after reminder"
    underpayment_interest: "~5% annual (varies with Riksbank rate)"
```

---

## 14. Key Differences from Thai and Japanese Tax

```yaml
comparison:
  structure:
    sweden: "3 income categories"
    japan: "10 income categories"
    thailand: "8 income categories"

  employment_deduction:
    sweden: "No deduction from salary — grundavdrag + jobbskatteavdrag handle it"
    japan: "Sliding-scale employment income deduction (給与所得控除)"
    thailand: "Flat 50% capped at 100,000 THB"

  progressive_brackets:
    sweden: "Only 2 levels: municipal (~32%) and municipal+state (~52%)"
    japan: "7 brackets: 5% to 45%"
    thailand: "8 brackets: 0% to 35%"

  capital_taxation:
    sweden: "Separate flat 30% — never mixed with employment income"
    japan: "Separate 20.315% for listed stocks; comprehensive option for dividends"
    thailand: "Generally added to progressive rates; withholding option for dividends"

  employer_burden:
    sweden: "31.42% arbetsgivaravgifter ON TOP of salary (invisible to employee)"
    japan: "~15% employer share of social insurance"
    thailand: "5% employer social security contribution"

  pre_filling:
    sweden: "Fully pre-filled return — approve with one click"
    japan: "Year-end adjustment by employer (年末調整) for most"
    thailand: "Must file manually (ภ.ง.ด.90/91)"

  foreign_income:
    sweden: "Worldwide income for unlimited taxpayers — always"
    japan: "Worldwide income for residents — always"
    thailand: "Only if remitted to Thailand (from 2024 rule change)"
```

---

## 15. Official Sources

| Topic | URL |
|---|---|
| 2025 rates and amounts (PDF) | https://www.skatteverket.se/download/18.262c54c219391f2e9633f9b/1737037270131/Belopp%20och%20procentsatser%20f%C3%B6r%20inkomst%C3%A5ret%202025.pdf |
| 2025 rates and amounts (web) | https://www.skatteverket.se/privat/skatter/beloppochprocent/2025 |
| Grundavdrag overview | https://www.skatteverket.se/privat/skatter/arbeteochinkomst/askattsedelochskattetabeller/grundavdrag |
| Grundavdrag table 2025 (PDF) | https://www.skatteverket.se/download/18.262c54c219391f2e96325f7/grundavdragstabell-ej-forhojt-grundavdrag.pdf |
| Enhanced grundavdrag 66+ (PDF) | https://www.skatteverket.se/download/18.262c54c219391f2e96325f8/grundavdragstabell-forhojt-grundavdrag.pdf |
| Jobbskatteavdrag | https://www.skatteverket.se/privat/skatter/arbeteochinkomst/skattereduktioner/jobbskatteavdrag |
| Deduction encyclopedia (A-Ö) | https://www.skatteverket.se/privat/skatter/arbeteochinkomst/avdragforprivatpersoner |
| Interest deduction rules (2025) | https://skatteverket.se/privat/skatter/arbeteochinkomst/avdragforprivatpersoner/r |
| Tax calculation technical spec (PDF) | https://www.skatteverket.se/download/18.1522bf3f19aea8075ba55c/teknisk-beskrivning-skv-433-2026-utgava-36.pdf |
| Beräkningskonventioner 2025 (Regeringen PDF) | https://www.regeringen.se/contentassets/0229ac516d4241e5a7b3dbf8e2d6b5a3/berakningskonventioner-2025.pdf |
| Grundavdrag legal basis (Rättslig vägledning) | https://www4.skatteverket.se/rattsligvagledning/edition/2025.1/2928.html |
| Income types and structure (NordiskeTax) | https://nordisketax.net/pages/sv-SE/taxation/?country=sweden&topic=tax-calculation-examples |
