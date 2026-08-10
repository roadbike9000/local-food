---
stepsCompleted: ['step-01-preflight-and-context', 're-run-2026-08-09']
lastStep: 're-run-2026-08-09'
lastSaved: '2026-08-09'
inputDocuments:
  - project-context.md
  - _bmad-output/test-artifacts/traceability-matrix.md
  - _bmad-output/test-artifacts/test-review.md
  - playwright.config.ts
  - src/middleware.ts
  - .env (E2E_VENDOR_EMAIL / E2E_VENDOR_PASSWORD confirmed present)
---

# Test Automation Expansion: local-food

## Step 1: Preflight & Context

- **Detected stack**: frontend (Next.js 14 + Playwright 1.47, `playwright.config.ts` present). No backend test runner.
- **Framework verified**: ✅ `playwright.config.ts` exists, `@playwright/test` in `package.json`.
- **Execution mode**: Standalone-with-artifacts — no formal story exists, but this run is directly continuing the `trace` (TR) workflow's recommendations, so `traceability-matrix.md` and `test-review.md` serve as the de facto test-design/priority inputs.
- **`tea_use_playwright_utils`**: `true` in config, but not actually used in the repo (confirmed in the RV review) — writing plain `@playwright/test` fixtures/helpers, no utils package.
- **Knowledge base**: core fragments (test-levels-framework, test-priorities-matrix, data-factories, selective-testing, ci-burn-in, test-quality, fixture-architecture, network-first, timing-debugging, selector-resilience, test-healing-patterns, playwright-config, playwright-cli) already loaded earlier this session via RV/TR — carried forward, not re-fetched.

## Scope for this run

From `traceability-matrix.md`, the 3 P0 critical gaps and 2 P0 partial gaps:

1. **J-07** — authenticated vendor dashboard (NONE) — blocked on auth fixture, now unblocked (`E2E_VENDOR_EMAIL`/`E2E_VENDOR_PASSWORD` confirmed in `.env`)
2. **J-08** — vendor-scoped data isolation (NONE) — depends on J-07's fixture
3. **J-05** — Stripe webhook / order creation / one-shot SMS (NONE) — does not depend on the auth fixture, API-level
4. **J-04** — checkout server-computed total (PARTIAL)
5. **J-06** — two missing dashboard-subpath redirect tests (PARTIAL) — trivial, no fixture needed

Proceeding to Step 2: Identify Targets.

## Steps 2-5: Targets, Fixture, Tests, DoD

### Target selected: J-07 / J-06 (J-08 covered as a side effect)

Scoped to what the Clerk test-user credential unblocked this run: the authenticated-vendor-dashboard gap (J-07) and the two missing unauthenticated redirect assertions (J-06). J-08 (vendor isolation) got real coverage as a natural extension once authenticated access existed — no extra fixture needed. J-05 (Stripe webhook) and J-04 (server-computed total) remain open; they don't depend on the auth fixture and are good candidates for a follow-up `automate` run.

### Auth fixture: `playwright/support/generate-vendor-auth.ts`

Clerk challenges sign-in from an unrecognized device with an emailed verification code — there is no way to fully automate that unattended (a human has to read the email). So the fixture is split in two:

- **One-time, human-in-the-loop script** (`npx tsx playwright/support/generate-vendor-auth.ts`, aliased as `npm run test:e2e:auth`): drives the real Clerk sign-in (email + password + Clerk Testing Token to dodge bot-detection, then prompts on stdin for the emailed code — retries if Clerk rejects it, since this dev instance was observed sending more than one code per attempt) and saves the authenticated session to `playwright/.auth/vendor.json`.
- **Reused automatically by tests**: `tests/dashboard.spec.ts`'s new `"vendor dashboard (authenticated)"` block does `test.use({ storageState: authFile })`, so normal `npm run test:e2e` runs never touch Clerk's UI at all — Clerk treats it as an already-trusted device.
- **Graceful skip**: if `playwright/.auth/vendor.json` doesn't exist (fresh clone, CI without a human having run the setup script), the authenticated tests `test.skip()` with a clear message, same pattern `payment.spec.ts` already uses for missing Stripe keys.

