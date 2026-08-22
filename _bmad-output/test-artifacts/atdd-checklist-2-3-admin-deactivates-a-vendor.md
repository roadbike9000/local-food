---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-22'
storyId: '2.3'
storyKey: '2-3-admin-deactivates-a-vendor'
storyFile: '_bmad-output/implementation-artifacts/2-3-admin-deactivates-a-vendor.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-2-3-admin-deactivates-a-vendor.md'
generatedTestFiles:
  - 'tests/admin-deactivate-vendor.spec.ts'
  - 'tests/checkout-api.spec.ts'
  - 'tests/storefront-cart.spec.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md'
  - '_bmad-output/implementation-artifacts/2-2-admin-adds-a-vendor.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/selector-resilience.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-healing-patterns.md'
  - 'tests/admin-vendors-api.spec.ts'
  - 'tests/checkout-api.spec.ts'
  - 'tests/storefront-cart.spec.ts'
  - 'tests/helpers/db.ts'
  - 'src/lib/vendor.ts'
  - 'src/app/api/checkout/route.ts'
  - 'src/app/vendors/[slug]/page.tsx'
  - 'prisma/schema.prisma'
---

# ATDD Checklist: Story 2.3 — Admin deactivates a vendor

## Step 1: Preflight & Context

- **Detected stack:** frontend (unchanged from every prior run this project).
- **Framework:** Playwright only — no new Zod schema this story (the deactivate route takes no request body), so no new Vitest surface.
- **Prerequisites met:** story has clear ACs (4), `playwright.config.ts` configured, dev server startable.
- **Story builds on Stories 2.1/2.2's already-shipped infrastructure** — `getCurrentAdmin()`, the Admin/Vendor Playwright fixtures, and the exact three-identity test-file pattern (`tests/admin-vendors-api.spec.ts`) all already exist. This story adds the second consumer of that pattern.
- **Previous stories' learnings carried forward:**
  - `existsSync(authFile) ? authFile : undefined` in `test.use({ storageState })`, never a bare path — the Story 2.1 review-confirmed `ENOENT` fix, applied to every new authenticated block again here.
  - Two/three-identity files need independent skip guards per identity, never one shared guard.
  - Never touch the seeded `corner-sourdough`/`green-valley-produce` vendors for anything deactivation-related — every other test in the suite assumes both stay orderable. All three new/modified files use `createTestVendor()` (a throwaway fixture) instead.
  - `test.describe.configure({ mode: "serial" })` on every block sharing a Clerk session (clerk/javascript#7891).
- **Coordination note:** `createTestVendor()`/`deleteVendorBySlug()` were added to `tests/helpers/db.ts` by the orchestrator *before* dispatching either subagent this run (Story 2.2's ATDD run had two subagents independently add the same helper and collide — avoided here by building the shared dependency first).
- **Knowledge fragments loaded:** test-quality, selector-resilience, data-factories, test-healing-patterns (same core set as every prior run).

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear, scenarios are standard (admin action endpoint, idempotency, 401/404, a conditional-rendering branch on an existing page). No recording needed — no CLI/MCP browser tool available in this run (resolved to `none`, same as every prior story).

## Step 3: Test Strategy

AC to scenario mapping:

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 1 | `POST /api/admin/vendors/[id]/deactivate` — active vendor → 200, `deletedAt`/`deletedByAdminId` read-back verified | API (Playwright `request`) | P0 |
| 1 | Same route, already-deactivated vendor → 200, `deletedByAdminId` **unchanged** from the original deactivator (idempotency, not overwritten by a retry) | API | P0 |
| 1 | Same route, nonexistent vendor id → 404 | API | P0 |
| 1 | Same route, signed-in vendor (not admin) → 401 | API | P0 |
| 1 | Same route, fully unauthenticated → 401 | API | P0 |
| 2 | Storefront of a deactivated vendor → 200 (not 404), vendor name still renders, "no longer available" message shown, no product/pickup-slot listing | E2E (Playwright `page`) | P0 |
| 2 | Checkout against a deactivated vendor's product → 400, specific message, no `Order` row created | API | P0 |
| 3 | Existing orders' fulfillment lifecycle unaffected | **Not automated** — nothing in this story's own tasks touches any order-status/SMS code path; the claim is provable by inspection (the diff simply won't touch those files), same treatment Story 1.2 gave its own non-automatable backfill-correctness clause. | N/A |
| 4 | `onDelete: Restrict` on `Product`/`Order`'s `vendor` relation | **Not automated at this level** — a migration/schema-correctness concern, verified by reading the generated SQL at implementation time, not a scaffolded app-level test. | N/A |

**All five deactivate-route cases are P0, not staggered** — this codebase's own precedent (Story 2.2's review, and Story 1.2's original table) treats an admin-only mutation's authorization boundary as top-tier risk across every case, not just the happy path; the idempotency case is equally P0 because a wrong answer there means attribution (AD-5) silently lies about who deactivated a vendor.

**Known environment limitation, same class as every prior authenticated-test run:** the three admin-session cases in `tests/admin-deactivate-vendor.spec.ts` need `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID` (not yet configured in this dev environment). The vendor-session 401 case and the fully-unauthenticated case both have real credentials/no credentials needed already and can activate and run for real immediately. The checkout and storefront cases (public routes, no auth needed at all) can also run for real immediately once their respective Tasks land.

**Red-phase note:** every scenario above is genuinely new work (no pre-existing partial implementation to verify) — normal TDD red phase, expected to fail (missing route → connection/404, missing schema fields → TS errors, missing page branch → wrong content) until `dev-story` implements each task.

## Step 4: Red-Phase Test Generation (Aggregated)

TDD Red Phase Validation: **PASS** — all 6 new tests use `test.skip()`, assert real expected behavior (no placeholder assertions), `expected_to_fail: true`.

- **API tests (Playwright `request` fixture):** 5, all P0 — new file `tests/admin-deactivate-vendor.spec.ts` (deactivation success + read-back, idempotency, 404, vendor-401, unauthenticated-401), plus 1 more appended to the existing `tests/checkout-api.spec.ts` (checkout rejection for a deactivated vendor's product).
- **E2E tests (Playwright `page` fixture):** 1 — appended to the existing `tests/storefront-cart.spec.ts` (deactivated-vendor storefront message).
- **Fixture needs already built, not left for later:** `tests/helpers/db.ts`'s `createTestVendor(overrides)` was added by the orchestrator *before* dispatching subagents this run, specifically to avoid the coordination race Story 2.2's ATDD run hit (two subagents independently adding the same helper). Both subagents correctly used it rather than duplicating it.
- **Execution mode:** SUBAGENT (API and E2E generation dispatched in parallel via the Agent tool, same as Story 2.2's run).

**Verified independently by the orchestrator, not just trusted from subagent reports:**
- `npx tsc --noEmit` — exactly 5 new errors, all correct red-phase signals: 4 in `tests/admin-deactivate-vendor.spec.ts` (`Vendor.deletedAt`/`deletedByAdminId` don't exist yet — Task 1's migration hasn't landed) plus the 1 pre-existing one in `tests/helpers/db.ts`'s already-landed `createTestVendor` (same root cause, not something either subagent introduced). `tests/checkout-api.spec.ts`'s new test produced zero new errors of its own — it only calls `createTestVendor({ deletedAt: ... })`, whose parameter type already declares those fields as optional overrides.
- `npx playwright test tests/admin-deactivate-vendor.spec.ts tests/checkout-api.spec.ts tests/storefront-cart.spec.ts --list` — all 19 tests across the three files parse and list correctly (13 pre-existing + 6 new), nothing broken.
- Read all three files in full and cross-checked against the story's own Task 8 bullet list line by line — confirmed correct HTTP status codes (200/404/401/400 per Task 3/4/5's exact contracts), correct idempotency assertion shape (a *different* fake original-deactivator id, proving the real route doesn't reassign it), correct reuse of the established three-identity pattern, correct "never touch the seeded vendors" discipline in all three files, correct `existsSync ? file : undefined` storageState fix carried forward.

Acceptance criteria coverage:
- AC1 (deactivate sets `deletedAt`/`deletedByAdminId`, throws-based guard, idempotent): covered (5 API tests)
- AC2 (storefront message, checkout rejection): covered (1 E2E + 1 API test)
- AC3 (existing orders unaffected): **not automated** — provable by inspection (no order-lifecycle file appears in this story's own Task list)
- AC4 (`onDelete: Restrict`): **not automated at the app level** — verified by reading the migration SQL at implementation time

## Next Steps (Task-by-Task Activation)

During `dev-story`, activate scaffolds task-by-task as each is implemented, not all at once:

1. Task 1 (migration: `deletedAt`/`deletedByAdminId`, `onDelete: Restrict`) lands → the 5 type errors above resolve on their own (no test-file edit needed, just re-run `tsc`).
2. Task 2 (`assertVendorActive()`/`VendorDeactivatedError`) + Task 3 (deactivate route) land → un-skip `tests/admin-deactivate-vendor.spec.ts`'s 5 cases. The 2 non-admin-gated cases (vendor-401, unauthenticated-401) can run for real immediately; the 3 admin-gated ones will skip until `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID` are configured (same known gap as every prior admin-authenticated test in this repo).
3. Task 4 (storefront integration) lands → un-skip `tests/storefront-cart.spec.ts`'s new case — runs for real immediately (public route, no auth fixture needed).
4. Task 5 (checkout integration) lands → un-skip `tests/checkout-api.spec.ts`'s new case — runs for real immediately (public route).
5. Task 6 (admin vendor-list UI) has no dedicated scaffold in this run — the story's own Task 8 doesn't ask for a UI-level E2E test of the deactivate button, only the API-level route coverage above plus the two customer-facing integration points. Verify the UI manually or add coverage as a follow-up if desired; not required by this story's own test plan.
6. Run each activated test, confirm it fails first (true red), then implement until green.

## Implementation Guidance

New: `src/app/api/admin/vendors/[id]/deactivate/route.ts`, `src/components/admin/DeactivateVendorButton.tsx`. Modified: `prisma/schema.prisma` (+ migration), `src/lib/vendor.ts`, `src/app/vendors/[slug]/page.tsx`, `src/app/api/checkout/route.ts`, `src/app/admin/vendors/page.tsx`. Full file list and exact contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/2-3-admin-deactivates-a-vendor.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] Test files created correctly (`tsc`, `playwright --list` both confirm expected state — independently re-verified by the orchestrator)
- [x] Checklist matches acceptance criteria (AC1, AC2 covered; AC3, AC4 correctly marked not-automatable at this level)
- [x] Tests generated as red-phase scaffolds, marked `test.skip()`
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened (`tea_browser_automation` resolved to `none`)
- [x] The coordination race Story 2.2's ATDD run hit (two subagents adding the same helper) was avoided by design this run, not caught after the fact
- [x] Temp artifacts in subagent transcripts only; durable artifacts in `_bmad-output/test-artifacts/`, `tests/`

**Completion summary:**
- Test files: `tests/admin-deactivate-vendor.spec.ts` (new, 5 cases), `tests/checkout-api.spec.ts` (extended, 1 case), `tests/storefront-cart.spec.ts` (extended, 1 case) — 6 red-phase tests total
- Fixture: `tests/helpers/db.ts`'s `createTestVendor()` (built by the orchestrator ahead of subagent dispatch)
- Checklist: this file
- Story: `_bmad-output/implementation-artifacts/2-3-admin-deactivates-a-vendor.md`
- Next recommended workflow: `dev-story`
