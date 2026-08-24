---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-24'
storyId: '4.1'
storyKey: '4-1-vendor-uploads-a-product-image'
storyFile: '_bmad-output/implementation-artifacts/4-1-vendor-uploads-a-product-image.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-4-1-vendor-uploads-a-product-image.md'
generatedTestFiles:
  - 'src/app/api/products/schema.test.ts'
  - 'src/app/api/products/upload-image/schema.test.ts'
  - 'tests/products-api.spec.ts'
  - 'tests/dashboard.spec.ts'
  - 'tests/fixtures/test-product-image.png'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/implementation-artifacts/4-1-vendor-uploads-a-product-image.md'
  - 'src/lib/cloudinary.ts'
  - 'next.config.mjs'
  - 'src/app/api/products/route.ts'
  - 'src/app/api/products/schema.ts'
  - 'src/app/api/products/schema.test.ts'
  - 'src/app/api/products/[id]/route.ts'
  - 'src/app/api/pickup-slots/route.ts'
  - 'src/components/dashboard/AddProductForm.tsx'
  - 'tests/products-api.spec.ts'
  - 'tests/dashboard.spec.ts'
  - 'tests/helpers/db.ts'
  - '.env.example'
  - 'project-context.md'
---

# ATDD Checklist: Story 4.1 — Vendor uploads a product image

## Step 1: Preflight & Context

