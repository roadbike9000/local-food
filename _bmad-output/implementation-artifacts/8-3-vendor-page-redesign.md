---
baseline_commit: 4065a6396c5137bb4fd8c1f8ffb8916cd5c5c7c3
---

# Story 8.3: Vendor page redesign

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a customer viewing a vendor's storefront page,
I want to see the vendor's menu presented with real visual warmth — a hero photo, a clear pickup-time banner, and inviting product listings,
so that the page feels like a real bakery's own menu, not a generic template.

## Acceptance Criteria

1. **Given** `src/app/vendors/[slug]/page.tsx` today renders a plain `<h1>` vendor name, description paragraph, an orange "next pickup" box, a "Menu" heading, and a flat vertical stack of `ProductCard` rows
   **When** this story ships
   **Then** the page is restyled per `DESIGN.md#Components`: a hero photo section with `caption-plate` (a deterministic-contrast caption chip, not relying on gradient/text-shadow alone), the `pickup-banner` (terracotta gradient, hand-drawn clock icon from Story 8.1), the `squiggle-divider`, and product rows using `circular-thumb` placeholders
   **And** the `<h1>` vendor name remains a heading element with its text unchanged ("Corner Sourdough" etc. — real vendor names, not restyled copy) — `tests/storefront-cart.spec.ts` locates it via `getByRole("heading", { name: /corner sourdough/i })` and must keep passing unmodified.

2. **Given** a product's `stockQuantity <= 0` (out of stock)
   **When** its row renders
   **Then** the existing sold-out treatment (disabled "Add" button, dimmed thumb) is preserved and restyled to `button-pill-disabled` and `badge-negative` per `DESIGN.md#Components`
   **And** the badge text changes from the current "Out of stock" to "Sold Out" (matching `DESIGN.md`'s approved copy) — this is a deliberate microcopy change this story makes, not an oversight; `tests/storefront-cart.spec.ts:95`'s `card.getByText(/out of stock/i)` assertion must be updated in the same commit to match the new text, or the test will fail (regex `/out of stock/i` does not match "Sold Out" — these are different words, not a substring relationship like the "Cart"/"Cart, N items" case in Story 8.1).
   **And** the underlying availability logic (`isInStock()`, `stockQuantity <= 0` check) is unchanged — only the visual presentation and badge text change.

3. **Given** `tests/storefront-cart.spec.ts`'s existing "out-of-stock products show a badge" test scopes its assertions via `productHeading.locator("../..")` — a hardcoded "two levels up from the product-name heading" DOM traversal, per that test's own comment, coupled to `ProductCard.tsx`'s current exact structure (heading → its immediate info-div parent → that div's parent, the outer flex container)
   **When** `ProductCard.tsx` is restyled for the `circular-thumb` treatment
   **Then** the outer row keeps the same 3-direct-children flex shape (thumb, info-div-containing-the-heading, action-button) so the heading's DOM depth relative to the outer card container is unchanged
   **And** if restructuring turns out to be unavoidable, update `tests/storefront-cart.spec.ts`'s `.locator("../..")` traversal (and its explanatory comment) to match the new structure in the same commit — don't leave it silently pointing at the wrong ancestor.

