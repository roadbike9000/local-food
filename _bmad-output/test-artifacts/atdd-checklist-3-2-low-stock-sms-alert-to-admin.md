---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-22'
storyId: '3.2'
storyKey: '3-2-low-stock-sms-alert-to-admin'
storyFile: '_bmad-output/implementation-artifacts/3-2-low-stock-sms-alert-to-admin.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-3-2-low-stock-sms-alert-to-admin.md'
generatedTestFiles:
  - 'src/lib/sms/index.test.ts'
  - 'tests/inventory.spec.ts'
  - 'tests/webhooks.spec.ts'
  - 'tests/helpers/db.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/prds/prd-local-food-2026-08-10/addendum.md'
  - '_bmad-output/implementation-artifacts/3-1-admin-inventory-dashboard.md'
  - 'src/lib/inventory.ts'
  - 'src/lib/sms/index.ts'
  - 'src/lib/sms/index.test.ts'
  - 'src/app/api/webhooks/stripe/route.ts'
  - 'src/app/api/products/[id]/route.ts'
  - 'tests/inventory.spec.ts'
  - 'tests/webhooks.spec.ts'
  - 'tests/sms.spec.ts'
  - 'tests/helpers/db.ts'
  - 'prisma/schema.prisma'
---

# ATDD Checklist: Story 3.2 — Low-stock SMS alert to admin

## Step 1: Preflight & Context