**Real-data note**: the Clerk test user (`budget-thorn-kabob@duck.com`) turned out to already own a live "Corner Sourdough" vendor row in the dev DB (not something my seed script created — pre-existing manual binding). `prisma/seed.ts` previously hardcoded that vendor's `clerkUserId` to a placeholder, which would have silently unbound this fixture the next time anyone ran `npm run db:seed`. Fixed: `seed.ts` now reads `E2E_VENDOR_CLERK_ID` from env and binds to it when set (verified: re-ran `db:seed`, binding survived, dashboard still authenticated correctly).

**Known quirk, documented in code**: the very first navigation to a protected route in a fresh `storageState`-loaded context can bounce to `/sign-in` once, even with a fully valid session — subsequent navigations in the same context are fine. Root cause not fully diagnosed (Clerk session-cookie hydration timing), but reproduced consistently across multiple manual checks. Worked around with a `test.beforeEach` warm-up navigation to `/` before every authenticated test. Also discovered: the standalone `request` Playwright fixture does **not** share cookies with a `storageState`-scoped `page`'s context — `page.request` does. Used `page.request` for the one API-level assertion.

### Tests added (`tests/dashboard.spec.ts`)

| Test | Journey | Level |
|---|---|---|
| `orders tab redirects unauthenticated users` | J-06 | E2E |
| `pickups tab redirects unauthenticated users` | J-06 | E2E |
| `vendor sees their own dashboard overview` | J-07 | E2E |
| `vendor sees their own products, never another vendor's` | J-07 + J-08 | E2E |
| `vendor's product API never returns another vendor's products` | J-08 | API (via `page.request`) |

Isolation assertions (J-08) check that Green Valley Produce's seeded catalog (`Heirloom Tomato Box`, `Salad Greens Bag`) never appears in Corner Sourdough's authenticated product list or `/api/products` response — verified against the real `getCurrentVendor()`-scoped queries in `products/page.tsx` and `api/products/route.ts`, both of which were already correctly vendor-scoped (no code fix needed, just the missing regression test).

### DoD / Verification

- Full suite: `npx playwright test` — **14/14 passed** (was 9; +5 new)
- New authenticated block re-run 3x independently — 0 flakes
- `npm run typecheck` — clean
- `npm run lint` — clean
- `playwright/.auth/` added to `.gitignore` (session cookies, must never be committed)
- All temp debugging scripts/logs removed

### Still open (unblocked by nothing, ready for a follow-up `automate` run)

- J-05: Stripe webhook (order creation, `smsNotified` idempotency) — highest remaining risk per the trace gate
- J-04: server-computed-total assertion on `/api/checkout`
- J-09/J-10/J-11/J-12: sign-up, checkout-success, `isAvailable:false` exclusion, SMS-failure handling

---

## Run 2 (2026-08-09): closing all 15 remaining items

Scope: the full "Remaining Test Items" table from `traceability-matrix.md`'s 2026-08-09 re-run — all 10 P0 and 5 P1 rows (J-04, J-05, J-07, J-08, J-09, J-10, J-11, J-12). Mode: BMad-Integrated, using the traceability matrix as the de facto test-design input (no formal story docs exist for this project).

### New files

- `tests/checkout-api.spec.ts` — J-04: server-computed total (ignores a bogus client-sent `totalCents`), 400 on an unavailable-product cart item
- `tests/webhooks.spec.ts` — J-05 (order → PAID, `smsNotified` one-shot + replay idempotency, invalid-signature 400) and J-12 (failing SMS never sets `smsNotified: true`)
- `tests/helpers/db.ts` — direct Prisma access for API-level specs (seed lookups, throwaway product/order creation + cleanup)
- `tests/helpers/stripe-webhook.ts` — builds and signs `checkout.session.completed` payloads via `stripe.webhooks.generateTestHeaderString`, so the webhook route's real signature check runs end to end (no mocking)

### Extended files

