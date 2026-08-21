---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate', 'step-05-validate-and-complete']
generatedTestFiles:
  - 'tests/storefront-cart.spec.ts'
lastStep: 'step-01-preflight-and-context'
lastSaved: '2026-08-18'
storyId: '1.1'
storyKey: '1-1-verify-cart-line-removal-and-total-accuracy'
storyFile: '_bmad-output/implementation-artifacts/1-1-verify-cart-line-removal-and-total-accuracy.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-1-1-verify-cart-line-removal-and-total-accuracy.md'
generatedTestFiles: []
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/prds/prd-local-food-2026-08-10/prd.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/selector-resilience.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-healing-patterns.md'
  - 'tests/storefront-cart.spec.ts'
  - 'tests/helpers/db.ts'
  - 'src/components/CartProvider.tsx'
  - 'src/app/cart/page.tsx'
---

# ATDD Checklist: Story 1.1 — Verify cart line removal and total accuracy

## Step 1: Preflight & Context

- **Detected stack:** frontend (Next.js 14 + Playwright; no backend-only manifests present)
- **Framework:** Playwright (`playwright.config.ts`, `testDir: "./tests"`, `webServer` auto-starts `npm run dev`)
- **Existing pattern file:** `tests/storefront-cart.spec.ts` — flat e2e specs, `page.getByRole`/`getByText` locators, seeded vendor `corner-sourdough`, `tests/helpers/db.ts` for DB access/cleanup
- **Prerequisites met:** story has clear ACs (3), Playwright configured, dev server startable — no HALT conditions triggered
- **Knowledge fragments loaded (scoped to what this story actually needs):** test-quality (determinism/isolation/explicit-assertions bar), selector-resilience (data-testid > ARIA > text > CSS hierarchy, `filter()` over `.first()`/`.nth()` for ambiguous lists), data-factories (fetch real seed data via existing helpers rather than hardcoding), test-healing-patterns (failure-signature catalog for later automate/healing passes)
- **Skipped fragments (not relevant to this story):** webhook-*, pact/contract-testing, component-tdd, auth-session, network-recorder, api-request — this story has no webhooks, no API mocking, no component-level isolation, no auth flow
- **Previous story:** none (Story 1.1 is first in Epic 1)

## Step 2: Generation Mode

**Mode: AI Generation** (not recording). Rationale: ACs are clear and standard (UI CRUD-style interaction on an already-fully-read implementation — `CartProvider.removeItem`, `totalCents`, `/cart` page markup). `detected_stack` is frontend, so recording was considered but skipped — no drag/drop, no wizard, no ambiguous multi-step state that would need live browser verification to pin down selectors. `tea_browser_automation` is `auto`, but simple recording isn't warranted here since source already gives exact element structure.

## Step 3: Test Strategy

AC to scenario mapping:

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 1 | Remove one of 2+ lines - line gone, total recalculates to remaining sum | E2E (Playwright) | P0 |
| 2 | Remove the last remaining line - cart shows empty state | E2E (Playwright) | P0 |
| 3 | (process constraint, not a runtime scenario - enforced by Task 2 in the story, not a test) | - | - |

One test, not two. ACs 1 and 2 are sequential states of a single user session (add 2, remove 1, assert partial total, remove the last one, assert empty), not independent scenarios - matches the story's own Task 1 breakdown and test-quality.md's "focused, not fragmented" guidance. Splitting into two tests would duplicate the add-2-items setup for no isolation benefit.

Test level: E2E only. Cart state is pure client-side React state (CartProvider) - no server round-trip to test at the API level, and this repo has no component-testing infra (Vitest is reserved for pure functions per project-context.md). E2E is the only level that actually exercises CartProvider + /cart page together.

Priority: P0. Money-adjacent - an incorrect cart total is a real financial-accuracy bug in a real-payments app, matching this codebase's existing "never trust client-sent prices" rigor at checkout.

Red-phase note (this story is atypical): standard ATDD red phase means "test fails because the feature doesn't exist yet." Here the feature is claimed already-implemented (FR-1), so the real red phase is narrower: the test doesn't exist until Step 4 writes it, and once written it is expected to go green on first run against the current CartProvider/cart page. An unexpected red result after that point means a real regression exists (per the story's Dev Notes: stop and report, don't patch around it) - that's the one legitimate red outcome this story's test can produce, not a normal TDD checkpoint to implement through.

## Step 4: Red-Phase Test Generation (Aggregated)

TDD Red Phase Validation: PASS - test uses test.skip(), asserts real expected behavior (not placeholders), expected_to_fail: true.

- API Tests: 0 (correct - no API endpoint exists for this story; verified by reading CartProvider.tsx, confirmed by subagent 4A)
- E2E Tests: 1 (RED, skipped) - written to tests/storefront-cart.spec.ts
- Fixtures created: 0 (none needed - test reads pre-seeded data via existing getVendorBySlug() helper, no new fixture, no DB mutation/cleanup)
- Execution mode: SUBAGENT (API + E2E dispatched in parallel via Agent tool)

Acceptance criteria coverage:
- AC1 (remove one of 2+ lines, total recalculates): covered
- AC2 (remove last line, cart shows empty state): covered
- AC3 (verification-only, no source changes): enforced by story Task 2, not a runtime test scenario

Test verified against real source before being written to disk: `ProductCard.tsx`'s DOM structure (heading/button sibling-div nesting resolves correctly through `.filter().filter().last()`), `<li>` cart lines (implicit listitem role), and `formatPrice`'s `Intl.NumberFormat` output (matches the test's `dollars()` helper for this seed data's price range). `npx tsc --noEmit` passes clean against the real file.

## Next Steps (Task-by-Task Activation)

During `dev-story` implementation of this story's Task 1/Task 2:

1. Remove `test.skip()` from the `[P0] removing cart lines recalculates the total and empties the cart` test in `tests/storefront-cart.spec.ts`
2. Run `npm run test:e2e`
3. **Expected result: green on first run** (not the usual red-then-green — see the red-phase note above, the feature already exists)
4. If it fails: that's a real regression in `CartProvider`/`cart/page.tsx` — stop and report per the story's own Dev Notes, do not silently patch around it
5. Commit the passing test

## Implementation Guidance

No new endpoints, no new UI components — this story is verification-only. The one task is activating and confirming the test above.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied (story with clear ACs, Playwright configured, dev server startable)
- [x] Test file created correctly (`tests/storefront-cart.spec.ts`, `tsc --noEmit` clean)
- [x] Checklist matches acceptance criteria (AC1, AC2 both covered; AC3 is a process constraint, not a test)
- [x] Test generated as red-phase scaffold, marked `test.skip()`
- [x] Story metadata and handoff paths captured (story file's new "ATDD Artifacts" subsection; this checklist's frontmatter)
- [x] No CLI sessions opened (browser automation resolved to `none` for this run — no orphaned sessions to clean up)
- [x] Temp artifacts stayed in the session scratchpad; durable artifacts landed in `_bmad-output/test-artifacts/` and `tests/`, not scattered

**Completion summary:**
- Test file created: `tests/storefront-cart.spec.ts` (1 new test, skipped)
- Checklist: `_bmad-output/test-artifacts/atdd-checklist-1-1-verify-cart-line-removal-and-total-accuracy.md` (this file)
- Story: `_bmad-output/implementation-artifacts/1-1-verify-cart-line-removal-and-total-accuracy.md`
- Key assumption: activating this test is expected to go straight to green (feature pre-exists) — an unexpected red result means a real regression, not a missing implementation
- Next recommended workflow: `dev-story` (activate the test, confirm green, commit)
