---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-22'
storyId: '3.1'
storyKey: '3-1-admin-inventory-dashboard'
storyFile: '_bmad-output/implementation-artifacts/3-1-admin-inventory-dashboard.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-3-1-admin-inventory-dashboard.md'
generatedTestFiles:
  - 'tests/admin-inventory.spec.ts'
  - 'src/lib/availability.test.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/prds/prd-local-food-2026-08-10/addendum.md'
  - '_bmad-output/implementation-artifacts/2-3-admin-deactivates-a-vendor.md'
  - '_bmad-output/implementation-artifacts/epic-2-retro-2026-08-22.md'
  - 'tests/admin.spec.ts'
  - 'tests/admin-vendors.spec.ts'
  - 'tests/admin-deactivate-vendor.spec.ts'
  - 'tests/helpers/db.ts'
  - 'src/lib/availability.ts'
  - 'src/lib/availability.test.ts'
  - 'src/app/dashboard/products/page.tsx'
  - 'src/app/admin/page.tsx'
  - 'src/app/admin/vendors/page.tsx'
  - 'src/middleware.ts'
  - 'prisma/schema.prisma'
---

# ATDD Checklist: Story 3.1 — Admin inventory dashboard

## Step 1: Preflight & Context

- **Detected stack:** fullstack (Next.js App Router frontend + API routes, Playwright configured, Prisma/Postgres backend) — unchanged from every prior run this project.
- **Framework:** Playwright for the page itself (Prisma + Clerk), plus Vitest for one new pure function (`isLowStock()`) — first ATDD run this epic to touch both frameworks in one pass (2.1/2.2/2.3 were Playwright-only or Playwright+Vitest-schema; this is Playwright+Vitest-pure-function).
- **Prerequisites met:** story has clear ACs (3), `playwright.config.ts`/`vitest.config.mts` both configured, dev server startable.
- **No schema change this story** — `Product.stockQuantity`/`lowStockThreshold` already exist (Story 1.2), `Admin`/`getCurrentAdmin()` already exist (Story 2.1). Red-phase failures are expected to be TS "missing export"/missing-route errors, not missing-column errors.
- **Previous stories' learnings carried forward:**
  - `existsSync(authFile) ? authFile : undefined` in `test.use({ storageState })`, never a bare path (Story 2.1 review-confirmed `ENOENT` fix).
  - Two/three-identity files need independent skip guards per identity, never one shared guard.
  - `page.goto("/")` warm-up in `beforeEach` before the real navigation, for every admin/vendor-authenticated block (Clerk session needs one full load to become valid against middleware).
  - `test.describe.configure({ mode: "serial" })` on every block sharing a Clerk session (clerk/javascript#7891).
  - Never touch the seeded `corner-sourdough`/`green-valley-produce` vendors — dedicated `createTestVendor()`/`createTestProduct()` fixtures used throughout, matching the discipline every Epic 1/2 story established.
  - **Epic 2 retro, applied directly:** accessible flag assertions (visible text, not `title`-only) in the low-stock-badge test; the story's own Task 2 already specifies a pagination cap and `export const dynamic = "force-dynamic"` proactively, so no scaffold is needed for either — they're implementation-time concerns, not separately testable behaviors beyond what AC #1/#2 already cover.
- **Execution mode:** direct (no subagent dispatch) — scope is small (one new pure function, one new spec file, both single-author, no coordination-race risk the way Story 2.2's multi-file/multi-subagent run had).

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear, scenarios are standard (a read-only cross-vendor query page, a pure boolean-flag function, an existing admin-gate pattern with 2 prior precedents). No recording needed — no CLI/MCP browser tool available in this run (`tea_browser_automation` resolves to `none`, same as every prior story).

## Step 3: Test Strategy

AC to scenario mapping:

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 1 | Admin visits `/admin/inventory` → a seeded product's Stock Quantity and Low-Stock Threshold values render | E2E (Playwright `page`) | P0 |
| 2 | `isLowStock()` — below threshold, at threshold (boundary), above threshold, at 0 with a 0 threshold, at 0 with a positive threshold | Unit (Vitest) | P0 |
| 2 | A product at/below its threshold shows a visible flag; a healthy product does not | E2E | P0 |
| 1 (scope decision) | A product belonging to a deactivated vendor still appears in the list (Task 2's deliberate "all vendors" choice) | E2E | P1 |
| 3 | Signed-in vendor (not admin) visiting `/admin/inventory` → 404 | E2E | P0 |
| 3 | Fully unauthenticated request → redirected to `/sign-in` | E2E | P0 |

**Not automated at this level:**
- "Computed live at request time, no caching staleness" (AC #1) — `export const dynamic = "force-dynamic"` is a build-time/framework-level guarantee, not something a single Playwright run can distinguish from a coincidentally-fresh cache. Verified by code inspection at implementation time (the export is present), same treatment Story 1.3's identical fix received.
- The deactivated-vendor-inclusion case (P1 above) proves the row appears, but doesn't separately re-prove `isInStock`/vendor-status rendering already covered by other stories' tests — kept narrowly scoped to what Task 2 actually decided.

**Known environment limitation, same class as every prior authenticated-test run:** the three admin-session cases in `tests/admin-inventory.spec.ts` need `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID` (Epic 2 retro's still-open action item #1). The vendor-session denial case and the fully-unauthenticated case both need no admin credentials and can activate and run for real immediately. The 5 Vitest cases need nothing beyond the function existing and can also run for real immediately once Task 1 lands.

**Red-phase note:** genuinely new work (no pre-existing partial implementation) — normal TDD red phase, expected to fail (missing `isLowStock` export → TS error; missing `/admin/inventory` route → 404/connection failure) until `dev-story` implements each task.

## Step 4: Red-Phase Test Generation

TDD Red Phase Validation: **PASS** — all 10 new tests use `test.skip()`/`it.skip()`, assert real expected behavior (no placeholder assertions), `expected_to_fail: true`.

- **Unit tests (Vitest):** 5, all `it.skip()` — appended to the existing `src/lib/availability.test.ts`, joining `isInStock`'s existing describe block with a new `describe("isLowStock", ...)`.
- **E2E tests (Playwright `page` fixture):** 5, all `test.skip()` — new file `tests/admin-inventory.spec.ts` (3 admin-authenticated cases, 1 vendor-denial case, 1 fully-unauthenticated case).

**Verified independently, not just narrated:**
- `npx tsc --noEmit` — exactly 1 new error: `src/lib/availability.test.ts(2,21): error TS2305: Module '"./availability"' has no exported member 'isLowStock'.` — the correct, sole expected red-phase signal (no `/admin/inventory` page exists yet either, but that surfaces as a runtime 404 in Playwright, not a `tsc` error, since the test file only imports already-existing helpers).
- `npx playwright test tests/admin-inventory.spec.ts --list` — all 5 tests parse and list correctly under the intended three-identity structure (3 admin / 1 vendor / 1 unauthenticated).
- Read both files in full after writing them and cross-checked against the story's own Task 1/2/5 bullets line by line — confirmed correct HTTP-status expectations (404 for non-admin denial, matching `notFound()`'s established precedent from `tests/admin.spec.ts`), correct accessible-flag assertion (`getByText(/low stock/i)`, not a `title` check), correct dedicated-fixture discipline (`createTestVendor`/`createTestProduct`, cleaned up in `finally`), correct boundary case for `isLowStock` (`stockQuantity === lowStockThreshold` → true).

Acceptance criteria coverage:
- AC1 (page shows live Stock Quantity per product, all vendors): covered (1 E2E value-rendering test + 1 E2E deactivated-vendor-inclusion test)
- AC2 (low-stock visual flag): covered (5 unit tests for the boolean logic + 1 E2E test for the visible flag)
- AC3 (non-admin denied): covered (2 E2E tests — signed-in-vendor 404, fully-unauthenticated redirect)

## Next Steps (Task-by-Task Activation)

During `dev-story`, activate scaffolds task-by-task as each is implemented, not all at once:

1. Task 1 (`isLowStock()` in `src/lib/availability.ts`) lands → the 1 TS error above resolves on its own; un-skip all 5 `isLowStock` cases in `src/lib/availability.test.ts` — run for real immediately (pure function, no fixtures/auth needed).
2. Task 2 (`/admin/inventory` page) lands → un-skip `tests/admin-inventory.spec.ts`'s 5 cases. The 2 non-admin-gated cases (vendor-404, unauthenticated-redirect) can run for real immediately; the 3 admin-gated ones will skip until `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID` are configured (same known gap as every prior admin-authenticated test in this repo — Epic 2 retro action item #1, still open).
3. Task 3 (link from `/admin/page.tsx`) has no dedicated scaffold — not asked for by the story's own Task 5 test plan; a link-presence assertion would be trivial to add manually if desired, but isn't required.
4. Run each activated test, confirm it fails first (true red), then implement until green.

## Implementation Guidance

New: `src/app/admin/inventory/page.tsx`, `tests/admin-inventory.spec.ts`. Modified: `src/lib/availability.ts`, `src/lib/availability.test.ts`, `src/app/admin/page.tsx`, `docs/source-tree-analysis.md`. Full contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/3-1-admin-inventory-dashboard.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] Test files created correctly (`tsc`, `playwright --list` both confirm expected state)
- [x] Checklist matches acceptance criteria (AC1, AC2, AC3 all covered)
- [x] Tests generated as red-phase scaffolds, marked `test.skip()`/`it.skip()`
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened (`tea_browser_automation` resolved to `none`)
- [x] Temp artifacts none created; durable artifacts in `_bmad-output/test-artifacts/`, `tests/`, `src/lib/`

**Completion summary:**
- Test files: `tests/admin-inventory.spec.ts` (new, 5 cases), `src/lib/availability.test.ts` (extended, 5 cases) — 10 red-phase tests total
- Checklist: this file
- Story: `_bmad-output/implementation-artifacts/3-1-admin-inventory-dashboard.md`
- Next recommended workflow: `dev-story`
