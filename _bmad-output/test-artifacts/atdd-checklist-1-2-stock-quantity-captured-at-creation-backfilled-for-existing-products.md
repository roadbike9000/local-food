---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate', 'step-05-validate-and-complete']
generatedTestFiles:
  - 'src/app/api/products/schema.test.ts'
  - 'src/app/api/products/[id]/schema.test.ts'
  - 'tests/products-api.spec.ts'
  - 'tests/dashboard.spec.ts'
lastStep: 'step-01-preflight-and-context'
lastSaved: '2026-08-18'
storyId: '1.2'
storyKey: '1-2-stock-quantity-captured-at-creation-backfilled-for-existing-products'
storyFile: '_bmad-output/implementation-artifacts/1-2-stock-quantity-captured-at-creation-backfilled-for-existing-products.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-1-2-stock-quantity-captured-at-creation-backfilled-for-existing-products.md'
generatedTestFiles: []
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/selector-resilience.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-healing-patterns.md'
  - 'src/app/api/products/route.ts'
  - 'src/app/api/products/schema.ts'
  - 'src/components/dashboard/AddProductForm.tsx'
  - 'src/app/dashboard/products/page.tsx'
  - 'prisma/schema.prisma'
  - 'prisma/seed.ts'
---

# ATDD Checklist: Story 1.2 — Stock Quantity captured at creation, backfilled, editable

## Step 1: Preflight & Context

