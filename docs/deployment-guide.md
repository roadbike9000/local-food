# Deployment Guide

## Current state: no deployment config is checked into the repo

There is no `Dockerfile`, no `vercel.json`, no IaC (`terraform/`, `k8s/`, etc.). `.vercel` is listed in `.gitignore`, implying the intended target is **Vercel**, but nothing enforces or automates that — deployment is assumed, not configured.

## CI pipeline (`.github/workflows/ci.yml`)

Runs on every push to `main` and every PR. Gate order matters — a failure at any step skips the rest:

```
actions/checkout
  → setup-node (v20, npm cache)
  → npm ci
  → prisma generate
  → npm run typecheck
  → npm run lint
  → playwright install --with-deps chromium
  → npm run test:e2e
  → upload Playwright report (always, even on failure)
```

- Secrets (`DATABASE_URL`, `DIRECT_URL`, Clerk keys, Stripe keys) come from **GitHub Actions repository secrets** — never hardcode a key/URL to make CI pass locally.
- CI does not run `prisma migrate deploy` — it assumes the CI database already has the current schema. A schema change without a corresponding migration applied to whatever DB `DATABASE_URL` points to in CI will make `test:e2e` fail at runtime, not at a dedicated migration step.
- No Twilio/Cloudinary/Sentry secrets are provided to CI — those helpers' graceful-degradation paths (`twilio.ts` logs instead of sending) are what keeps e2e green without them.

## What deploying for real would need (not yet done)

1. A hosting target (Vercel is the implied default) connected to this repo.
2. Production values for every var in `.env.example`, set as platform env vars — not committed anywhere.
3. A migration step (`prisma migrate deploy` against `DIRECT_URL`) run before or during deploy, since CI doesn't do this.
4. Stripe **live** keys + a live-mode webhook endpoint pointed at the deployed `/api/webhooks/stripe` URL (the local `stripe listen` approach only works for dev).
5. Sentry DSN + org/project/auth token if error monitoring should be active (currently optional/blank-safe).