- **Detected stack:** fullstack (Next.js App Router + API routes, Playwright + Vitest both configured) — unchanged from every prior run this project.
- **Framework:** Vitest for 2 new pure message-string builders; Playwright for everything touching Prisma (`decrementStock()`/`setStock()` signature changes, the webhook's SMS wiring) — no Clerk auth fixture needed anywhere in this story (a genuine break from every Epic 2/3.1 story, which all needed the still-unconfigured `E2E_ADMIN_*` credentials for at least some cases).
- **Prerequisites met:** story has clear ACs (6), `playwright.config.ts`/`vitest.config.mts` both configured, dev server startable, `STRIPE_WEBHOOK_SECRET` already configured in this dev environment (confirmed — prior stories' webhook tests run for real, not skipped).
- **Two breaking signature changes, not additions — different scaffolding approach than every prior story.** `decrementStock()` and `setStock()` already exist with different signatures; this story changes both. Rather than pre-migrating the ~12 existing call sites in `tests/inventory.spec.ts` to the new signatures (which would just be silently accepted as valid-but-wrong under the *old*, still-live code — verified by direct experiment, see below), the red-phase scaffolds here are **net-new test cases only**, appended alongside the untouched existing ones. `dev-story`'s own Tasks 2/3 are responsible for migrating the ~12 existing call sites in the same pass that changes the signatures — not a separate red-phase step.
- **Verified, not assumed: a naive 5-argument `setStock()` call using the new parameter order would silently typecheck under the *old* signature** (since both old and new shapes happen to have a same-length trailing optional/required tail) — the new scaffolded tests below use a 5th positional argument (`0`) chosen specifically to force a genuine `boolean` vs `number` type mismatch against the *old* signature, so they fail loudly (`tsc`) rather than silently compiling with wrong semantics. Confirmed via `npx tsc --noEmit` before finalizing this checklist.
- **Previous stories' learnings carried forward:**
  - `test.skip()` used for every new Playwright/Vitest case, none activated yet.
  - Dedicated fixtures only (`createTestProduct`, `createTestOrder`, and this story's new `createTestAdmin`) — never the seeded `corner-sourdough`/`green-valley-produce` vendors or the seeded `E2E_ADMIN_CLERK_ID` admin row.
  - `GET /api/debug/sms`'s `sentMessages` array is process-global and never cleared between tests — every new assertion filters by the fixture admin's own unique `phone`, never assumes array length/index (a fresh discipline this story's tests needed that no prior story's SMS coverage required, since `tests/sms.spec.ts`'s own existing case only checks the endpoint's shape, not specific message content).
- **Execution mode:** direct (no subagent dispatch) — matches Story 3.1's reasoning (single-author scope, low coordination risk), even though this story's scope is larger than 3.1's.

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear; scenarios are standard once the two signature-change decisions (already made during story creation, not left ambiguous) are taken as given. No recording needed — no CLI/MCP browser tool available in this run (`tea_browser_automation` resolves to `none`, same as every prior story).

## Step 3: Test Strategy

AC to scenario mapping:

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 1 | `Admin.phone` schema field exists (verified by every new Admin-touching test below failing to compile until it does) | N/A — schema-level, proven by the red-phase errors themselves | N/A |
| 2 | `lowStockAlertMessage()` includes product/vendor name, stock, threshold | Unit (Vitest) | P0 |
| 2, 3 | A decrement to at/below threshold reports `crossedLowStock: true` (unit level) and, end-to-end, sends an SMS + sets `lowStockAlerted` (webhook level) | Playwright (unit-style + e2e) | P0 |
| 2 | A decrement that stays above threshold reports `crossedLowStock: false` | Playwright | P0 |
| 4 | A failed send (mock provider's `MAGIC_FAILURE_NUMBER`) leaves `lowStockAlerted: false`, end-to-end | Playwright | P0 |
| 5 | A decrement while already `lowStockAlerted` reports `crossedLowStock: false` (unit level) and, end-to-end, a second webhook delivery sends no second SMS | Playwright | P0 |
| 5 | `setStock()` resets `lowStockAlerted` on a genuine restock above threshold; does NOT reset it when the write keeps stock at/below threshold | Playwright | P0 |
| 6 | `stockShortfallMessage()` includes product/vendor/order/requested/available | Unit (Vitest) | P0 |
| 6 | A shortfall sends a shortfall SMS regardless of `lowStockAlerted`'s state, end-to-end | Playwright | P0 |

**Not automated at this level:**
- The "fan out to every Admin with a phone, not just one" design decision (Dev Notes) — the new webhook tests each use exactly one `createTestAdmin` fixture; multi-admin fan-out is a straightforward loop with no distinct failure mode worth a dedicated concurrency-style test, and no AC calls for it explicitly.
- SMS content wording beyond "contains X" substring checks — matches the existing `orderConfirmedMessage()` test's own precision level, not pinning exact punctuation/phrasing.

**Known environment note, different from every prior Epic 2/3.1 story:** none of this story's own new tests need `E2E_ADMIN_EMAIL`/`E2E_ADMIN_CLERK_ID` (the still-open Epic 2 retro action item #1) — `decrementStock()`/`setStock()` are called directly, and the webhook is server-to-server, not behind `getCurrentAdmin()`'s page/route gate. Every new test is expected to run for real in this dev environment once its task lands, not skip.

**Red-phase note:** genuinely new/changed work — normal TDD red phase, expected to fail (missing exports → `tsc` errors; missing schema fields → `tsc` errors; old-signature type mismatches → `tsc` errors) until `dev-story` implements each task.

## Step 4: Red-Phase Test Generation

TDD Red Phase Validation: **PASS** — all 11 new test cases use `test.skip()`/`it.skip()`, assert real expected behavior (no placeholder assertions), and every one of them currently fails to typecheck for a task-attributable reason (verified directly, not narrated).

- **Unit tests (Vitest):** 2, both `it.skip()` — appended to the existing `src/lib/sms/index.test.ts`, joining `orderConfirmedMessage()`'s existing describe block with two new ones (`lowStockAlertMessage`, `stockShortfallMessage`).
- **Playwright — `tests/inventory.spec.ts`:** 5, all `test.skip()` — 2 new `setStock()` cases (restock-resets-alerted, stays-below-doesn't-reset) and 3 new `decrementStock()` cases (crosses-to-true, stays-above-false, already-alerted-stays-false).
- **Playwright — `tests/webhooks.spec.ts`:** 4, all `test.skip()` — appended to the existing `"stripe webhook - inventory decrement (Story 1.4)"` describe block: routine crossing sends SMS + sets flag, second delivery doesn't re-send, failed send leaves flag false, shortfall sends regardless of flag state.
- **Fixture built ahead of schedule:** `tests/helpers/db.ts`'s `createTestAdmin()`/`deleteTestAdmin()`, mirroring `createTestVendor()`'s exact shape — needed by all 4 new webhook tests.
- **Execution mode:** direct (no subagent dispatch).

**Verified independently, not just narrated:**
- `npx tsc --noEmit` — 21 errors total, every one directly attributable to an unimplemented task: 2 missing exports (Task 4's message builders), `Admin.phone`/`Product.lowStockAlerted` missing on the schema (Task 1), `decrementStock()`'s `.success`/`.crossedLowStock` not existing on `Boolean` (Task 2, confirms the *old* return type — `Promise<boolean>` — is still live, exactly as intended), and the two deliberate `boolean`-vs-`number` type mismatches proving the new `setStock()` calls don't silently pass under the old signature (see Step 1's verification note).
- `npx playwright test tests/inventory.spec.ts tests/webhooks.spec.ts --list` — 44 tests total (33 pre-existing + 11 new) all parse and list correctly; `tsc` errors inside `test.skip()` bodies don't block Playwright's own listing, matching the established pattern from every prior story's scaffolds.
- `npm run lint` — clean; no unused-variable/import warnings from the new skipped code.
- Read all 4 modified files in full after writing them and cross-checked against the story's own Task 2/3/5/7 bullets line by line — confirmed the `currentThreshold`-insertion argument order matches Task 3's exact spec, confirmed the shortfall test pre-sets `lowStockAlerted: true` specifically to prove AC #6's no-gating claim (not just asserting a send happened), confirmed the "second delivery" test uses two distinct `Order` fixtures against the *same* product (not two deliveries of the identical webhook event, which is a different, already-covered idempotency concern) to correctly exercise AC #5's "further sales" language.

Acceptance criteria coverage:
- AC1 (`Admin.phone`): covered indirectly — every new Admin-touching test's current compile failure IS the proof the field doesn't exist yet; no dedicated schema-shape test needed beyond that (matches Story 2.3's precedent for schema-only ACs).
- AC2 (crossing → SMS): covered (unit-level `crossedLowStock` cases + end-to-end webhook case)
- AC3 (`lowStockAlerted` only after success): covered (end-to-end webhook case asserts the flag directly)
- AC4 (failed send leaves flag false): covered (dedicated end-to-end case using the mock provider's failure number)
- AC5 (no repeat alerts until restock): covered at both levels — `decrementStock()`'s own already-alerted case, `setStock()`'s restock-reset/no-reset pair, and the webhook's second-delivery case
- AC6 (shortfall also alerts): covered (dedicated end-to-end case, deliberately pre-alerted to prove no gating)

## Next Steps (Task-by-Task Activation)

During `dev-story`, activate scaffolds task-by-task as each lands, not all at once:

1. Task 1 (schema: `Admin.phone`, `Product.lowStockAlerted`) lands → several `tsc` errors above resolve on their own (no test-file edit needed).
2. Task 2 (`decrementStock()` return-shape change) lands → **also update all 6 existing call-site assertions in `tests/inventory.spec.ts`'s `decrementStock` block in the same pass** (per the story's own Task 2 instruction) — this is not a separate red-phase step, it's part of implementing Task 2 itself. Then un-skip the 3 new `crossedLowStock` cases.
3. Task 3 (`setStock()` new `currentThreshold` param) lands → **also update all 6 existing call-site arguments in `tests/inventory.spec.ts`'s `setStock`/`setLowStockThreshold` block and the 1 production call site in `products/[id]/route.ts`**, same reasoning as Task 2. Then un-skip the 2 new restock-reset cases.
4. Task 4 (`lowStockAlertMessage()`/`stockShortfallMessage()`/`getAdminPhoneNumbers()`) lands → un-skip the 2 Vitest cases — run for real immediately (pure functions, no fixtures).
5. Task 5 (webhook wiring) lands → un-skip all 4 `tests/webhooks.spec.ts` cases — all expected to run for real immediately (no admin-credential gap blocks any of them, a first for this epic).
6. Run each activated test, confirm it fails first (true red), then implement until green.

## Implementation Guidance

No new files. Modified: `prisma/schema.prisma` (+ migration), `src/lib/inventory.ts`, `src/lib/sms/index.ts`, `src/lib/admin.ts`, `src/app/api/webhooks/stripe/route.ts`, `src/app/api/products/[id]/route.ts`, `tests/helpers/db.ts`, `tests/inventory.spec.ts`, `tests/webhooks.spec.ts`, `src/lib/sms/index.test.ts`, three docs files. Full contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/3-2-low-stock-sms-alert-to-admin.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] Test files created correctly (`tsc`, `playwright --list`, `lint` all confirm expected state)
- [x] Checklist matches acceptance criteria (AC1-6 all covered, with AC1 covered indirectly per its schema-only nature)
- [x] Tests generated as red-phase scaffolds, marked `test.skip()`/`it.skip()`
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened (`tea_browser_automation` resolved to `none`)
- [x] The "new tests might silently typecheck under the old signature" risk (unique to this story's breaking-change shape) was investigated and closed, not assumed away
- [x] Temp artifacts none created; durable artifacts in `_bmad-output/test-artifacts/`, `tests/`, `src/lib/`

**Completion summary:**
- Test files: `src/lib/sms/index.test.ts` (extended, 2 cases), `tests/inventory.spec.ts` (extended, 5 cases), `tests/webhooks.spec.ts` (extended, 4 cases), `tests/helpers/db.ts` (extended, `createTestAdmin`/`deleteTestAdmin`) — 11 red-phase tests total
- Checklist: this file
- Story: `_bmad-output/implementation-artifacts/3-2-low-stock-sms-alert-to-admin.md`
- Next recommended workflow: `dev-story`
