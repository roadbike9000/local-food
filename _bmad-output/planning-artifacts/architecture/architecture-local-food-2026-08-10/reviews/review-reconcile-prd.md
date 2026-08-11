---
title: PRD/Addendum ↔ Architecture Spine Reconciliation Review
scope: prd-local-food-2026-08-10 (prd.md + addendum.md) vs ARCHITECTURE-SPINE.md
reviewed: 2026-08-10
---

# Reconciliation Review — PRD/Addendum vs Architecture Spine

## Method

Walked every FR (FR-1 through FR-12, excluding retired FR-5), every testable consequence, every
`[ASSUMPTION]`, the Assumptions Index (§9), and the Non-Goals (§5) against the spine's six ADs,
Deferred list, Capability→Architecture Map, and Structural Seed. Also checked the addendum's
technical-how notes for anything explicitly flagged as "an architecture call" to confirm the
spine actually made that call.

## Overall Verdict

The spine covers the great majority of load-bearing PRD content well — all three items in the
PRD's own Assumptions Index (§9) are resolved (AD-1 for admin-table-vs-claim, AD-1 again for the
`clerkUserId` shape, AD-5 for audit-attribution mechanism), the vendor-soft-delete cascade
correctness concern is substantively captured (AD-4 + `deletedAt` in the structural seed), and
the "hobby/solo, don't over-build" tone is explicitly honored (AD-5's rationale for rejecting an
audit-log table). No PRD Non-Goal is reopened by the spine.

Three gaps found, one of them substantive enough to cause a real bug if built as literally
written.

## Gap 1 (substantive) — AD-3's `lowStockAlerted` timing contradicts FR-10's delivery-confirmation requirement

**FR-10 testable consequence (prd.md §4.4):**
> "Alert reuses the existing `sendSms` pattern; a failed send does not silently mark the alert as
> delivered (mirrors the existing `smsNotified` discipline)."

**AD-3's rule (ARCHITECTURE-SPINE.md):**
> "The same function \[`adjustStock()`\] flips `lowStockAlerted` (AD-5-adjacent) within the same
> call."

`adjustStock()` is a data-layer function — a conditional `UPDATE` on `Product.stockQuantity`. It
has no knowledge of whether an SMS send later succeeds; `sendSms()` necessarily runs *after*
`adjustStock()` returns (the caller — the webhook handler — needs `adjustStock()`'s return value
to know a threshold was crossed before it has anything to send). If `adjustStock()` sets
`lowStockAlerted = true` "within the same call" as the stock decrement, the flag is already
`true` before the SMS attempt even starts. A failed `sendSms()` call then leaves the flag
incorrectly showing "alerted" — exactly the outcome FR-10 says must not happen, and the addendum
underlines this by name-checking the existing `smsNotified` discipline as the pattern to mirror.

This isn't a nitpick: the spine's own AD-3 rationale for the *stock-quantity* half of the
function (conditional update, checking rows-affected) is precisely aimed at closing a race /
false-positive window. The same rigor wasn't applied to the alert-flag half, and the two
requirements are in genuine tension:
- **Dedupe-under-concurrency** (Feature NFR, §4.4) wants the crossing *detected* atomically inside
  the DB write, so two simultaneous last-units-sold don't both think they own the crossing.
- **Don't-mark-delivered-until-sent** (FR-10) wants the flag set only *after* `sendSms()`
  succeeds, which is necessarily outside that same DB write.

The spine needs an explicit rule reconciling these — e.g., `adjustStock()` returns a "crossed
threshold, not yet alerted" signal (without flipping the flag itself), the caller sends the SMS,
and a second, narrower conditional update (`UPDATE ... WHERE lowStockAlerted = false` or
equivalent) flips the flag only on confirmed send, still race-safe because it's still a
conditional update. As written, AD-3 as literally implemented would produce the exact bug FR-10
was written to prevent.

## Gap 2 (moderate) — FR-3's slug-collision handling has no architectural home

