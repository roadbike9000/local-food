---
baseline_commit: 4065a6396c5137bb4fd8c1f8ffb8916cd5c5c7c3
---

# Story 8.1: Design-token foundation and shared components

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a customer,
I want the site's persistent header, icons, and every interactive element to reflect the new Artisanal Warm visual identity,
so that the site feels cohesive and polished from the first thing I see on any page, not just on individual redesigned screens.

## Acceptance Criteria

1. **Given** the current Tailwind config (`tailwind.config.ts`) defines only a single `brand` color (`DEFAULT`/`light`/`dark`) with no typography, spacing, radius, or shadow scale
   **When** this story ships
   **Then** the token layer defines the full `DESIGN.md` frontmatter token set (Terracotta & Olive colors, Georgia/system-sans typography roles, rounded/spacing/shadow scales) so every later story (8.2–8.5) references named tokens instead of ad-hoc hex/px values — see `DESIGN.md#Colors`, `#Typography`, `#Layout & Spacing`, `#Shapes`, `#Elevation & Depth`.

2. **Given** `src/components/Navbar.tsx`'s cart link today renders bare "Cart" text plus a `<span>` that only renders when `count > 0`, with no `aria-label` on the link
   **When** this story ships
   **Then** it's replaced with `DESIGN.md`'s `header-cart-pill` component (hand-drawn basket icon, cream pill, terracotta count badge) — see `DESIGN.md#Components`
   **And** the link gains `aria-label="Cart, {count} items"` and the icon gains `aria-hidden="true"` — this is new accessibility work being added, not an existing pattern being preserved (per `EXPERIENCE.md#Accessibility Floor`).

3. **Given** emoji glyphs appear nowhere in the approved direction — Jeff explicitly rejected them during UX discovery
   **When** this story ships
   **Then** a reusable set of hand-drawn-style inline-SVG icon components exists, matching `DESIGN.md`'s `icon-line` token (basket, clock, wheat, leaf, checkmark)
   **And** `src/components/ProductCard.tsx`'s existing no-image-placeholder icon (already stroke-based `currentColor` SVG line art, `strokeWidth={1.5}`) is updated to add `strokeLinecap="round"` and `strokeLinejoin="round"` so it fully matches `icon-line`'s spec, rather than being replaced outright — no two icon styles should coexist in the app.

4. **Given** no interactive element in the app currently has a documented focus-visible treatment
   **When** this story ships
   **Then** a reusable `focus-ring` utility (terracotta outline, per `DESIGN.md#Components`) exists and is applied to the header cart-pill link built in this story
   **And** later stories (8.2–8.5) apply the same utility to their own interactive elements as they're built — this story only needs to prove the utility works on one real element, not retrofit the whole app.

5. **Given** `DESIGN.md#Do's and Don'ts` documents two known mock-drift spots (a near-duplicate `sold-out-bg` hex value, and a couple pixels of spacing drift between the vendor-page and cart mocks)
   **When** this story ships
   **Then** the token layer defines only the canonical values from `DESIGN.md`'s frontmatter — the drifted mock values are never carried into code.

## Tasks / Subtasks

