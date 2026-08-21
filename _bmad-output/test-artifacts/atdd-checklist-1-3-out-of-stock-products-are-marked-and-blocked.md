---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-18'
storyId: '1.3'
storyKey: '1-3-out-of-stock-products-are-marked-and-blocked'
storyFile: '_bmad-output/implementation-artifacts/1-3-out-of-stock-products-are-marked-and-blocked.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-1-3-out-of-stock-products-are-marked-and-blocked.md'
generatedTestFiles:
  - 'src/lib/inventory.test.ts'
  - 'tests/checkout-api.spec.ts'
  - 'tests/storefront-cart.spec.ts'
  - 'tests/helpers/db.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/selector-resilience.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-healing-patterns.md'
  - 'src/app/vendors/[slug]/page.tsx'
  - 'src/components/ProductCard.tsx'
  - 'src/app/dashboard/products/page.tsx'
  - 'src/app/api/checkout/route.ts'
  - 'src/components/CartProvider.tsx'
  - 'src/lib/inventory.ts'
  - 'prisma/schema.prisma'
  - 'tests/helpers/db.ts'
  - 'tests/checkout-api.spec.ts'
  - 'tests/storefront-cart.spec.ts'
---

# ATDD Checklist: Story 1.3 — Out-of-stock products are marked and blocked

## Step 1: Preflight & Context

