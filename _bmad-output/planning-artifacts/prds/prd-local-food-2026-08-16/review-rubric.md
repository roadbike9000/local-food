# PRD Quality Review — local-food — Vendor Application & Monetization

## Overall verdict

The FR structure, Non-Goals, and Open Questions are honest and well-earned — this reads like a real Coaching-path document, not a template fill. But it rests on a factually wrong brownfield premise: §0 and multiple FRs (FR-8, FR-10, FR-12) describe the prior PRD's Admin role, `Vendor.deletedAt` soft-delete (AD-4), and unbound-vendor binding (AD-8) as "existing platform capability" to be "reused," when the actual repo (`prisma/schema.prisma`) has none of it — no `Admin` model, no `deletedAt`, no nullable `clerkUserId`, no `stockQuantity`. That work is architected and epic'd but not built. This doesn't invalidate the PRD's design, but it hides a hard sequencing dependency that a decision-maker needs to see, and it should be fixed before this goes to an architect who might otherwise assume `assertVendorActive()` exists today.

## Decision-readiness — adequate

Trade-offs are mostly surfaced honestly: Non-Goals (§5) is specific and names what was given up (no Stripe Connect, no payout logic, one flat fee, no custom billing UI). Open Questions (§8) are genuinely open — item 1 (fee amount/interval) isn't dressed up with an answer in the next sentence, and item 3 (reactivation after billing lapse) correctly surfaces tension against the prior PRD's "reactivation is one-way" rule instead of silently picking a side.

### Findings
- **critical** Prior-PRD capabilities claimed as "existing" are unbuilt (§0, "Why now") — §0 states the prior PRD's "Admin role, vendor soft-delete mechanism (AD-4), and inventory system are inherited as existing platform capability, not re-specified here." Checked against `prisma/schema.prisma`: no `Admin` model, `Vendor.clerkUserId` is still required+unique (not nullable per AD-8), no `deletedAt`, no `stockQuantity`/`lowStockThreshold`/`lowStockAlerted`. `epics.md` shows the prior PRD's epics/stories were only just drafted (commits `5f0b639`, `d6bfcdf`, `6a86c1f`), not implemented. This PRD has a hard build-order dependency on the prior PRD shipping first, and that dependency is nowhere stated as an assumption, non-goal, or open question. *Fix:* Add an explicit `[ASSUMPTION]` or a prerequisite note in §0: "This PRD assumes prd-local-food-2026-08-10's Admin table, AD-4 soft-delete, and AD-8 binding are implemented and deployed before this PRD's work begins" — and soften "inherited as existing platform capability" to "inherited as an architected, not-yet-built capability this PRD depends on."
- **medium** Central monetization number is undecided in the PRD's own namesake feature — FR-11 ("Vendor is charged a flat recurring subscription fee") has no fee amount or billing interval; both are `[ASSUMPTION]`-tagged and listed as Open Question 1. Honestly flagged, not hidden, so this isn't a scope-honesty violation — but a document titled "Vendor Application & **Monetization**" shipping without the actual monetization number is a real decision-readiness gap worth naming plainly rather than letting the Open Questions list carry it silently. *Fix:* Call this out explicitly in §0 or as a `[NOTE FOR PM]` at FR-11: this PRD cannot be considered build-ready until the fee is set.

## Substance over theater — strong

No persona theater — all three JTBDs (§2.1) each drive distinct FR groups (applicant → FR-1–4, coach → FR-5–7, platform → FR-9–12). The Vision (§1) is specific to this product's actual mechanics (flat fee, no payout, success-coach review), not swappable boilerplate. The single feature-specific NFR (§4.4, "every Application has exactly one owning Admin") is a real, specific guarantee, not scalability/security boilerplate.

## Strategic coherence — strong

Clear thesis stated in §0 ("Why now"): the business needs revenue or it stops existing, and manual admin-only onboarding doesn't scale. Features follow the funnel arc (disclosure → apply → review → activate → bill) rather than reading as an unordered capability list. Success Metrics (§7) validate the thesis directly (no-admin-touch onboarding, reliable lapse enforcement) rather than measuring activity for its own sake, and a counter-metric (form complexity vs. vendor drop-off) is named.

## Done-ness clarity — adequate

Most FRs carry genuinely testable consequences (e.g., FR-8's single-use invitation binding, FR-9's "cannot complete activation without an active subscription"). One material gap:

