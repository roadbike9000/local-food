---
title: local-food — Vendor Application & Monetization
status: final
created: 2026-08-16
updated: 2026-08-17
---

# PRD: local-food — Vendor Application & Monetization
*Working title — confirm.*

## 0. Document Purpose

This PRD scopes local-food's vendor-onboarding and monetization capability: how a prospective vendor applies to join the platform, how that application is reviewed, and how an approved vendor starts paying for platform access. It is a **separate initiative** from `prd-local-food-2026-08-10` (Admin & Inventory Expansion) — that PRD's Admin role, vendor soft-delete mechanism (AD-4), and inventory system are inherited as **architected, not-yet-built** capability this PRD depends on, not re-specified here. Written for the PM, the architect who takes it next, and downstream epic/story authors. Structure matches the prior PRD: Glossary-anchored vocabulary, features grouped with FRs nested and globally numbered (fresh FR-1 series — distinct document, distinct ID space; when this PRD's epics are added to the shared `epics.md`, reference them as "monetization FR-N" to disambiguate from the prior PRD's own FR-1–FR-13), `[ASSUMPTION]` tags inline and indexed in §9.

**Why now:** local-food has real operating costs and needs revenue to sustain operations. Today, vendors are onboarded manually by an admin with no payment relationship at all — that doesn't scale and doesn't pay the bills. This PRD is a pain-to-solve (no vendor acquisition funnel) and a mandate-to-meet (the business needs revenue or it stops existing) at once.

**Prerequisite (verified against the codebase):** `prisma/schema.prisma` today has no `Admin` model, no `deletedAt`, `Vendor.clerkUserId` is still required (not nullable), and no `stockQuantity` — `prd-local-food-2026-08-10`'s epics (`epics.md`) are drafted but **not yet implemented**. FR-8 and FR-12 below depend specifically on that PRD's AD-8 (vendor binding) and AD-4 (soft-delete) mechanisms actually shipping first. This PRD is not build-ready until that prerequisite lands. Likewise, **FR-11 has no fee amount or billing interval decided** (§8, Open Question 1) — a document titled "...& Monetization" isn't truly build-ready until that number exists either.

## 1. Vision

