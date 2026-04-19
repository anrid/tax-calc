# SvelteKit Tax Calculator Implementation Plan

## Summary
- Build a standalone SvelteKit + TypeScript webapp deployable on Vercel.
- Implement all tax logic in frontend TypeScript modules.
- Compare take-home pay for Japan, Sweden, and Thailand.
- Use simple inputs (salary, marital/dependents, age, residency months) and manual FX conversion for JPY/SEK/THB.

## Scope Decisions
- Employment-income focused for v1.
- Tax-year baseline: Japan 2025, Sweden 2025, Thailand per provided 2567/2024 spec.
- Take-home defined as gross minus income tax minus modeled employee contributions.
- Residency handled by simplified status classification from months in-country.

## Build Steps
1. Scaffold SvelteKit TypeScript app with Vercel adapter.
2. Add shared domain types and FX utilities.
3. Implement country tax engines (JP/SE/TH) with explicit assumptions and source metadata.
4. Implement cross-country comparison pipeline and currency conversion.
5. Build a simple single-page UI with input controls and comparison cards.
6. Add tests for country engines and comparison behavior.
7. Validate project scripts (`check`, `test`, `build`) and prepare for Vercel deploy.

## Validation Criteria
- User can input monthly or annual salary.
- User can set marital status, spouse income status, dependents, age, and residency months per country.
- App returns annual and monthly take-home for all three countries.
- App supports display/input conversion among JPY, SEK, and THB.