### Findings
- **high** No idempotency/replay-safety requirement for the new subscription webhook path (FR-11, FR-12) — the codebase's own `project-context.md` explicitly warns "Webhook is not idempotency-guarded beyond `smsNotified` — don't assume replay-safety when extending it," referring to the existing Stripe order webhook. FR-11/FR-12 add a second, independent Stripe webhook consumer (subscription lifecycle events: payment failure, cancellation) with no stated behavior for duplicate/out-of-order delivery. FR-12's "storefront deactivates" consequence doesn't say whether a duplicate `invoice.payment_failed` event is safe to process twice, or whether an out-of-order "resumed" event after a "failed" event resolves correctly. *Fix:* Add a testable consequence to FR-12 (or a feature-specific NFR) addressing webhook idempotency/ordering, consistent with the app's existing documented risk area.

## Scope honesty — strong

Non-Goals (§5) does real work — seven specific exclusions, each tied to a reason (Stripe Connect explicitly ruled out "per explicit user direction," not just omitted). Both inline `[ASSUMPTION]` tags (FR-5, FR-11) round-trip cleanly into §9's index — no orphans either direction. `[NOTE FOR PM]` callouts land at genuine tensions in two of three cases (FR-4's new email dependency, FR-12's reactivation ambiguity); FR-1's is a safe checkpoint (content/copy isn't specified) rather than a real tension, which is fine but not load-bearing.

## Downstream usability — adequate

Glossary terms (§3) are used consistently across FRs and the one UJ. FR IDs are contiguous (FR-1–FR-12) with no gaps or duplicates.

### Findings
- **low** FR-ID namespace collision risk once epics merge — this PRD deliberately restarts at FR-1 ("fresh FR-1 series — distinct document, distinct ID space," §0), which is a reasonable per-document choice, but the prior PRD's `epics.md` already uses FR-1–FR-13 for entirely different requirements (cart stepper, admin vendor CRUD, inventory). If/when this PRD's epics are added to the same `epics.md`, an unqualified "FR-8" becomes ambiguous between the two documents. *Fix:* When epics are generated from this PRD, namespace references (e.g. "monetization FR-8" vs. "inventory FR-8") rather than relying on document context alone.

## Shape fit — thin

Hobby/solo stakes are consistent with the prior PRD, and the single UJ with a named protagonist (Bill Green) is correctly proportioned — not over-formalized with a UJ per FR, not under-formalized given this is a real multi-stakeholder flow (applicant + coach + platform).

The brownfield fit is mixed. One reuse claim checks out cleanly: FR-10's claim to reuse the existing `AddProductForm` vendor self-service flow is accurate — `src/components/dashboard/AddProductForm.tsx` exists today and is exactly the self-service creation flow described. But the PRD's two other load-bearing brownfield claims — FR-8 "supersedes AD-8" and FR-12 "reuses the exact soft-delete mechanism from AD-4, not a new mechanism" — describe reuse of architecture *decisions* that have not been built (see the critical finding under Decision-readiness). The PRD doesn't distinguish "reusing a shipped mechanism" (true for FR-10) from "reusing a specified-but-unbuilt mechanism" (true for FR-8/FR-12), and a reader can't tell the difference from the text alone.

### Findings
- **medium** FR-8/FR-12 reuse claims conflate "specified" with "built" — see the critical finding above; repeated here because it's specifically a shape-fit/brownfield-accuracy issue, not just a decision-readiness one. *Fix:* covered by the §0 fix above; additionally, FR-8 and FR-12's "not a new mechanism" phrasing should say "reuses AD-4/AD-8's design, once implemented" rather than implying it's callable today.

## Mechanical notes

- Glossary drift: none found — "Applicant," "Application," "Success Coach," "Subscription," "Vendor" are used identically across §2, §3, and the FRs.
- ID continuity: FR-1–FR-12 contiguous, no gaps/duplicates within this document (see downstream-usability finding on cross-document collision risk with the prior PRD's FR-1–FR-13).
- Assumptions Index roundtrip: clean — both inline `[ASSUMPTION]` tags (FR-5, FR-11) appear in §9, and both §9 entries have a matching inline tag.
- UJ protagonist naming: UJ-1's protagonist (Bill Green) is named and carries context inline throughout; no floating UJs (there's only the one, appropriately for scope).
- Required sections: all present for a Coaching-path, hobby-stakes, brownfield-companion PRD (Document Purpose, Vision, Target User, Glossary, Features, Non-Goals, MVP Scope, Success Metrics, Open Questions, Assumptions Index).