**FR-3 testable consequence (prd.md §4.3):**
> "Slug collisions are rejected with a clear error, not a raw DB constraint failure (closes an
> existing known gap noted in project context)."

**addendum.md, "Vendor slug collision (FR-3)":**
> "FR-3 closes this specifically for the new admin-add-vendor path; whether to also fix it for any
> existing vendor self-registration path is an architecture/scope call."

The addendum explicitly hands this to architecture — both the *mechanism* (friendly-error
translation instead of a raw Prisma unique-constraint throw) and the *scope question* (does the
fix apply only to the new admin path, or also retrofit the existing vendor self-registration
path?). The spine has no AD for it, no line in the Capability→Architecture Map's FR-3 row (which
only cites AD-1, AD-4, AD-5, AD-6 — none of which touch slug handling), and no entry in Deferred
explicitly punting the scope question the way it did for the FR-12 backfill default. This is a
real testable consequence of an in-scope FR with a named open architecture call that the spine
silently dropped rather than resolved or explicitly deferred.

## Gap 3 (minor) — `onDelete: Cascade` removal not carried into the spine's schema artifact

**addendum.md, "Vendor soft-delete (FR-4)":**
> "Needed schema changes: ... Remove/replace the `onDelete: Cascade` on both relations \[Vendor→
> Product, Vendor→Order\] — a real cascade would break fulfillment of in-flight orders and orphan
> `OrderItem` rows pointing at deleted `Product`s."

This is flagged in the addendum as a concrete, named schema change required for FR-4's
non-negotiable behavior ("Deleted vendor's Products are not removed... Orders placed before
deletion proceed through their normal fulfillment lifecycle unchanged"). The spine's Structural
Seed erDiagram adds the new soft-delete fields (`deletedAt`, `createdByAdminId`,
`deletedByAdminId`) but doesn't note the cascade removal as a required accompanying change,
despite the Structural Seed being exactly the artifact meant to capture schema-level facts (it
already does so for the other new fields). This is lower severity than Gap 1/2 — a soft-delete
implementation that only ever calls `UPDATE` and never `DELETE` would never trigger the cascade
regardless — but the addendum treats it as a defense-in-depth requirement (protecting against a
future accidental hard-`delete()` call), which is the same category of "prevent a plausible
implementation mistake" reasoning the spine already applies elsewhere (e.g., AD-3's rationale).
Worth a one-line addition to the Structural Seed or a Consistency Conventions row.

## Non-Findings (checked, no gap)

- All three §9 Assumptions Index items — resolved (AD-1 ×2, AD-5).
- Every PRD §5 Non-Goal — none reopened; several explicitly reaffirmed in Deferred (multi-tier
  admin) or structurally impossible to reopen without new code (self-deletion, reactivation UI,
  hard delete, extra push notifications, forecasting).
- FR-1's `[NOTE FOR PM]` (treat as regression/verification task, not new dev, re-confirm under
  FR-6 stock checks) — a process/story-scoping note, not an architectural commitment; correctly
  has no AD. Its interaction point (cart vs. stock check) is still implicitly covered since AD-2
  governs the checkout-time revalidation FR-1's own total math depends on.
- FR-9's "on-demand page only, no scheduled/pushed delivery" — correctly not built into the spine
  (no scheduling infra introduced anywhere).
- Tone/scale constraint ("hobby/solo stakes," avoid over-building) — actively honored, most
  visibly in AD-5's explicit rejection of a generic audit-log table.

## Recommendation

Resolve Gap 1 before any story writing touches FR-8/FR-10 — it's the one that produces an
observably wrong result (a real low-stock alert silently swallowed and never retried) if built
exactly as AD-3 currently reads. Gaps 2 and 3 can be closed with small, targeted additions to the
spine (a short AD or Deferred-list entry for Gap 2; a one-line Structural Seed note for Gap 3)
without changing its overall shape.
