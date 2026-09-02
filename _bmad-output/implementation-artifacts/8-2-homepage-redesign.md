---
baseline_commit: 4065a6396c5137bb4fd8c1f8ffb8916cd5c5c7c3
---

# Story 8.2: Homepage redesign

Status: done

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

- [x] Task 1: Homepage page shell (AC #4)
  - [x] `src/app/page.tsx` — restyle the `<h1>`/subhead per `DESIGN.md#Typography` (`display-md` for the H1, per `DESIGN.md#Typography`'s documented mapping: "the homepage hero is next" after the vendor page's `display-lg`), add the squiggle-divider (from Story 8.1's icon/SVG work — if the squiggle-divider component wasn't built in 8.1, build it here as this story's own prerequisite, since it's needed for this page's layout) below the hero text, and a "Vendors near you" section heading with an item count (`{typography.headline-sm}` / `{typography.card-title}` distinction — see `DESIGN.md#Typography`'s note that these are byte-identical in size but distinct semantic roles; use `headline-sm` for this page-level section heading).
  - [x] Do not change the Prisma query (`prisma.vendor.findMany({ where: { deletedAt: null }, ... })`) or the zero-vendors empty-state branch — both stay exactly as they are today.

- [x] Task 2: Vendor card restyle (AC #1, #2)
  - [x] `src/components/VendorCard.tsx` — restyle per `DESIGN.md`'s `vendor-card` component: `card-panel` base (paper background, card-border hairline, `rounded-lg`, mid-tier shadow), a universal accent panel (one gradient/icon treatment for every card, per AC #2 — do not branch on vendor data), the vendor name in `{typography.card-title}`, description in `{typography.body-card-desc}` (italic), item-count as a `badge-positive` pill ("N items available"), and a "View menu" `button-pill`-styled `<span>` (not a `<button>`) as the trailing visual label.
  - [x] Keep the outer `<Link href={\`/vendors/${slug}\`}>` as the single interactive element wrapping the entire card — do not add a nested `<button>`, `<a>`, or `role="button"` anywhere inside it (would create invalid nested-interactive-content and defeat the whole-card-link pattern this story exists to preserve).
  - [x] Apply the Story 8.1 `focus-ring` utility to this link.

- [x] Task 3: Tests (AC #1–#4)
  - [x] No new business logic — no new Vitest unit tests needed (matches Story 8.1's precedent; `project-context.md#Testing Rules`).
  - [x] Extend `tests/homepage.spec.ts` (existing file — read it first to match its established conventions before adding to it): assert the vendor-card link's accessible name still resolves to the vendor and still navigates to `/vendors/{slug}` on click (real behavior, not a CSS/snapshot check); assert no separate focusable element exists inside a card besides the outer link (e.g. count `page.getByRole("link")` / `page.getByRole("button")` scoped to one card and confirm there's exactly one focusable element); keyboard-`Tab` reaches a card and `Enter` navigates.
  - [x] Confirm the existing zero-vendors empty-state test (if one exists in `tests/homepage.spec.ts` — check) still passes unmodified; if none exists, this story doesn't need to add one (out of this story's AC scope — Task 1 explicitly preserves, doesn't newly test, that branch).
  - [x] No mocking.

### Review Findings

**Code review (`/code-review opus`, full branch diff, 2026-08-31)** — ran against the whole branch, not just this story's own commit; findings below are the subset scoped to this story. The rest (cart 400-race stale slot state, duplicated/divergent pickup-slot capacity-check logic, several lower-confidence Story 7.1 items) are out of this story's file scope and logged in `deferred-work.md` instead.

- [x] [Review][Patch] `src/app/page.tsx`'s squiggle-divider used a hardcoded `mt-[30px]` arbitrary value instead of the `divider-gap` (30px) spacing token Story 8.1 already defined in `tailwind.config.ts` for exactly this. [src/app/page.tsx]
- [x] [Review][Patch] `eslint-local-rules/index.js`'s `storefront-radius-tokens` rule (built in Story 8.1 round 2) had two gaps that reopened the exact "plausible-but-wrong radius, nothing to catch it" bug the rule exists to close: it didn't match variant-prefixed classes (`hover:rounded-lg`, `sm:rounded-md` — anchored on whitespace, not `:`), and it didn't walk ternary/`clsx()`-style `className` expressions, only plain strings and template literals. Not a defect in this story's own diff, but caught while reviewing it and fixed in the same pass since it's the shared guardrail 8.3-8.5 will also rely on. [eslint-local-rules/index.js]

Both verified: `npx eslint` clean on the full `src/app`/`src/components` tree, plus a dedicated `RuleTester` regression covering variant-prefixed classes, ternaries, `clsx()` calls, and confirming no false positive on `rounded-storefront-lg`/`rounded-full`/`border-rounded-lg`.

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

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx tsc --noEmit`: clean.
- `npm run lint`: clean (including the round-2 `local-rules/storefront-radius-tokens` rule against `rounded-storefront-lg`).
- `npx vitest run`: 142/142 passed (no unit tests added — none needed, no new business logic, matches Story 8.1's precedent).
- `npx playwright test tests/homepage.spec.ts`: 8/8 passed (3 new Story 8.2 tests + the 5 existing Story 8.1 tests, confirming no regression on the header work).
- Full `npx playwright test`, run twice: first run 134 passed / 2 failed / 16 skipped; second run 151 passed / 1 failed / 0 skipped. Investigated both failures:
  - `tests/dashboard.spec.ts:107` ("vendor's pickup-slots API never returns another vendor's slots") — failed only in the first full run, passed cleanly in isolation (`npx playwright test tests/dashboard.spec.ts -g "..."`, 1/1 passed) and in the second full run. This story touches zero backend/API/auth code (`src/app/page.tsx`'s JSX/Tailwind classes, `VendorCard.tsx`'s restyle, a new `SquiggleDivider` in `Icons.tsx`, `tests/homepage.spec.ts`), so there's no plausible mechanism connecting this story's changes to a pickup-slots API isolation test. Same class of pre-existing `dashboard.spec.ts` serial-block parallel-execution flake Story 8.1's Debug Log already documented (one flaky test in the authenticated `test.describe.configure({ mode: "serial" })` block cascades to skip its siblings — explains the first run's "16 did not run"). Not fixed here — pre-existing test-infrastructure flake, out of this story's scope.
  - `tests/storefront-cart.spec.ts:66` ("out-of-stock products show a badge...") — Story 8.3's own already-known-red ATDD test, unrelated to this story, unchanged by it.
- Manually verified in a real browser (dev server + a throwaway Playwright screenshot script, not committed): homepage hero/squiggle/section-heading render correctly, both seeded vendor cards show the accent panel/wheat icon/badge/View-menu pill, hovering a card darkens "View menu" from terracotta to terracotta-deep with no other hover chrome (matches AC #1 exactly), no console errors.

### Completion Notes List

- Page shell (Task 1): `src/app/page.tsx`'s hero restyled with a `label-caps` kicker ("Local Marketplace"), `display-md` H1 (`font-serif`, `text-terracotta-deep`), and a `body-lede` italic subhead — matching `DESIGN.md#Typography`'s mapping. Added the new `SquiggleDivider` (Task 1's own prerequisite, see below) below the hero. Added a `headline-sm` "Vendors near you" section heading.
  - **Item count in the section heading:** Task 1's text says the heading needs "an item count" but the approved mock (`mockups/homepage.html`) renders it as plain "Vendors near you" text with no count. Interpreted literally per the task's own wording rather than the mock (which predates this specific instruction) — rendered as `Vendors near you ({vendors.length})`. Flagging the interpretation call rather than silently picking one reading.
  - Prisma query and the zero-vendors empty-state branch are byte-for-byte unchanged (`where: { deletedAt: null }`, `orderBy: { createdAt: "asc" }`, the `_count.products` include, and the "No vendors yet..." paragraph text) — only their surrounding JSX/classNames moved, per Task 1's explicit instruction not to touch either.
- Squiggle-divider (Task 1's prerequisite): Story 8.1 built the 5-icon `icon-line` set but not the squiggle-divider, since `DESIGN.md` documents it as a tiled repeating-background pattern (tileWidth/tileHeight/path/stroke/opacity), not a discrete icon like the others. Added `SquiggleDivider` to `src/components/Icons.tsx` (this codebase's established home for shared SVG-based decorative components) as a `<div>` with a data-URI SVG tile as its CSS `background-image` (inline `style`, since a full SVG data URI is unwieldy and fragile to escape inside a Tailwind arbitrary-value className string) — reproduces `DESIGN.md`'s exact path (`M0 9 Q 8.5 0 17 9 T 34 9`), olive stroke, 34×18px tile, 0.8 opacity.
- Vendor card (Task 2): `VendorCard.tsx` restyled to `card-panel` (paper background, `card-border` hairline, `rounded-storefront-lg`, `shadow-card` — the Story 8.1 tokens, not the bare Tailwind defaults this file used before), a universal accent panel, `card-title` name, italic `body-card-desc` description, a `badge-positive`-style pill for item count (preserving the existing singular/plural "N item(s) available" text exactly), and a `button-pill`-styled `<span>` "View menu" label that darkens via Tailwind's `group`/`group-hover:` (no JS) — matching `DESIGN.md`'s `vendor-card.hoverEffect` spec ("inner call-to-action label darkens... no other hover chrome") exactly. `focus-ring` applied to the outer `<Link>`, still the sole interactive element in the card (no nested `<button>`/`<a>`/`role="button"` added).
  - **Universal accent-panel treatment (AC #2):** the approved mock (`mockups/homepage.html`) shows two category-coded variants (a terracotta "bakery" gradient+crosshatch and an olive "farm" gradient+furrows, keyed off which seeded vendor renders) — but that mock predates Jeff's 2026-08-30 decision (`deferred-work.md`) to ship one universal treatment with no per-vendor differentiation, since `Vendor` has no category field. Implemented one treatment for every card: a `terracotta-light`→`terracotta`→`terracotta-deep` gradient (simplified from the mock's radial-gradient-plus-crosshatch texture — a plain Tailwind gradient using existing color tokens, not a hand-authored CSS texture pattern) with `WheatIcon` (built in Story 8.1, explicitly earmarked there for "8.2's homepage accent panel") as the one universal accent icon. `LeafIcon` (also built in 8.1) is intentionally *not* used here — using both would reintroduce the rejected per-card differentiation.
- Tests (Task 3): 3 new cases in `tests/homepage.spec.ts` — the card-link-navigates case (already true before this story, a preservation check, not new behavior), the exactly-one-focusable-element-per-card case (also already true, a preservation check for AC #1's "no dead decorative buttons" rule), and the keyboard-reachable-with-focus-ring case (genuinely red before this story — confirmed by running it in isolation pre-implementation, `outlineStyle` was `"auto"` not `"solid"` — now green). No zero-vendors empty-state test existed before this story and none was added, matching Task 3's own explicit instruction.

### File List

- `src/app/page.tsx` (modified — hero/subhead/kicker restyle, squiggle-divider, "Vendors near you" section heading; Prisma query and empty-state branch unchanged; review round: `mt-[30px]` → `mt-divider-gap` token)
- `src/components/VendorCard.tsx` (modified — full `vendor-card` restyle: card-panel base, universal accent panel, card-title/body-card-desc typography, badge-positive item-count pill, button-pill "View menu" label, focus-ring)
- `src/components/Icons.tsx` (modified — new `SquiggleDivider` export)
- `tests/homepage.spec.ts` (modified — 3 new Story 8.2 test cases)
- `eslint-local-rules/index.js` (modified, review round — `storefront-radius-tokens` rule: variant-prefix + non-literal-expression coverage, caught during this story's review, out of this story's own scope but fixed in the same pass)
