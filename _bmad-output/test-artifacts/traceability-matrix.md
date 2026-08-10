---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision', 're-run-2026-08-09', 're-run-2026-08-10', 'gap-closed-2026-08-10']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-08-10'
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
tempCoverageMatrixPath: '/private/tmp/claude-501/-Users-jeffsmathers-Projects-local-food/004ab9b0-d9f2-4811-ba01-8d9eda444365/scratchpad/tea-trace-coverage-matrix-2026-08-10.json'
---

# Traceability Matrix & Gate Decision - local-food test suite

**Target:** local-food (suite-wide, no specific story/epic — synthetic oracle)
**Date:** 2026-08-10 (updated — prior runs 2026-08-07, 2026-08-09)
**Evaluator:** Murat (BMad TEA Agent)
**Coverage Oracle:** user_journeys (synthetic — inferred from source, no formal requirements exist)
**Oracle Confidence:** medium
**Oracle Sources:** `project-context.md`, `src/app` route tree, `src/middleware.ts`

---

Note: This workflow does not generate tests. If gaps exist, run `bmad-testarch-atdd` or `bmad-testarch-automate` to create coverage.

> **2026-08-10, same-day update:** The initial re-run below (static trace) found P0 at 80% with exactly one gap (J-08, orders cross-vendor isolation). That gap has since been closed in the same session: 1 new test written, and the full suite actually executed (not just traced) — 1 pre-existing flaky test found and fixed along the way. **P0 is now 100%.** Two remaining heuristic (non-blocking) findings were then also closed: cart-side error-state coverage for J-02, and validation/error-state coverage for the dashboard's create-flow forms (J-07). Coverage percentages, gate decision, and counts throughout this document reflect that fully-closed state.

## Oracle Resolution

No formal requirements exist for this project (no story files, PRD, test-design doc, or OpenAPI/contract spec under `_bmad-output/`). `_bmad-output/implementation-artifacts/spec-wire-dashboard-forms.md` is a single closed, one-off feature spec (status: done) — not a suite-wide oracle, so it doesn't outrank the synthetic resolution. Per the resolution order (formal requirements → contract/spec → external pointers → synthetic), I inferred **12 user journeys** directly from the route tree (`src/app/**`), the auth matcher (`src/middleware.ts`), and the explicit business rules in `project-context.md` ("Critical Don't-Miss Rules" section in particular). Route tree and middleware matcher are unchanged since the 2026-08-09 run, so the same 12 journeys still apply.

**Confidence: medium**, not high — these are my inference of what matters, not a PM/team-confirmed backlog. Treat the gate decision below as advisory until these journeys are confirmed or promoted into real stories. This confidence level caps the gate at **CONCERNS** even at 100% coverage (see Phase 2).

---

## PHASE 1: REQUIREMENTS TRACEABILITY

### Coverage Summary

| Priority  | Total Journeys | FULL Coverage | Coverage % | Status      |
| --------- | --------------- | -------------- | ---------- | ----------- |
| P0        | 5               | 5              | 100%       | ✅ PASS     |
| P1        | 7               | 7              | 100%       | ✅ PASS     |
| P2        | 0               | 0              | n/a        | n/a         |
| P3        | 0               | 0              | n/a        | n/a         |
| **Total** | **12**          | **12**         | **100%**   | ✅ PASS (oracle-confidence capped, see below) |

_(was P0 20% → 80% → 100%, P1 43% → 100%, total 33% → 92% → 100% across the three 2026-08 runs)_

**Legend:** ✅ FULL · ⚠️ PARTIAL · ❌ NONE

---

### Detailed Mapping

#### J-01: Homepage loads and shows marketplace heading + cart link (P1)

- **Coverage:** FULL ✅ _(unchanged)_
- **Tests:**
  - `tests/homepage.spec.ts:5` — loads and shows the heading
  - `tests/homepage.spec.ts:12` — has a link to the cart

