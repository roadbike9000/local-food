---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-31'
storyId: '8.5'
storyKey: '8-5-checkout-success-redesign'
storyFile: '_bmad-output/implementation-artifacts/8-5-checkout-success-redesign.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-8-5-checkout-success-redesign.md'
generatedTestFiles: []
inputDocuments:
  - '_bmad-output/implementation-artifacts/8-5-checkout-success-redesign.md'
  - 'src/app/checkout/success/page.tsx'
  - 'tests/payment.spec.ts'
---

# ATDD Checklist: Story 8.5 — Checkout-success redesign

## Step 1: Preflight & Context

- **Detected stack:** frontend (Next.js App Router + Playwright).
- **Prerequisites met:** story has 3 clear ACs, `ready-for-dev`; depends on Story 8.1 (checkmark icon, squiggle-divider, focus-ring).
- **No new behavior in this story at all** — confirmed by the story file's own framing ("smallest, lowest-risk story in the epic") and by AC #1's own assertion that `tests/payment.spec.ts` already covers the heading/body text and must keep passing *unmodified*. This is a pure visual restyle: `confirm-card` panel, `check-badge`, squiggle flourish, `button-pill-primary` link — none of it changes what the page renders semantically (heading text, body text, link href) or does functionally (still zero API calls, zero state).
- **Execution mode:** sequential, no subagent dispatch.

## Step 2: Generation Mode

**Mode: N/A this pass** — no new-behavior scenario exists.

## Step 3: Test Strategy

| AC | Scenario | Test Level | Priority | Status |
| --- | --- | --- | --- | --- |
| 1 | Heading contains "Thank you", body contains "we'll text you when it's ready for pickup" | E2E (Playwright) | P0 | Already covered, already green — `tests/payment.spec.ts`, unmodified |
| 3 | "Back to vendors" link keeps `href="/"` | E2E (Playwright) | P2 | Already true today — regression guard only |

**Nothing to add.** This story's entire test obligation is "don't break `tests/payment.spec.ts`" — already stated as an explicit AC, not something ATDD needs to scaffold new coverage for.

## Step 4: Red-Phase Test Generation

**N/A — no red-phase test generated this pass.** No behavior in this story is expected-but-not-yet-true; it is 100% presentation of already-correct, already-tested content.

## Next Steps (Task-by-Task Activation)

1. Task 1/2 (confirm-card, check-badge, squiggle flourish, button-pill-primary restyle) → implement.
2. Task 3 (already specified in the story file) → run `tests/payment.spec.ts` after the restyle — it should pass unmodified, since it navigates to `/checkout/success` directly and asserts only text content, not markup structure. A failure here means the heading/body text was accidentally altered, not a missing-feature red.

## Implementation Guidance

No test files modified by this ATDD pass. Per the story's own Tasks/Subtasks: `src/app/checkout/success/page.tsx` only. Full contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/8-5-checkout-success-redesign.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] N/A test files — no new behavior exists to scaffold, documented not silently skipped
- [x] Checklist matches acceptance criteria in scope (all 3 ACs assessed; none describe new behavior)
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened; no dev server changes needed this pass
- [x] Temp artifacts: none. Durable artifacts: this checklist only

**Completion summary:**

- **Test files created/modified:** none this pass.
- **Checklist output path:** `_bmad-output/test-artifacts/atdd-checklist-8-5-checkout-success-redesign.md`.
- **Story handoff:** `_bmad-output/implementation-artifacts/8-5-checkout-success-redesign.md`, status `ready-for-dev`.
- **Key risk:** none — lowest-risk story in the epic, confirmed by both the story author and this ATDD pass independently.
- **Next recommended workflow:** `dev-story`.
