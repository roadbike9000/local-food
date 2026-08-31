---
baseline_commit: 4065a6396c5137bb4fd8c1f8ffb8916cd5c5c7c3
---

# Story 8.2: Homepage redesign

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a customer visiting the homepage,
I want to see vendor cards in the new Artisanal Warm style with the whole card clickable,
so that browsing feels inviting and I don't have to aim for a small button just to view a vendor's menu.

## Acceptance Criteria

1. **Given** `src/components/VendorCard.tsx` today already wraps name/description/item-count in one `<Link href={\`/vendors/${slug}\`}>`
   **When** this story ships
   **Then** it's restyled per `DESIGN.md#Components`'s `vendor-card` definition (card-panel base, accent panel, "View menu" visual label, hover state where the label darkens from `terracotta` to `terracotta-deep`) while preserving the existing whole-card-is-a-link behavior
   **And** no `<button>` or other separate interactive element is introduced inside the card — the "View menu" text is presentational only, matching `EXPERIENCE.md#Component Patterns`'s explicit "no dead decorative buttons" rule.

2. **Given** `Vendor` has no category/type field in the data model (**DECIDED 2026-08-30, Jeff** — see `deferred-work.md`'s "Deferred from: create-story scoping of epic-8-storefront-visual-redesign" entry: a real `Vendor.category` field is deferred to a future epic, out of scope for this visual-only epic)
   **When** any vendor card renders, regardless of what that vendor actually sells
   **Then** it uses one universal accent-panel treatment (same gradient, same accent icon) — no per-vendor category differentiation, since there's no real data to differentiate on. Do not hardcode a "bakery vs. farm" branch keyed off vendor name/slug/description text — that would be the "pseudo-category from text" option Jeff explicitly rejected in favor of one universal treatment.

3. **Given** the homepage's persistent header (built in Story 8.1) and the card's own interactive link
   **When** a keyboard user tabs through the page
   **Then** every vendor card and the header cart-pill are reachable via `Tab` and activatable via `Enter`, with the `focus-ring` utility (from Story 8.1) visible on each — no hover-only affordances (per `EXPERIENCE.md#Interaction Primitives`).

4. **Given** `src/app/page.tsx` already handles the zero-vendors empty state ("No vendors yet. Run `npm run db:seed` to add samples.") and the deactivated-vendor exclusion (`where: { deletedAt: null }`)
   **When** this story ships
   **Then** both behaviors are preserved exactly — this story restyles the page shell (heading, subhead, squiggle divider, section heading with item count) and the card grid, it does not touch the Prisma query or the empty-state logic.

## Tasks / Subtasks

- [ ] Task 1: Homepage page shell (AC #4)
  - [ ] `src/app/page.tsx` — restyle the `<h1>`/subhead per `DESIGN.md#Typography` (`display-md` for the H1, per `DESIGN.md#Typography`'s documented mapping: "the homepage hero is next" after the vendor page's `display-lg`), add the squiggle-divider (from Story 8.1's icon/SVG work — if the squiggle-divider component wasn't built in 8.1, build it here as this story's own prerequisite, since it's needed for this page's layout) below the hero text, and a "Vendors near you" section heading with an item count (`{typography.headline-sm}` / `{typography.card-title}` distinction — see `DESIGN.md#Typography`'s note that these are byte-identical in size but distinct semantic roles; use `headline-sm` for this page-level section heading).
  - [ ] Do not change the Prisma query (`prisma.vendor.findMany({ where: { deletedAt: null }, ... })`) or the zero-vendors empty-state branch — both stay exactly as they are today.

- [ ] Task 2: Vendor card restyle (AC #1, #2)
  - [ ] `src/components/VendorCard.tsx` — restyle per `DESIGN.md`'s `vendor-card` component: `card-panel` base (paper background, card-border hairline, `rounded-lg`, mid-tier shadow), a universal accent panel (one gradient/icon treatment for every card, per AC #2 — do not branch on vendor data), the vendor name in `{typography.card-title}`, description in `{typography.body-card-desc}` (italic), item-count as a `badge-positive` pill ("N items available"), and a "View menu" `button-pill`-styled `<span>` (not a `<button>`) as the trailing visual label.
  - [ ] Keep the outer `<Link href={\`/vendors/${slug}\`}>` as the single interactive element wrapping the entire card — do not add a nested `<button>`, `<a>`, or `role="button"` anywhere inside it (would create invalid nested-interactive-content and defeat the whole-card-link pattern this story exists to preserve).
  - [ ] Apply the Story 8.1 `focus-ring` utility to this link.

- [ ] Task 3: Tests (AC #1–#4)
  - [ ] No new business logic — no new Vitest unit tests needed (matches Story 8.1's precedent; `project-context.md#Testing Rules`).
  - [ ] Extend `tests/homepage.spec.ts` (existing file — read it first to match its established conventions before adding to it): assert the vendor-card link's accessible name still resolves to the vendor and still navigates to `/vendors/{slug}` on click (real behavior, not a CSS/snapshot check); assert no separate focusable element exists inside a card besides the outer link (e.g. count `page.getByRole("link")` / `page.getByRole("button")` scoped to one card and confirm there's exactly one focusable element); keyboard-`Tab` reaches a card and `Enter` navigates.
  - [ ] Confirm the existing zero-vendors empty-state test (if one exists in `tests/homepage.spec.ts` — check) still passes unmodified; if none exists, this story doesn't need to add one (out of this story's AC scope — Task 1 explicitly preserves, doesn't newly test, that branch).
  - [ ] No mocking.

## Dev Notes

**Depends on Story 8.1** — the token layer (`tailwind.config.ts` extensions), the `focus-ring` utility, and (if not already built there) the squiggle-divider icon component are prerequisites. Do not start this story before 8.1 is done.

**The universal-accent decision is final for this epic, not a placeholder pending a future choice.** `deferred-work.md`'s entry for this is explicit: ship one universal treatment now, a real `Vendor.category` field (if ever wanted) is a future epic's separate scope decision, not something this story should half-implement (e.g. don't add an unused `category` prop to `VendorCard` "for later" — YAGNI, add it when the future epic actually needs it).

**`VendorCard.tsx` is currently a Server Component** (no `"use client"`, no interactivity beyond the plain `<Link>`) — keep it that way. Nothing in this story's restyle needs client-side state or effects.

**Read `src/app/page.tsx` and `src/components/VendorCard.tsx` in full before starting** — both are short today (page.tsx ~42 lines, VendorCard.tsx ~26 lines), but the exact current Prisma query shape (`_count: { select: { products: true } }`) and prop names (`slug`, `name`, `description`, `productCount`) must be preserved exactly; this story changes presentation, not the data contract between the page and the card component.

### Project Structure Notes

- **Modified only:** `src/app/page.tsx`, `src/components/VendorCard.tsx`, `tests/homepage.spec.ts`.
- No new files expected for this story (the accent-panel visual is CSS/Tailwind-only per the approved mock — `screen-homepage.html`'s `.card-accent`/`.accent-icon` treatment was pure CSS gradients + an inline SVG icon already built in Story 8.1, not a new asset).

### Testing Standards Summary

- Playwright only, extending the existing `tests/homepage.spec.ts` file (one-file-per-feature-area convention).
- Assert on real behavior (navigation, accessible-element count, keyboard reachability) — not CSS classes or visual snapshots.
- No mocking.

### References

- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Components]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Typography]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/EXPERIENCE.md#Component Patterns]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/EXPERIENCE.md#Interaction Primitives]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: create-story scoping of epic-8-storefront-visual-redesign (2026-08-30)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8: Storefront Visual Redesign]
- [Source: _bmad-output/implementation-artifacts/8-1-design-token-foundation-and-shared-components.md]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
