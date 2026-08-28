---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-28'
storyId: '7.1'
storyKey: '7-1-admin-sets-a-vendors-real-timezone'
storyFile: '_bmad-output/implementation-artifacts/7-1-admin-sets-a-vendors-real-timezone.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-7-1-admin-sets-a-vendors-real-timezone.md'
generatedTestFiles:
  - 'src/app/api/admin/vendors/schema.ts'
  - 'src/app/api/admin/vendors/schema.test.ts'
  - 'src/app/api/admin/vendors/[id]/schema.ts'
  - 'src/app/api/admin/vendors/[id]/schema.test.ts'
inputDocuments:
  - '_bmad-output/implementation-artifacts/7-1-admin-sets-a-vendors-real-timezone.md'
  - 'src/app/api/admin/vendors/route.ts'
  - 'src/app/api/admin/vendors/[id]/deactivate/route.ts'
  - 'src/lib/timezone.ts'
  - 'prisma/schema.prisma'
  - 'package.json'
  - 'playwright.config.ts'
  - 'vitest.config.mts'
---

# ATDD Checklist: Story 7.1 — Admin sets a vendor's real timezone

## Step 1: Preflight & Context

- **Detected stack:** fullstack (Next.js App Router frontend + API routes; Playwright and Vitest both configured) — same detection as every prior story in this project.
- **Framework:** Vitest for the two Zod schemas' `timezone` validation (Task 1/2) — the pieces genuinely testable in complete isolation, no DB dependency. Playwright for the DB/UI-dependent scenarios, deferred — see scoping decision below.
- **Prerequisites met:** story has 5 clear ACs, `ready-for-dev`; `playwright.config.ts`/`vitest.config.mts` configured; dev environment available.
- **Real prior art found and reused, not rebuilt:** `isValidTimeZone()` (`src/lib/timezone.ts`, Story 6.1) already exists and is the single source of truth for "is this a valid IANA identifier" — this ATDD pass's stubs deliberately do *not* reimplement that check inline; the red tests exist specifically to prove dev-story wires the existing helper in, not a new one. `src/app/api/admin/vendors/schema.test.ts`'s existing style (plain `describe`/`it`, `safeParse().success` assertions) was matched exactly for the new `CreateVendorSchema` cases, not reinvented.
- **Deliberate scoping decision, not an omission:** this pass scaffolds real, executed red-phase tests for both Zod schemas only (`CreateVendorSchema`'s new `timezone` field, and the brand-new `UpdateVendorSchema`) — the parts of this story genuinely testable in true isolation before any route/UI/DB work exists. Task 2's `PATCH /api/admin/vendors/[id]` route, Task 1/3's UI changes (`AddVendorForm.tsx`, the new admin edit control), and Task 4/5's DB-dependent API-level and end-to-end Playwright coverage are **not** scaffolded here — they depend on the route and UI existing, which is `dev-story`'s job, not ATDD's. This mirrors Story 6.1's ATDD precedent (scoped tightly to the one DB-independent module, `src/lib/timezone.ts`) and this story's own Task 4, which is explicitly framed as verification-after-implementation, not something expressible ahead of the route existing.
- **Stub design note:** each schema's `timezone` field is added with correct typing and trivial plumbing already working (default value for `CreateVendorSchema`, required-field enforcement for `UpdateVendorSchema`) — only the actual validation call (`isValidTimeZone()`) is left unimplemented. This differs slightly from Story 6.1's "throw not implemented" stub shape (which suited a pure function) — a Zod schema's *type* needs to exist correctly for `tsc --noEmit` to stay clean, so only the interesting, story-specific behavior (reusing the existing validator, per the story's own Dev Notes warning against reinventing it) is what's genuinely red. Confirmed by execution, not assumed: 2 of the 6 new test cases are red, the other 4 (typing/defaulting/required-field plumbing) already pass against the stub and serve as real regression coverage once implementation lands.
- **What `dev-story` still needs to scaffold itself, per the story file's own Task 5:** the API-level Playwright coverage for `PATCH /api/admin/vendors/[id]` (`tests/admin-vendors-api.spec.ts` or a new sibling), the UI-level Playwright coverage for both `AddVendorForm.tsx`'s new field and the new edit control (`tests/admin-vendors.spec.ts`), and the end-to-end AC #4 confirmation test (`tests/dashboard.spec.ts`) — all named explicitly in the story's Tasks/Subtasks, none silently dropped.
- **Execution mode:** sequential, no subagent dispatch.

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear; the scenario (reuse an existing, already-tested validator across two schemas) is well-understood, not exploratory. No recording — `tea_browser_automation` resolves to `none` in this environment, same as every prior story.

