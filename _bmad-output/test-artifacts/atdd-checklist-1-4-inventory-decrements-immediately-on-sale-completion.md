---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-19'
storyId: '1.4'
storyKey: '1-4-inventory-decrements-immediately-on-sale-completion'
storyFile: '_bmad-output/implementation-artifacts/1-4-inventory-decrements-immediately-on-sale-completion.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-1-4-inventory-decrements-immediately-on-sale-completion.md'
generatedTestFiles:
  - 'tests/inventory.spec.ts'
  - 'tests/webhooks.spec.ts'
  - 'tests/helpers/db.ts'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md'
  - '_bmad-output/project-context.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/data-factories.md'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/test-healing-patterns.md'
  - 'src/lib/inventory.ts'
  - 'src/app/api/webhooks/stripe/route.ts'
  - 'src/app/api/checkout/route.ts'
  - 'prisma/schema.prisma'
  - 'tests/inventory.spec.ts'
  - 'tests/webhooks.spec.ts'
  - 'tests/helpers/db.ts'
  - 'tests/payment.spec.ts'
  - '_bmad-output/implementation-artifacts/1-3-out-of-stock-products-are-marked-and-blocked.md'
  - '_bmad-output/implementation-artifacts/1-2-stock-quantity-captured-at-creation-backfilled-for-existing-products.md'
---

# ATDD Checklist: Story 1.4 — Inventory decrements immediately on sale completion

## Step 1: Preflight & Context

