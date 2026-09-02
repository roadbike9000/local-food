---
baseline_commit: 4065a6396c5137bb4fd8c1f8ffb8916cd5c5c7c3
---

# Story 8.5: Checkout-success redesign

Status: done

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

- [x] Task 1: Confirmation card restyle (AC #1, #2)
  - [x] `src/app/checkout/success/page.tsx` — wrap the existing heading + paragraph in the `confirm-card` component (`DESIGN.md#Components`: generous padding, `rounded-xl`, centered, largest single card in the system), add the `check-badge` (84px olive-gradient circle with the Story 8.1 checkmark icon) above the heading.
  - [x] Add the scattered squiggle-divider flourish behind the card — low opacity, rotated/scaled instances of the same inline-SVG asset from Story 8.1, purely decorative (`aria-hidden`) and static (no animation).
  - [x] Do not add any order-detail content, loading state, or API call to this page — it stays a pure static confirmation, per AC #2.
  - [x] Keep the heading text containing "Thank you" and the body copy containing "We'll text you when it's ready for pickup" verbatim.

- [x] Task 2: Back-to-vendors link (AC #3)
  - [x] Restyle the existing `<Link href="/">` as `button-pill-primary` (terracotta fill, `rounded-full`, per `DESIGN.md#Components`). Apply the Story 8.1 `focus-ring` utility.

- [x] Task 3: Tests (AC #1–#3)
  - [x] Run `tests/payment.spec.ts` after this story's changes — it navigates to `/checkout/success` directly and asserts the heading/body text; also exercises the vendor page's Add button and the cart page's Checkout button earlier in the same test, which are Story 8.2/8.3/8.4's concern, not new risk introduced here, but worth being aware this file spans multiple redesigned surfaces in one test.
  - [x] No new Vitest unit tests — no new business logic (`project-context.md#Testing Rules`).
  - [x] No mocking.

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

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx tsc --noEmit`: clean.
- `npm run lint` (`npx eslint src/app/checkout/success/page.tsx src/components/Icons.tsx`): clean.
- `npx vitest run`: 142/142 passed (no unit tests added — none needed, no new business logic).
- `npx playwright test tests/payment.spec.ts`: 2/2 passed, including "checkout success page renders" (heading/body text assertions unmodified and still passing).
- Full `npx playwright test`, run twice: 152/152 passed both runs, no flakes.
- Manually verified in a real browser (dev server + a throwaway Playwright screenshot script, not committed): confirm-card, check-badge with checkmark, italic body copy, and the 4 scattered squiggle flourishes all render correctly against `/checkout/success`, closely matching the approved mock, no console errors.

### Completion Notes List

- Confirmation card (Task 1): wrapped the existing heading/body in `DESIGN.md`'s `confirm-card` (`rounded-storefront-xl`, `card-border`, `shadow-confirm` — all pre-existing Story 8.1 tokens, matching the mock's literal `44px 56px 40px` padding and `480px` max-width, neither of which has a named spacing token so kept as arbitrary values per this epic's established precedent). `check-badge` uses the existing `olive-light`→`olive`→`olive-deep` gradient and `shadow-badge-check` token (both already defined in `tailwind.config.ts`, unused until now) plus the Story 8.1 `CheckmarkIcon`.
  - **Checkmark stroke width deliberately not matched to the mock's literal `stroke-width="4"`:** the mock's checkmark is a one-off SVG with its own 40x40 viewBox tuned in isolation; the app's real `CheckmarkIcon` shares `icon-line`'s uniform 24x24 viewBox and 1.3–1.6px stroke range with every other icon in the app (basket, clock, wheat, leaf). Using the icon's own default stroke keeps it visually consistent with the rest of the icon-line set instead of introducing a one-off thick-stroke exception — same "canonical system value over isolated mock pixel" call every prior 8.x story has made where the two disagree.
  - Body copy uses `{typography.body-lede}` (18px italic) rather than `body-card-desc` (15px italic) — the closest existing DESIGN.md role to the mock's own one-off 17px, and semantically closer (an editorial lede, not a card description).
- Squiggle flourish (Task 1): added `SquiggleFlourish` to `Icons.tsx`, reusing the existing `SQUIGGLE_TILE_SVG` data-URI constant `SquiggleDivider` already defined (Story 8.2) rather than duplicating it — renders one fixed-size mark instead of a repeating strip, positioned/rotated/scaled/dimmed per-instance via the caller's `className`. 4 instances match the mock's `f1`–`f4` positions/transforms/opacities exactly; simplified to one color (olive, the same asset `SquiggleDivider` already uses) rather than the mock's two-tone olive/terracotta variant, since AC #1 doesn't require the second color and introducing a second baked-color data-URI constant for a purely decorative detail wasn't worth the added surface in "the smallest, lowest-risk story in the epic."
- Back-to-vendors link (Task 2): restyled as `button-pill-primary` (`rounded-full`, terracotta fill, `shadow-button-primary`, `focus-ring`) — same padding/font-size/tracking values (`px-[26px] py-[14px] text-[15px] tracking-[0.02em]`) as Story 8.4's cart Checkout button, since both are the same `DESIGN.md` component. This is a known, already-logged duplication (`deferred-work.md`'s Story 8.4 review entry specifically named this page as the predicted second consumer) — not fixed here, since promoting it into a shared token/component is a deliberate decision flagged for outside this story's minimal scope, not a drive-by refactor mid-implementation.
- Tests (Task 3): no changes to `tests/payment.spec.ts` — its heading/body-text assertions pass unmodified against the restyled markup, confirmed by the file's 2/2 pass.

### File List

- `src/app/checkout/success/page.tsx` (modified — full restyle: confirm-card, check-badge, squiggle flourish, button-pill-primary link)
- `src/components/Icons.tsx` (modified — new `SquiggleFlourish` export, reusing `SquiggleDivider`'s existing tile asset)

### Review Findings

`/code-review opus`, single finder pass against Story 8.5's diff (`HEAD~1...HEAD`). Small, purely-presentational diff, no correctness/crash bugs. 2 findings:

- [x] [Review][Patch] Outer confirm-stage container used symmetric `py-[76px]` instead of the approved mock's asymmetric `padding: 76px 40px 90px` (`mockups/checkout-success.html:145`), undershooting bottom padding by 14px — the one literal value silently dropped where every other mock value was matched exactly. Fixed: `p-[76px_40px_90px]`, same shorthand-arbitrary style already used on the confirm-card itself.
- [x] [Review][Defer] "Back to vendors" link's `button-pill-primary` className string duplicates `cart/page.tsx`'s Checkout button verbatim — already logged in `deferred-work.md`'s Story 8.4 review entry as a predicted forward risk for this exact page; added a confirmation note there rather than a new entry. Not fixed here (token/component promotion is a deliberate follow-up decision, not a drive-by).
