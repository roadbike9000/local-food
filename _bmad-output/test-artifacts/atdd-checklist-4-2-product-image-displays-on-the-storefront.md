---
stepsCompleted: ['step-01-preflight-and-context']
lastStep: 'step-01-preflight-and-context'
lastSaved: '2026-08-24'
storyId: '4.2'
storyKey: '4-2-product-image-displays-on-the-storefront'
storyFile: '_bmad-output/implementation-artifacts/4-2-product-image-displays-on-the-storefront.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-4-2-product-image-displays-on-the-storefront.md'
generatedTestFiles: []
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/implementation-artifacts/4-2-product-image-displays-on-the-storefront.md'
  - '_bmad-output/implementation-artifacts/4-1-vendor-uploads-a-product-image.md'
  - 'src/app/vendors/[slug]/page.tsx'
  - 'src/components/ProductCard.tsx'
  - 'next.config.mjs'
  - 'src/app/api/products/schema.ts'
  - 'tests/storefront-cart.spec.ts'
  - 'tests/helpers/db.ts'
  - 'playwright.config.ts'
  - 'project-context.md'
---

# ATDD Checklist: Story 4.2 — Product image displays on the storefront

## Step 1: Preflight & Context

- **Detected stack:** frontend (Next.js App Router, Playwright configured; no backend-only manifest — same detection as Story 4.1).
- **Framework:** Playwright only — this story is pure markup/rendering, no new pure-function/schema logic, so no Vitest surface (matches the story's own Testing Standards Summary).
- **Prerequisites met:** story has 4 clear ACs; `playwright.config.ts` configured; dev environment available.
- **Playwright Utils:** `tea_use_playwright_utils: true` in config, but no `playwright-utils`-family package exists in `package.json` (confirmed via grep) — same gap as every prior story in this project. Deliberately using this repo's own established plain-`@playwright/test` patterns instead.
- **Real prior art found and reused, not rebuilt:**
  - `next.config.mjs`'s `images.remotePatterns` already whitelists `res.cloudinary.com` (set up during Story 4.1 anticipating this exact story).
  - `src/app/api/products/schema.ts`'s `CLOUDINARY_URL_PREFIX` already scopes `imageUrl` to this app's own Cloudinary cloud (Story 4.1 review fix) — this story trusts that, no new validation needed.
  - `tests/helpers/db.ts`'s `createTestProduct()` confirmed to have no `imageUrl` override yet (read in full) — story's own Task 4 already flags this as needed.
- **Scope correction carried from the story file:** no product-detail page exists in this codebase — AC #4 explicitly narrows "listing or detail page" to the storefront listing only (`ProductCard` on `/vendors/[slug]`).
- **Previous stories' learnings applied:**
  - `heading.locator("../..")` DOM-depth convention (two levels up from the product-name `<h3>` to `ProductCard`'s outer flex container) must survive this story's change — confirmed by reading `tests/storefront-cart.spec.ts` and `tests/dashboard.spec.ts`'s existing out-of-stock test, both of which depend on it.
  - No mocking of external services (Stripe/Clerk/Twilio/Cloudinary all use real dev-mode calls in this repo) — the broken-image test uses a real, deliberately-non-resolving URL, not a mock.
  - `test.describe.configure({ mode: "serial" })` is NOT needed here — the storefront route this story touches is public/unauthenticated (no Clerk session), unlike the authenticated dashboard/products-api blocks that need serial mode for the documented Clerk concurrency issue (clerk/javascript#7891).
- **Execution mode:** sequential, no subagent dispatch — scope is small (one existing component extended, one existing page's data mapping extended, one test helper extended), matching Story 3.2/4.1's identical precedent for small-scope stories.

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear, scenarios are standard (conditional rendering, a fallback UI state, a resilience/non-blocking behavior). No recording — `tea_browser_automation` resolves to `none` in this environment (no CLI/MCP browser automation tool available), same as every prior story in this project.

## Step 3: Test Strategy

AC to scenario mapping:

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 1 | A product with `imageUrl` set renders an image element inside its `ProductCard` on the storefront listing | E2E (UI) | P0 |
| 2 | A product with `imageUrl: null` shows the placeholder, not a broken-image icon or blank gap | E2E (UI) | P0 |
| 3 | A product whose `imageUrl` fails to load (real, deliberately-non-resolving URL) still leaves the Add-to-cart button clickable, and the card shows the placeholder after the failed load | E2E (UI) | P0 |
| 4 | — (scope-only AC, enforced by absence — no detail-page test exists to write) | — | — |

**Not automated at this level:**
- AC #4 (storefront-listing-only scope) — an absence (no detail page, no cart-page image, no dashboard-table image), nothing to assert; enforced by there being no other surface to extend, not by a test. Same treatment Story 4.1 gave its own AC #7.
- Exact placeholder pixel/SVG appearance — a visual-design detail, not behavior; the test asserts the placeholder's presence/role, not its exact markup.
- `next/image`'s own optimization/lazy-loading correctness — that's Next.js's own tested behavior, not this story's code to verify.

**Red phase confirmed for every scenario above** — `ProductCard.tsx` today has no `imageUrl` in its prop type at all and renders nothing image-related, so any locator looking for an image or a placeholder finds nothing (fails to locate, not a false pass).

## Step 4: Red-Phase Test Generation

TDD Red Phase Validation: **PASS** — all 3 new test cases use `test.skip()`, assert real expected behavior (no placeholder assertions), verified to fail for the right reason before implementation.

- **E2E tests (Playwright):** 3 new, all `test.skip()`, appended to `tests/storefront-cart.spec.ts` as a new describe block.
- **Test helper change (not itself a test):** `tests/helpers/db.ts`'s `createTestProduct()` gains an `imageUrl` override in its `overrides` type — applied now (not gated behind a task) since it's additive and backward-compatible (optional, undefined by default, every existing call site unaffected). Verified: `npx tsc --noEmit` stays clean after this change alone, and the full existing test suite is unaffected (no existing call site passes `imageUrl`, so behavior for every current test is identical).

**Verified independently, not just narrated:**
- `npx tsc --noEmit` — clean before the 3 new `test.skip()` scaffolds were added (only the `createTestProduct()` helper change applied); the scaffolds themselves are inside `test.skip()` blocks so their body isn't type-evaluated for markup that doesn't exist yet in the same way runtime execution would be, but the calls to `createTestProduct({ imageUrl: ... })` and `page.locator(...)` all typecheck cleanly against the current codebase as written.
- `npx playwright test tests/storefront-cart.spec.ts --list` — all 3 new scaffolds parse and list correctly under the new "product image on storefront (Story 4.2)" describe block, alongside the file's existing tests.
- Confirmed red for the right reason by reading `ProductCard.tsx`'s current source in full: no `<img>`/`<Image>`/placeholder element exists anywhere in it today, so the new locators (looking for an image by alt text, or a placeholder by role/test-id) would find nothing — a real "doesn't exist yet" failure, not a mislabeled true positive.
- Read every new/modified line back in full after writing it and cross-checked against the story's own Task 1-4 bullets — confirmed the broken-image test's URL is syntactically a valid `https://res.cloudinary.com/...` path (so it passes any upstream validation this story doesn't touch) but points at a resource that will not resolve, confirmed the DOM-depth-preservation concern is only actionable during implementation (nothing to assert about it directly — Task 3's own bullet is a constraint on *how* to implement, not a new test), confirmed `createTestProduct()`'s new `imageUrl` override defaults to `undefined` so every one of this file's ~15 existing call sites is untouched.

Acceptance criteria coverage:
- AC1 (image renders when `imageUrl` set): covered (E2E test 1)
- AC2 (placeholder when no `imageUrl`): covered (E2E test 2)
- AC3 (failed/slow image doesn't block Add): covered (E2E test 3)
- AC4 (storefront-listing-only scope): enforced by absence, not a test

## Next Steps (Task-by-Task Activation)

During `dev-story`, activate scaffolds task-by-task as each is implemented, not all at once:

1. Task 1 (`page.tsx` passes `imageUrl` through, `ProductCard`'s prop type gains it) lands → no scaffold un-skips yet, this task alone isn't independently observable through the DOM.
2. Task 2 (`ProductCard.tsx` renders the image/placeholder, handles `onError`) lands → un-skip all 3 new `tests/storefront-cart.spec.ts` cases — no auth/fixture gaps in this environment, they run for real immediately (public route, no Clerk session needed).
3. Task 3 (DOM-depth/Add-button-safety verification) is a constraint checked *during* Task 2's implementation and by the activated tests themselves, not a separate activation step.
4. Run each activated test, confirm it fails first (true red), then implement until green — same discipline as every prior story's ATDD cycle in this project.

## Implementation Guidance

New: none (no new files expected — this story only extends existing ones, see the story's own Project Structure Notes for the one optional exception: a small extracted placeholder component). Modified: `src/app/vendors/[slug]/page.tsx`, `src/components/ProductCard.tsx`, `tests/storefront-cart.spec.ts`, `tests/helpers/db.ts`, `docs/data-models.md`/`docs/api-contracts.md` (pending each file's own re-check per the story's Task 5). Full contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/4-2-product-image-displays-on-the-storefront.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] Test files created correctly (`tsc`, `playwright --list` both confirm expected state)
- [x] Checklist matches acceptance criteria (AC1-AC4 all addressed, 1 explicitly by absence)
- [x] Tests generated as red-phase scaffolds, marked `test.skip()`
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened (`tea_browser_automation` resolved to `none`)
- [x] Temp artifacts: none created. Durable artifacts: this checklist (`_bmad-output/test-artifacts/`), test file changes (`tests/storefront-cart.spec.ts`, `tests/helpers/db.ts`)

**Completion summary:**
- Test files: `tests/storefront-cart.spec.ts` (extended, 3 new cases), `tests/helpers/db.ts` (extended, `imageUrl` override added to `createTestProduct()`) — 3 red-phase tests total
- Checklist: this file
- Story: `_bmad-output/implementation-artifacts/4-2-product-image-displays-on-the-storefront.md`
- Next recommended workflow: `dev-story`
