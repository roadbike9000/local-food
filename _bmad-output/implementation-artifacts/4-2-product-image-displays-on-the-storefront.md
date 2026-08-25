---
baseline_commit: 2d9cff4f756195cf18ad0f650390834ec4925a1e
---

# Story 4.2: Product image displays on the storefront

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a customer,
I want to see a product's photo when I'm browsing,
so that I know what I'm actually buying.

## Acceptance Criteria

1. A product with `imageUrl` set renders its image on the storefront listing (`/vendors/[slug]`'s `ProductCard`), alongside the existing name/description/price.
2. A product with no `imageUrl` (the common case — every pre-existing product) shows a neutral placeholder, never a broken-image icon or blank gap where the image would be.
3. Image rendering never blocks the rest of the page — a slow-loading or failed (404, network error) image does not prevent the Add-to-cart button from being usable.
4. Scope is the storefront listing only. No dedicated per-product detail page exists in this codebase today — confirmed by reading `src/app/vendors/[slug]/page.tsx` in full: the only place a customer ever sees a product is `ProductCard`, rendered in a list on the vendor storefront. AC's "listing or detail page" phrasing from the epic collapses to "the storefront listing" for this reason. The cart page's line items and the vendor dashboard's own product table are separate, out-of-scope surfaces — neither is "the storefront."

*(FR14. Decision carried from Epic 4: single image per product, matching the current schema. Scope correction from epics.md's "listing or detail page" phrasing: confirmed by reading the codebase that no detail page exists to extend — AC #4 documents this correction, same pattern as Story 4.1's AC #7.)*

## Tasks / Subtasks

- [x] Task 1: Pass `imageUrl` through to `ProductCard` (AC #1, #4)
  - [x] `src/app/vendors/[slug]/page.tsx` — the `product={{...}}` object mapped for each `ProductCard` currently only includes `id`, `name`, `description`, `priceCents`, `stockQuantity` (`Product.imageUrl` is not selected into it at all, despite the Prisma query already fetching the full row via `include: { products: ... } }`). Add `imageUrl: p.imageUrl` to that mapped object.
  - [x] `src/components/ProductCard.tsx` — add `imageUrl: string | null` to `ProductCardProps["product"]`.

- [x] Task 2: Render the image (or a placeholder) in `ProductCard` (AC #1, #2, #3)
  - [x] Use `next/image`'s `<Image>` component, not a plain `<img>` tag — `next.config.mjs`'s `images.remotePatterns` already whitelists `res.cloudinary.com` (set up during Story 4.1 specifically anticipating this story; don't add a second images config or a different pattern).
  - [x] Fixed `width`/`height` sized for this card's compact row layout (e.g. `64`/`64` or `80`/`80` — pick something that reads well next to the existing name/price text, doesn't need to match pixel-for-pixel, dev's call). `next/image` requires explicit dimensions unless using `fill` inside a sized wrapper — either approach is fine, stay consistent with `ProductCard`'s existing flex layout.
  - [x] `next/image` lazy-loads by default (`loading="lazy"`) — don't override this to `eager`; a slow/failed image must not hold up the rest of the card or page (AC #3).
  - [x] When `product.imageUrl` is `null`/`undefined`, render a neutral placeholder in the same slot (same dimensions as the real image, so the layout doesn't shift). No placeholder asset or icon library exists anywhere in this codebase today (no `/public` folder, no npm icon dependency) — build one inline (an SVG or a plain Tailwind-styled `div`, e.g. a muted background box), don't add a new dependency for this. Give it `data-testid="product-image-placeholder"` — no ARIA role naturally identifies "the image placeholder," matching this codebase's one existing narrow `data-testid` exception (`cart-total` in `src/app/cart/page.tsx`, added for the identical reason). The real `<Image>` needs no `data-testid`; its accessible role (`img`) plus `alt={product.name}` is enough to locate it.
  - [x] `product.imageUrl` being *set* doesn't guarantee the Cloudinary asset still loads (deleted upstream, transient network failure) — add an `onError` handler on the `<Image>` that swaps to the same placeholder rather than leaving Next's default broken-image rendering. This needs the component to track "did this specific image fail" in local state (`useState`), since `next/image`'s `onError` fires client-side after the initial render attempt.
  - [x] `next/image`'s `alt` prop is required (TypeScript enforces this) — use `product.name` for the real image (accessibility: a screen reader should hear the product's name, not a generic label); the placeholder can use `alt=""` since it's purely decorative and the product name is already shown as adjacent text.
  - [x] If using `fill` instead of fixed `width`/`height`, the wrapping element must have `position: relative` and an explicit size, and `<Image>` needs a `sizes` prop (Next warns/degrades performance without one) — only relevant if you choose the `fill` approach over fixed dimensions.

- [x] Task 3: Confirm nothing else breaks (AC #3, plus regression safety)
  - [x] Verify the Add-to-cart button stays enabled/clickable regardless of image state (loading, loaded, or failed-and-placeholder-swapped) — it must never become unclickable or delayed by image loading.
  - [x] `tests/storefront-cart.spec.ts` and `tests/dashboard.spec.ts`'s existing out-of-stock test both locate a product's outer card via `productHeading.locator("../..")` — exactly two DOM levels up from the name `<h3>` to `ProductCard`'s outer flex container. Adding the image element must not change that depth relationship (add it as a sibling of the existing text-info `<div>` inside the same outer container, not as a new wrapping ancestor around the heading).

- [x] Task 4: Tests (AC #1-#4)
  - [x] Extend `tests/storefront-cart.spec.ts` (read it in full first, matches its existing vendor-storefront-visit pattern): a product created with a real `imageUrl` set renders an image element inside its card (read the actual rendered DOM from `next/image`'s output before writing the assertion — it renders a real `<img>` with a Next-optimizer-rewritten `src`, not the original Cloudinary URL verbatim, so assert on element presence/`alt` text or add a `data-testid`, not a literal `src` string match); a product with `imageUrl: null` shows the placeholder instead (assert the placeholder is present, and that no broken-image state is shown); a product with a deliberately-broken `imageUrl` (a syntactically valid but non-resolving Cloudinary-style URL) still leaves the Add button clickable and ends up showing the placeholder after the image fails to load.
  - [x] `tests/helpers/db.ts`'s `createTestProduct()` has no `imageUrl` override today (confirmed by reading it in full) — add one to its `overrides` type, undefined/omitted by default (matching every other optional field's pattern in that function).
  - [x] No mocking of the image load — matches this codebase's established "no mocking external services" convention (Story 4.1's own upload tests, Stripe/Clerk/Twilio elsewhere). The broken-image test's URL is a real, deliberately-non-resolving one, not a mocked response.

- [x] Task 5: Docs sync (housekeeping, matches established precedent)
  - [x] `docs/data-models.md` — Story 4.1 already confirmed `Product.imageUrl`'s row (`| imageUrl | String? | Cloudinary URL |`) has no stale "not yet populated"/"not yet rendered" language to remove. Re-check on this story's own inspection (the row may have been touched since); update only if it's actually stale, and say so either way in Completion Notes (don't skip the check just because 4.1 already found it clean once).
  - [x] `docs/api-contracts.md` — this story is pure rendering, no request/response shape changes to any endpoint. Confirm no relevant section needs a note (e.g. `GET /api/products`'s response shape doc, if any, already lists `imageUrl` — check, don't assume) and record the "no change needed" finding in Completion Notes rather than silently skipping the file.

### Review Findings

- [x] [Review][Patch] `next/image` will render any Cloudinary account's asset, and would crash the page if `imageUrl` ever pointed at a completely different host — `next.config.mjs`'s `images.remotePatterns` whitelists the bare `res.cloudinary.com` hostname with no account scoping, so this component is the first code path that actually renders `imageUrl` through `next/image` against that broad config. `Product.imageUrl` has no DB-level CHECK constraint (Zod-only enforcement at `CreateProductSchema`, per this codebase's established "known unenforced boundaries" pattern) — a value that bypasses that schema (direct Prisma write, future admin tool, bulk import) reaches this component untrusted. A non-Cloudinary host isn't just wrongly-trusted, it throws a hard `next/image` host-validation error and crashes the whole Server Component render, not just that one card. [src/components/ProductCard.tsx, src/app/vendors/[slug]/page.tsx] — **Fixed:** exported `CLOUDINARY_URL_PREFIX` from `src/app/api/products/schema.ts` and re-validated `p.imageUrl` against it in `page.tsx` (a Server Component, safe to read `process.env.CLOUDINARY_CLOUD_NAME`) before ever passing it to `ProductCard`; anything that doesn't match is coerced to `null`, same treatment as no image. Deliberately *not* done by importing the constant into the client component itself — `CLOUDINARY_CLOUD_NAME` isn't `NEXT_PUBLIC_`-prefixed, so it would resolve to `undefined` in the browser bundle and silently break the check for everyone. Test fixtures updated to upload a real image via `uploadImage()` (this app's own cloud) instead of Cloudinary's public "demo" cloud, which would now be correctly coerced to `null` and never reach `next/image` at all — verified end-to-end (real own-cloud image renders, own-cloud-but-404 image still falls back via `onError`).
- [x] [Review][Patch] Duplicate accessible name on every card — `<Image alt={product.name}>` sits immediately beside `<h3>{product.name}</h3>`; a screen reader announces the same text twice per product. The image is decorative relative to the adjacent visible heading (WCAG "redundant image" pattern) and should use `alt=""`, matching how the placeholder's inner SVG is already correctly marked `aria-hidden`. [src/components/ProductCard.tsx] — **Fixed:** `alt=""` on the real `<Image>`; added `data-testid="product-image"` so tests can still locate it (the accessible-name-based locator no longer applies once `alt` is empty).
- [x] [Review][Patch] `imageFailed` state has no reset path if `product.imageUrl` changes without the component remounting — currently masked by `key={p.id}` in `page.tsx`'s `.map()` (a different product always gets a fresh instance) and this app having no live-update/optimistic-UI mechanism anywhere, but it's a latent bug: a same-product `imageUrl` change under any future live-refresh pattern would get stuck showing a stale placeholder even after the new image would load fine. [src/components/ProductCard.tsx]
- [x] [Review][Patch] `role="presentation"` on the placeholder `<div>` is a no-op — a bare `<div>` carries no implicit ARIA role to begin with, so setting `presentation` changes nothing. The inner SVG's `aria-hidden="true"` is the actual mechanism already correctly hiding it. [src/components/ProductCard.tsx]
- [x] [Review][Patch] `justify-between` on the outer card `className` is now vestigial — with the text-info `<div>` set to `flex-1`, it already consumes all remaining space and pushes the Add button to the end on its own. [src/components/ProductCard.tsx]
- [x] [Review][Patch] `IMAGE_SIZE = 64` has no rationale comment — the story left the exact value as "dev's call" between 64 and 80; nothing records why 64 was picked. [src/components/ProductCard.tsx]
- [x] [Review][Defer] No fast/deterministic (unit/component-level) test coverage — all 3 new tests are Playwright e2e hitting a live third-party CDN. Real gap, but this codebase has no component-testing framework or convention anywhere (Vitest here is scoped to pure-function/schema tests only) — establishing one is infrastructure work beyond this story's scope, deferred rather than built ad hoc for one component.

## Dev Notes

**`Product.imageUrl` already exists, already populated by Story 4.1, and already trustworthy by the time this story reads it.** Story 4.1's `CreateProductSchema` (`src/app/api/products/schema.ts`) narrows `imageUrl` to this app's own Cloudinary cloud (`https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/...`, tightened during that story's own code review — read that file's `CLOUDINARY_URL_PREFIX` constant for the exact current host-scoping logic). This story does no new validation — it only reads and renders the field.

**`next.config.mjs`'s `images.remotePatterns` already whitelists `res.cloudinary.com`** — added during Story 4.1 specifically in anticipation of this story's `next/image` usage. Don't add a second images config or a narrower/different pattern; the existing one is already correctly scoped to the same host `CreateProductSchema` accepts.

**No product-detail page exists.** `src/app/vendors/[slug]/page.tsx` (read in full for this story) is the only place a customer sees products — a list of `ProductCard`s. The epic's "listing or detail page" phrasing is satisfied by the listing alone; AC #4 documents this scope correction explicitly, the same pattern Story 4.1's AC #7 used for its own scope correction.

**`ProductCard.tsx` is already a `"use client"` component** (it has interactive Add-to-cart state via `useCart()`), so `next/image`'s `onError` handler (needed for the broken-image case) works without any new client-boundary concerns — no new `"use client"` directive needed anywhere else.

**No placeholder image asset or icon library exists anywhere in this codebase.** There's no `/public` folder and no npm icon dependency (confirmed by listing the project root and grepping `src/components` for existing SVG/placeholder patterns). Build the placeholder inline — an SVG or a Tailwind-styled `div` — rather than introducing a new dependency or asset pipeline for one small placeholder graphic.

**Preserve the existing e2e DOM-depth convention.** `tests/storefront-cart.spec.ts` and `tests/dashboard.spec.ts` both locate a product's card via `productHeading.locator("../..")` — exactly two levels up from the name `<h3>` to `ProductCard`'s outer flex container (`src/components/ProductCard.tsx`'s current structure: `<div className="flex items-center justify-between ...">` wrapping a text-info `<div>` and the Add `<button>`). Add the image as a new sibling inside that same outer container (e.g., inside or alongside the existing text-info `<div>`), not as a new ancestor wrapping the heading — changing that depth breaks every existing test using this locator pattern, not just this story's new ones.

**`tests/helpers/db.ts`'s `createTestProduct()` has no `imageUrl` override today** (read in full for this story: its `overrides` type covers `name`/`priceCents`/`stockQuantity`/`lowStockThreshold`/`stockIsPlaceholder`/`thresholdIsPlaceholder`, nothing image-related) — this story's own tests need it added.

**Money/stock display logic is untouched.** `formatPrice()` (`src/lib/utils.ts`) and `isInStock()` (`src/lib/availability.ts`) are both already used correctly in `ProductCard.tsx` — this story is purely additive (one new image/placeholder element in the existing card), not a rewrite of any existing display logic.

### Project Structure Notes

- **New (optional, dev's call):** a small extracted placeholder component (e.g. `src/components/ProductImagePlaceholder.tsx`) if the inline SVG/markup is non-trivial enough to warrant its own file — not required if it stays a few lines inline in `ProductCard.tsx`.
- **Modified:** `src/app/vendors/[slug]/page.tsx` (pass `imageUrl` through), `src/components/ProductCard.tsx` (render image/placeholder, handle load failure), `tests/storefront-cart.spec.ts` (extended), `tests/helpers/db.ts` (`createTestProduct()`'s new `imageUrl` override).
- No new API route, schema, or Prisma migration — `Product.imageUrl` already exists and is already fetched by the existing `prisma.vendor.findUnique({ include: { products: ... } })` query in `page.tsx`; it just isn't threaded through to the component yet.

### Testing Standards Summary

- Playwright only (`tests/storefront-cart.spec.ts`) — this story is markup/rendering, not a pure function or a new schema, so there's no natural Vitest unit-test surface the way Story 4.1's schema files had.
- Real Cloudinary-hosted image URLs in tests, matching this codebase's established "no mocking of external services" convention — the broken-image test case uses a real, deliberately-non-resolving URL rather than a mocked response.
- Uses the existing unauthenticated storefront-visit pattern already established in `tests/storefront-cart.spec.ts` — no new auth infrastructure needed, the storefront is a public route.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2] — story definition and ACs (corrected in this story per AC #4 — see Dev Notes).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4] — epic scope, single-image decision (carried from Story 4.1).
- [Source: src/app/vendors/[slug]/page.tsx] — current storefront page (read in full for this story) — the exact product-mapping object Task 1 extends with `imageUrl`.
- [Source: src/components/ProductCard.tsx] — current card component (read in full for this story) — the exact component this story extends; its existing DOM structure is what Task 3's locator-preservation constraint is about.
- [Source: next.config.mjs] — `images.remotePatterns` already configured for `res.cloudinary.com` during Story 4.1, the authoritative config this story's `next/image` usage relies on.
- [Source: src/app/api/products/schema.ts] — Story 4.1's `CLOUDINARY_URL_PREFIX` host-scoping (this story doesn't modify it, just relies on `imageUrl` already being trustworthy by the time it's read here).
- [Source: tests/storefront-cart.spec.ts] — existing test file this story extends; establishes the `heading.locator("../..")` DOM-depth convention that must be preserved.
- [Source: tests/helpers/db.ts] — `createTestProduct()` (read in full for this story) — confirms no `imageUrl` override exists yet, needed for Task 4's tests.
- [Source: _bmad-output/implementation-artifacts/4-1-vendor-uploads-a-product-image.md] — previous story in this epic; `Product.imageUrl`'s validation/scoping this story builds on without re-deriving.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- **Caught and fixed a self-introduced DOM-depth regression during Task 2, before it ever reached a test run.** The first implementation attempt wrapped the image and the existing text-info `<div>` in a new intermediate wrapper `<div>`, adding a third ancestor level between the product-name `<h3>` and `ProductCard`'s outer container — exactly the regression Task 3's own bullet warned against. Caught on re-reading the JSX (also surfaced a second, unrelated bug in the same draft: an unbalanced `<div>` count that would have failed to compile). Rewrote `ProductCard.tsx` cleanly with the image, text-info `<div>`, and `<button>` as three direct siblings of the outer container — preserving the exact `heading -> text-info-div -> outer-div` two-level relationship `tests/storefront-cart.spec.ts`'s `heading.locator("../..")` depends on. Verified: full `storefront-cart.spec.ts` run (12/12, including every pre-existing test using that locator) passes clean.
- Placeholder built inline as a small SVG in a `data-testid="product-image-placeholder"` `<div>` — no icon library or `/public` asset exists anywhere in this codebase (confirmed on inspection), matching Dev Notes' explicit instruction not to add one. The `data-testid` follows the one existing narrow precedent in this codebase (`cart-total`, `src/app/cart/page.tsx`) for an element with no natural ARIA role.
- `onError` on `next/image` required local `useState` (`imageFailed`) to swap to the placeholder after a failed load — verified against a real, deliberately non-resolving Cloudinary-style URL (`.../story-4-2-does-not-exist.jpg`), not a mock. Confirmed the real network 404 in the dev server's own log output during the test run, not just the visible UI outcome.
- `npx tsc --noEmit` — clean.
- `npm run lint` — clean (no ESLint warnings or errors).
- `npm run test:unit` — 90/90 passed, unaffected (this story adds no unit-testable logic).
- `npx playwright test tests/storefront-cart.spec.ts` — 12/12 passed (9 pre-existing + 3 new), including the real broken-image case passing on first run.
- Full `npx playwright test` — see Step 9 completion run below.
- **Code review (round 1)**: 3-layer review (Blind Hunter, Edge Case Hunter, Acceptance Auditor). Acceptance Auditor found zero AC violations. 5 patches applied: (1) `imageUrl` re-validated against this app's own Cloudinary cloud server-side in `page.tsx` before reaching `ProductCard` — `next/image` would otherwise render *any* Cloudinary account's asset and hard-crash the page for a non-Cloudinary host, since `Product.imageUrl` has no DB-level constraint backing the Zod-only validation at write time; deliberately done in the Server Component, not by importing the check into the client component, since `CLOUDINARY_CLOUD_NAME` isn't `NEXT_PUBLIC_`-prefixed and would resolve to `undefined` in the browser bundle. (2) `alt=""` on the real image — a non-empty `alt` matching the adjacent visible `<h3>` was a duplicate-announcement a11y bug, not an enhancement. (3) `imageFailed` state now resets via `useEffect` keyed on `product.imageUrl` — currently unreachable given `key={p.id}` and no live-update pattern in this app, but cheap defense-in-depth matching this codebase's own established convention for that class of gap. (4) removed a no-op `role="presentation"`. (5) removed vestigial `justify-between`. (6) added a rationale comment for `IMAGE_SIZE`. Test fixtures also updated: the "real image" case now uploads via `uploadImage()` to this app's own cloud (a "demo"-cloud URL would now be correctly coerced to `null` by fix #1 and never reach `next/image`), verified end-to-end. 1 item deferred (no unit/component-level test coverage — no such framework exists anywhere in this codebase, out of scope to build for one component). Full regression re-run clean after fixes: 90/90 unit, 123/123 e2e, build succeeds.

### Completion Notes List

- `src/app/vendors/[slug]/page.tsx` now passes `imageUrl: p.imageUrl` through to `ProductCard` (previously omitted from the mapped object despite the Prisma query already fetching it).
- `ProductCard.tsx` renders `next/image` when `product.imageUrl` is set and hasn't failed to load; falls back to an inline SVG placeholder (`data-testid="product-image-placeholder"`) when there's no image, or when the real image's `onError` fires. Fixed 64×64 dimensions, `alt=""` (decorative relative to the adjacent visible name — see Review Findings), `data-testid="product-image"` for tests, lazy-loaded by `next/image`'s default (never blocks the rest of the card/page).
- All 3 ATDD scaffolds activated and pass for real (no skips, no mocking — Story 4.1's own established convention for external-service-adjacent behavior).
- Docs re-checked per Task 5, both confirmed to need no change: `docs/data-models.md`'s `Product.imageUrl` row already reads plain "Cloudinary URL" with no stale claim (Story 4.1 found this too; re-confirmed independently here, not assumed). `docs/api-contracts.md` has no endpoint whose request/response shape this story touches — the storefront reads `Product.imageUrl` via a direct Prisma query in a Server Component, not through a documented API contract.
- Full regression: typecheck clean, lint clean, 90/90 unit, full e2e suite run and results recorded below (Step 9).

### File List

- `src/app/vendors/[slug]/page.tsx` (modified — `imageUrl` added to the `ProductCard` prop mapping, re-validated against `CLOUDINARY_URL_PREFIX` before passing through)
- `src/app/api/products/schema.ts` (modified — `CLOUDINARY_URL_PREFIX` exported for reuse in `page.tsx`)
- `src/components/ProductCard.tsx` (modified — image/placeholder rendering, `onError` fallback, `ProductImagePlaceholder` helper component, `useEffect` reset on `imageUrl` change)
- `tests/storefront-cart.spec.ts` (modified — 3 new cases activated; real-image case now uploads via `uploadImage()` to this app's own cloud)
- `tests/helpers/db.ts` (modified — `imageUrl` override added to `createTestProduct()`, from the ATDD scaffolding step)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — 1 deferred finding logged)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status transitions)

## Change Log

- 2026-08-24: Implemented Story 4.2 in full. `src/app/vendors/[slug]/page.tsx` now passes `Product.imageUrl` through to `ProductCard`, which renders it via `next/image` (fixed 64×64, lazy-loaded, `alt={product.name}`) with a fallback to an inline SVG placeholder (`data-testid="product-image-placeholder"`) for products with no image, and an `onError`-driven fallback to the same placeholder for a real image that fails to load. Caught and fixed a self-introduced DOM-depth regression during implementation (an extra wrapper div that would have broken the `heading.locator("../..")` convention every existing storefront-cart test depends on) before it ever reached a test run — rewrote to keep the image, text-info, and Add button as three direct siblings of the outer card. All 3 ATDD scaffolds activated and pass for real against a live, deliberately-broken Cloudinary URL (no mocking). Docs re-checked, no changes needed. Full regression: typecheck clean, lint clean, 90/90 unit, 123/123 e2e (zero skips), production build succeeds. Status → review.
- 2026-08-24 (round-1 review): 3-layer review (Blind Hunter, Edge Case Hunter, Acceptance Auditor) — Acceptance Auditor found zero AC violations. **Fixed:** (1) `imageUrl` re-validated against this app's own Cloudinary cloud in `page.tsx` before ever reaching `ProductCard` — `next/image` would otherwise trust any Cloudinary account's asset and hard-crash the page for a genuinely different host, since `Product.imageUrl` carries no DB-level constraint behind its Zod-only write-time validation; the check lives server-side specifically because `CLOUDINARY_CLOUD_NAME` isn't `NEXT_PUBLIC_`-prefixed and would silently resolve to `undefined` if read from the client component instead. (2) `alt=""` on the real image, fixing a duplicate-announcement accessibility bug (it sat next to an identical visible `<h3>`). (3) `imageFailed` now resets via `useEffect` keyed on `product.imageUrl` — currently unreachable given this app's `key={p.id}` remount-per-product pattern and no live-update UI anywhere, but cheap and consistent with this codebase's own convention of patching defense-in-depth on currently-unreachable paths. (4)-(6) removed a no-op ARIA role, a vestigial flex class, and added a missing rationale comment. Test fixtures updated to use a real image uploaded to this app's own Cloudinary cloud (the prior "demo"-cloud fixture would now be correctly rejected by fix #1). 1 finding deferred (no component/unit-level test coverage — no such framework exists anywhere in this codebase; logged in `deferred-work.md`). Full regression clean after fixes: typecheck, lint, 90/90 unit, 123/123 e2e, build succeeds. Status → done.