A prospective vendor — a small farm, a home baker, a maker of jams or prepared foods — finds local-food, reads a plain-language explanation of what it is and how it works, and applies to sell through it. A local-food team member (their assigned "success coach") reviews the application, asks follow-up questions if needed, and approves or rejects it. On approval, the vendor creates their account, sets up a recurring subscription, builds their storefront, and goes live — all without an admin ever touching a database. The vendor pays local-food a flat fee for the privilege of using the platform; local-food never pays vendors out — order money keeps flowing exactly as it does today (100% to the platform's own Stripe account, untouched by this PRD).

## 2. Target User

### 2.1 Jobs To Be Done
- As a **prospective vendor** (small-scale local food producer), I need a straightforward way to apply to sell through local-food, and to trust I understand what I'm signing up for before I commit.
- As a **local-food success coach** (Admin), I need to review applications, ask clarifying questions when something's unclear, and make an approve/reject call — for a specific set of vendors I'm responsible for, not an undifferentiated queue.
- As the **platform**, I need a reliable, low-maintenance revenue mechanism from vendors, decoupled entirely from customer order payments.

**Illustrative vendor archetypes** (not exhaustive, informs tone/copy for the application and disclosure pages): small farms/orchards, home bakers, preserve/specialty-goods makers, prepared-meal cooks, small-batch beverage makers. Shared profile: no existing e-commerce presence, values simplicity over sophistication.

### 2.2 Key User Journeys

- **UJ-1. Bill Green onboards his apple orchard.**
  - **Persona + context:** Bill owns a small apple orchard. He's heard about local-food and wants to sell direct to local customers without building his own website.
  - **Entry state:** Unauthenticated, arrives from a marketing page. No Clerk account yet.
  - **Flow:**
    1. Bill reads a **services-disclosure page** — a short, clear summary of what local-food is, how it works, and the third-party services it depends on (Clerk for accounts, Stripe for payments, Twilio for SMS, and others) — so there's no ambiguity for him later if a question comes up about how his data or money moves.
    2. Bill submits an **application**: business name, product types, address, a 2-3 sentence business description, how he plans to use local-food, and accurate contact info (email + SMS-capable phone).
    3. He's redirected to a **status page** and gets updates via email and SMS as his application moves.
    4. His application lands in a queue, auto-assigned to a **success coach** (an Admin, responsible for his application and, later, his ongoing issues).
    5. The coach may request **follow-up info** before deciding — reaches Bill via email/SMS, reflected on his status page; his answer routes back to the same coach, not a generic queue.
    6. Coach **approves** (or rejects — see Edge case).
    7. On approval, Bill gets an **invitation to create a Clerk account**, which binds to his now-approved vendor record.
    8. He sets up **subscription billing** (Stripe).
    9. He completes **storefront setup** (adds products — reuses the existing `AddProductForm` vendor self-service flow from the prior PRD).
  - **Climax:** His storefront goes live at `/vendors/{slug}` — publicly visible, his apples listed. That's the moment onboarding itself succeeds.
  - **Resolution:** Bill's a fully self-service vendor from here — same dashboard, same product/inventory tools as any other vendor.
  - **Edge case (rejection):** If the coach rejects instead of approving, Bill's status page reflects it and he's notified by email/SMS. A reason is optional — the coach may include one, not required to.
  - **Edge case (billing lapse):** If Bill's subscription payment fails, or he cancels, his storefront deactivates using the *same* soft-delete mechanism as an admin-deactivated vendor (AD-4 from the prior PRD) — storefront shows unavailable, no new orders, existing orders keep fulfilling. Not a new mechanism, reused.

*Heavier dial used — this journey has auth, billing, and a multi-stakeholder review workflow; it feeds architecture and stories directly.*

## 3. Glossary

- **Applicant** — A prospective vendor who has submitted an application but is not yet an approved Vendor. No Clerk account exists yet for an Applicant.
- **Application** — The submitted request to become a Vendor: business name, product types, address, description, planned use, contact info (email + phone).
- **Services-Disclosure Page** — A page shown before/during application: what local-food is, how it works, and which third-party services it depends on (Clerk, Stripe, Twilio, others). Distinct from Terms of Use — a placeholder in this PRD (see §5).
- **Success Coach** — An existing Admin (per the prior PRD's flat Admin role — no new role/tier), assigned to a specific vendor's application and ongoing issues. "Success coach" is a relationship (which Admin owns which vendor), not a distinct permission level.
- **Application Status** — The applicant-visible state of their application: Submitted, Needs Info, Approved, Rejected.
- **Subscription** — The recurring flat fee a Vendor pays local-food for platform access, via Stripe. Fully decoupled from customer order payments (which continue flowing 100% to local-food's own Stripe account, unrelated to this PRD).
- **Vendor** — Existing concept from the prior PRD. This PRD adds the path that *creates* one (via an approved Application) as an alternative/replacement to admin-unilateral creation.

## 4. Features

### 4.1 Vendor Application

**Description:** A prospective vendor learns what local-food is, then submits a self-service application. Realizes UJ-1 steps 1-3.

**Functional Requirements:**

#### FR-1: Prospective vendor views the services-disclosure page
Applicant can read a plain-language page explaining what local-food is, how it works, and which third-party services it depends on, before or during application.

**Consequences (testable):**
- Page is reachable from the application entry point (marketing page) and names, at minimum, Clerk, Stripe, and Twilio as dependent services.
- `[NOTE FOR PM]` Actual copy for this page is content work, not specified here — this FR is the requirement that it exists and covers the named dependencies, not the exact wording.

#### FR-2: Prospective vendor submits an application
Applicant can submit a complete application without needing a Clerk account first.

**Consequences (testable):**
- Form collects: business name, product types, address, 2-3 sentence business description, planned use of local-food, email, phone.
- Submission does not require prior authentication — no Clerk account exists at this point (realizes UJ-1's "applies first" resolution).
- All fields are required; an incomplete submission is rejected client- and server-side.

#### FR-3: Applicant can check application status
Applicant can view the current status of their application (Submitted, Needs Info, Approved, Rejected) on a status page.

**Consequences (testable):**
- Status page reflects the current state in real time (no manual refresh trickery needed — standard page load shows current state).
- Status page is reachable without a Clerk account (applicant isn't authenticated yet).

#### FR-4: Applicant receives status notifications
Applicant is notified via email and SMS on every status change (Needs Info, Approved, Rejected).

**Consequences (testable):**
- Every status transition triggers both an email and an SMS to the contact info given in FR-2.
- `[NOTE FOR PM]` This is the first email-capable notification in the app — no email service exists today (per `project-context.md`, Twilio SMS is the only notification channel). Flagged as a new dependency for architecture.

**Out of Scope:** Application status changes pushed via any channel other than email/SMS (no in-app real-time updates beyond a page load).

### 4.2 Application Review

**Description:** Every application is assigned to a success coach who reviews, may request more info, and decides. Realizes UJ-1 steps 4-6.

**Functional Requirements:**

#### FR-5: Application is assigned to a success coach on submission
Every submitted Application is automatically assigned to an Admin acting as its success coach.

**Consequences (testable):**
- On submission, the Application has exactly one assigned Admin.
- `[ASSUMPTION: assignment logic (round-robin, least-loaded, or "the only Admin" at small scale) is an architecture/implementation decision, not specified here — MVP may trivially assign to whichever Admin exists.]`

#### FR-6: Success coach can request follow-up info before deciding
Assigned coach can ask the applicant clarifying questions before approving or rejecting.

**Consequences (testable):**
- Requesting info sets Application Status to "Needs Info" and triggers FR-4's notifications.
- Applicant's response routes back to the same assigned coach, not a general queue.
- Status returns to under-review once the applicant responds, without losing the original coach assignment.

#### FR-7: Success coach approves or rejects an application
Assigned coach makes the final call on an Application.

**Consequences (testable):**
- Approval creates a Vendor record (unbound — no `clerkUserId` yet, see FR-9) and transitions Application Status to Approved.
- Rejection transitions Application Status to Rejected; no Vendor record is created.
- A reason is optional on rejection — coach may include free text, not required to.

**Out of Scope:** A formal appeal or reapplication flow for a rejected Applicant (§8 Open Questions).

### 4.3 Vendor Activation

**Description:** An approved applicant becomes a fully self-service vendor. Realizes UJ-1 steps 7-9 and the climax.

**Functional Requirements:**

#### FR-8: Approved applicant is invited to create a Clerk account
On approval, the applicant receives an invitation (email/SMS, per FR-4's channels) to sign up via Clerk, binding their new account to their approved Vendor record.

**Consequences (testable):**
- Invitation link is single-use and tied to the specific approved Application/Vendor — it cannot bind an unrelated Clerk account to Bill's vendor record.
- On successful signup via the invitation, `Vendor.clerkUserId` is set — no manual/out-of-band step required. This **supersedes the design** of the prior PRD's AD-8 (which assumed no invite flow existed) — but AD-8 itself, including the `clerkUserId`-nullable schema change it specifies, is not yet built. This FR depends on that schema change landing first.

#### FR-9: New vendor sets up subscription billing
Newly-bound vendor sets up their recurring subscription before or as part of completing setup.

**Consequences (testable):**
- Vendor cannot complete activation without an active subscription (a pending/incomplete subscription blocks storefront go-live).
- Vendor manages the subscription (payment method, cancellation) via Stripe's hosted Customer Portal — no custom billing UI is built.

#### FR-10: New vendor completes storefront setup and goes live
Vendor adds their first product(s) and their storefront becomes publicly visible.

**Consequences (testable):**
- Uses the existing `AddProductForm` vendor self-service flow (prior PRD) — no new product-creation mechanism.
- Storefront at `/vendors/{slug}` is reachable the moment at least one product exists and the subscription (FR-9) is active.

### 4.4 Subscription Lifecycle

**Description:** The ongoing money relationship between vendor and platform — separate entirely from customer order payments.

**Functional Requirements:**

#### FR-11: Vendor is charged a flat recurring subscription fee
Vendor pays local-food a fixed recurring amount for platform access.

**Consequences (testable):**
- Billing is fully decoupled from order/checkout money — the existing Stripe Checkout flow (customer → platform's Stripe account) is untouched by this PRD.
- `[ASSUMPTION: exact fee amount and billing interval (monthly/annual) are not decided — see §8 Open Questions.]`

#### FR-12: Storefront deactivates on billing lapse
If the vendor's subscription payment fails or they cancel, their storefront deactivates.

**Consequences (testable):**
- Reuses the design of the prior PRD's AD-4 soft-delete mechanism (`Vendor.deletedAt`-equivalent state, "no longer available" message, existing orders keep fulfilling, no new orders) once that mechanism is built — not a new design, but not yet a callable one either.
- The subscription webhook (Stripe subscription lifecycle events: payment failure, cancellation, resumption) must handle duplicate and out-of-order delivery safely — a duplicate `invoice.payment_failed` does not double-process, and a late-arriving "resumed" event after a "failed" event resolves to the correct final state, not whichever arrived last. Matches the app's own documented risk area (`project-context.md`: the existing order webhook is "not idempotency-guarded beyond `smsNotified`").
- `[NOTE FOR PM]` Whether/how a vendor can reactivate after resolving a billing lapse (vs. the prior PRD's "reactivation is one-way, out of scope") is an open question — see §8.

**Feature-specific NFRs:**
- Application review must not silently drop an assigned coach — every Application has exactly one owning Admin from submission through resolution.

## 5. Non-Goals (Explicit)

- **local-food ever pays a vendor out** — the money relationship is one-directional (vendor → platform). No Stripe Connect, no marketplace payout logic, ever, per explicit user direction.
- **Changing customer checkout/order payment flow** — untouched by this PRD.
- **Real Terms of Use content** — placeholder for this PRD; the Services-Disclosure Page (FR-1) is distinct and does need real content, but formal legal ToS does not.
- **Multiple subscription tiers or pricing plans** — one flat fee, v1.
- **Custom billing management UI** — Stripe's hosted Customer Portal only (FR-9).
- **Formal appeal/reapplication flow for rejected applicants** — not specified (§8).
- **Success-coach reassignment or workload-balancing logic** — MVP assignment can be trivial (§4.2 assumption).

## 6. MVP Scope

### 6.1 In Scope
- Services-disclosure page (FR-1)
- Vendor application form (FR-2)
- Application status page (FR-3)
- Email + SMS status notifications (FR-4)
- Success-coach auto-assignment (FR-5)
- Follow-up-info request flow (FR-6)
- Approve/reject decision (FR-7)
- Clerk signup invite + vendor binding (FR-8)
- Subscription billing setup via Stripe (FR-9)
- Storefront setup + go-live (FR-10)
- Flat recurring subscription charge (FR-11)
- Storefront deactivation on billing lapse (FR-12)

### 6.2 Out of Scope for MVP
- Everything in §5 Non-Goals.

## 7. Success Metrics

*Hobby/solo scale — qualitative, consistent with the prior PRD's stakes calibration.*

- **Success**: A prospective vendor can go from application to live storefront without an admin ever touching the database — the coach's approve/reject click and the vendor's own setup steps are the only manual actions.
- **Success**: A lapsed subscription reliably takes a storefront offline (no orders placeable) without manual intervention.
- **Counter-metric**: The application form doesn't become a barrier that scares off legitimate small vendors — length/complexity should stay proportionate to what's actually needed to review and bill them.

## 8. Open Questions

1. Exact subscription fee amount and billing interval (monthly vs. annual, or offered choice) — genuinely undecided (FR-11).
2. Can a rejected applicant reapply? Is there any appeal path, or is a rejection final? (FR-7)
3. After a billing-lapse deactivation, can the vendor reactivate by resolving payment, or does it follow the prior PRD's "reactivation is one-way" rule? (FR-12)
4. Success-coach assignment logic beyond MVP triviality — round-robin, least-loaded, or manual reassignment? (FR-5)
5. Email service selection — this PRD is the first feature requiring email (SMS-only today). Which provider, deferred to architecture, but worth flagging that it's a genuinely new dependency, not a reuse.

## 9. Assumptions Index

- §4.2 FR-5: Coach assignment logic is trivial/architecture-deferred at MVP scale.
- §4.4 FR-11: Exact fee amount/interval undecided (also indexed as Open Question 1 — decision-blocking, not just an inference).
