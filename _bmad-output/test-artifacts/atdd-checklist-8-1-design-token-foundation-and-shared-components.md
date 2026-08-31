---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-31'
storyId: '8.1'
storyKey: '8-1-design-token-foundation-and-shared-components'
storyFile: '_bmad-output/implementation-artifacts/8-1-design-token-foundation-and-shared-components.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-1-design-token-foundation-and-shared-components.md'
generatedTestFiles:
  - 'tests/homepage.spec.ts'
inputDocuments:
  - '_bmad-output/implementation-artifacts/8-1-design-token-foundation-and-shared-components.md'
  - 'src/components/Navbar.tsx'
  - 'src/components/ProductCard.tsx'
  - 'tests/homepage.spec.ts'
  - 'tests/sms.spec.ts'
  - 'tests/payment.spec.ts'
  - 'playwright.config.ts'
---

# ATDD Checklist: Story 8.1 — Design-token foundation and shared components

## Step 1: Preflight & Context

- **Detected stack:** frontend (Next.js App Router + Playwright; no separate backend test manifest — `test_stack_type` auto-detected).
- **Prerequisites met:** story has 5 clear ACs, `ready-for-dev`; `playwright.config.ts` configured (auto-starts `next dev`, `reuseExistingServer` outside CI); dev environment available; DB re-seeded (`npm run db:seed`) before running.
- **No isolable pure-logic unit exists for this story** (unlike Story 7.1's Zod-schema case) — this is a Tailwind token layer plus JSX/markup changes to `Navbar.tsx` and `ProductCard.tsx`. All genuinely new, isolable-and-testable-before-implementation behavior is DOM-level, so this pass targets Playwright, not Vitest.
- **Execution mode:** sequential, no subagent dispatch — matches this project's established ATDD precedent (Stories 6.1/7.1) over the generic skill template's subagent-dispatch default: real, executed red-phase tests applied directly to the repo's existing spec files, not JSON scaffolds to `/tmp`.

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear; no browser recording (`tea_browser_automation` resolves to `none` in this environment, same as every prior story).

## Step 3: Test Strategy

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| header-cart-pill (Task 2) | Cart link's accessible name is an explicit `"Cart, N items"` aria-label, not just its visible text | E2E (Playwright) | P1 |

**Not automated at this level (deferred to `dev-story`, per the story's own regression-check task):**
- The 3 named regression tests (`tests/sms.spec.ts:26`, `tests/payment.spec.ts:41`, `tests/homepage.spec.ts:14`) that already locate the cart link via `getByRole("link", { name: "Cart"/... })` — these rely on Playwright's substring-matching default and are expected to keep passing once the new aria-label is added (since `"Cart, N items"` still contains `"Cart"` as a substring), but must be run and confirmed, not assumed, once `dev-story` lands the change. This pass does not pre-emptively touch them since they aren't currently red and touching them without the implementation in hand risks masking a real break.
- Icon set, focus-ring utility, token layer itself — pure visual/CSS, not meaningfully expressible as a DOM assertion ahead of implementation.

## Step 4: Red-Phase Test Generation

TDD Red Phase Validation: **PASS** — applied to the real repo and independently executed via `npx playwright test tests/homepage.spec.ts`; true red confirmed for the new aria-label case (element not found — `Navbar.tsx` currently has no `aria-label` on the cart link at all), the other 2 pre-existing tests in the file stayed green.

- **Test added, applied now:** `tests/homepage.spec.ts` — new case `"cart link has an explicit item-count aria-label (Story 8.1)"`, asserting `page.getByRole("link", { name: /^cart, \d+ items?$/i })` is visible on the homepage with an empty cart.
- **Confirmed red for the correct reason:** ran in isolation (`npx playwright test tests/homepage.spec.ts`) — 1 failed (new case, "element(s) not found"), 2 passed (pre-existing cases, unaffected).

Acceptance criteria coverage (this pass's scope): the header-cart-pill's new `aria-label` contract (Task 2) is under real, executed red-phase test. Everything else in this story (token layer, icon SVGs, focus-ring, badge-at-zero visual) is presentation with no clean DOM assertion available ahead of implementation — left to `dev-story`'s own regression-check task, already fully named in the story file.

## Next Steps (Task-by-Task Activation)

1. Task 2 (Navbar cart-pill restyle: add `aria-label="Cart, {count} items"`, `aria-hidden` icon, badge shown at 0) → re-run `npx playwright test tests/homepage.spec.ts` directly; the new aria-label case should flip to green with no test-file changes needed.
2. Regression check (already in story's own Task list) → run `tests/sms.spec.ts`, `tests/payment.spec.ts`, `tests/homepage.spec.ts` in full — confirm the 3 named cart-link locators still resolve against the new `"Cart, N items"` accessible name.
3. Remaining tasks (token layer, icon set, focus-ring) → no additional Playwright coverage needed per this story's own Testing Standards Summary; visual-only.

## Implementation Guidance

Modified: `tests/homepage.spec.ts` (already applied by this ATDD pass — implement against it, do not recreate). Still to come, per the story's own Tasks/Subtasks — not touched by this ATDD pass: `tailwind.config.ts`, `src/components/Navbar.tsx`, `src/components/ProductCard.tsx`, new icon-line SVG components, `src/app/globals.css` (focus-ring utility). Full contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/8-1-design-token-foundation-and-shared-components.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] Test file modified and applied to the real repo (not draft-only)
- [x] Checklist matches acceptance criteria in scope (header-cart-pill aria-label covered; token/icon/focus-ring visual work explicitly out of scope for DOM-level testing)
- [x] Tests generated and independently executed — true red confirmed, correct reason, zero other tests broken
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened (`tea_browser_automation` resolved to `none`); DB re-seeded before running per project convention
- [x] Temp artifacts: none. Durable artifacts: this checklist plus the modified `tests/homepage.spec.ts`

**Completion summary:**

- **Test files created/modified:** `tests/homepage.spec.ts` (modified, +1 case, 1 red).
- **Checklist output path:** `_bmad-output/test-artifacts/atdd-checklist-8-1-design-token-foundation-and-shared-components.md`.
- **Story handoff:** `_bmad-output/implementation-artifacts/8-1-design-token-foundation-and-shared-components.md`, status `ready-for-dev`.
- **Key risk:** low — the deliberate badge-at-zero behavior change (flagged in the story's own Dev Notes) has no dedicated red-phase test here since "badge visible when count is 0" isn't independently distinguishable from "badge visible when count > 0" without also implementing the count logic; `dev-story` should self-verify visually.
- **Next recommended workflow:** `dev-story` (this story first — 8.2–8.5 depend on it).
