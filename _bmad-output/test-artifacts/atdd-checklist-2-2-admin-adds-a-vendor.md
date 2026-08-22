---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-21'
storyId: '2.2'
storyKey: '2-2-admin-adds-a-vendor'
storyFile: '_bmad-output/implementation-artifacts/2-2-admin-adds-a-vendor.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-2-2-admin-adds-a-vendor.md'
generatedTestFiles:
  - 'src/app/api/admin/vendors/schema.test.ts'
  - 'tests/admin-vendors-api.spec.ts'
  - 'tests/admin-vendors.spec.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md'
  - '_bmad-output/implementation-artifacts/2-1-admin-identity-and-access-gating.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/selector-resilience.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-healing-patterns.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/component-tdd.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/timing-debugging.md'
  - 'src/app/api/products/route.ts'
  - 'src/app/api/products/schema.test.ts'
  - 'src/components/dashboard/AddProductForm.tsx'
  - 'tests/products-api.spec.ts'
  - 'tests/dashboard.spec.ts'
  - 'tests/admin.spec.ts'
  - 'tests/helpers/db.ts'
  - 'prisma/schema.prisma'
  - 'prisma/seed.ts'
---

# ATDD Checklist: Story 2.2 — Admin adds a vendor

## Step 1: Preflight & Context

