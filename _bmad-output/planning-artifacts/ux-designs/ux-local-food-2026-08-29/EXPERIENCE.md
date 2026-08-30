---
name: Artisanal Warm
status: final
sources:
  - '{planning_artifacts}/prds/prd-local-food-2026-08-10/prd.md'
  - '.memlog.md'
updated: 2026-08-30
---

# Local Food Storefront — Experience Spine

> Visual/UX refresh of the existing customer-facing storefront only (homepage, vendor page, cart, checkout success). No functionality changes — cart logic, checkout flow, and pickup-slot availability behavior are all unchanged, only presented differently. Vendor dashboard and admin panel are untouched by this redesign and out of scope. Paired with `DESIGN.md` (Artisanal Warm — Terracotta & Olive palette).

## Foundation

Responsive web, desktop-primary. Next.js App Router (Next 14.2, `dynamic = "force-dynamic"` on the vendor page so stock availability is never served stale from cache). Styling is Tailwind CSS utility classes applied directly in components (`VendorCard.tsx`, `ProductCard.tsx`, `cart/page.tsx`) — there is no named component library (not shadcn, not MUI) to inherit from; `DESIGN.md` tokens are the system of record and map onto Tailwind's theme/arbitrary-value utilities at implementation time. Auth (Clerk) and the vendor dashboard/admin panel exist in the app but are entirely out of scope for this pass — this spine covers only the anonymous, unauthenticated customer path.

Checkout leaves the app's own UI entirely: the Checkout button posts to `/api/checkout`, which creates a Stripe Checkout Session and redirects the browser (`window.location.href = url`) to Stripe's own hosted payment page — a surface this design system has no control over. The customer returns to `Checkout Success` only after Stripe completes the redirect. The actual order record is created server-side by a Stripe webhook, independent of whether the customer's browser ever reaches the success page — so Checkout Success is a stateless "thank you," not an order summary, and must never assume it has order details to display.

`DESIGN.md` is the visual identity reference for this spine; this document is the behavior, states, and journeys.

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| Homepage (vendor directory) | App root `/` | Browse active, non-deactivated vendors |
| Vendor page | Homepage card tap | Browse one vendor's menu; add items to cart; see next pickup window |
| Cart | Header cart pill, any page | Review line items, provide name + mobile number, pick a pickup time, submit checkout |
| *(external)* Stripe Checkout | Cart → Checkout button | Payment, hosted entirely by Stripe — outside this design system |
| Checkout Success | Stripe redirect after payment | Confirm the order was placed; single path back to Homepage |

No drawer, no tab bar — navigation is a persistent site header (wordmark + cart pill) present on every surface, plus in-page links (vendor card → vendor page, back-to-vendors button on success). Modal/overlay stacking does not apply — nothing in the current app opens a dialog or sheet.

→ Composition reference: `mockups/vendor-page.html` (flagship screen), `mockups/homepage.html`, `mockups/cart.html`, `mockups/checkout-success.html`. Spine wins on conflict with any mock.

## Voice and Tone

Microcopy only. Brand voice and aesthetic posture live in `DESIGN.md.Brand & Style`.

