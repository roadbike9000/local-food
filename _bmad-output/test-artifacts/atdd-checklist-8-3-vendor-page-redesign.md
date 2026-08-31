---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-31'
storyId: '8.3'
storyKey: '8-3-vendor-page-redesign'
storyFile: '_bmad-output/implementation-artifacts/8-3-vendor-page-redesign.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-3-vendor-page-redesign.md'
generatedTestFiles:
  - 'tests/storefront-cart.spec.ts'
inputDocuments:
  - '_bmad-output/implementation-artifacts/8-3-vendor-page-redesign.md'
  - 'src/components/ProductCard.tsx'
  - 'tests/storefront-cart.spec.ts'
---

# ATDD Checklist: Story 8.3 — Vendor page redesign

## Step 1: Preflight & Context

- **Detected stack:** frontend (Next.js App Router + Playwright).
- **Prerequisites met:** story has 5 clear ACs, `ready-for-dev`; DB re-seeded before running.
- **The one genuinely new-behavior AC in this story is AC #2's badge-copy change** ("Out of stock" → "Sold Out") — everything else (hero photo, pickup-banner restyle, circular-thumb, deactivated-vendor typography, focus-ring) is visual restyle of already-correct behavior, same reasoning as Story 8.2's scoping.
- **Real regression risk found and fixed during this pass, not just reasoned about:** the story's own Dev Notes flagged that `tests/storefront-cart.spec.ts`'s existing sold-out test at line ~95 asserts the *old* copy (`/out of stock/i`) and would break once the copy changes. Updating that assertion to `/sold out/i` **surfaced a second, previously-undocumented risk**: the test's own fixture product is named `"Playwright Sold Out Product"` — a text collision that made the updated assertion pass for the wrong reason (matching the product's own heading text via `card.getByText()`'s broad scope, not the badge). Fixed by renaming the fixture to `"Playwright Zero-Stock Product"` (no other test references the old name). This is exactly the kind of false-positive ATDD's "confirm true red, don't assume" discipline exists to catch.
- **Execution mode:** sequential, no subagent dispatch.

## Step 2: Generation Mode

**Mode: AI Generation.** AC is clear and scoped to a single copy change; no browser recording needed.

## Step 3: Test Strategy

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 2 | Out-of-stock badge reads "Sold Out" (not "Out of stock") | E2E (Playwright) | P1 |

**Not automated at this level (deferred to `dev-story`, per the story's own Task 3):**
- AC #3's DOM-depth preservation for `productHeading.locator("../..")` — this is a structural constraint on *how* the restyle is implemented, not independently expressible as a red-phase assertion; verified by the existing sold-out test continuing to resolve its `card` locator correctly once the badge text is real.
- AC #1 (hero/pickup-banner/circular-thumb restyle), AC #4 (deactivated-vendor typography), AC #5 (focus-ring) — pure visual, no clean DOM assertion ahead of implementation.

## Step 4: Red-Phase Test Generation

TDD Red Phase Validation: **PASS** — applied to the real repo and independently executed via `npx playwright test tests/storefront-cart.spec.ts -g "out-of-stock products show a badge"`; true red confirmed for the correct reason (badge element not found matching `/sold out/i` — current markup still says "Out of stock"), after first catching and fixing a false-positive caused by a fixture-name text collision (see Step 1).

- **Test modified, applied now:** `tests/storefront-cart.spec.ts` — the existing case `"out-of-stock products show a badge and a disabled Add button"` (line ~66): assertion changed from `card.getByText(/out of stock/i)` to `card.getByText(/sold out/i)`; fixture product renamed from `"Playwright Sold Out Product"` to `"Playwright Zero-Stock Product"` to remove the text collision.
- **Confirmed red for the correct reason:** ran in isolation twice — first run (before the rename) produced a false *pass* (matched the fixture's own heading text, not the badge); second run (after the rename) produced a true, correctly-reasoned *fail*. Full-file run (`tests/storefront-cart.spec.ts` + `tests/homepage.spec.ts`, 19 tests) confirmed exactly 2 reds (this one plus Story 8.1's), 17 green — no other test broken by the rename.

Acceptance criteria coverage (this pass's scope): AC #2's badge-copy contract is under real, executed red-phase test, with a genuine test-quality bug caught and fixed in the process — not just reasoned about.

## Next Steps (Task-by-Task Activation)

1. Task 2 (`ProductCard.tsx`: change badge text "Out of stock" → "Sold Out", `badge-negative` styling) → re-run `npx playwright test tests/storefront-cart.spec.ts -g "out-of-stock products show a badge"` directly; should flip to green with no further test-file changes needed.
2. Task 1/2 (hero, pickup-banner, circular-thumb, DOM-shape preservation for AC #3) → run the full `tests/storefront-cart.spec.ts` file (11 test cases hit this page) after the restyle; confirm the `productHeading.locator("../..")` traversal still resolves — if `ProductCard.tsx`'s outer-row structure changes shape, update that locator and its comment in the same commit, per AC #3.
3. Task 1 (deactivated-vendor typography) → no test-file changes needed; existing Story 2.3 coverage (`tests/storefront-cart.spec.ts:430`) already exercises this branch and is unaffected by typography-only changes.

## Implementation Guidance

Modified: `tests/storefront-cart.spec.ts` (already applied by this ATDD pass — implement against it, do not recreate; note the fixture rename when reading the test). Still to come, per the story's own Tasks/Subtasks: `src/app/vendors/[slug]/page.tsx`, `src/components/ProductCard.tsx`. Full contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/8-3-vendor-page-redesign.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] Test file modified and applied to the real repo (not draft-only)
- [x] Checklist matches acceptance criteria in scope (AC #2 covered by real red-phase test; AC #1/#3/#4/#5 explicitly deferred with a concrete plan)
- [x] Tests generated and independently executed — true red confirmed, correct reason confirmed only after catching and fixing a fixture-name collision; full-file regression run confirmed exactly 2 expected reds, 17 green
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened; DB re-seeded before running
- [x] Temp artifacts: none. Durable artifacts: this checklist plus the modified `tests/storefront-cart.spec.ts`

**Completion summary:**

- **Test files created/modified:** `tests/storefront-cart.spec.ts` (modified: 1 assertion changed, 1 fixture renamed, 1 red).
- **Checklist output path:** `_bmad-output/test-artifacts/atdd-checklist-8-3-vendor-page-redesign.md`.
- **Story handoff:** `_bmad-output/implementation-artifacts/8-3-vendor-page-redesign.md`, status `ready-for-dev`.
- **Key risk:** the AC #3 DOM-depth constraint (`.locator("../..")`) remains a live risk *during* implementation, not eliminated by this pass — `dev-story` must actively verify it, not just avoid touching it.
- **Next recommended workflow:** `dev-story`.
