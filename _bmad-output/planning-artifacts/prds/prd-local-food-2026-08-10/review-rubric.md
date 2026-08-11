# PRD Quality Review — local-food — Admin & Inventory Expansion

## Overall verdict

This is a disciplined Fast-path PRD: decisions are stated as decisions (not smoothed into "considerations"), scope was actively de-risked by a real grounding pass (two requested features correctly reclassified as already-implemented), and the Non-Goals/Assumptions apparatus does real work rather than performing thoroughness. The two things that would trip up a downstream reader are (1) no FR covers how Stock Quantity and Low-Stock Threshold actually get their first values — a real gap given Inventory Tracking is "the biggest net-new piece" — and (2) `addendum.md`'s SMS-reuse guidance points architecture at a file (`src/lib/twilio.ts`) that no longer exists after a same-day refactor to a provider-abstraction pattern. Neither is fatal; both are fixable in the next pass and don't undermine the PRD's overall coherence.

## Decision-readiness — strong

Trade-offs are named with what was given up, not just what was chosen. The `[NOTE FOR PM]` at FR-1 (§4.1, line 65) flags a real tension — "This FR is satisfied by existing code. Recommend the downstream epic scope it as a regression-test/harden task... not new development" — rather than sitting at a safe checkpoint. The `[NOTE FOR PM]` at §4.4 (line 162) does the same for FR-9's scheduling-infra question: "the daily-cadence framing was dropped when SMS-push was replaced with a dashboard page" is a decision stated plainly, with the alternative (scheduled SMS report) named and rejected, not silently dropped. §8 Open Questions is empty but earns it — "None outstanding — all resolved during Fast-path review (see `.memlog.md` for the decision trail)" — and `.memlog.md` does in fact show a live decision trail (FR-5 reclassification, FR-9 SMS→dashboard swap, FR-4 soft-delete rationale), so this isn't a rhetorical closure.

No findings — this dimension holds up under scrutiny.

## Substance over theater — strong

No persona theater: JTBD entries (§2.1) are role-scoped ("platform operator," "customer," "vendor") without invented backstory, and the PRD explicitly dials this down — "*Lighter dial used per hobby/solo stakes — JTBD-level detail, no multi-screen flow diagrams.*" (§2.2, line 35). The feature-specific NFR at §4.4 ("Stock Quantity changes... must be consistent under concurrent orders — no overselling the last unit") is concrete and product-specific, not "must be scalable/secure" boilerplate — and the addendum backs it with an actual mechanism choice (conditional `UPDATE ... WHERE stockQuantity >= :qty` over a transaction, "worth defaulting to that over a transaction for simplicity"). The Vision statement (§1) names the specific current state ("lets a vendor self-serve their own storefront... via Stripe") and the specific gap being closed — it would not swap into an unrelated PRD unchanged.

No findings.

## Strategic coherence — strong

The PRD has a clear, stated thesis (§1): add an admin layer *and* a real inventory system "so the app can tell customers what's actually available and tell admins when it's running low — without anyone hand-tracking counts in a spreadsheet." Every feature group (Cart Item Management, Admin Identity, Admin Vendor Management, Inventory Tracking) traces to one half of that thesis. Success Metrics (§7) measure the thesis directly — vendor onboarding without touching the DB, zero-stock reflected "within the same request cycle," a named counter-metric against alert spam — not activity counts. MVP scope reads as problem-solving (closing an operational gap), and the scope logic is consistent with that shape throughout.

No findings.

## Done-ness clarity — adequate

Most FRs carry genuinely testable consequences (FR-4's soft-delete behavior and FR-8's webhook-timing/race-condition consequences are particularly well specified — verified against `src/app/api/checkout/route.ts` and `src/app/api/webhooks/stripe/route.ts`, which match the PRD's claims about PENDING-at-session-creation and the `smsNotified` one-shot pattern). But there's a load-bearing gap:

### Findings
- **high** No FR covers how Stock Quantity or Low-Stock Threshold get their initial values (§3, §4.4) — §3's Glossary states Low-Stock Threshold is "set at product creation (via the existing `AddProductForm`)," implying a form change, but no FR in §4.4 (FR-6–FR-10) specifies adding stock-quantity/threshold inputs to `AddProductForm`, and none addresses what happens to **existing** Products (verified: `prisma/schema.prisma` currently has only `isAvailable: Boolean`, no stock field) when Stock Quantity is introduced — if it defaults to 0, every existing product goes instantly "out of stock" per FR-6/FR-7 on migration day. This affects all five Inventory Tracking FRs, which have no data to operate on without it. *Fix:* add an FR (or extend FR-9's scope) covering the `AddProductForm` field additions and a stated migration/backfill rule for pre-existing Products (e.g., backfill from current `isAvailable` to some default quantity, flagged as a `[NOTE FOR PM]` if the default is a product decision).
- **low** FR-2's "an admin action taken on a vendor is attributable to that admin (basic audit — who did it)" (§4.2) names a testable-sounding consequence but no mechanism (log table, field) is specified in the PRD or addendum, and no schema field exists today to hang it on. Likely fine to leave to architecture given hobby/solo stakes, but worth an `[ASSUMPTION]` tag rather than reading as a settled requirement. *Fix:* either tag it `[ASSUMPTION: architecture decides audit storage shape]` or move it to addendum.md alongside the other architecture-deferred items.

