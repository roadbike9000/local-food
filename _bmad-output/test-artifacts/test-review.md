---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation', 'step-03f-aggregate-scores', 'step-04-generate-report']
lastStep: 'step-04-generate-report'
lastSaved: '2026-08-07'
workflowType: 'testarch-test-review'
inputDocuments:
  - project-context.md
  - playwright.config.ts
  - package.json
  - tests/auth.spec.ts
  - tests/dashboard.spec.ts
  - tests/homepage.spec.ts
  - tests/payment.spec.ts
  - tests/sms.spec.ts
  - tests/storefront-cart.spec.ts
---

# Test Quality Review: local-food test suite

**Quality Score**: 95/100 (A - Excellent)
**Review Date**: 2026-08-07
**Review Scope**: suite (all 6 files in `tests/`)
**Reviewer**: Murat (BMad TEA Agent)

---

Note: This review audits existing tests; it does not generate tests.
Coverage mapping and coverage gates are out of scope here — routed to `trace` (TR) as a follow-up, per your original ask for coverage gaps.

## Execution Notes

- **Stack detected**: frontend — Next.js 14 App Router + Playwright 1.47, e2e only (no Jest/Vitest configured, matches `project-context.md`).
- **Config/reality mismatch**: `_bmad/tea/config.yaml` has `tea_use_playwright_utils: true`, but the repo has no `@seontechnologies/playwright-utils`-style dependency and no test imports it — plain `@playwright/test` only. Knowledge fragments for the *disabled* profile were loaded instead of the utils profile, since that reflects actual usage. Worth correcting the config flag so future runs don't load the wrong fragment set.
- **Execution mode**: resolved to **sequential inline** rather than spawning 4 parallel subagents. The suite is 6 files / 9 tests / ~126 lines total — well below the threshold where subagent parallelization pays for its overhead, so I evaluated all four quality dimensions directly.
- **Evidence collection**: skipped — this is a static code-quality read, not a live-flow debug session, so no `playwright-cli` browser session was needed.
- **No story file, test-design doc, or prior test-review found** under `_bmad-output/` — nothing to cross-reference for priority/AC mapping.

---

## Executive Summary

**Overall Assessment**: Excellent

**Recommendation**: Approve

### Key Strengths

✅ Every selector uses ARIA roles or `getByPlaceholder`/`getByText` — zero CSS-class, ID, or `nth()` selectors anywhere in the suite (top of the resilience hierarchy)
✅ `payment.spec.ts` implements the network-first pattern correctly: the `waitForResponse()` promise is created before the triggering `click()` inside `Promise.all([...])`, avoiding the classic navigate-then-intercept race
✅ Zero hard waits (`waitForTimeout`) anywhere in the suite — all waits are Playwright auto-waits or explicit `waitForResponse`/`waitForURL`
✅ Every file carries a header comment stating *why* it's built the way it is (e.g. why client-side nav instead of `page.goto` for cart tests, why the Stripe test stops at redirect) — genuinely useful, not boilerplate

### Key Weaknesses

⚠️ The "navigate to vendor → add first item → open cart" setup is copy-pasted across `storefront-cart.spec.ts`, `payment.spec.ts`, and `sms.spec.ts`, along with the hardcoded vendor slug and test phone number
⚠️ `payment.spec.ts` hits a real Stripe test-mode endpoint with no mocking — intentional per `project-context.md`, but still a source of environment-dependent flakiness when Stripe keys *are* configured
⚠️ No fixtures or data factories anywhere — three specs rely on `npm run db:seed` having created a specific vendor/product rather than seeding their own data

### Summary

This is a small, clean suite. Nothing here is flaky, brittle, or hard to read — the authors clearly already know the anti-patterns (no hard waits, no CSS selectors, network-first where it matters) and applied them without a TEA review nudging them to. The only real theme across all four findings below is **duplication**: three specs independently re-derive the same "add an item to the cart" setup instead of sharing a helper, which is also why the same vendor slug and phone number are hardcoded three times. None of this blocks merge; it's a 15-minute refactor whenever someone touches this area next.

---

## Quality Criteria Assessment