## Step 3: Test Strategy

AC to scenario mapping (this pass's scope only — see Step 1's scoping decision for what's deferred):

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 1 | `CreateVendorSchema` defaults `timezone` to `America/New_York` when omitted | Unit (Vitest) | P1 |
| 1 | `CreateVendorSchema` accepts and preserves a valid non-default IANA timezone | Unit (Vitest) | P1 |
| 1, 5 | `CreateVendorSchema` rejects a malformed/unrecognized timezone string | Unit (Vitest) | P0 |
| 2, 5 | `UpdateVendorSchema` accepts and preserves a valid IANA timezone | Unit (Vitest) | P1 |
| 2, 5 | `UpdateVendorSchema` rejects a malformed/unrecognized timezone string | Unit (Vitest) | P0 |
| 2 | `UpdateVendorSchema` rejects a missing `timezone` field | Unit (Vitest) | P1 |

**Not automated at this level (deferred to `dev-story`, per Step 1's scoping decision):**
- AC #1/#5's full create-flow (route + `AddVendorForm.tsx` UI) — needs `PATCH`/`POST` route wiring and the form's new field to exist; API-level and UI-level Playwright coverage per the story's own Task 5.
- AC #2/#3's edit flow (`PATCH /api/admin/vendors/[id]` route + admin UI edit affordance) — same reasoning; needs the route (Task 2) and UI (Task 3) to exist first.
- AC #4 (existing read-side machinery reflects an admin-driven edit with no separate propagation step) — explicitly framed in the story's own Task 4 as verification-by-testing after the write path exists, not something expressible ahead of it.

**Red phase independently executed, not just reasoned about:**
- `npx vitest run` (full suite): 127 passed, 2 failed — the 2 new "rejects a malformed timezone string" cases (one per schema) fail for the correct reason (nothing validates the value against `isValidTimeZone()` yet, confirmed by inspecting each failure's actual vs. expected output, not just the pass/fail count). The other 4 new cases already pass against the stubs' correct typing/defaulting/required-field plumbing — not test-authoring mistakes, a deliberate scoping consequence documented above.
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.

## Step 4: Red-Phase Test Generation

TDD Red Phase Validation: **PASS** — both new/modified files applied to the real repo and independently executed; true red confirmed for both malformed-timezone cases (via specific assertion-mismatch output, not an import/type error or a coincidental pass), zero other tests broken (127/127 prior + already-passing new cases stayed green).

- **Production stubs, applied now:**

  `src/app/api/admin/vendors/schema.ts` — `CreateVendorSchema` gains:
  ```ts
  timezone: z.string().default("America/New_York"),
  ```

  `src/app/api/admin/vendors/[id]/schema.ts` — new file:
  ```ts
  export const UpdateVendorSchema = z.object({
    timezone: z.string(),
  });
  ```

  Neither calls `isValidTimeZone()` yet — dev-story adds `.refine(isValidTimeZone, "Invalid timezone")` to both, per the story's own Dev Notes ("both the create-time schema and the edit-time schema must call it, not re-derive their own check").

- **Unit tests, applied now:**

  `src/app/api/admin/vendors/schema.test.ts` — 3 new cases appended to the existing `CreateVendorSchema` suite, matching its established style: defaults to `America/New_York` when omitted (passes today — trivial plumbing), accepts and preserves a valid non-default zone (passes today), rejects a malformed zone (**red today**).

  `src/app/api/admin/vendors/[id]/schema.test.ts` — new file, 3 cases for `UpdateVendorSchema`: accepts and preserves a valid zone (passes today), rejects a missing `timezone` field (passes today — Zod's built-in required-field enforcement, not story-specific logic), rejects a malformed zone (**red today** — pins the exact expected issue `path`/`message` the real refine must produce, not just a success/failure boolean, so this can't be satisfied by a different, wrong implementation later).

Acceptance criteria coverage (this pass's scope):
- AC1 (create-time field + validation): defaulting/passthrough covered and already green; the actual validation-reuse behavior is under real, executed red-phase test.
- AC2 (edit-time validation): same shape, `UpdateVendorSchema`'s malformed-rejection case is under real red-phase test.
- AC5 (malformed input rejected server-side, reusing `isValidTimeZone()`): both schemas' malformed-rejection tests are this AC's direct proof; both currently red for the correct reason.
- AC3, AC4: intentionally not scaffolded this pass — see Step 3's deferral list; each has a concrete plan, not a silent gap.

## Next Steps (Task-by-Task Activation)

1. Task 1 (add the real `.refine(isValidTimeZone, "Invalid timezone")` to `CreateVendorSchema`, thread through `route.ts` and `AddVendorForm.tsx`) → re-run `npx vitest run src/app/api/admin/vendors/schema.test.ts` directly; the malformed-timezone case should flip to green with no test-file changes needed.
2. Task 2 (implement `UpdateVendorSchema`'s real refine, build `PATCH /api/admin/vendors/[id]`) → re-run `npx vitest run src/app/api/admin/vendors/[id]/schema.test.ts`; the malformed-timezone case should flip to green. If it doesn't flip on a plausible-looking implementation, check the refine's error message matches `"Invalid timezone"` exactly — the test pins that string deliberately.
3. Task 3 (admin UI edit affordance) → build against the now-real `PATCH` route.
4. Task 4 (confirm read-side machinery) → write and run the deferred end-to-end Playwright test (Step 3's "not automated at this level" list) proving an admin-driven edit through the real route is reflected in the vendor dashboard's pickup-slot display with no separate step.
5. Task 5 → write the deferred API-level (`PATCH` route) and UI-level (`AddVendorForm`, edit control) Playwright coverage named in the story's own Tasks/Subtasks.

## Implementation Guidance

Modified: `src/app/api/admin/vendors/schema.ts`, `src/app/api/admin/vendors/schema.test.ts` (both already applied by this ATDD pass — implement the real refine, do not recreate). New: `src/app/api/admin/vendors/[id]/schema.ts`, `src/app/api/admin/vendors/[id]/schema.test.ts` (both already applied by this ATDD pass). Still to come, per the story's own Tasks/Subtasks — not touched by this ATDD pass: `src/app/api/admin/vendors/route.ts`, `src/app/api/admin/vendors/[id]/route.ts` (new), `src/components/admin/AddVendorForm.tsx`, `src/components/admin/EditVendorTimezoneControl.tsx` (new, or equivalent), `src/app/admin/vendors/page.tsx`, `tests/admin-vendors-api.spec.ts` or a new sibling, `tests/admin-vendors.spec.ts`, `tests/dashboard.spec.ts`, `docs/data-models.md`, `docs/api-contracts.md`. Full contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/7-1-admin-sets-a-vendors-real-timezone.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] Test files created and applied to the real repo (not draft-only); `tsc --noEmit` and lint clean
- [x] Checklist matches acceptance criteria in scope (AC1/AC2/AC5 covered by this pass; AC3/AC4 explicitly deferred with a concrete plan, not silently dropped)
- [x] Tests generated and independently executed — true red confirmed for both malformed-timezone cases, zero other tests broken (real, unskipped tests run via `npx vitest run`, matching Story 6.1's precedent of executed-not-skipped red-phase proof over the step file's literal `test.skip()` suggestion)
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened (`tea_browser_automation` resolved to `none`); no dev server or DB writes needed this pass — pure Vitest, no side effects to clean up
- [x] Temp artifacts: none. Durable artifacts: this checklist plus the two schema files (stubs) and their test files (6 cases, 2 red)

**Completion summary:**

- **Test files created/modified:** `src/app/api/admin/vendors/schema.ts` (modified), `src/app/api/admin/vendors/schema.test.ts` (modified, +3 cases), `src/app/api/admin/vendors/[id]/schema.ts` (new), `src/app/api/admin/vendors/[id]/schema.test.ts` (new, 3 cases).
- **Checklist output path:** `_bmad-output/test-artifacts/atdd-checklist-7-1-admin-sets-a-vendors-real-timezone.md`.
- **Story handoff:** `_bmad-output/implementation-artifacts/7-1-admin-sets-a-vendors-real-timezone.md`, status `ready-for-dev`.
- **Key risk:** none elevated — this story reuses already-reviewed, DST-hardened logic (`isValidTimeZone()`) rather than introducing new conversion math, unlike Story 6.1. The main thing to get right is wiring, not algorithm correctness.
- **Next recommended workflow:** `dev-story`.