| Do | Don't |
|---|---|
| "Find local food near you." | "Shop Local Now! 🛒" |
| "Naturally leavened breads baked fresh every weekend." | "The BEST bread in town!!" |
| "Thank you! Your order is confirmed. We'll text you when it's ready for pickup." | "🎉 Order placed! You're all set!" |
| "Select a pickup time to continue." | "Oops! You forgot something 😅" |
| "No pickup times available." / "Could not load pickup times. Try refreshing the page." | "Uh-oh, something broke." |
| Plain, complete sentences; a vendor's own description is the only place personality shows through. | Site-authored exclamation points, emoji, or urgency language ("Order now before it's gone!"). |

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| Vendor card | Homepage grid | **Whole card is a real `<a href="/vendors/{slug}">`** — matches the existing `VendorCard.tsx`. The "View menu" pill inside it is a visual label only, not a second focusable/clickable element. No dead decorative buttons anywhere in this system: if something looks like a control, it is wired to a real action. |
| Product row | Vendor page menu | Whole row is static (not a link); only the trailing "Add to cart" pill is interactive. Disabled (`{components.button-pill-disabled}`) + `badge-negative` "Sold Out" when `stockQuantity <= 0`. |
| Cart item row | Cart, left column | Quantity stepper (`−`/count/`+`) updates quantity in place; `−` disabled at qty 1, `+` disabled at `stockQuantity`. A trailing text "remove" link removes the line entirely (present in the real app, not rendered in the cart mock — carry it forward using `{typography.ui-sm}` / `{colors.ink-soft}`, matching the mock's other secondary-action text weight). |
| Pickup-option row | Cart, right panel | Radio-select, one selected at a time. Disabled + `badge-negative` "Full" when `available: false`. Selecting a row is the only way to enable the Checkout button (see State Patterns). |
| Checkout button | Cart, right panel | Primary pill (`{components.button-pill-primary}`). Disabled until name, phone, and a pickup slot are all present. Label swaps to "Redirecting…" and the button disables again once submitted — see State Patterns. |
| Cart pill (header) | Every surface | Shows a live item count badge. Not a dropdown/mini-cart — it's a plain link to `/cart`. |
| Input fields (name, mobile number) | Cart, right panel | Both plain text inputs, no client-side phone-number format validation exists today and none is being added in this pass. Checkout is gated on both being non-empty — the Checkout button stays disabled until `name` and `phone` are both filled *and* a pickup slot is selected (see Checkout button row and State Patterns). No inline per-field required-state messaging is rendered; the disabled button is the only signal that a field still needs filling. |
| Icon | Anywhere an icon appears | **Always** hand-drawn-style inline SVG line art (`{components.icon-line}`) — basket, clock, wheat, leaf, checkmark. **Never emoji.** Jeff explicitly rejected emoji glyphs (🛒 🕐 🍞 🥕, confetti/celebration emoji) during discovery as reading unpolished for a demo meant to look production-grade; every icon in this system must be an inline SVG matching the squiggle-divider's line-art language, with no glyph fallback anywhere. |
| Squiggle divider / flourish | Section breaks; checkout-success background | Same inline-SVG asset reused at full opacity as a horizontal rule and at low opacity, rotated/scaled, as a scattered celebratory flourish. Never confetti, never an animated burst. |

## State Patterns

Pulled from the real app's actual logic (`src/app/cart/page.tsx`, `src/app/vendors/[slug]/page.tsx`, `src/app/page.tsx`), not invented. **Mocked** = one of the four approved screens shows this state visually. **Spine-only** = the state is real app behavior with no visual reference in the approved mocks; treatment below is derived from the closest mocked analog plus `DESIGN.md` tokens.

| State | Surface | Mocked? | Treatment |
|---|---|---|---|
| Product sold out | Vendor page | **Mocked** | Grayscale/dim thumb, `badge-negative` "Sold Out," `button-pill-disabled` "Sold out" in place of "Add to cart." |
| Pickup slot full | Cart, pickup-option list | **Mocked** | Row background `{colors.sold-out-bg}`, trailing `badge-negative` "Full." No distinct radio-ring color for this state — `{colors.disabled-outline}` failed the 3:1 non-text minimum and was dropped (see `DESIGN.md` Colors / `components.pickup-option.full`). |
| Loading pickup times | Cart, right panel | Spine-only | Real code shows plain text "Loading pickup times…" before the fetch resolves. Render in `{typography.body-ui}` / `{colors.ink-soft}` where the pickup-option list would go — no skeleton shimmer was designed; keep it as quiet text, consistent with this system's restrained motion posture. |
| Pickup-times fetch failed | Cart, right panel | Spine-only | Real code shows "Could not load pickup times. Try refreshing the page." No error color exists in the Terracotta & Olive palette (see `DESIGN.md` open gap) — keep the app's current red-600 text color for this message until a themed value is chosen. |
| Zero pickup slots | Cart, right panel | Spine-only | Real code shows "No pickup times available." Same quiet-text treatment as the loading state, `{colors.ink-soft}`. |
| Exactly one pickup slot | Cart, right panel | Spine-only | Real code auto-selects it (AC #5 — no pointless click to confirm the only option) and renders a single summary line instead of a radio list. Render as one non-interactive `pickup-option` row already in the `selected` visual state, no radio dot needed since there's nothing to choose between. |
| Empty cart | Cart | Spine-only | Real code shows only a heading + "Your cart is empty." No illustration was designed for this; keep it text-only in `{typography.body-lede}` under the `{typography.display-xs}` title, matching the restrained tone of the rest of this system rather than inventing an empty-state graphic. |
| Sold-out item already in cart | Cart item row | Spine-only | Real code shows inline warning text "No longer available — remove to continue." below the row. Keep the app's current red-600 text (same open gap as fetch-error, above) since no themed alternative exists. |
| Checkout submitting | Cart, Checkout button | Spine-only | Button label swaps to "Redirecting…", `button-pill-primary` disables (no spinner icon was designed — text-only is consistent with this system's plain, unhurried voice). |
| Checkout submit failed | Cart, right panel | Spine-only | Inline error text above the Checkout button (e.g. "Select a pickup time to continue." or the server's message). Same red-600 open-gap treatment. |
| Deactivated vendor storefront | Vendor page | Spine-only | Route still resolves (real 200, not a 404) — vendor name renders in `{typography.display-lg}` with a plain "This vendor is no longer available." message in place of the pickup banner and menu. No product listing. |
| Empty vendor directory | Homepage | Spine-only | Real code shows a dev-facing message ("No vendors yet. Run `npm run db:seed` to add samples.") in place of the grid — acceptable as-is; this state is effectively unreachable in a seeded demo. |

## Interaction Primitives

- **Click/tap to act.** No drag, no swipe, no keyboard shortcuts beyond standard `Tab`/`Enter`/`Space` — this is a browse-and-pickup storefront, not a power-user tool.
- Vendor cards and the back-to-vendors link are real anchors — reachable and activatable by keyboard exactly like a mouse click, with no separate "keyboard mode."
- Quantity stepper and pickup-slot selection are optimistic/instant — no confirm step, matching the app's existing client-side cart state.
- Checkout is the one primitive with a real network round-trip and a visible pending state (button label + disabled), since it redirects off-site to Stripe.
- **Banned:** carousels, auto-playing anything, hover-only affordances (this is a touch-reachable web app, not desktop-only), decorative animation on page load, confetti or emoji at checkout — the squiggle flourish is the one permitted celebratory touch, and it is static.

## Accessibility Floor

Behavioral. Visual contrast lives in `DESIGN.md` (every color pairing was checked against WCAG 2.1 during discovery; the one gold-on-parchment failure found was fixed before the palette was locked).

- **System-wide focus ring:** every interactive element gets the same visible `{components.focus-ring}` treatment (`{colors.terracotta}` outline against `{colors.paper}`/`{colors.cream}`, 6.07:1 / 5.28:1) reachable by keyboard `Tab`/`Shift+Tab`, `Enter`, and `Space` where applicable — not scoped to just the whole-card vendor link. This applies to: the whole-card vendor `<a>`; every button (Add to cart, Checkout, Back to vendors, both stepper `−`/`+` buttons); the "remove" line-item link; the name and mobile-number `<input>`s; each pickup-time radio `<input>`; and the header cart-pill link. None of these may render with the browser's focus outline suppressed and no replacement.
- Every icon is decorative (`aria-hidden`) unless it is the *only* content of an interactive control, in which case that control gets a real `aria-label`. **This is new required work for the header cart pill, not an existing pattern being matched:** the current `Navbar.tsx` cart link has no `aria-label` today — it renders bare "Cart" text plus an unlabeled `<span>{count}</span>`. This redesign must add `aria-label="Cart, {count} items"` on the cart-pill link and `aria-hidden="true"` on its new decorative basket SVG icon.
- Badges (`badge-positive`, `badge-negative`) are never real `<button>`/`<a>` elements — they're status text, and must not be tab-stops.
- Quantity changes stay announced via `aria-live="polite"` on the quantity value (unchanged from the current app). Two distinct disabled-state patterns exist today and both must be preserved, not conflated: `ProductCard.tsx`'s Add-to-cart button uses `aria-disabled` + `aria-describedby` pointing at the sold-out text; the cart page's stepper `−`/`+` buttons use native `disabled` with no `aria-describedby` (there is no separate limit-text element for them to point at). This redesign must not regress either pattern, and must not introduce an `aria-describedby` for the stepper that doesn't correspond to any real element.
- **Quantity stepper mock fidelity:** like the pickup-option row, the `qty-btn` pill styling in `DESIGN.md.Components` wraps real `<button>` elements with their existing `aria-label`s (`Decrease/Increase quantity of {name}`, from the real `cart/page.tsx`) — it doesn't replace them with non-interactive divs, matching the approved mock's rendering.
- Pickup-time selection stays a real `<fieldset>`/`<legend>`/radio-input group when there are 2+ options, not a set of styled divs with only visual radio dots — the visual "radio-dot" styling in `DESIGN.md.Components.pickup-option` wraps a real input, it doesn't replace one.
- **Dynamic error/warning text needs live-region behavior — new work, not already covered elsewhere in the app.** `cart/page.tsx`'s three plain-text messages — the checkout error, the pickup-slots-fetch-failed message, and the "No longer available — remove to continue" warning — render as plain `<p>` text today with no announcement mechanism. This redesign pass must add `role="alert"` and `aria-live="polite"` to all three so a screen-reader user is notified when one appears, since all three can gate or block checkout.
- Minimum interactive-target size: pill buttons and badges should not render below roughly 32–36px in their smallest dimension — not the 44pt native-app bar (this is a mouse-and-touch web app, not a native mobile surface), but enough that the pill shape stays comfortably tappable.
- This is a reasonable accessibility floor for a hobby project being demoed for credibility, not a compliance-driven target — no dedicated screen-reader-only copy beyond what's listed above was scoped during discovery.

## Key Flows

### Flow 1 — Saturday brunch order (Renata, Friday evening, planning tomorrow's pickup)

1. Renata opens `localfood.app` on her laptop. Homepage loads: `{typography.display-md}` "Find local food near you" over the `{colors.cream}` page, a two-card grid below the squiggle divider.
2. She scans the two vendor cards — the terracotta "scored loaf" accent panel reads as bakery at a glance, before she even reads the name. She clicks anywhere on the Corner Sourdough card (the whole card is the link — no need to aim for a small "View menu" button).
3. The vendor page loads: `{typography.display-lg}` "Corner Sourdough" under the "Weekend Bakery" kicker, the hero photo, then the `{components.pickup-banner}` — "Next Pickup: Saturday, 9:00 AM – 12:00 PM · 123 Main St," legible immediately since it's the one full-bleed colored panel on the page.
4. She adds two Classic Sourdough Loaves and one Seeded Rye. The Cinnamon Morning Bun is greyed out with a `badge-negative` "Sold Out" pill — she notices, isn't annoyed, moves on; nothing about the badge implies a bug.
5. She clicks the header cart pill (now showing "3"). Cart loads: her two items on the left, running total in `{typography.total-display}`; on the right, the checkout panel asks for her name and mobile number, then shows the pickup-time list.
6. She reconsiders the second Sourdough Loaf — two feels like too much bread for the weekend — and taps the `−` on that line's quantity stepper, dropping it from 2 to 1; the running total updates immediately (optimistic, no confirm step). She decides she doesn't want the Seeded Rye at all and taps its trailing "remove" link, which drops the line from the cart entirely. Both edits happen in place, left column, with no navigation away from the cart.
7. Two slots are shown; the 9–12 window is pre-rendered as `{components.pickup-option}` selected (border + `{colors.selected-wash}` fill) since it's the only one still open — the noon–2 slot is already `badge-negative` "Full." She fills in her name and number.
8. She clicks Checkout. The button briefly reads "Redirecting…" and disables, then her browser leaves the app entirely for Stripe's hosted payment page — outside this design system, as expected.
9. She pays. Stripe redirects her back.
10. **Climax:** Checkout Success loads — the `{components.check-badge}`, an olive-gradient circle with a hand-drawn white checkmark, centered above "Thank you!" and "Your order is confirmed. We'll text you when it's ready for pickup," with a few low-opacity squiggle flourishes scattered behind the card. No confetti, no order-summary table she has to parse — just clear, calm confirmation that tomorrow's bread is handled. She closes the tab.

Failure branch: had the pickup-slot fetch failed on load (Spine-only state, above), the panel would have shown "Could not load pickup times. Try refreshing the page." in place of the option list — Renata's name/phone fields would still be usable, but Checkout would stay disabled until a slot exists to select.

## Inspiration & Anti-patterns

Per `.memlog.md`, four whole directions were rendered for the storefront and three were rejected before Artisanal Warm was locked in:

- **Premium-minimal** — rejected for lacking vitality/excitement; too restrained for a small-vendor marketplace that's supposed to feel warm and human.
- **Modern-editorial** — rejected as "clean but dull"; visually competent but didn't differentiate or carry any of the "artisanal" character the redesign was chasing.
- **Bold-playful** — explored the furthest of the three rejects, including a full repaint variant (Comic Primary palette, WCAG-checked ≥4.5:1) after Jeff asked to keep exploring it; ultimately eliminated once Artisanal Warm (v3, real bread photography) was confirmed as the winning direction — not dropped for a flaw, just not chosen.

Also from `.memlog.md`: an earlier gold-on-parchment palette attempt within the Artisanal Warm direction itself was rejected outright for a contrast bug (`#d4a24c` kicker on `#fffaf0`, ~2.1:1) before Terracotta & Olive replaced it — see `DESIGN.md` Colors.
