---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision', 're-run-2026-08-09']
lastStep: 're-run-2026-08-09'
lastSaved: '2026-08-09'
workflowType: 'testarch-trace'
inputDocuments:
  - project-context.md
  - src/middleware.ts
  - src/app/** (route inventory)
  - _bmad-output/test-artifacts/test-review.md
coverageBasis: 'user_journeys'
oracleConfidence: 'medium'
oracleResolutionMode: 'synthetic_source'
oracleSources: ['project-context.md', 'src/app route tree', 'src/middleware.ts']
externalPointerStatus: 'not_used'
tempCoverageMatrixPath: 'n/a — computed inline, no formal requirements exist to trace against'
---

# Traceability Matrix & Gate Decision - local-food test suite

**Target:** local-food (suite-wide, no specific story/epic — synthetic oracle)
**Date:** 2026-08-09 (updated — original run 2026-08-07)
**Evaluator:** Murat (BMad TEA Agent)
**Coverage Oracle:** user_journeys (synthetic — inferred from source, no formal requirements exist)
**Oracle Confidence:** medium
**Oracle Sources:** `project-context.md`, `src/app` route tree, `src/middleware.ts`

---

Note: This workflow does not generate tests. If gaps exist, run `bmad-testarch-atdd` or `bmad-testarch-automate` to create coverage.

> **2026-08-09, later same day — `automate` run closed all 15 remaining items** in the table below (10 P0 + 5 P1: J-04, J-05, J-07, J-08, J-09, J-10, J-11, J-12). Full details, including two real production bugs the new tests caught and fixed, are in [automation-summary.md](automation-summary.md)'s "Run 2" section. The coverage numbers and gate decision on this page are **not yet refreshed** — they still reflect the pre-automate state. Re-run `bmad-testarch-trace` for an authoritative updated Phase 1/Phase 2 result.

## Oracle Resolution

No formal requirements exist for this project (no story files, PRD, test-design doc, or OpenAPI/contract spec under `_bmad-output/`). Per the resolution order (formal requirements → contract/spec → external pointers → synthetic), I inferred **12 user journeys** directly from the route tree (`src/app/**`), the auth matcher (`src/middleware.ts`), and the explicit business rules in `project-context.md` ("Critical Don't-Miss Rules" section in particular — those map almost one-to-one onto real coverage gaps below).

**Confidence: medium**, not high — these are my inference of what matters, not a PM/team-confirmed backlog. Treat the gate decision below as advisory until these journeys are confirmed or promoted into real stories.

**2026-08-09 update**: since the original run, an `automate` pass added a Clerk auth fixture (`playwright/support/generate-vendor-auth.ts` + `playwright/.auth/vendor.json`) and 5 new tests. Re-scored below — J-06 is now FULL, J-07 and J-08 moved from NONE to PARTIAL. Full suite re-executed this run: **14/14 passing**.

---

## PHASE 1: REQUIREMENTS TRACEABILITY

### Coverage Summary

| Priority  | Total Journeys | FULL Coverage | Coverage % | Status      |
| --------- | --------------- | -------------- | ---------- | ----------- |
| P0        | 5               | 1              | 20%        | ❌ FAIL     |
| P1        | 7               | 3              | 43%        | ❌ FAIL     |
| P2        | 0               | 0              | n/a        | n/a         |
| P3        | 0               | 0              | n/a        | n/a         |
| **Total** | **12**          | **4**          | **33%**    | **❌ FAIL** |

_(was P0 0%, total 25% at the 2026-08-07 run — see update note above)_

**Legend:** ✅ FULL · ⚠️ PARTIAL · ❌ NONE

---

### Detailed Mapping

#### J-01: Homepage loads and shows marketplace heading + cart link (P1)

- **Coverage:** FULL ✅
- **Tests:**
  - `tests/homepage.spec.ts:6` — loads and shows the heading
    - **Given:** visitor navigates to `/`
    - **When:** page loads
    - **Then:** "Find local food" heading is visible
  - `tests/homepage.spec.ts:13` — has a link to the cart
    - **Given:** visitor is on the homepage
    - **When:** page renders
    - **Then:** cart link is visible

---

#### J-02: Guest browses a vendor storefront and adds a product to cart (P1)

- **Coverage:** FULL ✅
- **Tests:**
  - `tests/storefront-cart.spec.ts:6` — can add a product to the cart
    - **Given:** seeded vendor `corner-sourdough` exists
    - **When:** guest adds the first product and opens the cart
    - **Then:** cart page shows a total

---

#### J-03: Cart gates checkout on a valid mobile number (P1)

- **Coverage:** FULL ✅
- **Tests:**
  - `tests/sms.spec.ts:6` — cart requires a mobile number before checkout
    - **Given:** item in cart, name filled, no phone
    - **When:** checkout button state is checked
    - **Then:** disabled without phone, enabled once phone is entered

---

#### J-04: Checkout initiation redirects to Stripe (P0)

- **Coverage:** PARTIAL ⚠️
- **Tests:**
  - `tests/payment.spec.ts:7` — checkout redirects to Stripe
    - **Given:** item in cart, name + phone filled
    - **When:** checkout is clicked
    - **Then:** `/api/checkout` responds and browser redirects to `checkout.stripe.com`

- **Gaps:**
  - Missing: assertion that `totalCents` is server-computed, not client-trusted (explicit Don't-Miss Rule in `project-context.md`) — the test never inspects the `/api/checkout` response body
  - Missing: decline/error path — what happens when `/api/checkout` returns a non-2xx (e.g. product went unavailable mid-checkout, invalid pickup slot)
  - Missing: post-payment completion — the test intentionally stops at the Stripe redirect (documented, reasonable for E2E scope), but nothing in the suite covers what happens after Stripe redirects back

- **Recommendation:** Add an API-level test for `/api/checkout` that seeds a known cart and asserts the returned total matches server-side product prices regardless of what the client sent (guards the "never trust client-sent prices" rule directly, faster than E2E). Add an error-path test for a checkout attempt against an unavailable product.

---

#### J-05: Stripe webhook creates the order and triggers a one-shot SMS (P0)

- **Coverage:** NONE ❌
- **Tests:** none
- **Gaps:** `src/app/api/webhooks/stripe/route.ts` has zero test coverage — no test verifies order creation, the raw-body-before-`constructEvent` requirement, or the `smsNotified` one-shot flag. This is the single highest-risk gap in the suite: `project-context.md` calls out two Critical Don't-Miss Rules that both live in this one file ("Never JSON-parse the Stripe webhook body" and "SMS is one-shot per order via `smsNotified`"), and neither has any regression protection.
- **Recommendation:** Add an API-level test that posts a signed Stripe test webhook payload to `/api/webhooks/stripe` and asserts: (1) an order is created, (2) `smsNotified` flips to `true` exactly once, (3) a replayed webhook does not double-send SMS.

---

#### J-06: Unauthenticated visitor is blocked from all dashboard routes (P0)

- **Coverage:** FULL ✅ _(was PARTIAL)_
- **Tests:**
  - `tests/auth.spec.ts:13` — dashboard requires authentication (`/dashboard`)
  - `tests/dashboard.spec.ts:8` — overview redirects unauthenticated users (`/dashboard`)
  - `tests/dashboard.spec.ts:13` — products tab redirects unauthenticated users (`/dashboard/products`)
  - `tests/dashboard.spec.ts:18` — orders tab redirects unauthenticated users (`/dashboard/orders`)
  - `tests/dashboard.spec.ts:23` — pickups tab redirects unauthenticated users (`/dashboard/pickups`)
- **Remaining:** none. All 4 dashboard subpaths have their own regression test.

---

#### J-07: Authenticated vendor views and manages their own dashboard (P0)

- **Coverage:** PARTIAL ⚠️ _(was NONE)_
- **Tests:**
  - `tests/dashboard.spec.ts:49` — vendor sees their own dashboard overview (`/dashboard`, "Welcome back" + stats)
  - `tests/dashboard.spec.ts:54` — vendor sees their own products (`/dashboard/products` list renders)
- **Gaps (remaining):**
  - Missing: authenticated view of `/dashboard/orders` (own orders list renders)
  - Missing: authenticated view of `/dashboard/pickups` (own pickup slots list renders)
  - Missing: "manages" half of the journey — actually submitting `AddProductForm` and `AddSlotForm` (create-product, create-slot) was never exercised, only the read-only list views
- **Recommendation:** 4 more tests: two authenticated view assertions (orders, pickups tabs) and two create-flow tests (submit each form, assert the new row appears via `router.refresh()`).

---

#### J-08: Vendor-scoped data isolation — vendor A cannot see/edit vendor B's data (P0)

- **Coverage:** PARTIAL ⚠️ _(was NONE)_
- **Tests:**
  - `tests/dashboard.spec.ts:54` — vendor's product list never shows the other seeded vendor's products (UI-level)
  - `tests/dashboard.spec.ts:67` — `GET /api/products` never returns the other vendor's products (API-level, via `page.request`)
- **Verified while writing these**: `products/page.tsx`, `api/products/route.ts`, and `api/pickup-slots/route.ts` all correctly scope every query through `getCurrentVendor()` — no client-suppliable `vendorId`, no ID-based GET-by-id route that could leak cross-vendor data. No bug found; these tests are regression protection for an already-correct implementation.
- **Gaps (remaining):** Only the products surface has a direct test. `GET /api/pickup-slots` uses the identical `getCurrentVendor()`-scoping pattern but has no test proving it — same one-line assertion shape as the products API test, just not written yet. Orders have no `/api/orders` route to test at the API level (dashboard-rendered only); isolation there is implicitly covered once the J-07 orders-view test exists, but not explicitly asserted against another vendor's order data.
- **Recommendation:** 1 more test: mirror the existing products API-isolation test for `/api/pickup-slots` (assert Green Valley Produce's seeded slot never appears).

---

#### J-09: New vendor sign-up via Clerk (P1)

- **Coverage:** NONE ❌
- **Tests:** none — `auth.spec.ts` only tests sign-in render and the dashboard redirect; `/sign-up/[[...sign-up]]` is never visited
- **Recommendation:** Mirror the existing `sign-in page renders` test for `/sign-up` (same shallow "URL held" pattern is enough, consistent with how Clerk's hosted UI is already treated elsewhere in the suite).

---

#### J-10: Checkout success page renders post-payment (P1)

- **Coverage:** NONE ❌
- **Tests:** none — `/checkout/success` is never visited by any test
- **Recommendation:** Once an order-creation fixture exists (see J-05), add a test that navigates directly to `/checkout/success?...` with a known order and asserts the confirmation content renders.

---

#### J-11: Unavailable products (`isAvailable: false`) are excluded from storefront and checkout (P1)

- **Coverage:** NONE ❌
- **Tests:** none
- **Gaps:** Another explicit Critical Don't-Miss Rule in `project-context.md` with zero coverage — checkout's `findMany` already filters on `isAvailable: true`, but nothing asserts an unavailable product is actually hidden from `/vendors/[slug]` or rejected if someone tries to check it out anyway (e.g. via a stale cart).
- **Recommendation:** API-level test: seed a product with `isAvailable: false`, assert it's absent from the storefront listing and that `/api/checkout` rejects an attempt to buy it.

---

#### J-12: SMS send failure never falsely marks `smsNotified: true` (P1)

- **Coverage:** NONE ❌
- **Tests:** none
- **Gaps:** `sms.spec.ts` only tests that the cart *form* requires a phone number before checkout — it never touches the actual Twilio send path or the `smsNotified` flag. The explicit Don't-Miss Rule ("`sendSms` failures must not silently set `smsNotified: true`") is completely unverified.
- **Recommendation:** API-level test with a mocked/failing Twilio call, asserting `smsNotified` stays `false` on failure. Depends on the same webhook fixture as J-05.

---

### Gap Analysis

#### Critical Gaps (BLOCKER) ❌ — 1 found

1. **J-05: Stripe webhook → order creation + one-shot SMS** (P0)
   - Current Coverage: NONE
   - Missing Tests: order creation, raw-body signature verification, `smsNotified` idempotency
   - Impact: Two explicit "Critical Don't-Miss Rules" from `project-context.md` are unprotected; a regression here means either broken order fulfillment or duplicate SMS charges to customers, with no test to catch it.

#### High Priority Gaps (PR BLOCKER) ⚠️ — 3 found (PARTIAL P0 items)

1. **J-04: Checkout → Stripe redirect** (P0, PARTIAL)
   - Missing: server-computed total assertion, decline/error path
2. **J-07: Authenticated vendor dashboard** (P0, PARTIAL)
   - Missing: orders-tab view, pickups-tab view, create-product flow, create-slot flow
3. **J-08: Vendor-scoped data isolation** (P0, PARTIAL)
   - Missing: `/api/pickup-slots` isolation assertion

#### Medium Priority Gaps ⚠️ — 4 found (P1 NONE)

1. J-09: Sign-up flow untested
2. J-10: Checkout success page untested
3. J-11: `isAvailable: false` product exclusion untested
4. J-12: SMS failure handling untested

#### Low Priority Gaps ℹ️ — 0 found

---

### Remaining Test Items (all of them, per journey)

**15 tests remain** across 8 still-open journeys. J-01, J-02, J-03, and J-06 are fully closed — nothing left there.

| # | Journey | Test to write |
|---|---|---|
| 1 | J-04 | API test: `/api/checkout` total is server-computed from DB prices, ignores/rejects any client-sent price |
| 2 | J-04 | API test: `/api/checkout` rejects a cart containing an unavailable product (400) |
| 3 | J-05 | Webhook test: `checkout.session.completed` marks the matching order `PAID` |
| 4 | J-05 | Webhook test: `smsNotified` flips to `true` exactly once; a replayed webhook doesn't double-send |
| 5 | J-05 | Webhook test: invalid/missing Stripe signature → 400 (guards the raw-body-before-`constructEvent` rule) |
| 6 | J-07 | Authenticated view: `/dashboard/orders` renders the vendor's own orders |
| 7 | J-07 | Authenticated view: `/dashboard/pickups` renders the vendor's own pickup slots |
| 8 | J-07 | Authenticated flow: submit `AddProductForm`, assert the new product appears |
| 9 | J-07 | Authenticated flow: submit `AddSlotForm`, assert the new slot appears |
| 10 | J-08 | API test: `GET /api/pickup-slots` never returns another vendor's slots (mirrors test #67 in `dashboard.spec.ts`) |
| 11 | J-09 | `/sign-up` page renders (mirror the existing `/sign-in` render test) |
| 12 | J-10 | `/checkout/success` renders with a known order |
| 13 | J-11 | `isAvailable: false` product excluded from the storefront listing |
| 14 | J-11 | `/api/checkout` rejects an attempt to buy an `isAvailable: false` product |
| 15 | J-12 | SMS send failure never sets `smsNotified: true` (mocked/failing Twilio call) |

By priority: **10 are P0** (#1-10, spanning J-04/J-05/J-07/J-08) and **5 are P1** (#11-15, spanning J-09/J-10/J-11/J-12).

---

### Coverage Heuristics Findings

#### Endpoint Coverage Gaps

- Endpoints without any direct test: **2** (`/api/pickup-slots`, `/api/webhooks/stripe`) — was 3, `/api/products` now has a direct API-level test
- `/api/checkout` has indirect coverage only (through the E2E redirect test, not a direct API-level assertion of its response body)

#### Auth/Authz Gaps

- Negative path (unauthenticated → blocked) **is** covered for all 4 dashboard subpaths (J-06, now FULL).
- Positive path (authenticated) is now covered for overview + products view (J-07, PARTIAL) with vendor-scoping verified for products (J-08, PARTIAL). Orders/pickups authenticated views and the pickup-slots isolation check remain open — see Remaining Test Items above.

#### Happy-Path-Only Journeys

- J-02 (add to cart), J-04 (checkout redirect) — both only exercise the success path; no error/decline states asserted anywhere in the suite.

#### UI Journeys Without E2E Coverage

- 5 of 12 inferred journeys (J-05, J-09, J-10, J-11, J-12) — was 7; J-07 and J-08 now have partial E2E coverage

#### UI State Coverage

- No test in the suite asserts a loading, empty, validation-error, or permission-denied *state* — every existing test checks a final rendered outcome, not an intermediate state.

---

### Coverage by Test Level

| Test Level | Tests  | Journeys Covered | Coverage % |
| ---------- | ------ | ----------------- | ---------- |
| E2E        | 13     | 4 FULL, 3 PARTIAL | 58%        |
| API        | 1      | shares J-08 with E2E above | — |
| Component  | 0      | 0                  | 0%         |
| Unit       | 0      | 0                  | 0%         |
| **Total**  | **14** | **7 (4 FULL + 3 PARTIAL)** | **58%** |

No unit or component test runner is configured in this repo (`project-context.md` confirms this is intentional — Playwright e2e only, for now).

---

### Traceability Recommendations

#### Immediate Actions (Before next release)

1. **Cover the Stripe webhook (J-05)** — the one remaining Critical/BLOCKER gap; two explicit project rules are unprotected. 3 tests (see Remaining Test Items #3-5).
2. **Close out J-07/J-08** — 5 more tests using the auth fixture that already exists (#6-10). Cheap now that the fixture is built.

#### Short-term Actions (This milestone)

1. Add a direct API assertion on `/api/checkout`'s server-computed total + error path (J-04, #1-2).
2. Cover product-availability exclusion (J-11, #13-14) and SMS-failure handling (J-12, #15).

#### Long-term Actions (Backlog)

1. Sign-up flow (J-09, #11) and checkout-success page (J-10, #12) — lower risk, add opportunistically.
2. Consider introducing API-level Playwright tests (no browser needed) for the webhook/availability/SMS-failure scenarios above — cheaper and faster than E2E per `test-levels-framework.md`.

---

## PHASE 2: QUALITY GATE DECISION

**Gate Type:** release (no specific story/epic scope — suite-wide synthetic trace)
**Decision Mode:** deterministic

---

### Evidence Summary

#### Test Execution Results

Tests **were executed** this run: `npx playwright test` → **14/14 passed**, re-run 3x with no flakes.

- **Test Results Source**: local run, 2026-08-09
- **P0 Tests**: all passing tests pass, but P0 coverage (below) is still the binding constraint per Rule 1 — pass rate can't compensate for missing coverage

#### Coverage Summary (from Phase 1)

- **P0 Journeys**: 1/5 covered (20%) ❌
- **P1 Journeys**: 3/7 covered (43%) ❌
- **Overall Coverage**: 4/12 (33%)

#### Non-Functional Requirements (NFRs)

Not assessed in this run — out of scope for `trace`; run `bmad-testarch-nfr` if needed.

#### Flakiness Validation

Not assessed — no burn-in run performed. See [test-review.md](test-review.md) for the static quality review, which found zero hard waits or non-deterministic patterns in the existing 9 tests.

---

### Decision Criteria Evaluation

#### P0 Criteria (Must ALL Pass)

| Criterion   | Threshold | Actual | Status  |
| ----------- | --------- | ------ | ------- |
| P0 Coverage | 100%      | 20%    | ❌ FAIL |

**P0 Evaluation**: ❌ FAILED

#### P1 Criteria

| Criterion        | Threshold | Actual | Status  |
| ----------------- | --------- | ------ | ------- |
| P1 Coverage       | ≥80%      | 43%    | ❌ FAIL |
| Overall Coverage  | ≥80%      | 33%    | ❌ FAIL |

---

### GATE DECISION: ❌ FAIL

---

### Rationale

P0 coverage is 20% (required: 100%) — 1 of 5 P0 journeys (J-06, unauthenticated dashboard block) is now FULL, but J-04, J-07, and J-08 are only PARTIAL, and J-05 (Stripe webhook) is still completely untested. Overall coverage is 33%, still well under the 80% minimum. This decision stops at Rule 1 of the gate logic — P0 coverage alone is decisive here.

**Progress since 2026-08-07**: P0 coverage moved from 0% to 20%, overall from 25% to 33%, on the strength of a new Clerk auth fixture and 5 new tests (details in [automation-summary.md](automation-summary.md)). The remaining gap is now well-scoped: **15 specific tests** (10 P0, 5 P1) close it entirely — see the Remaining Test Items table above.

**Important context**: this FAIL is not a statement that the tests are bad — [test-review.md](test-review.md) scored the original 9 at 95/100, and the same patterns (real selectors, no hard waits, correct vendor-scoping already verified in the app code) continued in the new 5. It's a statement of remaining breadth, not quality. The Stripe webhook — the single highest-consequence untested path in the app — is still the one Critical (BLOCKER) gap.

Given the synthetic (medium-confidence) oracle, this FAIL should be treated as a strong signal to prioritize, not a hard release blocker enforced by CI — there's no CI pipeline wired up yet, and no formal stories to gate against. Re-run this trace once stories/epics exist for a higher-confidence, story-scoped gate.

---

### Critical Issues (For FAIL)

| Priority | Issue                                              | Description                                                        | Status |
| -------- | --------------------------------------------------- | -------------------------------------------------------------------- | ------ |
| P0       | Stripe webhook untested (J-05)                     | Order creation + one-shot SMS flag have zero coverage               | OPEN   |
| P0       | Authenticated vendor dashboard partial (J-07)      | Orders/pickups views + create flows still untested                  | OPEN   |
| P0       | Vendor data isolation partial (J-08)               | Products isolation tested; pickup-slots isolation still untested    | OPEN   |
| P0       | Checkout total/error path untested (J-04)          | No server-computed-total or unavailable-product-error assertion     | OPEN   |

**Blocking Issues Count**: 1 P0 blocker (J-05, NONE), 3 P0 partial-coverage issues (J-04, J-07, J-08) — was 3 blockers + 2 partial

---

### Gate Recommendations

#### For FAIL Decision ❌

1. This does not block any deployment mechanically — there's no CI gate wired to this decision yet — but treat the 3 critical gaps above as the top of the backlog before the next release that touches payments, dashboard, or SMS.
2. Fix order: stand up the Clerk test-user fixture first (unblocks 2 of 3 P0 gaps at once), then cover the webhook.
3. Re-run `bmad-testarch-trace` after adding coverage to confirm the gate moves off FAIL.

---

### Next Steps

**Immediate:**

1. Write the 3 webhook tests (J-05, #3-5) — closes the last Critical gap
2. Write the 5 remaining J-07/J-08 tests (#6-10) — fixture already exists, cheap now

**Follow-up:**

1. Server-computed-total + error-path tests for `/api/checkout` (J-04, #1-2)
2. Availability exclusion (J-11, #13-14) and SMS-failure handling (J-12, #15)
3. Sign-up and checkout-success (J-09/J-10, #11-12) — lowest priority, whenever convenient

**Stakeholder note:** these 12 journeys were inferred from source, not confirmed by a PM — worth a quick sanity check with whoever owns the roadmap before treating this as a formal backlog.

---

## Related Artifacts

- **Test Review:** [test-review.md](test-review.md) — quality assessment of the original 9 tests (95/100, no critical issues)
- **Automation Summary:** [automation-summary.md](automation-summary.md) — how the auth fixture and 5 new tests were built
- **Test Files:** `tests/*.spec.ts` (6 files, 14 tests)
- **Project Context:** `_bmad-output/project-context.md` — source of the Critical Don't-Miss Rules referenced throughout this trace

---

## Sign-Off

**Phase 1 - Traceability Assessment:**

- Overall Coverage: 33% (was 25%)
- P0 Coverage: 20% ❌ (was 0%)
- P1 Coverage: 43% ❌ (unchanged)
- Critical Gaps: 1 (was 3)
- High Priority Gaps: 3 (was 2)
- **Remaining tests to close all gaps: 15** (10 P0, 5 P1) — see Remaining Test Items table

**Phase 2 - Gate Decision:**

- **Decision**: FAIL ❌ (unchanged — P0 coverage still under 100%)
- **P0 Evaluation**: ❌ FAILED
- **P1 Evaluation**: ❌ FAILED

**Overall Status:** FAIL ❌ (advisory — synthetic oracle, no CI gate currently enforces this)

**Next Steps:**

- Write the 15 remaining tests (webhook first — the one Critical gap), then re-run `bmad-testarch-trace`.

**Generated:** 2026-08-07, updated 2026-08-09
**Workflow:** testarch-trace

---

<!-- Powered by BMAD-CORE™ -->