- **Detected stack:** frontend (unchanged from Story 1.1's run)
- **Framework:** Playwright (E2E) + Vitest (schema unit tests) — this story needs both, unlike 1.1 which was E2E-only
- **Prerequisites met:** story has clear ACs (5), Playwright/Vitest configured, dev server startable
- **Story is genuinely net-new** (unlike 1.1's verification-only shape): new Prisma columns, new `src/lib/inventory.ts`, new `PATCH /api/products/[id]` route + schema, extended `AddProductForm`, new `EditStockControl` component
- **Previous story (1.1) learnings carried forward:**
  - Assertions must actually exercise the logic under test, not a degenerate case that passes trivially — Story 1.1's review caught a total-assertion that couldn't detect a dropped quantity multiplier because every test line had qty 1. For this story: schema-validation tests must use genuinely invalid values per case (not just "missing"), and any numeric assertion should use non-trivial numbers.
  - Match real formatting/output exactly (e.g. `Intl.NumberFormat`) rather than reimplementing string formatting by hand.
  - Reuse existing seed data / helpers (`getVendorBySlug`) rather than hardcoding.
- **Knowledge fragments loaded:** test-quality, selector-resilience, data-factories, test-healing-patterns (same core set as Story 1.1). This story's API surface is real (unlike 1.1) — the API red-phase worker will additionally draw on `api-request`/`data-factories`/`api-testing-patterns` per its own subagent instructions.

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear, scenarios are standard (schema validation, CRUD-style PATCH endpoint, form submission). No recording needed — no ambiguous UI, and this story's UI (a small inline edit control) is fully specified in the story's Dev Notes/Tasks already.

## Step 3: Test Strategy

AC to scenario mapping:

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 1 | `CreateProductSchema` rejects missing/negative/non-integer `stockQuantity`/`lowStockThreshold`, accepts valid | Unit (Vitest) | P0 |
| 2, 3 | Migration backfill correctness | **Not automated** — per the story's own Dev Notes, the dev/test DB has no real pre-existing mixed-`isAvailable` data to migrate against (`db:seed` always gives fresh explicit values). Verified by direct SQL review, not a test. | N/A |
| 4, 5 | `PATCH /api/products/[id]` — success (200), ownership scoping (404 for a product that isn't the caller's), validation (400), optimistic-lock conflict (409 when `expectedStockQuantity` is stale) | API (Playwright `request` fixture) | P0 |
| 4, 5 | `UpdateProductStockSchema` rejects missing/negative/non-integer, accepts valid | Unit (Vitest) | P1 |
| 4, 5 | Vendor edits Stock Quantity via the inline control on `/dashboard/products`, sees the updated value | E2E (Playwright, authenticated) | P1 |

**Ownership scoping and the conflict case are P0, not P1** — this codebase's own documented discipline (`project-context.md`) treats cross-vendor data leaks as a top-tier risk, and a broken optimistic lock (AD-3) is exactly the silent-clobber race the architecture spine exists to prevent. Both get real coverage, not an afterthought.

**Known environment limitation carried into this run:** the E2E scenario needs the authenticated vendor fixture, which is currently blocked (stale Clerk session, tracked in `deferred-work.md` since Story 1.1's review). The red-phase scaffold is still generated — ATDD scaffolds exist independent of whether the environment can run them today — but it won't be activatable until that separate issue is resolved.

**Red-phase note:** unlike Story 1.1 (verification-only, atypical "expected green" red phase), this story is genuinely new work — every scenario above is a normal TDD red phase. The scaffolds are expected to **fail** until `dev-story` implements the schema fields, the new module, the new route, and the new UI.

## Step 4: Red-Phase Test Generation (Aggregated)

TDD Red Phase Validation: PASS — all 23 new tests use `test.skip()`/`it.skip()`, assert real expected behavior (no placeholders), `expected_to_fail: true`.

- **Unit tests (Vitest):** 18 — 8 for `CreateProductSchema`'s new fields (`src/app/api/products/schema.test.ts`, extending the existing file), 10 for the new `UpdateProductStockSchema` (`src/app/api/products/[id]/schema.test.ts`, new file — genuinely fails to import today, that's the red phase for this file)
- **API tests (Playwright `request` fixture):** 4 — `tests/products-api.spec.ts` (new file), covering `PATCH /api/products/[id]` success, ownership-scoping 404, validation 400, and the AD-3 optimistic-lock 409 conflict
- **E2E tests (Playwright `page` fixture):** 1 — added to the existing `tests/dashboard.spec.ts`, inline-edit-and-see-updated-value
- **Fixture needs tracked, not built:** `tests/helpers/db.ts`'s `createTestProduct` needs `stockQuantity`/`lowStockThreshold` override support once the Prisma columns exist (Task 1) — both new test files work around this today with local overrides / `as any` casts, exactly as expected before the migration lands
- **Execution mode:** SUBAGENT (API + E2E dispatched in parallel via Agent tool)

**Note on subagent file-writing:** the API-test subagent (4A) wrote its three files directly to the repo rather than only to its JSON output — verified no divergence between the JSON `content` fields and what's on disk, and confirmed via `git diff`/`npx tsc --noEmit` that nothing beyond the intended red-phase scaffolding changed. The E2E subagent (4B) followed the intended pattern (JSON + scratch copy only); its test was inserted into `tests/dashboard.spec.ts` during this aggregation step.

**Verified before finalizing:**
- `npx tsc --noEmit` — exactly one new error (`Cannot find module './schema'` in the new `[id]/schema.test.ts`), which *is* this file's correct red-phase signal. No other stray type errors.
- `npx vitest run src/app/api/products/schema.test.ts` — 6 existing tests still pass (the `validBody` fix didn't break anything), 8 new tests correctly skipped.
- `npx vitest run "src/app/api/products/[id]/schema.test.ts"` — fails to load (module doesn't exist), matching its own header comment exactly.
- `npx playwright test tests/products-api.spec.ts tests/dashboard.spec.ts --list` — all 20 tests in both files parse and list correctly, including the 5 new red-phase ones.

Acceptance criteria coverage:
- AC1 (creation requires both fields): covered (unit)
- AC2, AC3 (backfill correctness, placeholder-as-sentinel): **not automated** — per this story's own Dev Notes, no automated test can meaningfully exercise the backfill path in this environment (verified by SQL review instead)
- AC4, AC5 (editable via inline control, `setStock()`'s conditional-update contract): covered (API + E2E)

## Next Steps (Task-by-Task Activation)

During `dev-story`, activate scaffolds task-by-task as each is implemented, not all at once:
1. Task 1 (migration) lands → Task 4 (`CreateProductSchema`) → un-skip the 8 `stockQuantity`/`lowStockThreshold` cases in `src/app/api/products/schema.test.ts`
2. Task 3 (`src/lib/inventory.ts`) + Task 5 (PATCH route) land → un-skip `src/app/api/products/[id]/schema.test.ts`'s 10 cases and `tests/products-api.spec.ts`'s 4 cases
3. Task 6 (`EditStockControl` + table columns) lands → un-skip `tests/dashboard.spec.ts`'s new inline-edit test — but expect to need real selector adjustments here (the ATDD scaffold's selectors were written from best practices, not a live snapshot, per this run's `tea_browser_automation: none` limitation)
4. Task 2 (seed data) and Task 7 (existing test fixes) are prerequisites the other tasks assume are already done, not separately-activated red-phase tests
5. Run each activated test, confirm it fails first (true red), then implement until green
6. E2E activation for `tests/products-api.spec.ts` and the `dashboard.spec.ts` addition is still blocked by the separately-tracked stale-auth-fixture issue (`deferred-work.md`) — the Vitest unit tests (18 of the 23) are unaffected and can be activated/verified regardless

## Implementation Guidance

New: `src/lib/inventory.ts`, `src/app/api/products/[id]/route.ts` + `schema.ts`, `src/components/dashboard/EditStockControl.tsx`. Modified: `prisma/schema.prisma` (+ migration), `prisma/seed.ts`, `src/app/api/products/schema.ts`, `src/components/dashboard/AddProductForm.tsx`, `src/app/dashboard/products/page.tsx`, `tests/dashboard.spec.ts` (two existing tests need required-field fills added, per Task 7).

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] Test files created correctly (`tsc`, `vitest`, `playwright --list` all confirm expected state)
- [x] Checklist matches acceptance criteria (AC1, AC4, AC5 covered; AC2/AC3 correctly marked not-automatable)
- [x] Tests generated as red-phase scaffolds, marked `test.skip()`/`it.skip()`
- [x] Story metadata and handoff paths captured
- [x] No CLI sessions opened (browser automation resolved to `none`)
- [x] Temp artifacts in scratchpad; durable artifacts in `_bmad-output/test-artifacts/`, `src/`, `tests/`

**Completion summary:**
- Test files: `src/app/api/products/schema.test.ts` (extended), `src/app/api/products/[id]/schema.test.ts` (new), `tests/products-api.spec.ts` (new), `tests/dashboard.spec.ts` (extended) — 23 red-phase tests total
- Checklist: this file
- Story: `_bmad-output/implementation-artifacts/1-2-stock-quantity-captured-at-creation-backfilled-for-existing-products.md`
- Next recommended workflow: `dev-story`
