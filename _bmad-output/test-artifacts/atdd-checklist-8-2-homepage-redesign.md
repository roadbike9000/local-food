---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-31'
storyId: '8.2'
storyKey: '8-2-homepage-redesign'
storyFile: '_bmad-output/implementation-artifacts/8-2-homepage-redesign.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-2-homepage-redesign.md'
generatedTestFiles: []
inputDocuments:
  - '_bmad-output/implementation-artifacts/8-2-homepage-redesign.md'
  - 'src/app/page.tsx'
  - 'src/components/VendorCard.tsx'
  - 'tests/homepage.spec.ts'
---

# ATDD Checklist: Story 8.2 — Homepage redesign

## Step 1: Preflight & Context

- **Detected stack:** frontend (Next.js App Router + Playwright).
- **Prerequisites met:** story has 4 clear ACs, `ready-for-dev`; depends on Story 8.1 (token layer, focus-ring, icon set).
- **Deliberate scoping decision, not an omission: no new red-phase test scaffolded this pass.** Read `src/components/VendorCard.tsx` and `src/app/page.tsx` in full — the whole-card-is-a-link pattern (AC #1), the absence of any nested `<button>` (AC #2), and the zero-vendors/deactivated-vendor exclusions (AC #4) are **already true today**, before this story ships. A red-phase test asserts *expected-but-not-yet-true* behavior; none of this story's ACs describe behavior that is false in the current codebase — they describe a visual restyle of behavior that already exists and must not regress. Writing a test that already passes against current code is not ATDD red phase, it's just regression coverage, which the story's own Task 3 already specifies in full (exact-focusable-element-count assertion, navigation-still-works assertion).
- **Execution mode:** sequential, no subagent dispatch.

## Step 2: Generation Mode

**Mode: N/A this pass** — no new-behavior scenario exists to generate against; see scoping decision above.

## Step 3: Test Strategy

| AC | Scenario | Test Level | Priority | Status |
| --- | --- | --- | --- | --- |
| 1, 2 | Whole card is exactly one focusable element (the outer `<Link>`), no nested button/role="button" | E2E (Playwright) | P1 | Already true today — regression guard, not red-phase; see Task 3 |
| 3 | Keyboard `Tab` reaches a card, `Enter` navigates | E2E (Playwright) | P2 | Already true today — regression guard, not red-phase |
| 4 | Zero-vendors empty state, deactivated-vendor exclusion | E2E (Playwright) | P2 | Already true today (pre-Epic-8 behavior) — no new test needed per story's own Task 3 |

**All coverage for this story is regression-preservation, already fully enumerated in the story's own Task 3** — not deferred due to a missing dependency (unlike Story 7.1's DB/UI-dependent split), but because there is no true "before" state to prove red against.

## Step 4: Red-Phase Test Generation

**N/A — no red-phase test generated this pass.** Confirmed by inspection (not assumption): read `VendorCard.tsx` (26 lines) and `src/app/page.tsx` (42 lines) in full; the single-`<Link>`-wrapping-whole-card structure, absence of a nested interactive element, and the Prisma `where: { deletedAt: null }` exclusion are all present in the code today. This story is a pure visual restyle of already-correct behavior.

## Next Steps (Task-by-Task Activation)

1. Task 1/2 (page shell + `VendorCard.tsx` restyle) → implement per `DESIGN.md`'s `vendor-card` component; no test-file changes needed until Task 3.
2. Task 3 (tests, already specified in the story file) → extend `tests/homepage.spec.ts` with: accessible-name-still-resolves-and-navigates assertion, exactly-one-focusable-element-per-card assertion, keyboard-Tab-then-Enter assertion. Run these as real regression proof once the restyle lands — they should pass immediately (same reasoning as Story 6.1's already-implemented-feature red-phase precedent: a red result here means a real regression, not a missing feature).

## Implementation Guidance

No test files modified by this ATDD pass. Per the story's own Tasks/Subtasks: `src/app/page.tsx`, `src/components/VendorCard.tsx`, `tests/homepage.spec.ts` (dev-story's own responsibility, Task 3). Full contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/8-2-homepage-redesign.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] N/A test files — scoping decision documented, not silently skipped
- [x] Checklist matches acceptance criteria in scope (all 4 ACs assessed; none describe currently-false behavior)
- [x] Real code inspected, not assumed — `VendorCard.tsx` and `src/app/page.tsx` read in full
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened; no dev server changes needed this pass
- [x] Temp artifacts: none. Durable artifacts: this checklist only

**Completion summary:**

- **Test files created/modified:** none this pass — see scoping decision.
- **Checklist output path:** `_bmad-output/test-artifacts/atdd-checklist-8-2-homepage-redesign.md`.
- **Story handoff:** `_bmad-output/implementation-artifacts/8-2-homepage-redesign.md`, status `ready-for-dev`.
- **Key risk:** none elevated — this is the lowest-risk story in the epic behaviorally (pure restyle of already-correct interaction); the risk surface is visual/design fidelity, not testable via DOM assertions.
- **Next recommended workflow:** `dev-story`.