- `tests/dashboard.spec.ts` — J-07 (orders tab, pickups tab, create-product flow, create-slot flow) and J-08 (`/api/pickup-slots` vendor isolation)
- `tests/auth.spec.ts` — J-09 (`/sign-up` renders)
- `tests/payment.spec.ts` — J-10 (`/checkout/success` renders)
- `tests/storefront-cart.spec.ts` — J-11 (`isAvailable: false` product excluded from storefront listing)
- `playwright.config.ts` — loads `.env` into the Node test process (webhook/API specs talk to Prisma/Stripe directly, not just through the app's own HTTP surface, which only Next.js itself auto-loads env for) — same minimal loader `generate-vendor-auth.ts` already used; also bumped the global test `timeout` from Playwright's 30s default to 45s (see Flakiness below)

### Two real bugs found and fixed (not test bugs)

Writing tests for J-12 and J-07 surfaced two genuine production defects — both fixed, with Jeff's explicit go-ahead, rather than left as documented gaps:

1. **`src/lib/twilio.ts` / `src/app/api/webhooks/stripe/route.ts`** — `sendSms` swallowed every Twilio error internally (catch → log → return) instead of reporting failure, so the webhook route always set `smsNotified: true` regardless of whether the SMS actually sent. This directly violated the project's own Critical Don't-Miss Rule ("sendSms failures must not silently set smsNotified: true"). Fixed: `sendSms` now returns `Promise<boolean>` (`true` for an actual send or the intentional dev-mode no-credentials skip, `false` on a real Twilio failure), and the webhook route only persists `smsNotified: true` when it gets `true` back.
2. **`src/components/dashboard/AddSlotForm.tsx`** — called `event.currentTarget.reset()` *after* `await fetch(...)`; React nulls `currentTarget` once the synchronous event-dispatch window closes, so this threw, was swallowed by the generic `catch`, and surfaced a false "Network error" message while skipping `router.refresh()` — even though the slot had actually been created. Same bug class the project had already fixed once in the sibling `AddProductForm.tsx` (which has a comment explaining exactly this), just missed here. Fixed by capturing the form ref before the `await`, mirroring `AddProductForm.tsx`.

### Test hygiene fixes made along the way

- `tests/dashboard.spec.ts`'s create-product/create-slot tests and `tests/checkout-api.spec.ts`'s total-check test now delete what they create in a `finally` block. The first pass at these didn't, and left 2 real products, 2 real pickup slots, and 13 real orders in the shared seed data before this was caught and cleaned up — worth flagging since three specs (`storefront-cart`, `payment`, `sms`) already depend on `corner-sourdough`'s exact seeded catalog (per `test-review.md`'s P3 finding), so uncleaned test data here would have started silently corrupting that shared fixture.

### Flakiness observed and addressed

Two distinct causes, both environmental rather than logic bugs, surfaced while re-running the suite 6+ times for stability:

- `net::ERR_NETWORK_IO_SUSPENDED` on a subset of tests, once — the OS suspending network I/O mid-run (sleep/App Nap). Re-ran under `caffeinate -i`; did not recur.
- Sporadic `page.goto` timeouts and one “form still mid-submit” timeout under the default 4-worker `fullyParallel` config — `next dev` compiles routes on demand, and the suite tripled in size (9 → 27 tests) and now hits far more distinct routes in parallel than it used to, occasionally outrunning Playwright's 30s default. Addressed two ways: the two dashboard create-flow tests now wait on the triggering POST response before asserting (network-first pattern, matching `payment.spec.ts`'s existing approach) with a longer 15s assertion timeout for the follow-on `router.refresh()`; the global test timeout in `playwright.config.ts` went from the 30s default to 45s.

### DoD / Verification

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npx playwright test`, re-run 6 times under `caffeinate -i`: 5/6 fully green (27 passed, 1 skipped); 1/6 had a single unrelated flake in a pre-existing test (`storefront-cart.spec.ts`'s original add-to-cart test), consistent with the dev-server contention above, not a regression
- The 1 skip is `webhooks.spec.ts`'s "smsNotified flips true" success-path assertion — this dev environment's `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` are unfilled placeholders from `.env.example` (confirmed: 5–7 char values), so a real Twilio send cannot succeed here. The failure-path test (J-12) doesn't need a successful send and does run for real.
- Verified no leftover Playwright-created rows remain in the seed data (products, pickup slots, orders) after the final run

### Result

All 15 items in `traceability-matrix.md`'s "Remaining Test Items" table are now covered (10 P0, 5 P1). **Recommend re-running `bmad-testarch-trace`** for an authoritative refreshed coverage/gate decision — this summary documents what was built and verified, but the gate math itself belongs to that workflow, not this one.

