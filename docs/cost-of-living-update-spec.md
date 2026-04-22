# Cost-of-Living Data — Quarterly Update Spec

**File:** `src/lib/data/costOfLiving.json`  
**Cadence:** Once per quarter (Jan, Apr, Jul, Oct)  
**Who runs this:** Ask Claude Code to execute this spec, or update manually.

---

## What the file contains

Monthly cost-of-living estimates in local currency, per country, per city, per household type:

| Field | Description |
|-------|-------------|
| `rent` | Unfurnished apartment (1BR single, 2BR couple, 3BR family) in a nice inner-city neighbourhood |
| `utilities` | Electricity + water + heating/cooling + internet combined. CH exception: heating/water in Nebenkosten, so figure = electricity + internet only |
| `groceries` | Supermarket spend only — no restaurants or takeaway |
| `consumables` | Cleaning supplies, toiletries, paper goods, laundry/dishwasher products |

Household types:
- `single` — 1 adult, no children
- `couple` — 2 adults (married), no children
- `family` — 2 adults + 1–2 children (or 1 adult + 1+ children)

---

## Countries, cities, and target neighbourhoods

| Country | City ID | Display Name | Target neighbourhoods |
|---------|---------|--------------|----------------------|
| CH | `zurich` | Zurich | Seefeld, Enge, Kreis 6 |
| CH | `geneva` | Geneva | Champel, Eaux-Vives, Plainpalais |
| UK | `london` | London | Islington, Clapham |
| UK | `edinburgh` | Edinburgh | Marchmont, Bruntsfield, New Town |
| SG | `central` | Central | Tanjong Pagar, Orchard, Marina Bay |
| SG | `east_holland` | East Coast / Holland V. | Holland Village, East Coast, Katong |
| JP | `tokyo` | Tokyo | Shibuya, Nakameguro, Daikanyama |
| JP | `osaka` | Osaka | Namba, Shinsaibashi, Umeda |
| SE | `stockholm` | Stockholm | Södermalm, Östermalm |
| SE | `gothenburg` | Gothenburg | Linnéstaden, Vasastan |
| TH | `bangkok` | Bangkok | Sukhumvit, Thonglor, Ekkamai |
| TH | `chiangmai` | Chiang Mai | Nimman, Santitham |
| USCA | `san_francisco` | San Francisco | Mission, Noe Valley, Castro |
| USCA | `los_angeles` | Los Angeles | Silver Lake, Los Feliz, Echo Park |
| MY | `kuala_lumpur` | Kuala Lumpur | Bangsar, Mont Kiara |
| MY | `penang` | Penang | George Town, Gurney |
| IN | `mumbai` | Mumbai | Bandra West, Powai |
| IN | `bangalore` | Bangalore | Koramangala, Indiranagar |

---

## Update instructions

### Step 1 — Research each city

For each city use the sources below. Look up the city by name; find the monthly costs section.

**Primary sources (in order of preference):**
1. [Numbeo](https://www.numbeo.com/cost-of-living/) — search by city, use "Cost of Living" tab. Key fields: *Apartment (1 bedroom) in City Centre*, *Apartment (3 bedrooms) in City Centre*, *Basic (Electricity, Heating, Cooling, Water, Garbage) for 85m² Apartment*, *Internet (60 Mbps or More)*, *Basic Lunchtime Menu* (ignore), *Monthly Pass (Regular Price)* (ignore)
2. [Investropa city reports](https://investropa.com/blogs/news) — search `investropa [city] rents [year]`
3. Local property portals for rent cross-checks:
   - JP: Suumo, Homes.co.jp
   - SE: Hemnet, Blocket
   - TH: DDProperty, FazWaz
   - US: Zillow, Apartments.com
   - MY: PropertyGuru, iProperty
   - IN: MagicBricks, 99acres

**For 2BR apartments:** Numbeo only shows 1BR and 3BR directly. Either use Investropa's reports (which often quote 2BR averages), or interpolate as `(1BR × 1.35 + 3BR × 0.65) / 2`, rounded to nearest 50.

### Step 2 — Record values

Fill each `costs` object with monthly amounts in the country's local currency (listed in `currency` field). Round to nearest:
- JPY/INR/THB/SEK/MYR: nearest 500
- USD/GBP: nearest 25
- CHF/SGD/AED: nearest 50
- EUR: nearest 25

### Step 3 — Sanity checks

Run these checks before saving. Flag any that fail and investigate before overriding.

| Check | Rule |
|-------|------|
| Rent dominates | `rent` should be ≥ 50% of total for all household types |
| Utilities < rent | `utilities` should be less than `rent` in every city (exception: Tallinn-style high-heating cities can get close) |
| Couple > single | Every field for `couple` should be ≥ single |
| Family > couple | Every field for `family` should be ≥ couple |
| Groceries scale | `couple.groceries` ≈ 1.5–1.7× `single.groceries`; `family.groceries` ≈ 2.2–2.6× single |
| Consumables scale | `couple.consumables` ≈ 1.5–1.7× single; `family.consumables` ≈ 2.2–2.6× single |
| Year-on-year change | No single field should change more than 25% from the previous quarter without a comment explaining why |

**Country-specific notes:**
- **CH:** Utilities look low vs. other countries — correct, because heating/water is bundled in rent (Nebenkosten). Electricity + internet only ≈ CHF 250–310.
- **SG:** Utilities are genuinely low (tropical, no heating). SGD 120–200 is correct.
- **JP:** Utilities are seasonal (cold winters, hot summers). Use annual average. Tokyo 1BR utilities ≈ ¥12,000–16,000/month average.
- **TH:** Bangkok utilities include AC costs — figure will be higher than you expect vs. rent (THB 2,000–4,000 for a nice condo).
- **IN:** Electricity is cheap; utilities total ≈ INR 3,000–6,000 for a single in Mumbai/Bangalore.

### Step 4 — Bump the version

At the top of `costOfLiving.json`, update:
```json
"version": "YYYY-QN",
"updatedAt": "YYYY-MM-DD"
```

Where `QN` is Q1/Q2/Q3/Q4 matching the quarter being updated (e.g. July update → Q3).

---

## Schema reference

```jsonc
{
  "version": "2026-Q2",          // Quarter label shown in the UI
  "updatedAt": "2026-04-22",     // ISO date of last update
  "notes": { ... },              // Human-readable notes, not used by code
  "countries": {
    "CH": {
      "currency": "CHF",         // Must match the Currency type in types.ts
      "cities": [
        {
          "id": "zurich",        // Stable slug, never change after first deploy
          "name": "Zurich",      // Display name shown in city pills
          "neighbourhoods": ["Seefeld", "Enge"],  // Shown as subtitle on card
          "costs": {
            "single": { "rent": 2600, "utilities": 260, "groceries": 520, "consumables": 80 },
            "couple": { "rent": 3600, "utilities": 280, "groceries": 850, "consumables": 130 },
            "family": { "rent": 5000, "utilities": 310, "groceries": 1350, "consumables": 190 }
          }
        }
      ]
    }
  }
}
```

**Important:** Never change a city's `id` after first deploy — it is used for localStorage state persistence (selected city per card).

---

## Verification after update

1. Run `npm run dev` and open the app with a salary entered
2. Check each country card — the CoL section should reflect updated numbers
3. Toggle household type (married / dependants) and verify the displayed costs change correctly
4. Check that "After essentials" = take-home monthly − (rent + utilities + groceries + consumables)
5. Run `npm test` to confirm no regressions