- **Detected stack:** frontend (unchanged from Stories 1.1/1.2)
- **Framework:** Playwright (E2E/API) + Vitest (unit) — this story's new logic is a pure function, so unit coverage returns to Vitest after Story 1.2's DB-touching test had to move out to Playwright
- **Prerequisites met:** story has 3 clear ACs, Playwright/Vitest configured, dev server startable
- **Story shape:** a removal + read-site sweep, not new infrastructure — five existing files edited, one schema field dropped, zero new routes/components/models
- **Previous story (1.2) learnings carried forward:**
  - Pin exact contract strings (error messages, badge text) in the red-phase test itself, not left to dev-story's discretion — Story 1.2's review found a reworded message breaking a test invisibly (blocked by an unrelated skip) not once but twice across review rounds. This story's checkout-insufficiency message ("One or more items don't have enough stock") and the storefront badge text (`/out of stock/i`) are pinned here, in the scaffold, before implementation.
  - A DB-touching test belongs in Playwright, not Vitest (project-context.md's Testing Rules) — this story's only new logic (`isInStock()`) is a pure function with zero Prisma/Clerk dependency, so it correctly goes in Vitest from the start; no repeat of that mistake needed here.
  - Read every file being modified in full before writing tasks — this story's context-gathering ran a dedicated research pass across all 9 files referencing `isAvailable` before any task was written, to avoid missing a read site (exactly the failure mode AD-2 exists to prevent).

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear, scenarios are standard (schema drop + computed-availability read sites + a checkout validation rule). No recording needed.

## Step 3: Test Strategy

AC to scenario mapping:

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 1 | Out-of-stock product renders visibly with a badge, "Add" button disabled | E2E (Playwright, unauthenticated storefront) | P0 |
| 2 | `isInStock()` computes availability from `stockQuantity` alone | Unit (Vitest) | P1 |
| 2 | Dashboard "Available" column reads `isInStock(p)`, not a dropped column | Covered implicitly by Task 4 compiling/running at all post-migration — no dedicated new test; existing dashboard e2e coverage is unauthenticated-redirect only for this page today (stale Clerk fixture) | N/A |
| 3 | Checkout rejects a cart line requesting more than available stock (400), whole order rejected | API (Playwright `request` fixture) | P0 |
| 3 | Checkout rejects when stock drops below cart quantity between add-to-cart and submission | E2E (Playwright, unauthenticated storefront + cart + checkout) | P0 |

**Both checkout scenarios are P0** — this mirrors Story 1.2's own precedent (ownership scoping, optimistic-lock conflict) of treating money/inventory-integrity paths as top-tier regardless of how "obvious" the fix looks, per this codebase's own documented discipline in `project-context.md`.

**No dedicated test for AC #2's dashboard column** — Story 1.2 already established that this page's authenticated e2e coverage is blocked by the stale Clerk fixture (tracked in `deferred-work.md`); a new authenticated test here would ship skipped for the same pre-existing reason and add no real coverage today. The read itself is exercised implicitly: if `isInStock()` didn't exist or the column reference were wrong, `npx tsc --noEmit` fails immediately (this file has no dynamic/loose typing), which is a stronger and cheaper signal than an e2e test that can't run anyway.

**Red-phase note:** every scenario above is a normal TDD red phase — all are expected to **fail** today, either by compile error (`isInStock` doesn't exist) or by behavioral mismatch (badge/disabled-state missing, checkout still using the existence-only `isAvailable` filter instead of a sufficiency check).

## Step 4: Red-Phase Test Generation (Aggregated)

TDD Red Phase Validation: PASS — all 6 new/changed test cases assert real expected behavior (no placeholders); the 3 genuinely-new-behavior tests use `test.skip()`/fail to import, `expected_to_fail: true`.

- **Unit tests (Vitest):** 3 — `src/lib/inventory.test.ts` (new file, genuinely fails to import today: `isInStock` doesn't exist — that's this file's red phase)
- **E2E tests (Playwright `page` fixture, unauthenticated — no stale-fixture blocker):** 2 — `tests/storefront-cart.spec.ts`: "out-of-stock products show a badge and a disabled Add button" (new, `test.skip`), "checkout shows an error when a cart item's stock drops below the cart quantity before submitting" (rewritten from the old `isAvailable`-toggling version, `test.skip`)
- **API tests (Playwright `request` fixture, unauthenticated):** 1 — `tests/checkout-api.spec.ts`: "rejects a cart requesting more than the available stock (400)" (rewritten from the old `isAvailable:false` version, `test.skip`)
- **Existing-suite fixes (not red-phase, already green — Story 1.2 precedent: "fix the existing suite first"):**
  - `tests/checkout-api.spec.ts`'s "total is computed from DB prices" test: `vendor.products.find((p) => p.isAvailable)` → `(p) => p.stockQuantity > 0` — same product, same semantics, today's seed data (all `isAvailable: true` and `stockQuantity: 100`) makes this a no-op change that keeps passing right now and keeps passing after Task 1 drops the column
  - `tests/helpers/db.ts`'s `createTestProduct`: removed the `isAvailable` override (type + create-data field) — no remaining caller references it after the two spec-file rewrites above, and once Task 1's migration lands, a create call referencing a dropped column would fail at the type level
- **Pinned contracts (dev-story must match exactly):**
  - Checkout's new insufficient-stock error message: `"One or more items don't have enough stock"`
  - Storefront out-of-stock badge text: matched via `/out of stock/i` (case-insensitive substring — exact casing/wording beyond containing "out of stock" is dev-story's call)
- **Execution mode:** DIRECT (single-agent — story is small enough not to warrant parallel subagent dispatch; unlike Story 1.2's 23 cases across 4 files, this is 6 cases across 4 files with heavy read-site overlap that's faster to reason about in one pass)

**Verified before finalizing:**
- `npx tsc --noEmit` — exactly one new error (`Module '"./inventory"' has no exported member 'isInStock'`), the correct red-phase signal, no stray type errors elsewhere
- `npm run lint` — clean
- `npm run test:unit` — 55 pre-existing tests still pass unchanged; 3 new `isInStock` tests fail with `TypeError: isInStock is not a function` (correct red)
- `npx playwright test tests/storefront-cart.spec.ts tests/checkout-api.spec.ts --list` — all 6 tests in both files parse and list correctly (3 skipped, 3 active)
- `npx playwright test tests/storefront-cart.spec.ts tests/checkout-api.spec.ts` — 3 skipped (the red-phase scaffolds), 3 passed (the fixed-selector total-check test, the unaffected "can add a product" test, and Story 1.1's unaffected cart-removal test) — confirms the "fix existing suite" edits introduced zero regressions

Acceptance criteria coverage:
- AC1 (out-of-stock badge + disabled Add): covered (E2E)
- AC2 (isAvailable dropped, computed everywhere): covered (unit for the helper; dashboard read covered implicitly by compilation, per Step 3's reasoning)
- AC3 (checkout per-line sufficiency, whole-order rejection): covered (API + E2E)

## Next Steps (Task-by-Task Activation)

During `dev-story`, activate scaffolds task-by-task as each is implemented, not all at once:

1. Task 1 (drop `isAvailable` migration) lands first — no test activates here, but this is the precondition every other task's read-site change depends on
2. Task 2 (`isInStock()` in `src/lib/inventory.ts`) lands → un-skip `src/lib/inventory.test.ts`'s 3 cases
3. Task 3 (storefront badge + disabled Add) lands → un-skip `tests/storefront-cart.spec.ts`'s "out-of-stock products show a badge and a disabled Add button"
4. Task 4 (dashboard computed column) lands → no dedicated test to un-skip (see Step 3's reasoning); confirm via `npx tsc --noEmit` and a manual look
5. Task 5 (checkout sufficiency check) lands → un-skip `tests/checkout-api.spec.ts`'s "rejects a cart requesting more than the available stock (400)" and `tests/storefront-cart.spec.ts`'s "checkout shows an error when a cart item's stock drops below the cart quantity before submitting" — both depend on the exact pinned message string above
6. Task 6 (existing test fixes) is already done as part of this red-phase generation, not a separate dev-story activation step
7. Run each activated test, confirm it fails first (true red — most already reconfirmed above), then implement until green

## Implementation Guidance

- `isInStock()` belongs in `src/lib/inventory.ts` — every other stock-derived concern already lives there (`PLACEHOLDER_*`, `setStock()`, `setLowStockThreshold()`); do not create a new file or a `src/lib/availability.ts`.
- Do not add a transaction, a decrement, or any write to `stockQuantity` in this story — checkout only validates and rejects, it never mutates stock. That is Story 1.4's `decrementStock()`, which does not exist yet.
- Do not build a separate storefront "detail" route — `src/app/vendors/[slug]/page.tsx` is the only storefront file in this codebase; the epic's "listing or detail" language collapses to just "listing" here.
- Keep the disabled "Add" button present (not hidden/removed) when out of stock — it keeps its accessible role/name for the E2E scaffold's `getByRole("button", { name: "Add" })` locator, and matches AC #1's literal wording ("disabled," not "removed").
