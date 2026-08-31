---
baseline_commit: 4065a6396c5137bb4fd8c1f8ffb8916cd5c5c7c3
---

# Story 8.4: Cart and checkout redesign

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a customer reviewing my cart and checking out,
I want the cart page laid out clearly with my items, total, and the checkout form easy to complete,
so that finishing my order feels straightforward rather than like scrolling through one long plain form.

## Acceptance Criteria

1. **Given** `src/app/cart/page.tsx` today renders one long single-column stack (items list, then total, then name/phone/pickup-time/checkout)
   **When** this story ships
   **Then** the page splits into the two-column layout from `DESIGN.md#Layout & Spacing` (items + total on the left, a grouped contact/pickup-time/checkout panel on the right) — no change to what data is collected, when checkout is enabled, or the underlying DOM semantics the existing test suite depends on (see Dev Notes — this page has the heaviest existing test coverage of any surface in this epic).

2. **Given** the existing quantity stepper (`−`/count/`+` buttons) and "remove" link, with exact `aria-label`s (`Increase quantity of {name}`, `Decrease quantity of {name}`, `Quantity of {name}`) and exact behavior (`−` disabled at qty 1, `+` disabled at `stockQuantity`, `aria-live="polite"` on the quantity value)
   **When** this story ships
   **Then** they're restyled per `DESIGN.md#Components` (pill-shaped stepper, `field-border` token) while preserving every `aria-label` string **character-for-character** and all existing behavior — this is a **regression guard**, not new work; `tests/storefront-cart.spec.ts` asserts these exact strings via `page.locator('[aria-label="Quantity of ${name}"]')` (an exact CSS-attribute match, not fuzzy) and `getByRole("button", { name: \`Increase quantity of ${name}\` })`.

3. **Given** cart line items today render as `<li>` elements inside a `<ul>` (`tests/storefront-cart.spec.ts` locates them via `page.getByRole("listitem")`)
   **When** this story ships
   **Then** the two-column restyle keeps cart items as a real list (`<ul>`/`<li>`, `role="list"`/`role="listitem"`) — do not switch to plain `<div>` rows for the visual redesign; a list is still the correct semantic element regardless of the new column layout.

4. **Given** the pickup-time picker's existing states (loading, error, empty, one slot auto-selected as a non-interactive summary, 2+ slots as a real `<fieldset>`/`<legend>`/radio-input group, a full slot disabled) and existing radio accessible names (built from the label text wrapping each radio, including the formatted pickup window and location)
   **When** this story ships
   **Then** each state is restyled per `EXPERIENCE.md#State Patterns` and `DESIGN.md`'s `pickup-option` component, preserving the real `<fieldset>`/`<legend>`/radio-input group for 2+ options and the radio's accessible name still containing the slot's location text — `tests/storefront-cart.spec.ts` locates radios via `getByRole("radio", { name: new RegExp(slot.location) })`.

5. **Given** `cart/page.tsx`'s three dynamic error/warning messages (checkout error, pickup-times-fetch-failure, "no longer available — remove to continue") render today as plain `<p>` text with no announcement mechanism
   **When** this story ships
   **Then** all three gain `role="alert"` and `aria-live="polite"` — new work this story adds, per `EXPERIENCE.md#Accessibility Floor`, since all three can gate or block checkout and a screen-reader user currently gets no notification when one appears.

6. **Given** the name and mobile-number input fields with their current exact placeholder text ("Your name", "Mobile number (for pickup texts)")
   **When** this story ships
   **Then** they're restyled per `DESIGN.md`'s `input-field` component (`field-border`, `placeholder-text` tokens) — placeholder text stays exactly as it is today (`tests/storefront-cart.spec.ts` locates both fields by placeholder text in 4 separate tests); no new client-side validation is added, checkout stays gated on both fields being non-empty exactly as today.

