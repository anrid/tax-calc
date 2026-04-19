# Tax Calculator Living Plan

Last updated: 2026-04-19

## Current State

- Web app is live on SvelteKit + TypeScript with Vercel deployment.
- Jurisdictions implemented: JP, SE, TH, CH, UK, USCA, MY, SG, IN.
- Core features implemented:
  - input/profile controls (salary, period, marital/dependents, age, residency months)
  - display-currency rail + FX override workflow
  - country comparison cards + monthly ranking bars
  - salary sweep chart (USD 50k to 600k) with hover comparison tooltip and legend filtering
- Test and build baseline:
  - `npm run check`
  - `npm run test`
  - `npm run build`

## Active Priorities

1. Tax-model quality hardening
   - continue adding regression tests for high-income and threshold transitions across jurisdictions
   - keep every substantive tax-rule change source-backed in code/docs and PR notes
2. UI clarity and contribution ergonomics
   - continue reducing UI complexity while preserving comparability across countries
   - keep chart readability and responsive behavior as a non-regression requirement
3. Contributor workflow
   - keep AGENTS policy and README deployment/contribution instructions aligned with actual repo behavior
   - prefer small, reviewable PRs with explicit validation output

## Maintenance Rule

- This file is a living status/priority document, not a one-time bootstrap checklist.
- Update it whenever scope, supported jurisdictions, or key UX/data-model direction changes materially.