- [ ] Task 1: Extend the Tailwind token layer (AC #1, #5)
  - [ ] `tailwind.config.ts` — add `DESIGN.md`'s full color palette to `theme.extend.colors` (17 tokens: `cream`, `cream-deep`, `paper`, `card-border`, `line`, `field-border`, `terracotta` family, `olive` family, `sage-light`, `selected-wash`, `sold-out-bg`, `disabled-outline`, `placeholder-text`, `ink`, `ink-soft`) — keep the existing `brand` key too (still referenced by untouched pages until Epic 8's later stories migrate them; don't delete it in this story).
  - [ ] Add `theme.extend.fontFamily` for the Georgia display stack and confirm the system-sans stack is Tailwind's existing default `font-sans` (don't duplicate it as a new token if Tailwind's built-in stack already matches `DESIGN.md`'s sans list — check `tailwind.config.ts`'s current defaults first).
  - [ ] Add `theme.extend.borderRadius` (`DESIGN.md.rounded`: `sm`/`DEFAULT`/`md`/`lg`/`xl`/`full`) and `theme.extend.spacing` (`DESIGN.md.spacing`: `gutter`/`section-gap`/`divider-gap`/`list-gap`/`grid-gap`/`panel-gap`/`tight`) as named keys, not just relying on Tailwind's default numeric scale.
  - [ ] Typography sizes/weights/line-heights (`DESIGN.md.typography`, 19 roles) don't map cleanly onto Tailwind's `fontSize` theme key (each role bundles size+weight+lineHeight+letterSpacing together) — implementer's choice: either extend `fontSize` with `[size, {lineHeight, letterSpacing}]` tuples per role, or keep these as documented reference values applied via Tailwind arbitrary-value utilities (`text-[52px]`) at each use site in stories 8.2–8.5. Don't force a heavier abstraction (e.g. a custom typography plugin) than this small token set needs.
  - [ ] Do NOT introduce `sold-out-bg`'s drifted mock value (`#d8c9a3`, seen in the cart mock) — only the canonical `#e6dbc0`. Do NOT carry forward the vendor-page/cart spacing drift (18px/28px) — only the canonical 16px/24px scale.

- [ ] Task 2: Header cart-pill (AC #2, #4)
  - [ ] `src/components/Navbar.tsx` — replace the current bare "Cart" text + conditional count `<span>` with `DESIGN.md`'s `header-cart-pill`: cream-fill pill (`rounded-full`), basket icon (built in Task 3), "Cart" text, and a count badge that's always rendered (matching the approved mocks, which render `<span class="cart-badge">0</span>` even at zero — this differs from the current app's hide-when-zero behavior; a minor, deliberately-simplifying visual change, not a functional one).
  - [ ] Add `aria-label={\`Cart, ${count} items\`}` to the `<Link href="/cart">`. Add `aria-hidden="true"` to the basket icon.
  - [ ] Apply the `focus-ring` utility (Task 4) to this link.

- [ ] Task 3: Hand-drawn inline-SVG icon set (AC #3)
  - [ ] New file, e.g. `src/components/icons/` (implementer's choice of exact location/naming, matching this codebase's existing `src/components/` flat structure) — basket, clock, wheat, leaf, checkmark icons as small React components, each an inline `<svg>` with `stroke="currentColor"`, `fill="none"`, `strokeWidth` in the 1.3–1.6px range, `strokeLinecap="round"`, `strokeLinejoin="round"` (per `DESIGN.md`'s `icon-line` token). The squiggle-divider (also inline SVG, `DESIGN.md`'s `squiggle-divider` token) is a separate, later-story concern (used in 8.3/8.5) — don't build it in this story unless trivial to include alongside.
  - [ ] `src/components/ProductCard.tsx`'s `ProductImagePlaceholder()` — add `strokeLinecap="round"` and `strokeLinejoin="round"` to its existing `<svg>` (currently has neither, defaulting to butt/miter joins) so it matches `icon-line`'s spec exactly. Its `stroke="currentColor"`, `strokeWidth={1.5}`, and `aria-hidden="true"` already comply — don't touch those.
  - [ ] Confirm zero emoji characters remain anywhere in the codebase (`grep -rP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/` or equivalent) — the current codebase has none, but this is the story that establishes the "never emoji" rule going forward; a quick confirmation grep costs nothing and pins the baseline.

- [ ] Task 4: Focus-ring utility (AC #4)
  - [ ] A reusable `focus-ring` Tailwind utility class (or a small shared className constant, implementer's choice) — terracotta outline (2px solid, ~2px offset per `DESIGN.md`'s `focus-ring` component token), applied via `focus-visible:` (not bare `focus:`, to avoid a visible ring on mouse click — matches modern browser-default `:focus-visible` semantics and avoids the classic "ugly ring on every click" complaint without losing keyboard accessibility).
  - [ ] Apply it to the header cart-pill link (Task 2) as this story's one proof-of-use. Do not apply it retroactively to every existing interactive element in the app — that's each later story's own job as it touches its own elements.

- [ ] Task 5: Tests (AC #1–#5)
  - [ ] This story has no new business logic (no pure functions, no Prisma/API changes) — no new Vitest unit tests are needed; this codebase's testing convention reserves Vitest for pure functions/helpers only (`project-context.md#Testing Rules`).
  - [ ] New or extended Playwright coverage in `tests/homepage.spec.ts` or a new `tests/navbar.spec.ts` (implementer's choice, matching this codebase's one-file-per-feature-area convention): the cart-pill link has the expected `aria-label` text (assert via `getByRole("link", { name: /Cart, \d+ items/ })`, not by CSS class), the icon is `aria-hidden` (assert the SVG has `aria-hidden="true"` or that it's excluded from the accessibility tree), and the link is keyboard-reachable (`Tab` reaches it, `Enter` navigates to `/cart` — a real behavior test, not just a visual snapshot).
  - [ ] **Regression check, don't skip:** `tests/sms.spec.ts:26` and `tests/payment.spec.ts:41` locate the cart link via `page.getByRole("link", { name: "Cart" })`; `tests/homepage.spec.ts:14` via `page.getByRole("link", { name: /cart/i })`. Playwright's default (non-`exact`) name matching is substring-based, so all three should still match the new `aria-label="Cart, {count} items"` — but verify by actually running all three spec files after the Navbar change, don't just trust the substring-matching theory.
  - [ ] No mocking — matches this codebase's established convention.

## Dev Notes

**This is the foundation story for Epic 8 — stories 8.2 through 8.5 depend on the token layer and shared components this story builds, but this story itself depends on nothing else in the epic.** Keep its scope disciplined: token definitions + 3 shared components (cart-pill, icon set, focus-ring utility) proven on exactly one real element (the cart-pill). Do not use this story as a place to start restyling the homepage, vendor page, cart, or checkout-success pages — those are 8.2–8.5's job.

**Tailwind-only, no new dependency.** This codebase has no CSS modules/styled-components and no icon library (`project-context.md#Framework-Specific Rules`, `#Code Quality & Style Rules`). `DESIGN.md`'s Do's and Don'ts explicitly chose system Georgia over a webfont/Google Fonts load specifically to avoid a new dependency — don't add `next/font` or any Google Fonts import for this. The hand-drawn icons are hand-authored inline SVG (no icon library like `lucide-react`/`heroicons`), matching `ProductCard.tsx`'s existing placeholder icon's own approach.

**`ProductCard.tsx`'s placeholder icon is the one piece of `icon-line`-matching SVG that already exists in this codebase** (`src/components/ProductCard.tsx`, `ProductImagePlaceholder()`) — `stroke="currentColor"`, `strokeWidth={1.5}`, `aria-hidden="true"` all already match `DESIGN.md`'s `icon-line` token. It's missing only `strokeLinecap="round"`/`strokeLinejoin="round"`. This is a real point of continuity `DESIGN.md`'s own Components section calls out — read the actual file before touching it, don't rebuild it from scratch.

**Cart-pill badge-at-zero is a deliberate small behavior change, flagged here so it isn't missed or silently reverted.** Today (`Navbar.tsx`), the count badge only renders when `count > 0` — a customer with an empty cart sees plain "Cart" text, no badge at all. All 4 approved mocks (including `mockups/checkout-success.html`, a page reached with a cart that's typically now empty post-checkout) render the badge always, including at `0`. This wasn't a decision Jeff made explicitly — it fell out of the mock's consistent treatment. Implement it as "badge always visible" to match the approved mocks; if it reads oddly in practice (e.g. a "0" badge feels like noise), note that in Completion Notes rather than silently reverting to conditional rendering.

**No Prisma/schema/API changes anywhere in this story** — purely front-end token/component work. `src/lib/*` is untouched.

### Project Structure Notes

- **New:** an icon-components location under `src/components/` (exact naming/file-per-icon-vs-one-file is implementer's discretion, matching this codebase's existing flat `src/components/` structure — no `src/components/icons/index.ts` barrel-file convention exists elsewhere in this codebase to match, so a flat set of files or one file is equally fine).
- **Modified:** `tailwind.config.ts` (token layer), `src/components/Navbar.tsx` (cart-pill), `src/components/ProductCard.tsx` (placeholder icon's `strokeLinecap`/`strokeLinejoin` only — don't touch anything else in this file, it's fully out of scope otherwise for this story).
- No changes needed to `src/app/globals.css` beyond what Tailwind's `@tailwind` directives already provide, unless the typography-role approach chosen in Task 1 needs a small `@layer utilities` addition — implementer's call.

### Testing Standards Summary

- Playwright only for this story (UI/accessibility behavior, not pure logic) — matches `project-context.md#Testing Rules`'s Vitest-for-pure-functions-only convention.
- Assert on real behavior (`aria-label` text, keyboard reachability, `aria-hidden` on decorative icons) — not CSS class names or visual snapshots, matching this codebase's established `toHaveURL`-not-DOM-internals convention (`project-context.md#Testing Rules`).
- No mocking.

### References

- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Colors]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Typography]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Layout & Spacing]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Shapes]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Elevation & Depth]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Components]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/DESIGN.md#Do's and Don'ts]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-local-food-2026-08-29/EXPERIENCE.md#Accessibility Floor]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 8: Storefront Visual Redesign]
- [Source: _bmad-output/project-context.md#Framework-Specific Rules]
- [Source: _bmad-output/project-context.md#Testing Rules]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
