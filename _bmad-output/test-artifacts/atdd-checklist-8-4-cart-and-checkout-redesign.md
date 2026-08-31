---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-31'
storyId: '8.4'
storyKey: '8-4-cart-and-checkout-redesign'
storyFile: '_bmad-output/implementation-artifacts/8-4-cart-and-checkout-redesign.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-4-cart-and-checkout-redesign.md'
generatedTestFiles: []
inputDocuments:
  - '_bmad-output/implementation-artifacts/8-4-cart-and-checkout-redesign.md'
  - 'src/app/cart/page.tsx'
  - 'tests/storefront-cart.spec.ts'
---

# ATDD Checklist: Story 8.4 — Cart and checkout redesign

## Step 1: Preflight & Context

- **Detected stack:** frontend (Next.js App Router + Playwright).
- **Prerequisites met:** story has 7 clear ACs, `ready-for-dev`.
- **AC #5's `role="alert"`/`aria-live="polite"` additions are this story's only genuinely new behavior** — read `src/app/cart/page.tsx` in full to assess whether each of the 3 messages is cleanly triggerable for a real red-phase Playwright test:
  - **Checkout error** (`{error && <p>...}`, line ~283): the one client-triggerable path (`if (!selectedSlotId) { setError(...) }`, line ~101) is explicitly a defense-in-depth guard behind the Checkout button's own `disabled` state — the story's own Dev Notes confirm the primary guard is the disabled button, meaning this branch is not reachable through normal UI interaction (clicking a disabled button is a no-op). The only other trigger is a non-OK `/api/checkout` response, which needs either a live Stripe-adjacent failure or DB-state manipulation mid-flow.
  - **Pickup-times-fetch-failure** message (line ~229): requires simulating a network/fetch failure for the pickup-slots endpoint — not reachable via pure UI interaction without route-level mocking, which this project's tests deliberately avoid (`project-context.md`: no mocking).
  - **Sold-out-in-cart warning** (line ~192): the closest existing precedent is `tests/storefront-cart.spec.ts`'s stock-drop test (line ~106), which mutates `stockQuantity` mid-session via Prisma directly — a real, working pattern, but it targets a *different* message (the checkout-time insufficient-stock error, not this cart-page in-place warning) and would need its own dedicated fixture flow to reach the right code path.
- **Deliberate scoping decision:** none of the 3 `role="alert"` additions are cleanly triggerable as a true, independently-executed red-phase test without either (a) building new DB-mutation fixture plumbing per message, or (b) violating the project's no-mocking convention. Rather than author a fragile or convention-breaking test to force a checkbox, this pass defers all 3 to `dev-story`'s own Task 4 — which already names exactly which attributes go where, with no ambiguity left for the implementer.
- **Execution mode:** sequential, no subagent dispatch.

## Step 2: Generation Mode

**Mode: N/A this pass** — see scoping decision above.

## Step 3: Test Strategy

| AC | Scenario | Test Level | Priority | Status |
| --- | --- | --- | --- | --- |
| 5 | Checkout error message has `role="alert"`/`aria-live="polite"` | E2E (Playwright) | P2 | Deferred — not cleanly triggerable via UI (defense-in-depth branch, per Dev Notes) |
| 5 | Pickup-fetch-failure message has `role="alert"`/`aria-live="polite"` | E2E (Playwright) | P2 | Deferred — requires network mocking, against project convention |
| 5 | Sold-out-in-cart warning has `role="alert"`/`aria-live="polite"` | E2E (Playwright) | P2 | Deferred — needs new dedicated fixture flow, not yet built |
| 1–4, 6, 7 | Two-column layout, stepper/list-semantics/pickup-picker/input preservation | E2E (Playwright) | P0/P1 | Already true today — regression guard, fully specified in the story's own Task 6 |

**This story's real risk is regression, not missing coverage of new behavior** — the story file itself already names every exact locator (`[aria-label="Quantity of ${name}"]`, `getByPlaceholder`, `data-testid="cart-total"`, radio accessible names) that must survive the restyle untouched. That existing enumeration *is* this story's test plan; ATDD's job here is to confirm there's no additional new-behavior gap beyond it, which this pass did (AC #5), not to duplicate it.

## Step 4: Red-Phase Test Generation

**N/A — no red-phase test generated this pass.** All 3 candidate new-behavior tests were assessed for clean, mocking-free triggerability and found to require fixture work beyond this pass's scope (see Step 1). No test was force-authored to satisfy a checkbox.

## Next Steps (Task-by-Task Activation)

1. Task 1–3, 5 (layout, stepper, pickup-picker, inputs) → implement; then run the full `tests/storefront-cart.spec.ts` file (the story's own Task 6 instruction) — this is the single most cart-page-dependent test file in the repo and is the real regression proof for this story.
2. Task 4 (the 3 `role="alert"`/`aria-live="polite"` additions) → implement per the story's own exact spec (checkout error, pickup-fetch-failure, sold-out-in-cart warning). If a follow-up ATDD or code-review pass wants executed coverage for these, the cleanest paths are: (a) checkout error — temporarily relax the disabled-button guard in a dedicated test-only fixture, or drive the `/api/checkout` call to fail via a controlled bad request; (b) pickup-fetch-failure — would need a project-approved mocking exception or a route that can be forced to fail via fixture data (e.g. a vendor with a malformed pickup-slot record); (c) sold-out-in-cart — extend the existing stock-drop-via-Prisma pattern (`tests/storefront-cart.spec.ts` line ~106) to reach the cart-page in-place warning specifically, not just the checkout-time error. None of these are this pass's call to make unilaterally — flagging for `dev-story`/reviewer awareness, not silently dropping.

## Implementation Guidance

No test files modified by this ATDD pass. Per the story's own Tasks/Subtasks: `src/app/cart/page.tsx`, `tests/storefront-cart.spec.ts` (only if a locator genuinely needs adjustment — expected to be none, verify by running the suite). Full contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/8-4-cart-and-checkout-redesign.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] N/A test files — scoping decision documented with concrete rationale per message, not silently skipped
- [x] Checklist matches acceptance criteria in scope (AC #5 assessed and deferred with reasons; AC #1–4/6/7 already fully specified in the story's own Task 6)
- [x] Real code inspected, not assumed — `src/app/cart/page.tsx` read in full, all 3 error/warning trigger paths traced
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened; no mocking introduced (project convention preserved)
- [x] Temp artifacts: none. Durable artifacts: this checklist only

**Completion summary:**

- **Test files created/modified:** none this pass — see scoping decision.
- **Checklist output path:** `_bmad-output/test-artifacts/atdd-checklist-8-4-cart-and-checkout-redesign.md`.
- **Story handoff:** `_bmad-output/implementation-artifacts/8-4-cart-and-checkout-redesign.md`, status `ready-for-dev`.
- **Key risk:** this remains the highest-regression-risk story in the epic (heaviest existing test coverage of any page) — the risk is entirely regression, not missing new-behavior coverage, and it's already fully mitigated by the story's own exhaustive locator enumeration plus the instruction to run the full spec file, not a subset.
- **Next recommended workflow:** `dev-story`.