7. **Given** `data-testid="cart-total"` on the total row and the Checkout button's text containing "Checkout" (asserted via `getByRole("button", { name: /checkout/i })`)
   **When** this story ships
   **Then** both are preserved — the `data-testid` verbatim, the button text still containing "Checkout" as a substring (styling it as `button-pill-primary` doesn't require changing its label).

## Tasks / Subtasks

- [ ] Task 1: Two-column layout shell (AC #1)
  - [ ] `src/app/cart/page.tsx` — restructure into the `1.55fr 1fr` two-column grid from `DESIGN.md#Layout & Spacing`: left column holds the existing `<ul>` of cart items plus the `data-testid="cart-total"` row; right column holds a single grouped panel with the name/phone inputs, pickup-time picker, and Checkout button, in that order (unchanged from today).
  - [ ] Do not change the `useCart()` hook usage, `handleCheckout()` logic, or any state variable — this story only changes JSX structure/classes around the existing logic, not the logic itself.

- [ ] Task 2: Cart item row and stepper restyle (AC #2, #3, #7)
  - [ ] Cart items stay `<li>` inside a `<ul>` — restyle via `DESIGN.md`'s `card-row` component (paper background, card-border hairline, `rounded-md`) without changing the list semantics.
  - [ ] Quantity stepper — restyle to a pill shape (`field-border` token) preserving every existing `aria-label` string verbatim: `Decrease quantity of {name}`, `Quantity of {name}` (on the count `<span>`), `Increase quantity of {name}`. Preserve `aria-live="polite"` on the quantity span and the existing `disabled` logic (`i.quantity <= 1` / `i.quantity >= i.stockQuantity`).
  - [ ] "remove" link — restyle per `EXPERIENCE.md#Component Patterns`'s guidance (`{typography.ui-sm}` / `{colors.ink-soft}`) but keep it a `<button>` (or whatever element currently renders `getByRole("button", { name: "remove" })`) with text containing "remove".
  - [ ] `data-testid="cart-total"` — keep verbatim on the total row.
  - [ ] Apply the Story 8.1 `focus-ring` utility to the stepper buttons and remove button.

- [ ] Task 3: Pickup-time picker restyle (AC #4)
  - [ ] Loading/error/empty/one-slot states — restyle per `EXPERIENCE.md#State Patterns`'s documented treatment (quiet `{typography.body-ui}`/`{colors.ink-soft}` text; the fetch-error and "no pickup times available" messages keep the app's current red-600 color per `DESIGN.md`'s documented open gap — no themed error color exists yet, don't invent one for this story).
  - [ ] 2+ slots — keep the real `<fieldset>`/`<legend>`/radio-input group; restyle each row per `DESIGN.md`'s `pickup-option` component (selected = terracotta border + `selected-wash` fill; full = `sold-out-bg` background + `badge-negative` "Full" pill, no separate radio-ring color per Story 8.1's token work). Preserve the label text wrapping each radio (the formatted pickup window + location) so the radio's accessible name is unchanged.
  - [ ] Apply the `focus-ring` utility to each radio input.

- [ ] Task 4: New accessibility work — live-region error messages (AC #5)
  - [ ] Add `role="alert"` and `aria-live="polite"` to: the checkout error message (`{error && <p>...}`), the pickup-times-fetch-failure message, and the "no longer available — remove to continue" per-item warning. This is new work — none of these three currently have any announcement mechanism.

- [ ] Task 5: Input fields (AC #6)
  - [ ] Restyle name/phone `<input>`s per `DESIGN.md`'s `input-field` component (`field-border` border, `cream` fill, `placeholder-text` placeholder color) — placeholder text strings stay exactly "Your name" and "Mobile number (for pickup texts)".
  - [ ] Apply the `focus-ring` utility to both inputs.

- [ ] Task 6: Tests (AC #1–#7)
  - [ ] Run the full `tests/storefront-cart.spec.ts` file after this story's changes — it's the single most cart-page-dependent test file in this codebase (list-item roles, exact aria-labels, exact placeholder text, radio accessible names, `data-testid="cart-total"`, the "Checkout" button substring match). Don't assume passes; run it and fix any break immediately, not as a follow-up.
  - [ ] No new Vitest unit tests — no new business logic (`project-context.md#Testing Rules`).
  - [ ] No mocking.

## Dev Notes

**Depends on Story 8.1** (token layer, `focus-ring` utility, icon set if pickup-option needs an icon).

**This story touches the single most heavily-tested page in the app — read `tests/storefront-cart.spec.ts` in full before starting, not just the excerpts cited in this story's ACs.** That file hits `/vendors/corner-sourdough` → `/cart` in roughly a dozen places, asserting on: `role="listitem"` cart rows, an exact CSS-attribute-selector match on `[aria-label="Quantity of {name}"]` (no fuzzy matching — this one breaks on any deviation, not just a wholesale rename), `getByRole("button", { name: "Increase/Decrease quantity of {name}" })`, `getByPlaceholder("Your name")` / `getByPlaceholder("Mobile number (for pickup texts)")` (4 separate tests), `getByRole("radio", { name: new RegExp(slot.location) })`, `data-testid="cart-total"`, and `getByRole("button", { name: /checkout/i })`. This story is a pure visual/layout restyle of a page whose *markup semantics* a dozen-plus existing tests already depend on — the discipline here is "same DOM meaning, new DOM appearance," not "rebuild the page."

**The only genuinely new behavior in this story is the three `role="alert"`/`aria-live="polite"` additions (Task 4)** — everything else is restyling existing, unchanged behavior. Don't let the volume of visual work in Tasks 1-3, 5 create pressure to also "clean up" or restructure the underlying state/logic in `cart/page.tsx` — that's explicitly out of scope (per `EXPERIENCE.md#Foundation`: "cart logic, checkout flow... are all unchanged, only presented differently").

**No error/themed color exists in the Terracotta & Olive palette** (`DESIGN.md`'s documented open gap) — the three error/warning messages stay on the app's current `red-600` text color; don't invent a themed error tone for this story.

### Project Structure Notes

- **Modified only:** `src/app/cart/page.tsx`, `tests/storefront-cart.spec.ts` (only if any locator genuinely needs adjustment after the restyle — expected to be none, given the preservation requirements above, but verify by running the suite, don't assume).
- No Prisma/schema/API changes.

### Testing Standards Summary

- Playwright only; run the full `tests/storefront-cart.spec.ts` file, not a subset, given its density of assertions against this exact page.
- No mocking.

### References

- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Layout & Spacing]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Components]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/EXPERIENCE.md#State Patterns]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/EXPERIENCE.md#Component Patterns]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/EXPERIENCE.md#Accessibility Floor]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/EXPERIENCE.md#Foundation]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8: Storefront Visual Redesign]
- [Source: _bmad-output/implementation-artifacts/8-1-design-token-foundation-and-shared-components.md]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