| Criterion                            | Status  | Violations | Notes                                                                 |
| ------------------------------------- | ------- | ---------- | ---------------------------------------------------------------------- |
| BDD Format (Given-When-Then)         | ✅ PASS | 0          | Not literally BDD-worded, but test names read as clear behavior specs |
| Test IDs                             | ⚠️ WARN | 9          | No `{EPIC}.{STORY}-{LEVEL}-{SEQ}` IDs — expected, no story docs exist yet |
| Priority Markers (P0/P1/P2/P3)       | ⚠️ WARN | 9          | No `@p0`-`@p3` tags — fine for a suite this size, revisit if it grows |
| Hard Waits (sleep, waitForTimeout)   | ✅ PASS | 0          | None found                                                              |
| Determinism (no conditionals)        | ⚠️ WARN | 1          | `payment.spec.ts` real Stripe dependency (see Recommendations #1)     |
| Isolation (cleanup, no shared state) | ⚠️ WARN | 3          | 3 files share one seeded vendor/product with no per-test setup        |
| Fixture Patterns                     | ⚠️ WARN | 1          | No fixtures used anywhere — duplication would be solved by one       |
| Data Factories                       | ⚠️ WARN | 1          | None used; all data is either hardcoded or externally seeded          |
| Network-First Pattern                | ✅ PASS | 0          | Correctly applied in `payment.spec.ts`                                 |
| Explicit Assertions                  | ✅ PASS | 0          | All `expect()` calls visible in test bodies, no hidden helpers        |
| Test Length (≤300 lines)             | ✅ PASS | 0          | Longest file is 33 lines                                                |
| Test Duration (≤1.5 min)             | ✅ PASS | n/a        | Not run in this review; nothing in the code suggests slow tests       |
| Flakiness Patterns                   | ✅ PASS | 0          | No random data, no unmocked timestamps, no order dependencies         |

**Total Violations**: 0 Critical, 0 High, 2 Medium, 2 Low

---

## Quality Score Breakdown

```
Dimension scores (weighted):
  Determinism      95/100  (A)   × 30% = 28.5
  Isolation        94/100  (A-)  × 30% = 28.2
  Maintainability  95/100  (A)   × 25% = 23.75
  Performance      98/100  (A)   × 15% = 14.7
                                          -----
Overall Score:                            95.15 → 95/100
Grade:                                    A

Violation penalties (severity weights: HIGH -10, MEDIUM -5, LOW -2):
  Determinism:      1 MEDIUM  (payment.spec.ts external Stripe call)         → -5
  Isolation:        3 LOW     (shared seeded vendor, storefront/payment/sms) → -6
  Maintainability:  1 MEDIUM  (duplicated add-to-cart setup, 3 files)        → -5
  Performance:      1 LOW     (redundant setup navigation, 3 files)          → -2
```

Coverage is intentionally excluded from this score — see `trace` for breadth/gap analysis.

---

## Critical Issues (Must Fix)

No critical issues detected. ✅

---

## Recommendations (Should Fix)

### 1. External Stripe dependency in `payment.spec.ts` has no isolation tag

**Severity**: P2 (Medium)
**Location**: `tests/payment.spec.ts:20-23`
**Criterion**: Determinism
**Knowledge Base**: [test-quality.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Issue Description**:
The test calls the real internal `/api/checkout` endpoint and waits on a redirect to `checkout.stripe.com` with no mocking. `project-context.md` documents this as an intentional project-wide policy ("no mocking of Stripe/Clerk/Twilio"), and the `test.skip()` fallback when the response is missing/not-ok is a reasonable mitigation. The remaining risk is narrower than the generic "external API call" violation: when Stripe test keys *are* configured, the test is still coupled to Stripe's test-mode uptime/latency, so a Stripe-side hiccup shows up as a local test failure with no way to distinguish it from a real regression.

**Current Code**:

```typescript
const [response] = await Promise.all([
  page.waitForResponse("**/api/checkout").catch(() => null),
  page.getByRole("button", { name: /checkout/i }).click(),
]);

test.skip(
  !response || !response.ok(),
  "Stripe test keys not configured; skipping redirect assertion",
);
```

**Recommended Improvement**:

```typescript
// tag it so it can be run/monitored separately from the fully-deterministic subset
test("@external checkout redirects to Stripe", async ({ page }) => {
  // ...unchanged...
});
```

**Benefits**:
No code behavior changes — just makes the one network-dependent test in the suite greppable (`playwright test --grep-invert '@external'` for a fully deterministic CI lane) without touching the project's existing "don't mock Stripe" policy.

**Priority**:
P2 — not urgent, the `test.skip()` already prevents false failures in environments without keys. Worth doing whenever CI flakiness triage becomes a recurring cost.

---

### 2. "Add item to cart" setup duplicated across three spec files

**Severity**: P2 (Medium)
**Location**: `tests/storefront-cart.spec.ts:7-13`, `tests/payment.spec.ts:8-14`, `tests/sms.spec.ts:7-11`
**Criterion**: Fixture Patterns / Maintainability
**Knowledge Base**: [fixture-architecture.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/fixture-architecture.md)

**Issue Description**:
All three files independently repeat: navigate to `/vendors/corner-sourdough`, click the first "Add" button, then click the "Cart" link via client-side nav. The vendor slug `"corner-sourdough"` and the test phone `"+15005550006"` are also hardcoded three times each. Per the fixture-architecture guidance, 3+ uses of the same setup is exactly the threshold for extracting a fixture.

**Current Code**:

```typescript
// repeated near-identically in 3 files
await page.goto("/vendors/corner-sourdough");
await page.getByRole("button", { name: "Add" }).first().click();
await page.getByRole("link", { name: "Cart" }).click();
```

**Recommended Improvement**:

```typescript
// tests/helpers/cart.ts
export const TEST_VENDOR_SLUG = "corner-sourdough";
export const TEST_PHONE = "+15005550006";

export async function addFirstItemAndOpenCart(page: Page) {
  await page.goto(`/vendors/${TEST_VENDOR_SLUG}`);
  await page.getByRole("button", { name: "Add" }).first().click();
  // client-side nav — page.goto would hard-reload and wipe the in-memory cart
  await page.getByRole("link", { name: "Cart" }).click();
}
```

**Benefits**:
One place to update if the "Add" button's accessible name or the cart nav flow changes, instead of three. Also removes the risk of the three copies silently drifting (e.g. one file getting fixed for a UI change, the other two staying broken).

**Priority**:
P2 — no functional risk today, but this is the kind of duplication that gets more expensive every time someone adds a fourth cart-flow test without noticing the first three.

---

### 3. Three specs share one seeded vendor with no per-test data setup

**Severity**: P3 (Low)
**Location**: `tests/storefront-cart.spec.ts:7`, `tests/payment.spec.ts:8`, `tests/sms.spec.ts:7`
**Criterion**: Isolation / Data Factories
**Knowledge Base**: [data-factories.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md)

**Issue Description**:
All three tests assume `corner-sourdough` exists and has at least one product with an enabled "Add" button, sourced entirely from `npm run db:seed` rather than anything the test itself creates. None of them mutate this data, so today it's parallel-safe — but it also means the tests are silently coupled to the seed script's contents. If someone reorders products for that vendor or the seed script changes, these three tests break with no obvious connection back to the seed change.

**Recommended Improvement**:
No urgent action needed. If/when the app grows a products or vendor-admin API, consider seeding the specific product these tests need directly (API-first setup per `data-factories.md`) instead of depending on the global seed script's current contents. Until then, the existing file-header comments documenting the seed dependency (already present in `storefront-cart.spec.ts` and `payment.spec.ts`) are a reasonable stopgap — worth adding the same comment to `sms.spec.ts`, which currently omits it.

**Priority**:
P3 — advisory. The current setup works and is documented; this is a "notice before it bites you" flag, not a defect.

---

## Best Practices Found

### 1. ARIA-role selectors used exclusively

**Location**: all 6 files
**Pattern**: Selector hierarchy (Level 2 — ARIA roles/accessible names)
**Knowledge Base**: [selector-resilience.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/selector-resilience.md)

**Why This Is Good**:
Every interaction goes through `getByRole`, `getByPlaceholder`, or `getByText` — never a CSS class, ID, or `nth()` index. This survives styling refactors and Tailwind class churn for free, and doubles as an accessibility check (if `getByRole('button', { name: 'Add' })` finds the button, a screen reader user can find it too).

**Code Example**:

```typescript
await expect(
  page.getByRole("heading", { name: /find local food/i }),
).toBeVisible();
```

**Use as Reference**: Keep doing exactly this as the suite grows — no changes needed.

### 2. Correct network-first ordering under `Promise.all`

**Location**: `tests/payment.spec.ts:20-23`
**Pattern**: Intercept-before-navigate (network-first)
**Knowledge Base**: [network-first.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/network-first.md)

**Why This Is Good**:
`page.waitForResponse(...)` is listed first inside `Promise.all([...])`, so the response listener is registered before the `.click()` that triggers the request fires — the exact ordering that prevents the "navigate then intercept" race condition described in the knowledge base. Easy to get backwards; this suite gets it right.

**Use as Reference**: Any future test that waits on a network call triggered by a click/nav should follow this same `Promise.all([waitForX, triggerAction])` shape.

---

## Test File Analysis

| File | Lines | Describe/Test | Fixtures | Factories | Priority tags |
|---|---|---|---|---|---|
| `auth.spec.ts` | 18 | 1 / 2 | 0 | 0 | none |
| `dashboard.spec.ts` | 16 | 1 / 2 | 0 | 0 | none |
| `homepage.spec.ts` | 16 | 1 / 2 | 0 | 0 | none |
| `payment.spec.ts` | 33 | 1 / 1 | 0 | 0 | none |
| `sms.spec.ts` | 23 | 1 / 1 | 0 | 0 | none |
| `storefront-cart.spec.ts` | 20 | 1 / 1 | 0 | 0 | none |
| **Total** | **126** | **6 / 9** | **0** | **0** | **0** |

**Test Framework**: Playwright 1.47 (`@playwright/test`), TypeScript. No unit/integration runner configured.

---

## Context and Integration

No story files, test-design docs, or prior test-review artifacts exist under `_bmad-output/` for this project — nothing to cross-reference for AC-to-test mapping or risk-based priority. Once epics/stories exist, re-run this review with `test_design_output` populated to get P0-P3 classification in the criteria table above.

---

## Knowledge Base References

- **[test-quality.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)** — Definition of Done (no hard waits, <300 lines, <1.5 min, self-cleaning)
- **[fixture-architecture.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/fixture-architecture.md)** — Pure function → Fixture pattern; "3+ uses → fixture" rule applied in Recommendation #2
- **[network-first.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/network-first.md)** — Intercept-before-navigate; validated against `payment.spec.ts`
- **[data-factories.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md)** — API-first setup; referenced in Recommendation #3
- **[selector-resilience.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/selector-resilience.md)** — Selector hierarchy; validated as a strength across all files
- **[timing-debugging.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/timing-debugging.md)**, **[test-healing-patterns.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/test-healing-patterns.md)** — consulted, no violations found
- **[playwright-config.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/playwright-config.md)** — `playwright.config.ts` uses sane defaults (`fullyParallel`, `retries` on CI, `trace: on-first-retry`); no changes recommended
- **[ci-burn-in.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/ci-burn-in.md)**, **[selective-testing.md](.claude/skills/bmad-testarch-test-review/resources/knowledge/selective-testing.md)** — no CI pipeline or tag strategy exists yet in this repo; out of scope for this review, relevant if/when `CI` (ci-pipeline) workflow is run

For coverage mapping, run `trace` (TR) — this is the natural next step given the original ask included "find coverage gaps."

---

## Next Steps

### Immediate Actions (Before Merge)

None — no blockers. This suite is approved as-is.

### Follow-up Actions (Future PRs)

1. **Extract `addFirstItemAndOpenCart` helper** — removes the 3-file duplication (Recommendation #2)
   - Priority: P2
   - Target: next time someone touches cart/payment/sms tests

2. **Tag `payment.spec.ts` as `@external`** — enables a fully-deterministic CI lane (Recommendation #1)
   - Priority: P2
   - Target: whenever CI is set up (see `CI` workflow)

3. **Run `trace` (TR)** — map current 9 tests against actual user flows/requirements to find coverage gaps (payment failure paths, dashboard authenticated view, SMS delivery confirmation, vendor-scoped data isolation are all plausible gaps based on `project-context.md`'s described features, but unverified without a proper trace)
   - Priority: P1
   - Target: now, since this was part of the original ask

### Re-Review Needed?

✅ No re-review needed — approve as-is.

---

## Decision

**Recommendation**: Approve

**Rationale**:
Zero critical or high-severity issues. The two medium findings (external Stripe dependency, setup duplication) are both low-risk and already partially mitigated by the codebase's existing conventions (graceful skip, documented rationale comments). Nothing here indicates flaky or unreliable tests — the opposite: this is a small suite written with real attention to the same anti-patterns TEA checks for.

> Test quality is excellent with 95/100 score. Minor duplication and one external-dependency tag can be addressed in a follow-up PR. Tests are production-ready and follow best practices.

---

## Appendix

### Violation Summary by Location

| Location | Severity | Criterion | Issue | Fix |
|---|---|---|---|---|
| `payment.spec.ts:20-23` | P2 (Medium) | Determinism | Real Stripe dependency, no isolation tag | Add `@external` grep tag |
| `storefront-cart.spec.ts:7-13`, `payment.spec.ts:8-14`, `sms.spec.ts:7-11` | P2 (Medium) | Fixture Patterns | Add-to-cart setup duplicated 3x | Extract `addFirstItemAndOpenCart()` helper |
| `storefront-cart.spec.ts:7`, `payment.spec.ts:8`, `sms.spec.ts:7` | P3 (Low) | Isolation | Shared seeded vendor, no per-test data setup | Document (partial) or API-seed once available |
| `storefront-cart.spec.ts`, `payment.spec.ts`, `sms.spec.ts` | P3 (Low) | Performance | Redundant vendor-page navigation across files | Solved by the same fixture as above |

---

## Review Metadata

**Generated By**: Murat, BMad TEA Agent (Test Architect)
**Workflow**: testarch-test-review
**Review ID**: test-review-suite-20260807
**Timestamp**: 2026-08-07
**Version**: 1.0