- **Detected stack:** frontend (Next.js App Router, unchanged from every prior story's run)
- **Framework:** Playwright (API-level + E2E) + Vitest (schema unit tests) — same three-level split as Story 1.2
- **Prerequisites met:** story has clear ACs (4), `playwright.config.ts` configured, dev server startable
- **Story builds on Story 2.1's already-shipped infrastructure** — `getCurrentAdmin()`, the `/admin(.*)` middleware matcher, and the Admin Playwright auth fixture (`playwright/.auth/admin.json`) all already exist; this story's tests are the first real *consumers* of the admin fixture beyond 2.1's own gating tests.
- **Previous story (2.1) learnings carried forward:**
  - `test.use({ storageState: authFile })` resolves the file at browser-context creation, before any `beforeEach` skip guard runs — a missing auth file throws `ENOENT` instead of skipping. Every new authenticated test file in this run uses `existsSync(authFile) ? authFile : undefined`, not a bare path.
  - Two-identity files (one needing both a Vendor and an Admin session) need two separate `test.describe` blocks, each with its own independent skip guard — never one guard covering both. `tests/admin-vendors-api.spec.ts` needs exactly this shape (admin session for 3 cases, vendor session for the 401 case).
  - `test.describe.configure({ mode: "serial" })` is required on every block sharing a Clerk session with other files (clerk/javascript#7891) — applied to every new block in this run.
- **Knowledge fragments loaded:** test-quality, selector-resilience, data-factories, test-healing-patterns, component-tdd, timing-debugging (core tier + the frontend-conditional pair). `tea_use_playwright_utils: true` in config, but no `@playwright-utils/*` package is actually installed in this repo (verified against `package.json`) — treated the Playwright-Utils-branded knowledge fragments as generic best-practice guidance only (typed requests, fixture composition, deterministic waiting), not as an actual library to import. This repo's own established Clerk/Prisma-specific conventions (`global-setup.ts`'s Backend-API sign-in, the `existsSync`/`storageState` pattern) take precedence over the generic fragments where the two diverge.

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear, scenarios are standard (CRUD-style admin form, slug-uniqueness validation, 401 authorization check). No recording needed — `tea_browser_automation` had no CLI/MCP tool available in this run (resolved to `none`, same as Story 1.2's own run), and the UI (a small admin form) is fully specified in the story's Task 6 already.

## Step 3: Test Strategy

AC to scenario mapping:

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 1 | `CreateVendorSchema` accepts valid body, accepts optional `phone`/`description`, rejects missing/empty `name`/`slug` | Unit (Vitest) | P1 |
| 1 | `POST /api/admin/vendors` creates a `Vendor` with `clerkUserId: null` and `createdByAdminId` set to the acting admin's `Admin.id` (verified via direct Prisma read-back, not just the response body) | API (Playwright `request` fixture) | P0 |
| 1 | `POST /api/admin/vendors` rejects a request from a signed-in non-admin (401) | API | P0 |
| 1 | `POST /api/admin/vendors` rejects a malformed body (400) | API | P0 |
| 2 | `POST /api/admin/vendors` rejects a slug colliding with a seeded vendor (409, friendly message, no duplicate row) | API | P0 |
| 1, 3 | Admin fills the form on `/admin/vendors`, submits, sees a storefront-link confirmation, then the storefront actually renders the vendor's name at `/vendors/{slug}` | E2E (Playwright, authenticated as Admin) | P1 |
| 2 | Submitting a colliding slug via the form shows an inline error and doesn't navigate away | E2E | P2 |

**The 401 case is P0, not lower** — this codebase's own documented discipline (`project-context.md`) treats an admin-only mutation being reachable by a non-admin as a top-tier risk, same reasoning Story 1.2's table applied to ownership-scoping. It's also the one case in this run proving `getCurrentAdmin()`'s own check matters at all, since (per the story's Dev Notes) `/api/admin/vendors` isn't covered by `middleware.ts`'s matcher — no other layer would catch a regression here.

**Schema validation is P1, not P0** — `CreateVendorSchema` only gates shape (non-empty strings); the actual security/data-integrity guarantees (admin-only, no duplicate slugs) live at the API level and are P0 there instead.

**Known environment limitation carried into this run, same class as every prior authenticated-test run:** `tests/admin-vendors-api.spec.ts`'s admin-session cases and all of `tests/admin-vendors.spec.ts` need `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID` configured (not yet done in this dev environment — Story 2.1's Task 5 left this as an explicit out-of-reach manual step). The vendor-session case (the 401 test) already has real credentials configured and can activate immediately once Task 4 lands. Scaffolds are generated and correct regardless of what's currently configured — activation just won't produce real coverage on the admin-gated cases until the secret exists.

**Red-phase note:** this is genuinely new work end to end (schema, route, page, form) — every scenario is a normal TDD red phase, expected to fail (404/network-error for the API/E2E cases, module-not-found for the schema unit tests) until `dev-story` implements each task.

## Step 4: Red-Phase Test Generation (Aggregated)

TDD Red Phase Validation: **PASS** — all 12 new tests use `test.skip()`/`it.skip()`, assert real expected behavior (no placeholder assertions), `expected_to_fail: true`.

- **Unit tests (Vitest):** 6 — `src/app/api/admin/vendors/schema.test.ts` (new file — genuinely fails to *load* today, not just fail an assertion, since `./schema` doesn't exist yet; that failure-to-load *is* this file's correct red-phase signal, same shape as Story 1.2's own `[id]/schema.test.ts` red phase)
- **API tests (Playwright `request` fixture):** 4, all P0 — `tests/admin-vendors-api.spec.ts` (new file): 201 success + `createdByAdminId`/`clerkUserId` read-back, 409 slug collision + no-duplicate-row read-back, 400 malformed body, 401 non-admin
- **E2E tests (Playwright `page` fixture):** 2 — `tests/admin-vendors.spec.ts` (new file): full form-to-live-storefront round trip (P1), inline slug-collision error (P2)
- **Fixture needs tracked and built during this run** (not left for later, since the addition was small and well-scoped): `tests/helpers/db.ts` gained `deleteVendorBySlug(slug)`, mirroring `deleteProductByName`'s existing shape — needed by both new Playwright files for cleanup. One coordination note: both parallel workers independently added this helper (a genuine race, not a spec gap) — the orchestrator resolved it before either worker's typecheck ran, keeping exactly one definition.
- **Execution mode:** SUBAGENT (API+unit test generation and E2E test generation dispatched in parallel via the Agent tool, matching Story 1.2's own precedent) — `tea_execution_mode: auto` resolved to `subagent` (this session can launch subagents; no distinct "agent-team" primitive available).

**Verified independently by the orchestrator, not just trusted from subagent reports:**
- `npx tsc --noEmit` — exactly 2 new errors, both correct red-phase signals: `Cannot find module './schema'` in the new `admin/vendors/schema.test.ts`, and `Property 'createdByAdminId' does not exist` in `admin-vendors-api.spec.ts` (Task 1's migration hasn't landed, so the Prisma-generated `Vendor` type doesn't have the field yet). No other stray errors.
- `npx vitest run "src/app/api/admin/vendors/schema.test.ts"` — fails to load (module doesn't exist), matching its own header comment exactly.
- `npm run test:unit` (full suite) — 66/66 existing tests still pass, the one new file correctly fails to load, no collateral damage.
- `npx playwright test tests/admin-vendors.spec.ts tests/admin-vendors-api.spec.ts --list` — all 6 tests in both files parse and list correctly.
- Read all three generated files in full and spot-checked against the story's own Task specs — confirmed correct HTTP status codes (201/409/400/401 per Task 4's exact contract), correct `createdByAdminId`-via-`Admin.id`-not-`clerkUserId` verification (AD-5), correct two-identity/two-skip-guard structure, correct reuse of the seeded `corner-sourdough` vendor as the collision target, correct `existsSync ? file : undefined` storageState fix from Story 2.1's review carried forward into every new block.

Acceptance criteria coverage:
- AC1 (admin submits form → `Vendor` created with `clerkUserId: null`, `createdByAdminId` set): covered (unit + API + E2E)
- AC2 (slug collision → friendly error, never a raw constraint failure): covered (API + E2E)
- AC3 (new vendor gets a live storefront at `/vendors/{slug}` immediately): covered (E2E — the form-flow test navigates to the storefront URL directly and asserts the vendor's name renders, not just that a DB row exists)
- AC4 (no new external dependency): **not automatable** — verified by code review (package.json/lockfile diff), not a test scaffold, same treatment Story 1.2's AC2/AC3 backfill-correctness clause got for a similarly non-testable claim

## Next Steps (Task-by-Task Activation)

During `dev-story`, activate scaffolds task-by-task as each is implemented, not all at once:

1. Task 1 (migration: nullable `clerkUserId`, `createdByAdminId`) lands → the `createdByAdminId` type error in `tests/admin-vendors-api.spec.ts` resolves on its own (no test file edit needed, just re-run `tsc`)
2. Task 2 (`resolveVendorSlug()`) + Task 3 (`CreateVendorSchema`) land → un-skip `src/app/api/admin/vendors/schema.test.ts`'s 6 cases
3. Task 4 (`POST /api/admin/vendors` route) lands → un-skip `tests/admin-vendors-api.spec.ts`'s 4 cases; the admin-session 3 cases will additionally need `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID` configured to actually run rather than skip (Story 2.1's known out-of-reach step) — the 401 test can activate and run for real immediately, since it only needs the already-configured vendor fixture
4. Task 5 (`/admin/vendors` page) + Task 6 (`AddVendorForm.tsx`) land → un-skip `tests/admin-vendors.spec.ts`'s 2 cases — expect to need real selector adjustments here specifically around the form's `aria-label`/button text (the E2E subagent inferred `"Add vendor"`/`"Save vendor"` by direct analogy to `AddProductForm.tsx`'s `"Add product"`/`"Save product"`, since the component didn't exist yet to verify against; either match these strings in Task 6 or update the two selectors — flagged explicitly by the subagent, not a scaffold defect)
5. Task 7 (`deleteVendorBySlug`) is already done (built during this ATDD run, ahead of `dev-story`, since both new test files needed it immediately for cleanup)
6. Run each activated test, confirm it fails first (true red), then implement until green

## Implementation Guidance

New: `src/lib/vendor.ts` gains `resolveVendorSlug()`, `src/app/api/admin/vendors/` (`route.ts` + `schema.ts`), `src/app/admin/vendors/page.tsx`, `src/components/admin/AddVendorForm.tsx`. Modified: `prisma/schema.prisma` (+ migration), `tests/helpers/db.ts` (done). Full file list and exact contracts are in the story's own Tasks/Subtasks — this checklist doesn't duplicate them, see `_bmad-output/implementation-artifacts/2-2-admin-adds-a-vendor.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] Test files created correctly (`tsc`, `vitest`, `playwright --list` all confirm expected state — independently re-verified by the orchestrator, not just trusted from subagent self-reports)
- [x] Checklist matches acceptance criteria (AC1, AC2, AC3 covered; AC4 correctly marked not-automatable)
- [x] Tests generated as red-phase scaffolds, marked `test.skip()`/`it.skip()`
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened (`tea_browser_automation` resolved to `none`)
- [x] A genuine race between the two parallel workers (both independently adding `deleteVendorBySlug`) was caught and resolved before it could reach `tsc` as a duplicate-symbol error
- [x] Temp artifacts in scratchpad/subagent transcripts only; durable artifacts in `_bmad-output/test-artifacts/`, `src/`, `tests/`

**Completion summary:**
- Test files: `src/app/api/admin/vendors/schema.test.ts` (new, 6 cases), `tests/admin-vendors-api.spec.ts` (new, 4 cases), `tests/admin-vendors.spec.ts` (new, 2 cases) — 12 red-phase tests total
- Fixture: `tests/helpers/db.ts`'s `deleteVendorBySlug()` (new)
- Checklist: this file
- Story: `_bmad-output/implementation-artifacts/2-2-admin-adds-a-vendor.md`
- Next recommended workflow: `dev-story`