4. **Given** the vendor's `deletedAt` is set (deactivated vendor — `src/app/vendors/[slug]/page.tsx` already returns a real 200 with a "This vendor is no longer available" message in place of the pickup banner and menu, per Story 2.3's existing behavior)
   **When** a customer visits that vendor's page
   **Then** the message renders in the new typography (`DESIGN.md`'s `display-lg` heading style for the vendor name, which still renders above the message) rather than plain unstyled text — behavior is unchanged, only presentation.

5. **Given** the page's interactive elements ("Add" buttons on in-stock products)
   **When** a keyboard user tabs through the page
   **Then** each is reachable and shows the Story 8.1 `focus-ring` utility.

## Tasks / Subtasks

- [ ] Task 1: Hero section and pickup banner (AC #1, #4)
  - [ ] `src/app/vendors/[slug]/page.tsx` — restyle the vendor-name heading (`display-lg` typography), add the hero-photo section with the `caption-plate` chip (see `DESIGN.md#Components`'s `caption-plate` token: a near-opaque `terracotta-deep` chip behind the caption text, deterministic contrast regardless of the underlying photo — real vendor photos don't exist in this app's data model yet, so this section needs a placeholder image strategy; check whether `Product.imageUrl` values already uploaded for this vendor's products can serve as a stand-in hero image, or whether a static placeholder is acceptable — implementer's call, but don't block this story on adding a new `Vendor.imageUrl` field, which would be a schema change out of scope for this visual-only epic).
  - [ ] Restyle the "next pickup" box into the `pickup-banner` component (terracotta gradient, `pickup-icon` roundel with the Story 8.1 clock icon, "Next Pickup" label + time/location detail) — the underlying data (`formatPickupWindow()`, `vendor.pickupSlots[0]`) and conditional rendering (`vendor.pickupSlots.length > 0`) are unchanged.
  - [ ] Add the `squiggle-divider` (built in Story 8.1 or 8.2) below the hero section.
  - [ ] Deactivated-vendor branch: restyle only the vendor-name heading and the "no longer available" message's typography — this branch's early-return structure and copy stay exactly as they are today.

- [ ] Task 2: Product row restyle (AC #2, #3, #5)
  - [ ] `src/components/ProductCard.tsx` — replace the `next/image`/`ProductImagePlaceholder` treatment with the `circular-thumb` component (`DESIGN.md#Components`: true circle, 84px on this page, inset bottom-shading shadow) — real product images (`product.imageUrl`) still render when present, the circular crop/shape is the visual change, not the image-vs-placeholder logic.
  - [ ] Preserve the exact outer-row DOM shape: one flex container with 3 direct children (thumb, info block containing the name heading + description + price + badge, the action button) — see AC #3. If this can't be preserved, update `tests/storefront-cart.spec.ts`'s `.locator("../..")` traversal in the same commit.
  - [ ] Sold-out state: change badge text from "Out of stock" to "Sold Out" (`badge-negative` styling), keep `aria-disabled`/`aria-describedby` on the "Add" button exactly as today (`ProductCard.tsx`'s existing `outOfStockId` pattern — this is a **regression guard**, not new work, matching `EXPERIENCE.md#Accessibility Floor`'s existing-pattern-preservation rule).
  - [ ] Apply the `focus-ring` utility to the "Add" button.
  - [ ] "Menu" section heading — restyle typography (`{typography.headline-md}`, per `DESIGN.md#Typography`'s documented mapping) but keep the text "Menu" and the item-count suffix unchanged.

- [ ] Task 3: Tests (AC #1–#5)
  - [ ] Update `tests/storefront-cart.spec.ts:95` (`card.getByText(/out of stock/i)`) to assert `card.getByText(/sold out/i)` instead, matching the new badge copy from Task 2 — do this in the same commit as the copy change, not as a follow-up.
  - [ ] Run the full `tests/storefront-cart.spec.ts` file after this story's changes — it hits `/vendors/corner-sourdough` in 11 places; every heading-role and "Add"-button-role assertion in that file must still pass. Don't assume; run it.
  - [ ] No new Vitest unit tests — no new business logic (`project-context.md#Testing Rules`).
  - [ ] No mocking.

## Dev Notes

**Depends on Story 8.1** (token layer, icon components including the clock icon, `focus-ring` utility) and benefits from Story 8.2 if the squiggle-divider was first built there — check which story actually builds it before assuming it doesn't exist yet.

**Two real regression risks found while scoping this story, both must be handled, not just avoided by luck:**
1. The out-of-stock badge text is changing from "Out of stock" to "Sold Out" to match the approved `DESIGN.md` copy — a real, deliberate change. `tests/storefront-cart.spec.ts:95` asserts the old text via regex and will fail if not updated in the same commit (see AC #2, Task 3).
2. `tests/storefront-cart.spec.ts`'s sold-out test locates the product's card via a hardcoded "two levels up from the heading" DOM traversal (its own comment names this explicitly). This story's restyle must preserve that structural depth or update the test's traversal — see AC #3.

**No `Vendor.imageUrl` field exists in the data model** — the hero photo section (Task 1) needs a real content strategy that doesn't require a schema change (out of scope for this visual-only epic). Options include reusing an existing product image as a stand-in, or a static/generic placeholder image — implementer's call, but note the choice explicitly in Completion Notes since it's a real product decision nobody has made yet, not a pure implementation detail.

**`isInStock()` (`src/lib/availability.ts`) remains the single source of truth for stock status** (`project-context.md#Critical Don't-Miss Rules`) — this story never re-derives availability, only re-styles its display.

### Project Structure Notes

- **Modified only:** `src/app/vendors/[slug]/page.tsx`, `src/components/ProductCard.tsx`, `tests/storefront-cart.spec.ts` (badge-text assertion update).
- No Prisma/schema changes.

### Testing Standards Summary

- Playwright only, extending `tests/storefront-cart.spec.ts` where the badge-text assertion needs updating; no new unit tests.
- Run the full file, not just the touched assertion, given how many of its 11 test cases hit this exact page.
- No mocking.

### References

- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Components]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Typography]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/EXPERIENCE.md#Accessibility Floor]
- [Source: _bmad-output/project-context.md#Critical Don't-Miss Rules]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8: Storefront Visual Redesign]
- [Source: _bmad-output/implementation-artifacts/8-1-design-token-foundation-and-shared-components.md]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