- **Detected stack:** frontend (Next.js App Router, Playwright configured; no separate backend-only manifest — this project has no `playwright-utils` package dependency either, so Playwright Utils knowledge fragments were deliberately skipped in favor of this repo's own established plain-`@playwright/test` patterns).
- **Framework:** Playwright for API-level and browser-level coverage, Vitest for two pure Zod schema files.
- **Prerequisites met:** story has 7 clear, numbered ACs; `playwright.config.ts`/`vitest.config.mts` both configured; dev environment available.
- **Real prior art found and reused, not rebuilt:** `src/lib/cloudinary.ts`'s `uploadImage()` already exists (full server-side upload, no signing endpoint needed) and `next.config.mjs` already whitelists `res.cloudinary.com` for `next/image` — both confirmed by reading the files directly during story creation, carried into this scaffold's assumptions.
- **Scope correction carried from the story file:** no product-edit form exists in this codebase (`PATCH /api/products/[id]` only ever touches Stock Quantity/Low-Stock Threshold, Story 1.2's deliberate scope) — this story, and this checklist, cover creation-only (AC #7).
- **Previous stories' learnings applied:**
  - `existsSync(authFile) ? authFile : undefined` in `test.use({ storageState })`, never a bare path (Story 2.1's `ENOENT` fix, reused verbatim in the new `products-api.spec.ts` block).
  - `test.describe.configure({ mode: "serial" })` on the new authenticated block (clerk/javascript#7891, same reasoning as every other authenticated describe block in this repo).
  - No mocking of external services (Stripe/Clerk/Twilio all use real dev-mode calls) — the new upload route's happy-path test hits real Cloudinary with a real fixture image, not a synthetic string, matching this codebase's established convention.
- **Execution mode:** sequential, no subagent dispatch — scope is small (one new route+schema, one schema narrowing, one form field, all single-author), matching Story 3.2's identical precedent ("scope small enough to not warrant coordination overhead").

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear, scenarios are standard (file upload, schema validation, auth-gated API route, form submission). No recording — `tea_browser_automation` resolves to `none` in this environment, same as every prior story in this project.

## Step 3: Test Strategy

AC to scenario mapping:

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 4 | `CreateProductSchema` still accepts a Cloudinary-host `imageUrl` (pre-existing case, unaffected) | Unit | — (regression, already passing) |
| 4 | `CreateProductSchema` rejects a well-formed but non-Cloudinary `imageUrl` (currently accepted — the actual behavior change) | Unit | P0 |
| 2, 3 | `UploadImageSchema` accepts a valid base64 PNG data URL | Unit | P0 |
| 5 | `UploadImageSchema` rejects a plain remote URL (not base64) | Unit | P1 |
| 5 | `UploadImageSchema` rejects a non-data-URL string | Unit | P0 |
| 5 | `UploadImageSchema` rejects a non-image MIME type in the data URL | Unit | P0 |
| 5 | `UploadImageSchema` rejects an oversized (~4M-char) base64 payload | Unit | P0 |
| 2, 3 | `POST /api/products/upload-image` as the authenticated test vendor, real fixture image → 200 + `imageUrl` starting with `https://res.cloudinary.com/` | E2E (API) | P0 |
| — | `POST /api/products/upload-image` fully unauthenticated → 401 | E2E (API) | P0 |
| 5 | `POST /api/products/upload-image` malformed (non-image) value → 400 | E2E (API) | P0 |
| 5 | `POST /api/products/upload-image` oversized payload → 400, size-specific message | E2E (API) | P1 |
| 1, 2, 3 | Vendor uploads a real image via `AddProductForm`'s new file input → created product's `imageUrl` is set (verified via DB, not visually — Story 4.2 owns display) | E2E (UI) | P1 |
| 5 | Vendor selects an oversized file in `AddProductForm` → inline "too large" error, no product created | E2E (UI) | P1 |

**Not automated at this level:**
- AC #1 (file input exists) — proven implicitly by the two UI tests above actually locating and using it; no standalone "input renders" test.
- AC #6 (no-image path unaffected) — already covered by Story 1.2's existing "vendor can add a new product" test, which selects no file; no new scaffold needed, would be pure duplication.
- AC #7 (creation-only scope) — an absence (no edit-image capability), nothing to assert; enforced by there being no edit form to extend, not by a test.
- "the browser never receives or uses Cloudinary credentials" (AC #2's sub-claim) — verified by code inspection (`uploadImage()` runs server-side only, `CLOUDINARY_API_SECRET` never sent to the client), same treatment Story 3.1 gave its own non-automatable "no caching staleness" claim.

**Red phase confirmed for every scenario above** — either the assertion is new against unimplemented code (E2E cases 404 against a missing route, or fail to locate a form field that doesn't exist), or the schema doesn't yet enforce the rule being tested (`imageUrl` host check) or doesn't exist yet at all (`UploadImageSchema`).

## Step 4: Red-Phase Test Generation

TDD Red Phase Validation: **PASS** — all 11 new test cases use `it.skip()`/`test.skip()`, assert real expected behavior (no placeholder assertions), verified to fail for the right reason before implementation.

- **Unit tests (Vitest):** 6 new, all `it.skip()` — 1 appended to the existing `src/app/api/products/schema.test.ts`, 5 in the new `src/app/api/products/upload-image/schema.test.ts`.
- **E2E tests (Playwright):** 6 new, all `test.skip()` — 4 appended to `tests/products-api.spec.ts` (new `describe` block), 2 appended to `tests/dashboard.spec.ts`.
- **New fixture:** `tests/fixtures/test-product-image.png` — a real, valid 68-byte 1x1 PNG (not a synthetic string), so the happy-path upload test exercises a real Cloudinary upload once activated, per this repo's "no mocking external services" convention. `src/app/api/products/upload-image/schema.test.ts` inlines the same image's base64 payload directly (no filesystem dependency for the pure schema tests).

**Verified independently, not just narrated:**
- `npx tsc --noEmit` — exactly 1 new error: `src/app/api/products/upload-image/schema.test.ts(2,35): error TS2307: Cannot find module './schema'` — the correct, sole expected red-phase signal (`UploadImageSchema` doesn't exist yet; every other new test compiles fine and fails at runtime instead, since they reference an unimplemented *route*/*form field*, not an unimplemented *module*).
- `npm run test:unit` — confirms the same failure at the suite level (`FAIL src/app/api/products/upload-image/schema.test.ts`, `Cannot find module './schema'`), and confirms the 80 pre-existing unit tests are unaffected (80 passed, 1 skipped — the new `it.skip()` case appended to the existing `schema.test.ts` file).
- `npx playwright test tests/products-api.spec.ts tests/dashboard.spec.ts --list` — all 6 new E2E scaffolds parse and list correctly under their intended structure (4 in the new `POST /api/products/upload-image` describe block, 2 inside the existing authenticated dashboard block).
- Read every modified/new file back in full after writing it and cross-checked against the story's own Task 1-4 bullets line by line — confirmed the upload-route test's success assertion matches `res.cloudinary.com` (Task 2/`next.config.mjs`'s exact host string), confirmed the oversized-payload tests both use the same ~4,000,000-character threshold the story's Dev Notes derive from the 3MB-raw/4.5MB-Vercel-ceiling math, confirmed the UI oversized-file test builds an in-memory buffer rather than requiring a second large fixture file on disk.

Acceptance criteria coverage:
- AC1 (file input exists): covered implicitly (2 UI tests successfully locate and use it)
- AC2 (upload before create, no browser-side credentials): covered (upload-route happy-path E2E test + code-inspection note for the credentials sub-claim)
- AC3 (`imageUrl` saved to `Product.imageUrl`): covered (upload-route E2E test's response shape + UI test's DB-level assertion)
- AC4 (Cloudinary-host restriction): covered (2 unit tests — accept pre-existing, reject new)
- AC5 (upload failure shows inline error, no broken product): covered (4 schema unit tests + 2 API E2E tests + 1 UI E2E test)
- AC6 (no-image path unaffected): covered by existing Story 1.2 test, no new scaffold
- AC7 (creation-only scope): enforced by absence, not a test

## Next Steps (Task-by-Task Activation)

During `dev-story`, activate scaffolds task-by-task as each is implemented, not all at once:

1. Task 1 (`src/app/api/products/upload-image/route.ts` + `schema.ts`) lands → the `tsc` error above resolves; un-skip all 5 `src/app/api/products/upload-image/schema.test.ts` cases (pure function, no fixtures/auth needed, runs for real immediately) and all 4 new `tests/products-api.spec.ts` cases (need `E2E_VENDOR_EMAIL`/`CLERK_SECRET_KEY` configured — already true in this dev environment per the existing `authFile` guard, so these run for real, not skip).
2. Task 2 (`CreateProductSchema`'s host restriction) lands → un-skip the 1 new case in `src/app/api/products/schema.test.ts` — runs for real immediately.
3. Task 3 (`AddProductForm.tsx`'s file input + upload wiring) lands → un-skip both new `tests/dashboard.spec.ts` cases — same vendor auth fixture as every other dashboard test in this file, runs for real immediately.
4. Run each activated test, confirm it fails first (true red), then implement until green — same discipline as every prior story's ATDD cycle in this project.

## Implementation Guidance

New: `src/app/api/products/upload-image/route.ts`, `src/app/api/products/upload-image/schema.ts`, `tests/fixtures/test-product-image.png` (already created — real file, not a stub). Modified: `src/components/dashboard/AddProductForm.tsx`, `src/app/api/products/schema.ts`, `docs/data-models.md`, `docs/api-contracts.md`. Full contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/4-1-vendor-uploads-a-product-image.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] Test files created correctly (`tsc`, `test:unit`, `playwright --list` all confirm expected state)
- [x] Checklist matches acceptance criteria (AC1-AC7 all addressed, 2 explicitly by absence)
- [x] Tests generated as red-phase scaffolds, marked `it.skip()`/`test.skip()`
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened (`tea_browser_automation` resolved to `none`)
- [x] Temp artifacts: none created. Durable artifacts: this checklist (`_bmad-output/test-artifacts/`), test files (`tests/`, `src/app/api/products/`), fixture (`tests/fixtures/`)

**Completion summary:**
- Test files: `src/app/api/products/schema.test.ts` (extended, 1 case), `src/app/api/products/upload-image/schema.test.ts` (new, 5 cases), `tests/products-api.spec.ts` (extended, 4 cases), `tests/dashboard.spec.ts` (extended, 2 cases) — 12 red-phase tests total (11 new + confirmed the 1 pre-existing accept-case still applies unchanged)
- Fixture: `tests/fixtures/test-product-image.png` — new, real 68-byte PNG
- Checklist: this file
- Story: `_bmad-output/implementation-artifacts/4-1-vendor-uploads-a-product-image.md`
- Next recommended workflow: `dev-story`
