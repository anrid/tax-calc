# Tax Calculator Web App (SvelteKit)

Employment-focused take-home comparison app across:
- Japan (`JP`)
- Sweden (`SE`)
- Thailand (`TH`)
- Switzerland (`CH`)
- United Kingdom (`UK`)
- USA (California) (`USCA`)
- Malaysia (`MY`)
- Singapore (`SG`)
- India (`IN`)

Tax specification files live in `tax-specs/`.

## Local Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run check
npm run test
npm run build
```

## Scope (v1)

- Frontend-only TypeScript tax logic
- Employment-income focused model
- Inputs: annual/monthly salary, marital profile, dependents, age, residency months
- Currency support and conversion:
  `JPY`, `SEK`, `THB`, `CHF`, `GBP`, `USD`, `MYR`, `SGD`, `INR`
- Manual FX override supported for scenario testing

## Deployment (Vercel)

### Primary: GitHub Auto-Deploy

1. Push this repo to GitHub (`main` branch).
2. In Vercel, click **Add New Project** and import the GitHub repo.
3. Keep defaults for SvelteKit (`@sveltejs/adapter-vercel` is already configured).
4. Set `main` as the production branch.
5. Deploy.

Behavior after setup:
- Pull requests: preview deployments
- Merge to `main`: production deployment

### Fallback: Vercel CLI

```bash
npm install
npx vercel
npx vercel --prod
```

## Publish to GitHub

If you are starting from a local folder without git history:

```bash
git init
git branch -M main
git add -A
git commit -m "Initial public release"
gh auth login
gh repo create tax-calc --public --source=. --remote=origin --push
```

## Environment Variables

No environment variables are required for the current frontend-only setup.

If you add any later:
1. add placeholders to `.env.example`
2. configure real values in Vercel project settings
3. never commit real secrets

## Tax Baselines

- Japan: 2025 baseline
- Sweden: 2025 baseline
- Thailand: 2567/2024 baseline
- Switzerland: 2025 baseline
- UK: 2025/26 baseline
- USA (California): 2025 baseline
- Malaysia: YA 2025 baseline
- Singapore: YA 2026 baseline
- India: FY 2025-26 (new regime) baseline

This tool provides estimates and is not tax filing advice.
