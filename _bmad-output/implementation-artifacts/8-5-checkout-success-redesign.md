---
baseline_commit: 4065a6396c5137bb4fd8c1f8ffb8916cd5c5c7c3
---

# Story 8.5: Checkout-success redesign

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a customer who just completed an order,
I want a warm, clear confirmation that my order went through,
so that I know tomorrow's pickup is handled without having to parse a plain, generic "thank you" page.

## Acceptance Criteria

1. **Given** `src/app/checkout/success/page.tsx` today renders a plain centered heading, one paragraph, and a text link
   **When** this story ships
   **Then** it's restyled per `DESIGN.md#Components`: the `confirm-card` panel, the `check-badge` (olive-gradient circle with a hand-drawn checkmark icon from Story 8.1), and a low-opacity scattered squiggle-divider flourish behind the card — never confetti, never an animated burst (per `EXPERIENCE.md#Interaction Primitives`)
   **And** the heading remains a heading element containing "Thank you" and the body text still contains "we'll text you when it's ready for pickup" verbatim — `tests/payment.spec.ts` asserts both via `getByRole("heading", { name: /thank you/i })` and `getByText(/we'll text you when it's ready for pickup/i)`.

2. **Given** this page is a stateless "thank you" with no access to real order details (the actual order record is created server-side by a Stripe webhook, independent of whether the customer's browser ever reaches this page — per `EXPERIENCE.md#Foundation`)
   **When** this story ships
   **Then** the page continues to render only the static confirmation message and a "Back to vendors" link — no order-summary content is added, since this page structurally cannot know if the webhook has processed yet.

3. **Given** the "Back to vendors" link (`<Link href="/">`)
   **When** this story ships
   **Then** it's restyled as a `button-pill-primary` and remains keyboard-reachable with the Story 8.1 `focus-ring` utility visible, and its `href="/"` destination is unchanged.

## Tasks / Subtasks

- [ ] Task 1: Confirmation card restyle (AC #1, #2)
  - [ ] `src/app/checkout/success/page.tsx` — wrap the existing heading + paragraph in the `confirm-card` component (`DESIGN.md#Components`: generous padding, `rounded-xl`, centered, largest single card in the system), add the `check-badge` (84px olive-gradient circle with the Story 8.1 checkmark icon) above the heading.
  - [ ] Add the scattered squiggle-divider flourish behind the card — low opacity, rotated/scaled instances of the same inline-SVG asset from Story 8.1, purely decorative (`aria-hidden`) and static (no animation).
  - [ ] Do not add any order-detail content, loading state, or API call to this page — it stays a pure static confirmation, per AC #2.
  - [ ] Keep the heading text containing "Thank you" and the body copy containing "We'll text you when it's ready for pickup" verbatim.

- [ ] Task 2: Back-to-vendors link (AC #3)
  - [ ] Restyle the existing `<Link href="/">` as `button-pill-primary` (terracotta fill, `rounded-full`, per `DESIGN.md#Components`). Apply the Story 8.1 `focus-ring` utility.

- [ ] Task 3: Tests (AC #1–#3)
  - [ ] Run `tests/payment.spec.ts` after this story's changes — it navigates to `/checkout/success` directly and asserts the heading/body text; also exercises the vendor page's Add button and the cart page's Checkout button earlier in the same test, which are Story 8.2/8.3/8.4's concern, not new risk introduced here, but worth being aware this file spans multiple redesigned surfaces in one test.
  - [ ] No new Vitest unit tests — no new business logic (`project-context.md#Testing Rules`).
  - [ ] No mocking.

## Dev Notes

**Depends on Story 8.1** (icon set including the checkmark, squiggle-divider SVG asset, `focus-ring` utility) — confirm the squiggle-divider component was built by the time this story starts (it may have landed in 8.1, 8.2, or 8.3 depending on implementation order; check before assuming it needs to be built fresh here).

**This is the smallest, lowest-risk story in the epic** — one static page, one existing test file with two simple text assertions, no interactive state beyond a single link. Keep it that way; don't add scope (e.g. an order-summary fetch) that the page's own stateless-by-design nature (per `EXPERIENCE.md#Foundation`) explicitly rules out.

### Project Structure Notes

- **Modified only:** `src/app/checkout/success/page.tsx`.
- No Prisma/schema/API changes.

### Testing Standards Summary

- Playwright only, existing `tests/payment.spec.ts` coverage; no new test file needed for this story alone.
- No mocking.

### References

- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Components]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/EXPERIENCE.md#Interaction Primitives]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/EXPERIENCE.md#Foundation]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8: Storefront Visual Redesign]
- [Source: _bmad-output/implementation-artifacts/8-1-design-token-foundation-and-shared-components.md]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
