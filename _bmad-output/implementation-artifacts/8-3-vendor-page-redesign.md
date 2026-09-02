---
baseline_commit: 4065a6396c5137bb4fd8c1f8ffb8916cd5c5c7c3
---

# Story 8.3: Vendor page redesign

Status: review

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

- [x] Task 1: Hero section and pickup banner (AC #1, #4)
  - [x] `src/app/vendors/[slug]/page.tsx` — restyle the vendor-name heading (`display-lg` typography), add the hero-photo section with the `caption-plate` chip (see `DESIGN.md#Components`'s `caption-plate` token: a near-opaque `terracotta-deep` chip behind the caption text, deterministic contrast regardless of the underlying photo — real vendor photos don't exist in this app's data model yet, so this section needs a placeholder image strategy; check whether `Product.imageUrl` values already uploaded for this vendor's products can serve as a stand-in hero image, or whether a static placeholder is acceptable — implementer's call, but don't block this story on adding a new `Vendor.imageUrl` field, which would be a schema change out of scope for this visual-only epic).
  - [x] Restyle the "next pickup" box into the `pickup-banner` component (terracotta gradient, `pickup-icon` roundel with the Story 8.1 clock icon, "Next Pickup" label + time/location detail) — the underlying data (`formatPickupWindow()`, `vendor.pickupSlots[0]`) and conditional rendering (`vendor.pickupSlots.length > 0`) are unchanged.
  - [x] Add the `squiggle-divider` (built in Story 8.1 or 8.2) below the hero section.
  - [x] Deactivated-vendor branch: restyle only the vendor-name heading and the "no longer available" message's typography — this branch's early-return structure and copy stay exactly as they are today.

- [x] Task 2: Product row restyle (AC #2, #3, #5)
  - [x] `src/components/ProductCard.tsx` — replace the `next/image`/`ProductImagePlaceholder` treatment with the `circular-thumb` component (`DESIGN.md#Components`: true circle, 84px on this page, inset bottom-shading shadow) — real product images (`product.imageUrl`) still render when present, the circular crop/shape is the visual change, not the image-vs-placeholder logic.
  - [x] Preserve the exact outer-row DOM shape: one flex container with 3 direct children (thumb, info block containing the name heading + description + price + badge, the action button) — see AC #3. If this can't be preserved, update `tests/storefront-cart.spec.ts`'s `.locator("../..")` traversal in the same commit.
  - [x] Sold-out state: change badge text from "Out of stock" to "Sold Out" (`badge-negative` styling), keep `aria-disabled`/`aria-describedby` on the "Add" button exactly as today (`ProductCard.tsx`'s existing `outOfStockId` pattern — this is a **regression guard**, not new work, matching `EXPERIENCE.md#Accessibility Floor`'s existing-pattern-preservation rule).
  - [x] Apply the `focus-ring` utility to the "Add" button.
  - [x] "Menu" section heading — restyle typography (`{typography.headline-md}`, per `DESIGN.md#Typography`'s documented mapping) but keep the text "Menu" and the item-count suffix unchanged.

- [x] Task 3: Tests (AC #1–#5)
  - [x] Update `tests/storefront-cart.spec.ts:95` (`card.getByText(/out of stock/i)`) to assert `card.getByText(/sold out/i)` instead, matching the new badge copy from Task 2 — do this in the same commit as the copy change, not as a follow-up.
  - [x] Run the full `tests/storefront-cart.spec.ts` file after this story's changes — it hits `/vendors/corner-sourdough` in 11 places; every heading-role and "Add"-button-role assertion in that file must still pass. Don't assume; run it.
  - [x] No new Vitest unit tests — no new business logic (`project-context.md#Testing Rules`).
  - [x] No mocking.

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

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx tsc --noEmit`: clean.
- `npm run lint` (`npx eslint src/app src/components`, full tree): clean.
- `npx vitest run`: 142/142 passed (no unit tests added — none needed, no new business logic).
- `npx playwright test tests/storefront-cart.spec.ts`: 16/16 passed, including the Story 8.3 ATDD red-phase test ("out-of-stock products show a badge and a disabled Add button") — it was already scaffolded with the target `/sold out/i` assertion (Story 8.1/8.2's dev sessions both independently noted it as "known-red until 8.3 ships"); no test-file edit was needed since the scaffold already asserted the correct target copy, only the app code needed to change.
- Full `npx playwright test`, run twice: 152/152 passed both runs, no flakes.
- Manually verified in a real browser (dev server + a throwaway Playwright screenshot script, not committed): hero gradient placeholder + caption plate, pickup banner with clock icon, squiggle divider, and circular product thumbs with badges/Add buttons all render as expected against `/vendors/corner-sourdough`, no console errors.

### Completion Notes List

- Hero section (Task 1): no `Vendor.imageUrl` field exists (confirmed, out of this visual-only epic's scope per Dev Notes) — implemented the suggested stand-in strategy: the first product with an already-Cloudinary-validated `imageUrl` (same `CLOUDINARY_URL_PREFIX` check `page.tsx` already applies per-product) renders as the hero background via a plain `style={{ backgroundImage }}` div (matching `SquiggleDivider`'s existing inline-style-for-SVG-data-URI precedent in this codebase, and avoiding `next/image`'s layout-prop complexity for a full-bleed background). When no product has one (true for the seeded dev data today), falls back to the same `from-terracotta-light via-terracotta to-terracotta-deep` gradient `VendorCard.tsx` already uses for its accent panel — reuses an existing visual treatment rather than inventing a second one.
  - **Caption text is a flagged interpretation call, same as 8.2's item-count one:** the mock's hero caption ("Fresh from this morning's bake") is vendor-specific copy with no backing data field (no per-vendor tagline/category exists, same gap 8.2 already resolved by dropping the mock's per-vendor kicker/category distinction). Used one static, vendor-agnostic caption ("Fresh from this vendor, ready for pickup") identical across every vendor — deliberately generic rather than inventing per-vendor content that doesn't exist. Also dropped the mock's "Weekend Bakery"-style kicker line entirely for the same reason (no data to back it, and AC #1 doesn't require one).
  - Pickup-banner spacing (26px, mock) and pickup-icon (translucent white circle, 42px) implemented per `DESIGN.md#Components`'s literal token values, not the mock's exact-pixel-drifted markup — matches this epic's established precedent (Story 8.1 Completion Notes) of using canonical `DESIGN.md` values over mock drift where the two differ.
- Product row restyle (Task 2): `IMAGE_SIZE` bumped from 64→84px (`DESIGN.md`'s `circular-thumb`, vendor-page value) — confirmed via grep that `ProductCard.tsx` is used only on this page, so no shared-component-tension with a different size elsewhere (Story 8.4's cart page will build its own 56px cart-item treatment separately, not through this component). Outer-row DOM shape preserved exactly (3 direct children: thumb, `flex-1` info div, button) — no test-locator update needed (AC #3's "if unavoidable" branch wasn't triggered). Badge moved from "Out of stock" to "Sold Out" text and `badge-negative` styling (`bg-sold-out-bg`/`text-ink-soft`), kept as a sibling of the heading (not nested inside it) specifically to avoid changing the `<h3>`'s accessible name — nesting it (as the mock's flat `.p-name` div does) would have made `getByRole("heading", { name: ... })` return "Product Name Sold Out" instead of just the name, a real behavior change AC #3 doesn't ask for and Task 2's DOM-preservation instruction argues against.
  - Sold-out visual treatment (dimmed circular thumb) approximates the mock's `grayscale(0.7) brightness(0.85) opacity(0.6)` via Tailwind arbitrary-value utilities (`grayscale-[70%] brightness-[85%] opacity-60`) rather than a plain full `grayscale`, matching the mock's softer (not fully desaturated) look.
  - "Menu" heading: Task 2's own wording says to keep "the item-count suffix unchanged," but the current (pre-story) code has no item-count suffix at all — only the bare word "Menu." Flagging this the same way Story 8.2's Completion Notes flagged its own analogous task-wording/actual-code mismatch: interpreted literally against the real current code (which has nothing to "keep unchanged" beyond the word itself) rather than the mock (which does show a count) — restyled typography only, added no new count text, since AC #1's requirements list doesn't ask for one either.
  - `button-pill` padding used `DESIGN.md`'s literal token values (10px/20px, i.e. `py-2.5 px-5`) rather than the mock's own slightly-drifted 11px/22px, consistent with this epic's established canonical-over-mock precedent.
- Tests (Task 3): no edits needed to `tests/storefront-cart.spec.ts` — its ATDD scaffold (built ahead of this story, confirmed already in place per Story 8.1/8.2's own Debug Log entries) already asserted the target `/sold out/i` copy and the correct `.locator("../..")` DOM traversal, both of which this story's implementation satisfies as-is. Full file run (16/16) and full suite run twice (152/152, 152/152) both clean.

### File List

- `src/app/vendors/[slug]/page.tsx` (modified — vendor-name/description typography, hero-photo section with caption-plate, pickup-banner restyle, squiggle-divider, "Menu" heading typography, deactivated-vendor branch typography)
- `src/components/ProductCard.tsx` (modified — circular-thumb restyle at 84px, card-row container styling, "Sold Out" badge copy/styling, focus-ring on the Add button)