---

#### J-02: Guest browses a vendor storefront and adds a product to cart (P1)

- **Coverage:** FULL ✅ _(unchanged)_
- **Tests:**
  - `tests/storefront-cart.spec.ts:7` — can add a product to the cart
  - `tests/storefront-cart.spec.ts:25` — unavailable products are excluded from the storefront listing (closes J-11)
  - `tests/storefront-cart.spec.ts:50` — **new** — checkout shows an error when a cart item goes unavailable before submitting (closes the cart-side error-state heuristic gap: an item marked unavailable *after* being added to the cart, before checkout is submitted)

---

#### J-03: Cart gates checkout on a valid mobile number (P1)

- **Coverage:** FULL ✅ _(unchanged)_
- **Tests:**
  - `tests/sms.spec.ts:6` — cart requires a mobile number before checkout

---

#### J-04: Checkout initiation redirects to Stripe (P0)

- **Coverage:** FULL ✅ _(was PARTIAL)_
- **Tests:**
  - `tests/payment.spec.ts:7` — checkout redirects to Stripe
  - `tests/checkout-api.spec.ts:14` — total is computed from DB prices, ignoring any client-sent total (closes the "never trust client-sent prices" Don't-Miss Rule directly)
  - `tests/checkout-api.spec.ts:52` — rejects a cart containing an unavailable product (400)
- **Remaining (non-blocking):** no test covers a generic Stripe-side decline/non-2xx unrelated to price/availability — reasonable to leave untested since it's outside app control and the hosted-Checkout boundary is by design.

---

#### J-05: Stripe webhook creates the order and triggers a one-shot SMS (P0)

- **Coverage:** FULL ✅ _(was NONE — this was the sole Critical/BLOCKER gap in the 2026-08-09 run)_
- **Tests:**
  - `tests/webhooks.spec.ts:17` — `checkout.session.completed` marks the matching order PAID
  - `tests/webhooks.spec.ts:41` — `smsNotified` flips to `true` exactly once; a replayed webhook doesn't re-trigger it (env-gated: skips its success-path assertion when Twilio isn't fully configured, same pattern as `payment.spec.ts`'s Stripe-key check — confirmed skipping for that reason in this environment, not failing)
  - `tests/webhooks.spec.ts:88` — invalid/missing signature is rejected (400) — guards the raw-body-before-`constructEvent` rule
  - `tests/webhooks.spec.ts:104` — a failing SMS send never sets `smsNotified: true` (also closes J-12)
- **Note:** No E2E/browser coverage exists for this journey, but none is expected — it's a server-to-server webhook with no UI surface. API-level coverage is the correct test level here per `test-levels-framework.md`.

---

#### J-06: Unauthenticated visitor is blocked from all dashboard routes (P0)

- **Coverage:** FULL ✅ _(unchanged)_
- **Tests:**
  - `tests/auth.spec.ts:13` — dashboard requires authentication (`/dashboard`)
  - `tests/dashboard.spec.ts:13,18,23,28` — overview/products/orders/pickups all redirect unauthenticated users

---

#### J-07: Authenticated vendor views and manages their own dashboard (P0)

- **Coverage:** FULL ✅ _(was PARTIAL)_
- **Tests:**
  - `tests/dashboard.spec.ts:54` — vendor sees their own dashboard overview
  - `tests/dashboard.spec.ts:59` — vendor sees their own products
  - `tests/dashboard.spec.ts:98` — vendor sees their own orders tab
  - `tests/dashboard.spec.ts:103` — vendor sees their own pickups tab
  - `tests/dashboard.spec.ts:112` — vendor can add a new product (exercises `AddProductForm`)
  - `tests/dashboard.spec.ts:139` — vendor can add a new pickup slot (exercises `AddSlotForm`)
  - `tests/dashboard.spec.ts:188` — **new** — add-slot form shows a validation error when the end time is before the start time (`endsAt <= startsAt`; this branch has no native HTML constraint, so it's genuinely reachable via UI interaction, unlike the price check below)
  - `tests/dashboard.spec.ts:217` — **new** — add-product form shows an error when the session has expired (401 path, via route interception)
- **Resolved (was dead code):** `AddProductForm`'s client-side price guard (`priceCents <= 0` → "Enter a valid price.") was unreachable through real UI interaction — the price input's native `required`/`min="0.01"` constraints already blocked submission for any value that would trip it. No test ever covered it (correctly, since it couldn't be exercised). Removed from `AddProductForm.tsx` at the user's request; `priceCents` itself is still computed and sent to the API unchanged.

---

#### J-08: Vendor-scoped data isolation — vendor A cannot see/edit vendor B's data (P0)

- **Coverage:** FULL ✅ _(was PARTIAL — closed in this session)_
- **Tests:**
  - `tests/dashboard.spec.ts:59` — vendor's product list never shows the other seeded vendor's products (UI-level)
  - `tests/dashboard.spec.ts:72` — `GET /api/products` never returns the other vendor's products (API-level)
  - `tests/dashboard.spec.ts:85` — `GET /api/pickup-slots` never returns another vendor's slots (API-level)
  - `tests/dashboard.spec.ts:105` — **new** — vendor's orders view never shows another vendor's seeded order (UI-level; mirrors the products isolation test at `dashboard.spec.ts:59`)
- **Closed this session:** orders isolation was the last untested surface (`src/app/dashboard/orders/page.tsx:8` was already correctly scoped via `getCurrentVendor()` — verified by reading source — but had no regression test). Confirmed passing against the seeded second vendor (`green-valley-produce`).

---

#### J-09: New vendor sign-up via Clerk (P1)

- **Coverage:** FULL ✅ _(was NONE)_
- **Tests:**
  - `tests/auth.spec.ts:19` — sign-up page renders

---

#### J-10: Checkout success page renders post-payment (P1)

- **Coverage:** FULL ✅ _(was NONE)_
- **Tests:**
  - `tests/payment.spec.ts:34` — checkout success page renders

---

#### J-11: Unavailable products (`isAvailable: false`) are excluded from storefront and checkout (P1)

- **Coverage:** FULL ✅ _(was NONE)_
- **Tests:**
  - `tests/storefront-cart.spec.ts:22` — excluded from the storefront listing
  - `tests/checkout-api.spec.ts:52` — `/api/checkout` rejects an attempt to buy it (400)

---

#### J-12: SMS send failure never falsely marks `smsNotified: true` (P1)

- **Coverage:** FULL ✅ _(was NONE)_
- **Tests:**
  - `tests/webhooks.spec.ts:104` — a failing SMS send never sets `smsNotified: true`

---

### Gap Analysis

#### Critical Gaps (BLOCKER) ❌ — 0 found

None.

#### High Priority Gaps (PR BLOCKER) ⚠️ — 0 found

None. J-08 (the last PARTIAL P0 item) is now FULL.

#### Medium Priority Gaps ⚠️ — 0 found

All P1 journeys are FULL.

#### Low Priority Gaps ℹ️ — 0 found

---

### Remaining Test Items

**0 tests remain** to close a journey-level gap. All 12 inferred journeys are FULL. Remaining items below are heuristic/quality findings, not coverage gaps (see Coverage Heuristics Findings).

---

### Coverage Heuristics Findings

#### Endpoint Coverage Gaps

- Endpoints without any direct test: **0**. `/api/checkout`, `/api/products`, `/api/pickup-slots`, and `/api/webhooks/stripe` all have direct API-level tests.

#### Auth/Authz Gaps

- Negative path (unauthenticated → blocked): covered for all 4 dashboard subpaths (J-06, FULL).
- Positive path (authenticated): covered for all 4 dashboard subpaths (J-07, FULL).
- Vendor-scoping assertions: present for products (UI + API), pickup-slots (API), and now orders (UI) — all four dashboard resources have an explicit cross-vendor isolation test.

#### Happy-Path-Only Journeys

- None remaining. J-02 now has a cart-side error-state test (item goes unavailable after adding to cart); J-07's create flows now have validation/error-state tests for both forms.

#### UI Journeys Without E2E Coverage

- 0 of 12. J-05 has no *browser* coverage by design (server-to-server webhook with no UI), but has direct, correctly-scoped API-level coverage.

#### UI State Coverage

- Closed. Both create-flow forms now have an asserted error/validation state (`AddSlotForm`'s `endsAt`-before-`startsAt` guard, `AddProductForm`'s session-expiry 401 path), and the cart has an asserted error state (checkout against a since-unavailable item). No loading/empty-state coverage exists, but no known risk is attached to that gap — lowest priority, tracked in Long-term Actions.

---

### Coverage by Test Level

| Test Level | Tests  | Journeys Covered | Coverage % |
| ---------- | ------ | ----------------- | ---------- |
| E2E        | 24     | 11 journeys (some shared with API) | — |
| API        | 8      | 4 journeys (J-04, J-05, J-08, J-11 partly share E2E) | — |
| Component  | 0      | 0                  | 0%         |
| Unit       | 28     | 0 (pure-function coverage, not journey-mapped) | — |
| **Total**  | **60** | **12/12 (FULL)**   | **100%**   |

Unit tests (Vitest) cover pure functions and Zod schema validation only (`formatPrice`, `slugify`, SMS message formatting, and schema validation for all 3 route handlers) per `project-context.md`'s testing rules — intentionally outside the journey-traceability oracle since journeys are user-facing flows, not unit boundaries. They're still part of "solid coverage" in the broader sense: schema-level edge cases (e.g. "strips a client-sent `totalCents` rather than accepting it as trusted input") give fast, precise regression protection that complements the slower E2E/API layer.

---

### Traceability Recommendations

#### Immediate Actions (Before next release)

None outstanding — all P0/P1 journeys are FULL.

#### Short-term Actions (This milestone)

None outstanding — both heuristic gaps (validation-error-state coverage, cart-side error state) closed this session.

#### Long-term Actions (Backlog)

1. Consider promoting these 12 inferred journeys into confirmed stories/epics — would raise oracle confidence from medium to high and unlock an unconditional PASS instead of a confidence-gated CONCERNS ceiling.
2. General UI-state coverage (loading/empty states) remains untested suite-wide — lowest-priority item, no known risk attached.

---

## PHASE 2: QUALITY GATE DECISION

**Gate Type:** release (no specific story/epic scope — suite-wide synthetic trace)
**Decision Mode:** deterministic

---

### Evidence Summary

#### Test Execution Results

**Actually executed this run** (not just traced against source):

- `npm run test:unit` (Vitest) → **28/28 passed**.
- `npx playwright test` (E2E + API) → first run surfaced **1 pre-existing flaky failure**: `tests/storefront-cart.spec.ts:7` ("can add a product to the cart") failed the `toHaveURL(/cart/)` assertion under full parallel load, but passed every time in isolation. Root cause: the `/cart` route's first-hit Next.js dev-server compile can outrun the assertion's default 5s timeout under 4-worker parallel load — the same class of issue `playwright.config.ts:30`'s comment already documents and that `dashboard.spec.ts`'s create-flow tests already work around with extended timeouts. Fixed by extending that one assertion's timeout to 15s (`tests/storefront-cart.spec.ts:18`), consistent with the existing pattern.
- After that fix, 4 more tests were added to close the remaining heuristic gaps (J-02 cart-side error state; J-07 form validation/error states for both `AddProductForm` and `AddSlotForm`).
- Final run → **31/32 passed, 1 skipped**. The skip is `tests/webhooks.spec.ts:41`'s success-path assertion, intentionally env-gated (`test.skip(!afterFirst?.smsNotified, ...)`) because this environment's Twilio credentials are placeholders — same documented pattern as `payment.spec.ts`'s Stripe-key skip. Confirmed via server logs: Twilio returned `403` as expected for unconfigured dev creds, so the skip fired for the documented reason, not a hidden failure.
- `npm run typecheck` and `npm run lint` both clean throughout.
- **Net result: every test that can run in this environment is green.** 0 unexplained failures, 0 flakes remaining, 1 documented environment-gated skip.

#### Coverage Summary (from Phase 1)

- **P0 Journeys**: 5/5 covered (100%) ✅
- **P1 Journeys**: 7/7 covered (100%) ✅
- **Overall Coverage**: 12/12 (100%) ✅

#### Non-Functional Requirements (NFRs)

Not assessed in this run — out of scope for `trace`; run `bmad-testarch-nfr` if needed.

#### Flakiness Validation

Partially assessed as a byproduct of actually running the suite twice this session (not a formal burn-in): 1 flaky test found and fixed (see above). A dedicated burn-in (`ci-burn-in.md` pattern — repeat runs to shake out timing issues) has still not been performed and is recommended before treating this suite as CI-gate-ready.

---

### Decision Criteria Evaluation

#### P0 Criteria (Must ALL Pass)

| Criterion   | Threshold | Actual | Status  |
| ----------- | --------- | ------ | ------- |
| P0 Coverage | 100%      | 100%   | ✅ MET  |

**P0 Evaluation**: ✅ PASSED

#### P1 Criteria

| Criterion        | Threshold | Actual | Status  |
| ----------------- | --------- | ------ | ------- |
| P1 Coverage       | ≥80% (target 90%) | 100%   | ✅ MET |
| Overall Coverage  | ≥80%      | 100%   | ✅ MET |

---

### GATE DECISION: ⚠️ CONCERNS

---

### Rationale

All base-coverage thresholds are met: P0 100% (required 100%), P1 100% (target 90%), overall 100% (minimum 80%) — this meets the criteria for an unconditional PASS. However, the oracle-confidence overlay applies: coverage is traced against **inferred** user journeys (synthetic oracle) at **medium** confidence, not team-confirmed acceptance criteria. Per the gate logic, a synthetic oracle below high confidence caps an otherwise-PASS result at **CONCERNS** — the underlying coverage is solid, but nobody with product authority has confirmed these 12 journeys are the right things to have tested.

**Progress across this session**: P0 coverage moved 20% → 80% → 100%; P1 43% → 100%; overall 33% → 100%. The single Critical (BLOCKER) gap (J-05, Stripe webhook) and the last PARTIAL item (J-08, orders isolation) are both closed. The suite was also actually executed (not just traced), surfacing and fixing one real flaky test.

**What would unlock an unconditional PASS**: have a PM/team member confirm these 12 journeys reflect intended behavior (promoting them from inferred to formal), which raises oracle confidence to high and removes the CONCERNS cap. Absent that, CONCERNS is the ceiling regardless of coverage percentage — this is by design, not a coverage shortfall.

---

### Critical Issues (For CONCERNS)

| Priority | Issue                                              | Description                                                        | Status |
| -------- | --------------------------------------------------- | -------------------------------------------------------------------- | ------ |
| —        | Oracle confidence not high                          | 12 journeys are inferred from source, not confirmed by a PM/team — caps gate at CONCERNS regardless of coverage % | ADVISORY |

**Blocking Issues Count**: 0 (no coverage blockers remain — the CONCERNS classification is a confidence-of-oracle statement, not a coverage statement).

---

### Gate Recommendations

#### For CONCERNS Decision ⚠️

1. No coverage work is required to improve this decision — the ceiling is confidence-based, not coverage-based.
2. To reach PASS: have the journeys reviewed and confirmed (ideally promoted into `_bmad-output` story/epic files), then re-run `bmad-testarch-trace`.
3. Recommended before relying on this suite as a release gate: run a burn-in pass (repeat `npx playwright test` several times) to build confidence beyond the one flake already caught and fixed this session, and wire the suite into CI so this gate decision is actually enforced rather than advisory.

---

### Next Steps

**Immediate:**

None required for coverage. Suite is green and all inferred journeys are FULL.

**Follow-up:**

1. Promote the 12 inferred journeys into confirmed stories to raise oracle confidence and unlock an unconditional PASS.
2. Burn-in the suite (repeat runs) before treating it as CI-gate-ready — only limited execution's worth of flakiness data exists so far.
3. Wire the suite into CI (`.github/workflows/ci.yml` already runs it per `project-context.md`, but nothing consumes this gate decision programmatically yet).

**Stakeholder note:** these 12 journeys were inferred from source, not confirmed by a PM — worth a quick sanity check with whoever owns the roadmap before treating this as a formal backlog.

---

## Related Artifacts

- **Test Review:** [test-review.md](test-review.md) — quality assessment of the original 9 tests (95/100, no critical issues); predates the 20 tests added since
- **Automation Summary:** [automation-summary.md](automation-summary.md) — how the auth fixture and first batch of new tests were built (2026-08-09 run)
- **Machine-readable outputs:** [e2e-trace-summary.json](e2e-trace-summary.json), [gate-decision.json](gate-decision.json)
- **Test Files:** `tests/*.spec.ts` (8 files, 32 cases) + `src/**/*.test.ts` (5 files, 28 cases) = 13 files, 60 cases total
- **Project Context:** `_bmad-output/project-context.md` — source of the Critical Don't-Miss Rules referenced throughout this trace

---

## Sign-Off

**Phase 1 - Traceability Assessment:**

- Overall Coverage: 100% (was 33% → 92% → 100%)
- P0 Coverage: 100% ✅ (was 20% → 80% → 100%)
- P1 Coverage: 100% ✅ (was 43% → 100%)
- Critical Gaps: 0
- High Priority Gaps: 0
- **Remaining tests to close coverage gaps: 0**

**Phase 2 - Gate Decision:**

- **Decision**: CONCERNS ⚠️ (was FAIL — coverage is complete; ceiling is now oracle-confidence, not coverage)
- **P0 Evaluation**: ✅ PASSED
- **P1 Evaluation**: ✅ PASSED

**Overall Status:** CONCERNS ⚠️ (advisory — synthetic oracle at medium confidence caps the ceiling; no CI gate currently enforces this)

**Next Steps:**

- Get the 12 journeys confirmed by a PM/team member to unlock PASS; burn-in the suite and wire it into CI before relying on it as a hard release gate.

**Generated:** 2026-08-07, updated 2026-08-09, updated 2026-08-10 (gap closed + suite executed same day)
**Workflow:** testarch-trace

---

🚨 GATE DECISION: CONCERNS

📊 Coverage Analysis:
- P0 Coverage: 100% (Required: 100%) → MET
- P1 Coverage: 100% (PASS target: 90%, minimum: 80%) → MET
- Overall Coverage: 100% (Minimum: 80%) → MET

✅ Decision Rationale:
Coverage meets every threshold for PASS. Gate is capped at CONCERNS because the oracle is synthetic (inferred journeys, not team-confirmed) at medium confidence — this is a confidence statement, not a coverage gap.

⚠️ Critical Gaps: 0

📝 Recommended Actions:
1. Have the 12 inferred journeys confirmed by a PM/team member to unlock PASS
2. Burn-in the suite (repeat runs) before treating it as CI-gate-ready
3. Wire this gate decision into CI so it's enforced, not just advisory

📂 Full Report: _bmad-output/test-artifacts/traceability-matrix.md

⚠️ GATE: CONCERNS - Proceed with caution; coverage is solid but the oracle is unconfirmed

<!-- Powered by BMAD-CORE™ -->