- **Detected stack:** fullstack (Playwright API/E2E only for this story — no new UI, no new Vitest coverage; Testing Rules route anything touching Prisma to Playwright)
- **Framework:** Playwright (E2E/API). No Vitest involved — every new behavior in this story touches Prisma directly (`decrementStock()`, the webhook route, the concurrency tests), and `decrementStock()` is deliberately kept out of `availability.ts` (the Prisma-free module Vitest/client components use).
- **Prerequisites met:** story has 6 clear ACs with an extensive Dev Notes section already resolving the design (transaction shape, idempotency guard reusing `Order.status`, `decrementStock()`'s exact signature); Playwright configured; dev server startable.
- **Story shape:** first `prisma.$transaction()` usage in this codebase, first committed concurrency test in this codebase (Story 1.2's review verified `setStock()`'s race by hand, never automated). Extends two existing files (`tests/inventory.spec.ts`, `tests/webhooks.spec.ts`) plus one fixture helper (`tests/helpers/db.ts`) — no new test files.
- **Previous story (1.3) learnings carried forward:**
  - Dedicated `createTestProduct`/`createTestOrder` fixtures only, never shared seed data — `fullyParallel: true` plus this story's own tests deliberately mutating `stockQuantity` down to 0/1 makes this the exact failure mode Story 1.3's round-1/round-2 reviews already found and fixed once.
  - A DB-touching test belongs in Playwright, not Vitest (`project-context.md`'s Testing Rules) — every new export/route change in this story touches Prisma directly, so unlike Story 1.3's `isInStock()`, nothing here goes in `src/lib/inventory.test.ts`-style Vitest coverage.
  - Genuine concurrency needs `Promise.all` firing real simultaneous calls/requests, not sequential awaits — the story's own Dev Notes flag this as "the one place in this story where getting the test shape wrong makes it silently pass without proving anything." Built from `payment.spec.ts`'s existing `Promise.all` pattern.

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear, the Dev Notes already specify the exact function signature, transaction shape, and idempotency design — no ambiguity requiring a recording/discovery pass.

## Step 3: Test Strategy

AC to scenario mapping:

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 1 | `decrementStock()` conditional update succeeds/fails correctly | API (Playwright, direct Prisma via `tests/inventory.spec.ts`) | P0 |
| 1 | Webhook decrements stock by ordered quantity on first PAID transition | API (Playwright `request` fixture, `tests/webhooks.spec.ts`) | P0 |
| 2 | Multi-item order: all line decrements happen inside one transaction | API (Playwright, `tests/webhooks.spec.ts`) | P0 |
| 3 | Two concurrent `decrementStock()` calls on the last unit — exactly one success, one rejection | API (Playwright, `Promise.all`, `tests/inventory.spec.ts`) | P0 |
| 3 | Two concurrent webhook calls for two different orders on the last unit — same guarantee end-to-end | API (Playwright, `Promise.all`, `tests/webhooks.spec.ts`) | P0 |
| 4 | `/api/checkout` makes zero stock writes | Verification only — no new test (see below) | N/A |
| 5 | Post-payment shortfall: 200 returned, order still PAID, stock unchanged, rolled back atomically | API (Playwright, `tests/webhooks.spec.ts`) | P0 |
| 6 | Replayed webhook does not double-decrement | API (Playwright, `tests/webhooks.spec.ts`) | P0 |

**Every scenario is P0** — this is the money/inventory-integrity path (NFR1's literal "no overselling the last unit" wording), consistent with this codebase's documented discipline of treating these paths as top-tier regardless of how bounded the diff looks (Story 1.2/1.3 precedent).

**AC #4 has no dedicated new test.** `src/app/api/checkout/route.ts` was read in full for this story: it only reads `stockQuantity` (Story 1.3's sufficiency check) and never writes it. This story's own Task 2/3 scope confines all writes to the webhook route. If a future change accidentally added a write to `/api/checkout`, the existing `tests/checkout-api.spec.ts` total-computation test would not catch it (it doesn't assert on `stockQuantity` post-checkout) — flagged here as a coverage gap that exists independent of this story, not introduced by it; not in scope to fix under this story's ACs.

**Red-phase note:** every new/changed scenario below is a normal TDD red phase — all fail today because `decrementStock()` doesn't exist (`tests/inventory.spec.ts`'s new import breaks type-resolution — confirmed via `tsc --noEmit`) and the webhook route has no stock-decrement logic, no transaction, and no `PENDING`→`PAID` idempotency guard (confirmed by reading the route in full).

## Step 4: Red-Phase Test Generation

TDD Red Phase Validation: PASS — all 10 new test cases assert real expected behavior (no placeholders); every one uses `test.skip("name", async (...) => {...})` as the top-level function (not a runtime `test.skip(condition, reason)` call), matching the confirmed convention from `git show 8b5fbd7` and Story 1.3's ATDD commit.

- **`tests/inventory.spec.ts` (extended, 5 new cases, `decrementStock (Story 1.4)` describe block):**
  - `decrements stockQuantity by exactly quantity when enough stock exists`
  - `returns false and leaves stockQuantity unchanged when insufficient`
  - `boundary: quantity exactly equal to stockQuantity succeeds and lands at 0`
  - `boundary: quantity one more than stockQuantity fails and never goes negative`
  - `two concurrent decrementStock calls against the last unit resolve to exactly one success and one rejection (AC #3)` — genuine `Promise.all` over two independent `prisma.$transaction()` calls, each running `decrementStock()`
  - All red today via the file's new `import { decrementStock, ... } from "@/lib/inventory"` — `decrementStock` has no export yet (`tsc --noEmit` reports exactly one new error: `Module '"@/lib/inventory"' has no exported member 'decrementStock'`). `test.skip()` means the runtime `TypeError` this would otherwise throw is never hit.
- **`tests/webhooks.spec.ts` (extended, 5 new cases, `stripe webhook - inventory decrement (Story 1.4)` describe block):**
  - `checkout.session.completed decrements stock by exactly the ordered quantity (AC #1)`
  - `multi-item order: one webhook call decrements both products' stock together inside one transaction (AC #2)`
  - `shortfall discovered at decrement time: webhook still returns 200, order still becomes PAID, stock is left unchanged (AC #5)`
  - `idempotency: a replayed webhook does not decrement stock a second time (AC #6)`
  - `end-to-end race: two orders competing for the last unit resolve to exactly one decrement, both webhooks still 200 (AC #3)` — genuine `Promise.all` over two concurrent `request.post()` calls against two separate dedicated orders sharing one dedicated product
  - All red today: the current route unconditionally sets `status: "PAID"` with no stock write at all, so every assertion on `stockQuantity` changing (or staying pinned under shortfall/replay) fails against current behavior. Same `test.skip(!signature, "STRIPE_WEBHOOK_SECRET not configured; skipping")` guard as the file's existing tests — no mocking of Stripe.
- **Fixture extension (not red-phase, made directly — Task 4):** `tests/helpers/db.ts`'s `createTestOrder()` now accepts an optional `items: { productId, quantity, unitPriceCents }[]` override, nested into the `prisma.order.create()` call (`items: { create: [...] }`), mirroring `src/app/api/checkout/route.ts`'s existing nested-create pattern. `deleteOrder()` needed no change — its existing `orderItem.deleteMany` before `order.deleteMany` already handles real `OrderItem` rows.
- **Not tested directly: `Sentry.captureException` invocation on shortfall.** The shortfall test (`tests/webhooks.spec.ts`) asserts the externally-observable contract from Task 6's own bullet (200, `PAID`, `stockQuantity` unchanged) but does not assert Sentry was called — there's no existing Sentry-mocking precedent in this codebase (`grep -rn "Sentry" tests/` returns nothing), and "no mocking" here specifically covers Stripe/Clerk/Twilio per `project-context.md`, not Sentry — but building a first-of-its-kind Sentry assertion harness wasn't asked for by Task 6's literal scope. **Flagged for human decision**, not silently resolved: if Sentry visibility on this exact path needs regression protection, that's an explicit scope addition to make, not an oversight in this scaffold.
- **Execution mode:** DIRECT (single-pass) — the story's Dev Notes were detailed enough (exact signatures, exact fixture needs) that parallel subagent dispatch wasn't needed.

**Verified before finalizing:**
- `npx tsc --noEmit` — exactly one new error (`Module '"@/lib/inventory"' has no exported member 'decrementStock'`), the correct red-phase signal, no stray type errors elsewhere.
- `npm run lint` — clean.
- `npx playwright test tests/inventory.spec.ts tests/webhooks.spec.ts --list` — all 21 tests (11 pre-existing + 10 new) parse and list correctly.
- `npx playwright test tests/inventory.spec.ts tests/webhooks.spec.ts` — 10 skipped (the new red-phase scaffolds), 11 passed (all pre-existing `setStock`/`setLowStockThreshold`/webhook tests) — confirms the `tests/helpers/db.ts` fixture extension introduced zero regressions.
- `npm run test:unit` — 58 pre-existing unit tests still pass unchanged (this story adds no Vitest coverage).

Acceptance criteria coverage:
- AC1 (conditional decrement on PENDING→PAID, never negative): covered (`tests/inventory.spec.ts` unit-of-behavior cases + `tests/webhooks.spec.ts` happy path)
- AC2 (multi-item order, one transaction, all-or-nothing): covered (`tests/webhooks.spec.ts` multi-item case + shortfall rollback case)
- AC3 (two concurrent decrements on last unit → exactly one success): covered twice — library-level (`tests/inventory.spec.ts`) and end-to-end (`tests/webhooks.spec.ts`)
- AC4 (no write at checkout-session creation): verification only, no dedicated test — see Step 3 above
- AC5 (shortfall doesn't fail webhook, doesn't over-decrement, surfaced not swallowed): covered for the observable contract (`tests/webhooks.spec.ts`); Sentry-call assertion explicitly out of scope, flagged above
- AC6 (replay-safe, no double-decrement): covered (`tests/webhooks.spec.ts` idempotency case)

## Next Steps (Task-by-Task Activation)

During `dev-story`, activate scaffolds task-by-task as each is implemented, not all at once:

1. Task 1 (`decrementStock()` in `src/lib/inventory.ts`) lands → un-skip `tests/inventory.spec.ts`'s 5 new cases; confirm each fails first if run individually before the function exists, then implement until green.
2. Task 2 (wire `decrementStock()` into the webhook route, transaction + idempotency guard + shortfall catch) lands → un-skip `tests/webhooks.spec.ts`'s 5 new cases in this order: happy path → multi-item → shortfall → idempotency → end-to-end race (each layers on the prior one's correctness).
3. Task 3 (`/api/checkout` verification) requires no test activation — confirm by inspection only, per Step 3's reasoning.
4. Task 4 (`tests/helpers/db.ts` extension) is already done as part of this red-phase generation, not a separate dev-story activation step.
5. Task 7 (`docs/api-contracts.md`/`docs/data-models.md` housekeeping) has no associated test — a documentation-only task, verify by reading the updated docs.
6. Run each activated test, confirm it fails first (true red — most already reconfirmed above), then implement until green.

## Implementation Guidance

- `decrementStock()` goes directly into `src/lib/inventory.ts` (no new file), matching `setStock()`'s exact doc-comment/conditional-update-then-count-check shape — see Dev Notes for the precise `tx.product.updateMany({ where: { id, stockQuantity: { gte: quantity } }, ... })` body.
- The webhook route's restructure (`updateMany` status guard → `findUnique` with `items` → `$transaction` looping `order.items` → sentinel `StockShortfallError` → `Sentry.captureException` on catch) is Task 2's job — this scaffold does not touch `src/app/api/webhooks/stripe/route.ts`.
- Do not build Story 3.2's threshold-crossing/low-stock-SMS plumbing here — `decrementStock()` returns only `boolean`, nothing more (Dev Notes are explicit about this discipline).
- Do not add a `setStock()` ABA-race fix as part of this story — `_bmad-output/implementation-artifacts/deferred-work.md`'s entry on this remains open and unaddressed by this story's scope (the story's own Dev Notes explicitly flag this as a human decision, not silently resolved here either).
- Once this story ships, `project-context.md`'s "Webhook is not idempotency-guarded beyond `smsNotified`" line becomes stale and should be updated (Dev Notes, last paragraph) — housekeeping, not a test-scaffold concern.

## Flagged for Human Decision

1. **Sentry-call assertion on the shortfall path is not tested.** No existing Sentry-mocking precedent exists in this codebase, and Task 6's literal scope doesn't call for one. The shortfall test covers the externally-observable contract (200/PAID/stock-unchanged) but not "was `Sentry.captureException` actually invoked." If this needs regression protection, it's a scope decision for a human, not an oversight silently patched into this scaffold.
2. **The `setStock()` ABA-race deferred-work entry remains open.** `deferred-work.md` suggested folding a fix into "whichever story first introduces a real second writer" — which is this story — but neither this story's ACs nor Dev Notes call for a `setStock()` change, so it's left untouched here, exactly as the story's own Dev Notes direct.

Everything else in this story's scope was unambiguous given the Dev Notes' level of detail (exact signatures, exact transaction shape, exact idempotency design) — no other open questions.