## Scope honesty — strong

Non-Goals (§5) is substantial (8 items) and each entry gives a reason, not just a label — e.g. "Hard delete of Vendor/Product/Order records — deletion is soft (deactivation), not row removal, so order history and fulfillment survive." Both `[ASSUMPTION]` tags (single flat Admin role; provisioning mechanism deferred) are indexed in §9 and both index entries trace back to the single inline tag at §4.2 — no orphaned entries either direction. De-scoping is done honestly, not silently: FR-1 and the originally-requested "admin adds products" (FR-5) were reclassified as already-implemented *after* a codebase grounding pass, and that reclassification is documented both in the PRD body (§6.2: "FR-5 is retired (not reassigned, per stable-ID discipline)") and in `.memlog.md`'s decision trail. Open-items density (0 Open Questions, 2 Assumptions, 2 Notes-for-PM) is appropriately light for hobby/solo stakes without reading as swept-under-the-rug.

No findings.

## Downstream usability — strong

Glossary terms are used identically across FRs and UJs (Vendor, Product, Stock Quantity, Admin all check out on a pass through §4). FR IDs are contiguous except FR-5, which is explicitly and intentionally retired rather than silently gapped — this is good practice, not a defect. UJs (UJ-1, UJ-2, UJ-3) each carry a named role-protagonist and each is referenced by at least one FR's "Realizes UJ-N" tag; none float unconnected. This matters more than usual here since the PRD states its own audience explicitly (§0): "written for the PM, the architect who takes it next, and downstream epic/story authors" — this is chain-top, not standalone.

One minor drift, covered in Mechanical notes rather than as a dimension finding per the rubric's own categorization.

## Shape fit — adequate

Hobby/solo rigor-light is applied correctly and consistently: JTBD-level UJs instead of flow diagrams, qualitative Success Metrics, a single flat Admin role assumed rather than explored as a design space. This is the right dial for the stated stakes.

The brownfield half is mostly solid — claims like "no admin role, no stock-quantity field, and no tax/shipping logic" (§0) checked out against the actual schema, and FR-3's slug-collision claim matches a documented gap in `_bmad-output/project-context.md` line 34 ("`Vendor.slug` has no uniqueness/collision handling beyond the DB constraint"). But one existing-code reference is stale:

### Findings
- **high** `addendum.md`'s "Twilio reuse (FR-10)" section states the low-stock alert "should go through the existing `src/lib/twilio.ts` `sendSms` wrapper, not a new client instantiation." That file does not exist. The actual current pattern (confirmed by reading the source) is a provider-abstraction layer added the same day as this PRD — `src/lib/sms/index.ts` exports `sendSms`, dispatching to `src/lib/sms/providers/twilioProvider.ts` or `mockProvider.ts` via `SMS_PROVIDER` env var (git log: "Add mockable SMS provider abstraction," merged same day as this PRD's `created` date). The PRD body itself is fine — it only says "reuses the existing `sendSms` pattern" (§4.4, FR-10) without naming a path — but the addendum, which is explicitly "for architecture/downstream use," will send the architect looking for a file that isn't there. This suggests the grounding pass either predated the SMS refactor or didn't re-check it. *Fix:* update the addendum's Twilio-reuse section to reference `src/lib/sms/index.ts`'s `sendSms` export instead of `src/lib/twilio.ts`.

## Mechanical notes

- **Glossary drift**: §3 coins "Inventory Report" as the term for the admin dashboard page, but FR-9 and its surrounding prose never use that term — they call it "Admin inventory dashboard page" throughout. Not a contradiction, just an unused glossary entry; consider dropping the term or using it consistently in §4.4/FR-9.
- **Broken cross-ref (addendum)**: the "Vendor soft-delete (FR-4)" section cites `prisma/schema.prisma:53` for the `Vendor → Product` cascade. Verified against the actual file: line 53 is the `model PickupSlot {` declaration; the `Vendor → Product` cascade is at line 46. The companion citation for `Vendor → Order` (`:82`) is correct. Low-impact since the surrounding reasoning is right, just the pinpoint citation is off by one relation.
- **ID continuity**: FR-1 through FR-11 are contiguous except FR-5, which is explicitly retired and documented as such (§6.2) rather than silently gapped — flagged here only so a reader scanning IDs doesn't mistake it for an oversight.
- **Assumptions Index roundtrip**: clean. The single inline `[ASSUMPTION]` tag at §4.2 is split into two §9 index entries (flat role; provisioning deferred) — both trace back to the same inline tag, no orphans in either direction.
- **UJ protagonist naming**: all three UJs name a role-level protagonist (Admin, Customer) carrying context inline — consistent with the hobby/solo dial, no floating UJs.
