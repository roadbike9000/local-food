---
title: Good-Spine Checklist Review — Admin & Inventory Expansion Spine
target: architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md
lens: 7-item good-spine checklist (divergence coverage, AD enforceability, Deferred safety, tech currency, brownfield ratification, PRD coverage, structural-dimension ownership)
reviewed: 2026-08-10
verdict: NEEDS REVISION
---

# Good-Spine Checklist Review — Admin & Inventory Expansion Spine

## Method

Walked all seven checklist items against `ARCHITECTURE-SPINE.md`, cross-checked against `prd.md` + `addendum.md`, and verified specific claims directly in the repo: `prisma/schema.prisma`, `src/middleware.ts`, `src/lib/vendor.ts`, `src/app/api/checkout/route.ts`, `src/app/api/webhooks/stripe/route.ts`, `src/components/CartProvider.tsx`, `src/components/dashboard/AddProductForm.tsx`, `src/app/vendors/[slug]/page.tsx`, `src/app/dashboard/products/page.tsx`, `src/lib/sms/*`, `_bmad-output/project-context.md`. Two other reviews already sit in this folder (`review-tech-verify.md`, `review-reconcile-prd.md`) covering factual/version accuracy and PRD↔spine mapping respectively; where this pass reproduces one of their findings under this checklist's lens, it's cited rather than re-derived. Two findings below (#1, #3) are not present in either prior review.

## Overall Verdict

**NEEDS REVISION.** Five of seven checklist items pass. Two fail in a way that matters: two of the six ADs (AD-2, AD-3), read literally, do not actually prevent the divergence/bug their own "Prevents" clause names — one produces an overselling bug (checkout accepts orders exceeding available stock as long as stock > 0), the other produces a false-positive low-stock alert flag (set before SMS delivery is confirmed). Both are concrete, build-blocking-if-uncaught problems, not style nits — the checklist calls these out for exactly this reason ("Every AD's Rule is enforceable and actually prevents its stated divergence").

## Checklist Walkthrough

### 1. Fixes the real divergence points for the level below, misses none — PARTIAL

Most divergence points are correctly identified and fixed (admin-identity resolution, stock-write races, vendor-active checks, admin route gating). Two real ones are missed — see Findings #2 and #4.

### 2. Every AD's Rule is enforceable and actually prevents its stated divergence — FAIL

AD-3 passes on the stock-quantity half but fails on the `lowStockAlerted` half (Finding #2). AD-2's rule is enforceable as literally written but under-delivers the FR-7 consequence it's mapped to (Finding #1). AD-1, AD-5, AD-6 are enforceable and sound — verified their prescribed shapes (`getCurrentVendor()`-style resolver, plain FK attribution, middleware + explicit check) exist and mirror real, working precedent in the codebase.

### 3. Nothing under Deferred could let two units diverge — PASS

All four Deferred items are either one-time decisions with no repeated call sites (FR-12 backfill default — a single migration, not an ongoing pattern), explicit Non-Goal reaffirmations (multi-tier admin), unchanged-and-verified-true state (deployment topology — see item 7), or a rejected-alternative note (Clerk-claim admin identity) with no live ambiguity. None of these is a rule two independently-built call sites could interpret differently.

### 4. Named tech is verified-current — PASS

Cross-checked against `package.json`/lockfile findings already in `review-tech-verify.md` (Next 14.2.13, Prisma ^5.20/resolved 5.22, Clerk ^5.7.6 — spine names match or are normal-shorthand-accurate). Independently confirmed the spine's SMS reference points at the *current* post-migration module (`src/lib/sms/index.ts` + `providers/{twilioProvider,mockProvider}.ts`), not the retired `src/lib/twilio.ts` — notable because `project-context.md` itself (dated 2026-07-19, pre-dating the mock-provider merge) still refers to bare "Twilio 5.3," so the spine is more current than its own inherited project-context file on this point.

### 5. Ratifies rather than contradicts the brownfield codebase — PASS

Every concrete brownfield claim checked out exactly as stated: `getCurrentVendor()` (`src/lib/vendor.ts`) matches the shape AD-1/AD-6 say `getCurrentAdmin()` should mirror; `isProtectedRoute` matcher in `src/middleware.ts` is real (`createRouteMatcher(["/dashboard(.*)"])`); the `isAvailable: true` filters AD-2 names are real and verbatim at `src/app/api/checkout/route.ts:28` and `src/app/vendors/[slug]/page.tsx:16`; `Order.smsNotified`'s check-before-send/set-after-success pattern (`src/app/api/webhooks/stripe/route.ts:55-66`) matches what the spine says `lowStockAlerted` should mirror (the *shape* claim holds even though Finding #2 shows the *timing* doesn't); `Vendor`/`Product`/`Order`'s existing `onDelete: Cascade` relations are correctly left undisturbed since FR-4 is soft-delete-only (`UPDATE`, never `DELETE`) — the spine doesn't claim otherwise and doesn't need to.

### 6. If a spec/PRD drove it, it covers that PRD's capabilities — PARTIAL

All PRD-bound FRs (FR-1,2,3,4,6,7,8,9,10,11,12) appear in the Capability → Architecture Map. One explicitly-testable FR consequence has no governing AD and no Deferred entry: FR-3's "slug collisions are rejected with a clear error, not a raw DB constraint failure" — already flagged as Gap 2 in `review-reconcile-prd.md`; this pass concurs and notes the same absence surfaces as a second symptom in the spine's own Consistency Conventions table (Finding #4).

### 7. Every structural dimension this altitude owns is decided/deferred/open, especially deployment & environments — PASS

The spine's Deferred section explicitly addresses deployment/environment topology ("unchanged by this work; no new env vars, no new external service, Vercel assumption... stands as-is") rather than leaving it silent. Verified against `project-context.md:84` ("deployment is assumed to be Vercel but not configured in-repo") — claim matches verbatim, and independently confirmed this PRD's scope introduces no new external service or env var (Admin is an in-app table; SMS reuses the existing provider-abstracted `sendSms`; no scheduling/queue infra per PRD's own note on FR-9/FR-10). This dimension is not silently missing.

## Findings (severity-ranked)

### 1. HIGH — AD-2's literal rewrite doesn't enforce FR-7's actual requirement ("stock ≥ requested quantity"), only "stock > 0"

**Where:** ARCHITECTURE-SPINE.md, AD-2 (lines 47-51) and the FR-6/FR-7 row of the Capability → Architecture Map (line 134).

AD-2's rule is explicit and literal: `where: { isAvailable: true }` "rewritten to `where: { stockQuantity: { gt: 0 } }`" at `src/app/api/checkout/route.ts` and the storefront listing query. But FR-7's testable consequence (prd.md §4.4) is stronger: "Server-side checkout re-validates Stock Quantity **≥ requested quantity** at order-creation time." A product with `stockQuantity: 1` and a cart line requesting `quantity: 5` passes `stockQuantity: { gt: 0 }` cleanly — the checkout route's current `products.length !== items.length` guard (verified in `src/app/api/checkout/route.ts:26-34`) only checks that every requested product *exists and has any stock*, never that available stock covers the requested quantity. No other AD covers this: AD-3 governs the decrement-time conditional update inside `adjustStock()`, which runs later, at webhook/payment-confirmation time — by then the customer has already been charged via Stripe and the order already created. A downstream builder following AD-2's rule exactly as written ships a real overselling bug at the checkout boundary, the exact failure mode FR-7 exists to close ("never trust client state").

**Fix shape:** AD-2 (or a new rule) needs to state that checkout's per-item validation compares `stockQuantity` against each requested line's `quantity`, not just against zero.

### 2. HIGH — AD-3's `lowStockAlerted`-in-the-same-call timing contradicts FR-10's don't-mark-delivered-until-sent requirement

**Where:** ARCHITECTURE-SPINE.md, AD-3 (lines 53-57): "The same function \[`adjustStock()`\] flips `lowStockAlerted`... within the same call."

Already identified as Gap 1 in `review-reconcile-prd.md`; this pass independently confirms it fails checklist item 2 specifically ("Rule... actually prevents its stated divergence"). `adjustStock()` is a data-layer conditional `UPDATE`; `sendSms()` necessarily runs after it returns (the caller needs to know a threshold was crossed before it has anything to send). Setting `lowStockAlerted = true` inside `adjustStock()`'s own call sets the flag before the SMS attempt starts, so a failed `sendSms()` leaves the flag falsely "alerted" — precisely the outcome FR-10 forbids, and the addendum explicitly says to mirror the `smsNotified` check-before-send/set-after-success discipline that `src/app/api/webhooks/stripe/route.ts:55-66` actually implements today. AD-3's own rationale for the *stock* half (conditional update to close a race) isn't applied to the *alert-flag* half.

### 3. MEDIUM — AD-4's `assertVendorActive()` has no defined contract, leaving storefront-message vs. checkout-rejection unreconciled

**Where:** ARCHITECTURE-SPINE.md, AD-4 (lines 59-63).

AD-4 mandates a single shared guard, `assertVendorActive(vendor)`, called by both the storefront route and the checkout API — but doesn't specify whether it throws or returns a boolean/result. The two call sites have genuinely different needs: the checkout API (`src/app/api/checkout/route.ts`) wants a reject-with-error-response outcome, which a throw-and-catch pattern serves naturally. The storefront route (`src/app/vendors/[slug]/page.tsx`, verified: currently `notFound()` on missing vendor, full listing render otherwise — no existing "deactivated" branch) must instead render the specific message FR-4 requires ("this vendor is no longer available," not a blank 404, not a generic error). An "assert"-named function that throws is the wrong shape for a Server Component that needs to conditionally render UI, not crash — an implementer under deadline could reasonably decide to bypass the shared guard on the storefront side (e.g., inline-check `vendor.deletedAt` there instead) specifically to get correct rendering, which is exactly the two-call-sites-disagreeing divergence AD-4 exists to prevent.

**Fix shape:** specify the function's return contract (e.g., `assertVendorActive` throws for API use; a paired `isVendorActive(vendor): boolean` or the storefront route catching and rendering serves the Server Component case) so both consumers are still funneled through one source of truth.

### 4. MEDIUM — AD-2's enumerated call sites miss `src/app/dashboard/products/page.tsx:40`

**Where:** ARCHITECTURE-SPINE.md, AD-2 (lines 47-51).

Already identified as Finding 1 in `review-tech-verify.md`; corroborated independently via `grep -rn "isAvailable" src/`. `src/app/dashboard/products/page.tsx:40` reads `p.isAvailable` for display (not a filter), from an unscoped `findMany`. AD-2's rule names only two rewrite targets (checkout route, storefront listing filter); dropping the `Product.isAvailable` column as the rule mandates breaks this third site at the type level. Low risk of shipping silently (TypeScript/CI would catch it), but a story-writer trusting AD-2's enumerated list as exhaustive will miss it and burn an unplanned fix cycle.

### 5. MEDIUM — FR-3's slug-collision requirement has no architectural home

**Where:** ARCHITECTURE-SPINE.md, Capability → Architecture Map, FR-3/FR-4 row (line 133); Consistency Conventions table, "error shapes" column (line 79-83).

Already identified as Gap 2 in `review-reconcile-prd.md`; this pass adds one corroborating data point: the Consistency Conventions table has a column literally labeled "error shapes" but its row content never actually states an error-shape convention (it jumps straight to `stockQuantity`/`lowStockThreshold` data types) — the exact gap FR-3 needs filled ("rejected with a clear error, not a raw DB constraint failure"). Confirmed via `grep` that no slug-collision handling exists anywhere in the current codebase (`Vendor` creation today only happens in `prisma/seed.ts`) — this is genuinely new ground with zero precedent to inherit, and none of AD-1/AD-4/AD-5/AD-6 (the four ADs the FR-3 row cites) touches it.

### 6. LOW — `onDelete: Cascade` removal not carried into the Structural Seed

Already identified as Gap 3 in `review-reconcile-prd.md`, low severity — confirmed the schema still has `onDelete: Cascade` on `Vendor → Product` (`prisma/schema.prisma:46`) and `Vendor → Order` (`:82`), and the addendum's defense-in-depth suggestion to remove it isn't reflected in the spine's Structural Seed. Since FR-4 is soft-delete-only (`UPDATE`, never `DELETE`), this cascade config is inert under correct implementation — genuinely low risk, worth a one-line note rather than a blocker.

### 7. LOW — FR-11's stepper ceiling-clamp data flow is ungoverned

**Where:** ARCHITECTURE-SPINE.md, Capability → Architecture Map, FR-1/FR-11 row (line 131): governed only by "Paradigm (client-side state, unchanged)."

FR-11's testable consequence requires the stepper to clamp at "the Product's Stock Quantity... once inventory tracking lands" (prd.md §4.4). `CartProvider` (verified: `src/components/CartProvider.tsx`) holds only `productId`/`name`/`priceCents`/`quantity` per line today — no stock figure. Nothing in the spine says how the client-side ceiling learns the product's current `stockQuantity` (fetched at add-to-cart time and possibly stale by stepper-time, or re-fetched). Low severity because the real enforcement is server-side at checkout (Finding #1's concern, not this one) and a stale client-side ceiling is a UX rough edge, not a correctness bug — but it's a genuine silent gap at this altitude's own paradigm layer.

## Non-Findings (checked, no gap)

- AD-1, AD-5, AD-6: enforceable, sound, verified against real precedent (`getCurrentVendor()` shape, `smsNotified`-style plain-field attribution, middleware + explicit-check pattern).
- Deferred section: all four items confirmed safe per checklist item 3 (see Walkthrough).
- Tech-currency and brownfield-ratification: both pass cleanly (see Walkthrough items 4-5); no contradiction of the live codebase found anywhere in the spine.
- Deployment/environment envelope: explicitly addressed, not silently missing (see Walkthrough item 7).
- PRD Non-Goals: none reopened (consistent with `review-reconcile-prd.md`'s own check).

## Recommendation

Findings #1 and #2 should block story-writing on FR-7/FR-8/FR-10 until resolved — both describe a rule that, if implemented exactly as written, produces the specific bug its own PRD requirement exists to prevent (overselling on the last units; a swallowed low-stock alert). Findings #3-5 are real gaps but closable with small, targeted spine additions (a defined `assertVendorActive` contract, one more file in AD-2's enumerated list, a short AD or Deferred entry for slug-collision handling) without changing the spine's overall shape. Findings #6-7 are low-severity notes, not blockers.
