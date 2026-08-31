---
baseline_commit: 4065a6396c5137bb4fd8c1f8ffb8916cd5c5c7c3
---

# Story 8.1: Design-token foundation and shared components

Status: review

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

- [x] Task 1: Extend the Tailwind token layer (AC #1, #5)
  - [x] `tailwind.config.ts` — add `DESIGN.md`'s full color palette to `theme.extend.colors` (17 tokens: `cream`, `cream-deep`, `paper`, `card-border`, `line`, `field-border`, `terracotta` family, `olive` family, `sage-light`, `selected-wash`, `sold-out-bg`, `disabled-outline`, `placeholder-text`, `ink`, `ink-soft`) — keep the existing `brand` key too (still referenced by untouched pages until Epic 8's later stories migrate them; don't delete it in this story).
  - [x] Add `theme.extend.fontFamily` for the Georgia display stack and confirm the system-sans stack is Tailwind's existing default `font-sans` (don't duplicate it as a new token if Tailwind's built-in stack already matches `DESIGN.md`'s sans list — check `tailwind.config.ts`'s current defaults first).
  - [x] Add `theme.extend.borderRadius` (`DESIGN.md.rounded`, namespaced `storefront-sm`/`storefront`/`storefront-md`/`storefront-lg`/`storefront-xl` — see Completion Notes), `theme.extend.spacing` (`DESIGN.md.spacing`: `gutter`/`section-gap`/`divider-gap`/`list-gap`/`grid-gap`/`panel-gap`/`tight`), and `theme.extend.boxShadow` (`DESIGN.md`'s Elevation & Depth scale: `row`/`card`/`hero`/`confirm`/`button`/`button-primary`/`badge-check`/`thumb`) as named keys, not just relying on Tailwind's default numeric scale.
  - [x] Typography sizes/weights/line-heights (`DESIGN.md.typography`, 19 roles) don't map cleanly onto Tailwind's `fontSize` theme key (each role bundles size+weight+lineHeight+letterSpacing together) — implementer's choice: either extend `fontSize` with `[size, {lineHeight, letterSpacing}]` tuples per role, or keep these as documented reference values applied via Tailwind arbitrary-value utilities (`text-[52px]`) at each use site in stories 8.2–8.5. Don't force a heavier abstraction (e.g. a custom typography plugin) than this small token set needs.
  - [x] Do NOT introduce `sold-out-bg`'s drifted mock value (`#d8c9a3`, seen in the cart mock) — only the canonical `#e6dbc0`. Do NOT carry forward the vendor-page/cart spacing drift (18px/28px) — only the canonical 16px/24px scale.

- [x] Task 2: Header cart-pill (AC #2, #4)
  - [x] `src/components/Navbar.tsx` — replace the current bare "Cart" text + conditional count `<span>` with `DESIGN.md`'s `header-cart-pill`: cream-fill pill (`rounded-full`), basket icon (built in Task 3), "Cart" text, and a count badge that's always rendered (matching the approved mocks, which render `<span class="cart-badge">0</span>` even at zero — this differs from the current app's hide-when-zero behavior; a minor, deliberately-simplifying visual change, not a functional one).
  - [x] Add `aria-label={\`Cart, ${count} items\`}` to the `<Link href="/cart">`. Add `aria-hidden="true"` to the basket icon.
  - [x] Apply the `focus-ring` utility (Task 4) to this link.

- [x] Task 3: Hand-drawn inline-SVG icon set (AC #3)
  - [x] New file, e.g. `src/components/icons/` (implementer's choice of exact location/naming, matching this codebase's existing `src/components/` flat structure) — basket, clock, wheat, leaf, checkmark icons as small React components, each an inline `<svg>` with `stroke="currentColor"`, `fill="none"`, `strokeWidth` in the 1.3–1.6px range, `strokeLinecap="round"`, `strokeLinejoin="round"` (per `DESIGN.md`'s `icon-line` token). The squiggle-divider (also inline SVG, `DESIGN.md`'s `squiggle-divider` token) is a separate, later-story concern (used in 8.3/8.5) — don't build it in this story unless trivial to include alongside.
  - [x] `src/components/ProductCard.tsx`'s `ProductImagePlaceholder()` — add `strokeLinecap="round"` and `strokeLinejoin="round"` to its existing `<svg>` (currently has neither, defaulting to butt/miter joins) so it matches `icon-line`'s spec exactly. Its `stroke="currentColor"`, `strokeWidth={1.5}`, and `aria-hidden="true"` already comply — don't touch those.
  - [x] Confirm zero emoji characters remain anywhere in the codebase (`grep -rP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/` or equivalent) — the current codebase has none, but this is the story that establishes the "never emoji" rule going forward; a quick confirmation grep costs nothing and pins the baseline.

- [x] Task 4: Focus-ring utility (AC #4)
  - [x] A reusable `focus-ring` Tailwind utility class (or a small shared className constant, implementer's choice) — terracotta outline (2px solid, ~2px offset per `DESIGN.md`'s `focus-ring` component token), applied via `focus-visible:` (not bare `focus:`, to avoid a visible ring on mouse click — matches modern browser-default `:focus-visible` semantics and avoids the classic "ugly ring on every click" complaint without losing keyboard accessibility).
  - [x] Apply it to the header cart-pill link (Task 2) as this story's one proof-of-use. Do not apply it retroactively to every existing interactive element in the app — that's each later story's own job as it touches its own elements.

- [x] Task 5: Tests (AC #1–#5)
  - [x] This story has no new business logic (no pure functions, no Prisma/API changes) — no new Vitest unit tests are needed; this codebase's testing convention reserves Vitest for pure functions/helpers only (`project-context.md#Testing Rules`).
  - [x] New or extended Playwright coverage in `tests/homepage.spec.ts` or a new `tests/navbar.spec.ts` (implementer's choice, matching this codebase's one-file-per-feature-area convention): the cart-pill link has the expected `aria-label` text (assert via `getByRole("link", { name: /Cart, \d+ items/ })`, not by CSS class), the icon is `aria-hidden` (assert the SVG has `aria-hidden="true"` or that it's excluded from the accessibility tree), and the link is keyboard-reachable (`Tab` reaches it, `Enter` navigates to `/cart` — a real behavior test, not just a visual snapshot).
  - [x] **Regression check, don't skip:** `tests/sms.spec.ts:26` and `tests/payment.spec.ts:41` locate the cart link via `page.getByRole("link", { name: "Cart" })`; `tests/homepage.spec.ts:14` via `page.getByRole("link", { name: /cart/i })`. Playwright's default (non-`exact`) name matching is substring-based, so all three should still match the new `aria-label="Cart, {count} items"` — but verify by actually running all three spec files after the Navbar change, don't just trust the substring-matching theory.
  - [x] No mocking — matches this codebase's established convention.

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

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx tsc --noEmit`: clean.
- `npm run lint`: clean.
- `npx vitest run`: 131/131 passed (no unit tests added — none needed, no new business logic).
- `npx playwright test tests/homepage.spec.ts tests/sms.spec.ts tests/payment.spec.ts`: 7/7 passed (regression check named in Task 5, plus the 2 new Story 8.1 tests).
- Full `npx playwright test` (147 tests, run twice): 128 passed both times, 2 failed both times, 17 skipped both times (`tests/dashboard.spec.ts`'s authenticated block runs `test.describe.configure({ mode: "serial" })` — one flaky test in it cascades to skip its serial siblings). Investigated both failures:
  - `tests/dashboard.spec.ts:94` ("vendor's product API never returns another vendor's products") — passes cleanly in isolation (`npx playwright test tests/dashboard.spec.ts -g "..."`, 1/1 passed). Pre-existing parallel-execution flake unrelated to this story: this story touches zero backend/API/auth code (Tailwind config, `Navbar.tsx` JSX, `ProductCard.tsx`'s decorative SVG attributes, a new icon-components file, `globals.css`), so there's no plausible mechanism connecting this story's changes to vendor-product-API isolation. Not fixed as part of this story — out of scope, and fixing a pre-existing test-infrastructure flake wasn't asked for.
  - `tests/storefront-cart.spec.ts:66` ("out-of-stock products show a badge...") — this is Story 8.3's own ATDD red-phase test (badge copy "Out of stock" → "Sold Out"), already known-red and explicitly scoped to Story 8.3, not this story. Correctly still red; will flip when 8.3 ships.
- **Code review round 1, medium-severity fixes:** after the shadow/radius fixes above, re-ran `npx tsc --noEmit` (clean), `npm run lint` (clean), and `npx playwright test tests/homepage.spec.ts tests/sms.spec.ts tests/payment.spec.ts tests/storefront-cart.spec.ts` (24/25 passed; the one failure is the same already-known-red Story 8.3 ATDD test at `tests/storefront-cart.spec.ts:66` noted above, unaffected by this round's changes).

### Completion Notes List

- Token layer (Task 1): all 19 colors, 19 typography roles (as `fontSize` tuples pairing with new `font-serif`/`font-sans` families), 5 `borderRadius` keys, 8 `boxShadow` keys, and 7 named `spacing` keys added to `tailwind.config.ts`, matching `DESIGN.md`'s frontmatter values exactly (not the two flagged mock-drift values). The existing `brand` color key was left untouched, per the story's own instruction.
  - **Resolved after code review (round 1), decision by Jeff:** `DESIGN.md`'s `rounded` token names (`sm`/`DEFAULT`/`md`/`lg`/`xl`) are literally Tailwind's own default `borderRadius` scale key names — the original implementation used them as-is, which overrode those keys **globally**, not just for Epic 8 surfaces (35 existing `rounded-md` / 9 `rounded-lg` usages across admin/dashboard pages explicitly out of Epic 8's scope, per `EXPERIENCE.md#Foundation`, picked up the new corner radii as an unintended side effect). Renamed to `storefront-sm`/`storefront`/`storefront-md`/`storefront-lg`/`storefront-xl` so the extension is additive, not overriding — admin/dashboard now keep Tailwind's default radius scale untouched. `{rounded.full}` (`DESIGN.md`) needs no token entry: it's 9999px, identical to Tailwind's own default `rounded-full`, already used as-is by the cart-pill (Task 2). 8.2–8.5 should use `rounded-storefront-*` classes per `DESIGN.md`'s `{rounded.X}` mapping.
  - **Also resolved:** the original implementation omitted `theme.extend.boxShadow` entirely (Task 1's checklist item only named `borderRadius`/`spacing`, an oversight in the story's own task breakdown) despite AC #1 requiring the full frontmatter token set including shadow scales. Added the 8-value scale from `DESIGN.md#Elevation & Depth` — 4 neutral ink-tinted (`row`/`card`/`hero`/`confirm`, scaling with surface weight), 3 brand-tinted (`button`/`button-primary` terracotta, `badge-check` olive), and 1 inset (`thumb`, circular-thumbnail bottom-shading). No consumer wired up this story (matches the story's own "prove tokens, don't restyle" scope) — 8.2–8.5 apply these via `shadow-row` etc.
  - `fontFamily.sans` was redefined (not left as Tailwind's built-in default) because Tailwind's default sans stack doesn't exactly match `DESIGN.md`'s documented list (`-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif` vs. Tailwind's `ui-sans-serif, system-ui, ...`) — confirmed via direct comparison before choosing to override, per Task 1's own instruction to check first. No existing `font-sans`/`font-serif` usage anywhere in the codebase, so this had zero blast radius.
- Header cart-pill (Task 2): `Navbar.tsx`'s cart link now has `aria-label="Cart, {count} items"`, a `focus-ring` (Task 4), the new `BasketIcon` (`aria-hidden="true"`), and a count badge that always renders (including "0") — the deliberate badge-at-zero change the story's Dev Notes flagged. Did not read oddly in the isolated Playwright run; no reason found to revert to conditional rendering.
  - **Resolved after code review (round 1):** the aria-label had no singular branch — `count === 1` still produced "Cart, 1 items". Fixed to `` `Cart, ${count} item${count === 1 ? "" : "s"}` ``. The original ATDD regex (`/^cart, \d+ items?$/i`) tolerated the bug either way, so a dedicated test (`tests/homepage.spec.ts`, "cart link uses singular wording for exactly one item") now adds a real single-item cart via the UI and asserts the exact string `"Cart, 1 item"` with `exact: true` (a loose match would've passed against the buggy "Cart, 1 items" too, since "1 item" is a substring of "1 items").
- Icon set (Task 3): new `src/components/Icons.tsx` (one file, matching this codebase's flat `src/components/` convention — no barrel-file precedent existed to match) exports `BasketIcon`, `ClockIcon`, `WheatIcon`, `LeafIcon`, `CheckmarkIcon`, all sharing one `baseProps` object (`stroke="currentColor"`, `fill="none"`, `strokeWidth={1.5}`, round caps/joins, `aria-hidden="true"` by default, overridable via props spread). Only `BasketIcon` is consumed this story (by the cart-pill); the other four are built now per AC #3's "reusable set" requirement but wired up by later stories (clock → 8.3's pickup-banner, wheat/leaf → 8.2's homepage accent panel, checkmark → 8.5's confirmation card). `ProductCard.tsx`'s existing placeholder icon gained `strokeLinecap="round"`/`strokeLinejoin="round"` only — nothing else in that file touched. Emoji baseline confirmed at zero via the story's own suggested grep.
  - **Resolved after code review (round 1):** two latent bugs in the shared `baseProps` spread. (1) `{...baseProps} {...props}` let a caller-passed prop that's explicitly `undefined` (e.g. a conditional `stroke={cond ? "x" : undefined}`) silently delete a base default, since object-spread copies `undefined`-valued keys too — added `mergeIconProps()`, which filters `undefined` out of caller overrides before merging. (2) no intrinsic size — an icon used with no sizing `className` and no CSS falls back to the browser's default replaced-element size (300×150), badly distorting a 24×24 viewBox icon — added `width: "1em"` / `height: "1em"` defaults so icons scale with font-size by default, same convention most icon sets use; callers (e.g. the cart-pill's `h-4 w-4`) still override via CSS class as before.
- Focus-ring utility (Task 4): `.focus-ring:focus-visible` added to `globals.css`'s `@layer utilities` (terracotta outline, 2px solid, 2px offset, via `theme("colors.terracotta")`) rather than a bare Tailwind `focus-visible:` utility chain at each call site — a single reusable class name is simpler for 8.2–8.5 to apply consistently. Proven on exactly the one element this story specifies (the cart-pill link); not retrofitted elsewhere.
  - **Resolved after code review (round 1):** the keyboard test reached the cart link and confirmed `Enter` navigated, but never asserted the focus-ring itself actually renders — AC #4's whole deliverable had zero direct assertion. Added a `getComputedStyle` check (`outlineStyle: "solid"`, `outlineWidth: "2px"`) once the cart link is focused. Also tightened the same test's blind `Tab` × 2: it now asserts the first `Tab` lands on the logo link before asserting the second lands on the cart link, instead of assuming the tab order without checking the intermediate stop.
- Tests (Task 5): `tests/homepage.spec.ts` extended with 2 new cases (the `aria-label` assertion, already proven true-red during the ATDD pass and now green; a new icon-`aria-hidden` + keyboard-Tab-then-Enter case covering the two Task 5 sub-requirements ATDD hadn't scaffolded). All 3 named regression tests (`tests/sms.spec.ts:26`, `tests/payment.spec.ts:41`, `tests/homepage.spec.ts:14`) verified passing by actually running them, not assumed from the substring-matching theory.
  - Code review round 1 also raised three findings reviewed and deliberately left as-is, not code bugs: (a) typography `fontSize` tokens can't carry `fontFamily`/`fontStyle` in Tailwind's tuple format — already flagged in `tailwind.config.ts`'s own comment for 8.2–8.5 callers to pair with `font-serif`/`font-sans`/`italic` explicitly, a Tailwind API limitation, not an oversight. (b) the header showing both `brand` (`#c2410c`) and the new `terracotta` (`#a83f22`) simultaneously is the story's own documented interim state — `brand` stays until later stories migrate the pages that still use it; unifying the header's own logo color now would be restyling work this story's Dev Notes explicitly reserve for 8.2+. (c) `{colors.line}`'s cart-pill border contrast falls short of `DESIGN.md`'s own stated 3:1 minimum — a self-contradiction inherited from the design doc itself, not something to silently "fix" by picking a different color than what `DESIGN.md` specifies; flagging for Jeff/UX to resolve in `DESIGN.md` rather than deciding unilaterally in code.

### File List

- `tailwind.config.ts` (modified — token layer)
- `src/app/globals.css` (modified — focus-ring utility)
- `src/components/Icons.tsx` (new — icon set)
- `src/components/Navbar.tsx` (modified — header cart-pill)
- `src/components/ProductCard.tsx` (modified — placeholder icon strokeLinecap/strokeLinejoin only)
- `tests/homepage.spec.ts` (modified — 2 new test cases)
