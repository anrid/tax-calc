# Contributing

Thanks for contributing to `tax-calc`.

## Setup

```bash
npm install
npm run check
npm run test
npm run build
```

## Development Rules

- Keep changes focused and scoped.
- Preserve tax-spec structure and validity in `tax-specs/`.
- Do not change tax assumptions silently.

## Tax Rule Changes (Mandatory)

For any change to rates, thresholds, residency rules, deductions, legal classifications, or effective-year behavior, include in your PR:

1. Official source URL (primary authority preferred)
2. Effective tax year/date
3. Jurisdiction
4. What changed in code and/or specs

If authoritative sources conflict, call it out explicitly in the PR and do not guess.

## Pull Request Checklist

- [ ] `npm run check` passes
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] Tax-rule changes include official source metadata
- [ ] Assumptions and limitations are documented

## Branch and PR Flow

1. Fork the repository
2. Create a branch from `main`
3. Open a PR with clear scope and validation details
