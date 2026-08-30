---
name: Artisanal Warm
description: 'Visual identity for the Local Food customer storefront — a warm, editorial-artisanal reskin of the existing homepage, vendor page, cart, and checkout-success screens. Palette name: Terracotta & Olive.'
status: final
sources:
  - '.memlog.md'
updated: 2026-08-30
colors:
  cream: '#f7ecd8'
  cream-deep: '#ecdcc0'
  paper: '#fffdf6'
  card-border: '#e9dbb9'
  line: '#ddc79f'
  field-border: '#8a7550'
  terracotta: '#a83f22'
  terracotta-deep: '#7a2e19'
  terracotta-light: '#c9673f'
  olive: '#55622f'
  olive-deep: '#3d4722'
  olive-light: '#6b7a3c'
  sage-light: '#dde3c8'
  selected-wash: '#fdf3ec'
  sold-out-bg: '#e6dbc0'
  disabled-outline: '#b9ab8c'
  placeholder-text: '#78654c'
  ink: '#2b2015'
  ink-soft: '#5c4d3a'
typography:
  display-lg:
    fontFamily: Georgia, "Times New Roman", serif
    fontSize: 52px
    fontWeight: '400'
    lineHeight: '1.05'
    letterSpacing: -0.01em
  display-md:
    fontFamily: Georgia, "Times New Roman", serif
    fontSize: 46px
    fontWeight: '400'
    lineHeight: '1.08'
    letterSpacing: -0.01em
  display-sm:
    fontFamily: Georgia, "Times New Roman", serif
    fontSize: 40px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: -0.01em
  display-xs:
    fontFamily: Georgia, "Times New Roman", serif
    fontSize: 38px
    fontWeight: '400'
    lineHeight: '1.08'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Georgia, "Times New Roman", serif
    fontSize: 28px
    fontWeight: '400'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Georgia, "Times New Roman", serif
    fontSize: 24px
    fontWeight: '400'
    lineHeight: '1.2'
  card-title:
    fontFamily: Georgia, "Times New Roman", serif
    fontSize: 24px
    fontWeight: '400'
    lineHeight: '1.2'
  item-title-lg:
    fontFamily: Georgia, "Times New Roman", serif
    fontSize: 21px
    fontWeight: '400'
    lineHeight: '1.25'
  item-title:
    fontFamily: Georgia, "Times New Roman", serif
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.25'
  total-display:
    fontFamily: Georgia, "Times New Roman", serif
    fontSize: 30px
    fontWeight: '400'
    lineHeight: '1.1'
  body-lede:
    fontFamily: Georgia, "Times New Roman", serif
    fontStyle: italic
    fontSize: 18px
    lineHeight: '1.5'
  body-card-desc:
    fontFamily: Georgia, "Times New Roman", serif
    fontStyle: italic
    fontSize: 15px
    lineHeight: '1.5'
  label-caps:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
    fontSize: 12px
    fontWeight: '700'
    letterSpacing: 0.18em
  label-caps-tight:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
    fontSize: 12px
    fontWeight: '700'
    letterSpacing: 0.14em
  field-label:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.4'
  body-ui:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
  ui-sm:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
  price:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
    fontSize: 15px
    fontWeight: '700'
  button-label:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
    fontSize: 13px
    fontWeight: '700'
    letterSpacing: 0.02em
  badge-label:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif
    fontSize: 10px
    fontWeight: '700'
    letterSpacing: 0.1em
rounded:
  sm: 10px
  DEFAULT: 14px
  md: 16px
  lg: 18px
  xl: 20px
  full: 9999px
spacing:
  gutter: 40px
  section-gap: 40px
  divider-gap: 30px
  list-gap: 16px
  grid-gap: 24px
  panel-gap: 22px
  tight: 12px
components:
  button-pill:
    background: '{colors.terracotta}'
    backgroundHover: '{colors.terracotta-deep}'
    color: '{colors.paper}'
    radius: '{rounded.full}'
    paddingY: 10px
    paddingX: 20px
    typography: '{typography.button-label}'
    shadow: '0 6px 14px -6px rgba(122,46,25,0.5)'
  button-pill-primary:
    background: '{colors.terracotta}'
    color: '{colors.paper}'
    radius: '{rounded.full}'
    paddingY: 14px
    paddingX: 26px
    fontSize: 15px
    fontWeight: '700'
    letterSpacing: 0.02em
    shadow: '0 8px 18px -8px rgba(122,46,25,0.55)'
  button-pill-disabled:
    background: '{colors.sold-out-bg}'
    color: '{colors.ink-soft}'
    shadow: none
  badge-positive:
    background: '{colors.sage-light}'
    color: '{colors.olive-deep}'
    radius: '{rounded.full}'
    typography: '{typography.badge-label}'
  badge-negative:
    background: '{colors.sold-out-bg}'
    color: '{colors.ink-soft}'
    radius: '{rounded.full}'
    typography: '{typography.badge-label}'
  card-row:
    background: '{colors.paper}'
    border: '1px solid {colors.card-border}'
    radius: '{rounded.md}'
    shadow: '0 4px 14px -8px rgba(43,32,21,0.15)'
    gap: '{spacing.list-gap}'
  card-panel:
    background: '{colors.paper}'
    border: '1px solid {colors.card-border}'
    radius: '{rounded.lg}'
    shadow: '0 10px 24px -14px rgba(43,32,21,0.25)'
  vendor-card:
    extends: card-panel
    wholeCardLink: true
    hoverEffect: 'inner call-to-action label darkens from {colors.terracotta} to {colors.terracotta-deep}; no other hover chrome'
  header-cart-pill:
    background: '{colors.cream}'
    border: '1px solid {colors.line}'
    radius: '{rounded.full}'
    paddingY: 7px
    paddingXLeft: 12px
    paddingXRight: 16px
    color: '{colors.ink}'
    typography: '{typography.body-ui}'
    icon:
      extends: icon-line
      strokeWidth: 1.6px
      ariaHidden: true
    badge:
      background: '{colors.terracotta}'
      color: '{colors.paper}'
      size: 20px
      shape: circle
      fontWeight: '700'
      fontSize: 11px
  focus-ring:
    color: '{colors.terracotta}'
    style: '2px solid outline, ~2px offset'
    usageNote: 'Terracotta measures 6.07:1 against {colors.paper} and 5.28:1 against {colors.cream} — both comfortably clear the 3:1 non-text/UI-boundary minimum. Applies system-wide to every interactive element (see EXPERIENCE.md Accessibility Floor), not only the vendor card.'
  caption-plate:
    background: '{colors.terracotta-deep}'
    color: '{colors.paper}'
    radius: '{rounded.sm}'
    paddingY: 4px
    paddingX: 10px
    usageNote: 'A near-opaque chip sitting behind hero-photo caption text so contrast is guaranteed (9.24:1, {colors.paper} on {colors.terracotta-deep}) regardless of the underlying photo — replaces reliance on the gradient-overlay + text-shadow alone.'
  pickup-banner:
    background: 'linear-gradient(120deg, {colors.terracotta}, {colors.terracotta-deep})'
    color: '{colors.paper}'
    radius: '{rounded.DEFAULT}'
    shadow: '0 12px 24px -10px rgba(122,46,25,0.5)'
    iconRoundel:
      background: 'rgba(255,255,255,0.18)'
      size: 42px
      shape: circle
  squiggle-divider:
    stroke: '{colors.olive}'
    strokeWidth: 2px
    tileWidth: 34px
    tileHeight: 18px
    opacity: 0.8
    path: 'M0 9 Q 8.5 0 17 9 T 34 9'
  icon-line:
    strokeWidthRange: '1.3px – 1.6px'
    strokeLinecap: round
    strokeLinejoin: round
    fill: none
    color: currentColor
  circular-thumb:
    radius: 50%
    sizeRange: '56px – 84px'
    innerShadow: 'inset 0 -6px 10px rgba(0,0,0,0.15)'
  pickup-option:
    border: '1px solid {colors.line}'
    radius: '{rounded.DEFAULT}'
    selected:
      border: '{colors.terracotta}'
      background: '{colors.selected-wash}'
      insetRing: '1px {colors.terracotta}'
    full:
      background: '{colors.sold-out-bg}'
      note: 'No distinct radio-ring color for this state — the row background plus the badge-negative "Full" pill (5.92:1, sufficient on its own) carry the unavailable signal. {colors.disabled-outline} on the radio ring measured only 2.23:1 against paper and 1.65:1 against its own row background, both failing the 3:1 non-text minimum, so the ring distinction is dropped rather than patched.'
  input-field:
    background: '{colors.cream}'
    border: '1px solid {colors.field-border}'
    radius: '{rounded.sm}'
    placeholderColor: '{colors.placeholder-text}'
  confirm-card:
    background: '{colors.paper}'
    border: '1px solid {colors.card-border}'
    radius: '{rounded.xl}'
    shadow: '0 20px 40px -18px rgba(43,32,21,0.35)'
  check-badge:
    background: 'linear-gradient(150deg, {colors.olive-light}, {colors.olive} 55%, {colors.olive-deep} 100%)'
    shadow: '0 10px 20px -8px rgba(61,71,34,0.55)'
    radius: 50%
    size: 84px
---

## Brand & Style

**Artisanal Warm** is the visual language for the Local Food customer storefront — an independently-run pickup marketplace for bakers, farmers, and small food makers. The posture is **warm editorial craft**: a page that reads like a well-kept community bulletin board or a small bakery's own printed menu, not a generic e-commerce template. This is a deliberate visual-only refresh — the underlying app (Next.js App Router, existing cart/checkout/pickup-slot logic) is unchanged; this system governs how the four customer-facing surfaces (homepage, vendor page, cart, checkout success) *look*.

The style leans on a serif/sans-serif split doing real narrative work: **Georgia** (a ubiquitous system serif, no webfont load) carries the editorial voice — vendor names, section headings, italic descriptive copy — while a system sans-serif stack carries every functional element: labels, prices, buttons, badges, form fields. This is a deliberate performance-and-simplicity choice for a hobby project targeting demo credibility, not a settled brand decision to load a distinctive display webfont — see Do's and Don'ts.

Two textures carry the "artisanal" half of the name: a hand-drawn squiggle line (rendered as inline SVG, reused as a section divider and as a scattered celebratory flourish) and a hand-drawn line-icon set (never emoji — see Do's and Don'ts). Together they keep the page feeling made by a person, not generated by a template, without resorting to twee illustration or stock iconography.

Stakes: this is a hobby project being demoed to a potential client evaluating it as a production system. Visual polish and credibility are the priority. A reasonable accessibility floor is maintained (every color pairing below was checked against WCAG 2.1 contrast targets during discovery), but this is not a regulated-product design system — pragmatic choices win over exhaustive compliance.

## Colors

The palette is **Terracotta & Olive** — a warm, sun-baked pairing evoking crust and herb, bread and field. It replaced an earlier gold-on-parchment attempt that failed contrast (a `#d4a24c` label on `#fffaf0` measured ~2.1:1); every pairing below was re-checked and passes ≥4.5:1 for body text.

- **`{colors.cream}` (`#f7ecd8`)** is the page canvas — warm, slightly deeper than white paper, never stark. Paired with a very faint diagonal texture stripe (`{colors.cream-deep}` at low opacity) on the page body for tactile warmth without any legibility cost, since nothing renders directly on top of the stripe.
- **`{colors.paper}` (`#fffdf6`)** is the surface color for anything that needs to sit *above* the page: the site header, every card, every panel, the pickup banner's icon roundel content. It's warmer than pure white but reads as "lifted."
- **`{colors.card-border}` (`#e9dbb9`)** is the 1px hairline on every card and row (product rows, cart items, vendor cards, the checkout panel, the confirmation card). **`{colors.line}` (`#ddc79f`)** is a separate, slightly deeper hairline used for dividers and dashed rules — intentionally distinct from `card-border` so containers read a touch softer than the lines separating content inside them. `{colors.line}` is *not* used for form-field borders (see `{colors.field-border}` below); it measures only 1.41:1 against `{colors.cream}` and 1.62:1 against `{colors.paper}`, far below the 3:1 non-text/UI-boundary minimum, so it's reserved for lower-stakes divider use where a hairline is decorative rather than a component boundary a user needs to perceive.
- **`{colors.field-border}` (`#8a7550`)** is a dedicated, darker olive-brown border tone for input fields — added because `{colors.line}` fails 3:1 against both field backgrounds it would sit on. It measures 3.78:1 against `{colors.cream}` (the input fill) and 4.35:1 against `{colors.paper}` (the checkout panel background), clearing the WCAG 1.4.11 non-text 3:1 minimum with margin on both, while staying in the same warm brown-gray register as `{colors.ink-soft}` and `{colors.disabled-outline}` rather than jumping to a cold or pure-black tone.
- **`{colors.terracotta}` (`#a83f22`)** is the primary brand and action color — every primary button, the cart pill accent, links, the pickup-banner gradient. `{colors.paper}` button-label text on a `{colors.terracotta}` fill measures 6.07:1 — the single most-used interactive pairing in the system (every pill button, the checkout button, the cart badge). **`{colors.terracotta-deep}` (`#7a2e19`)** is its emphasis form — headings, prices, hover states, and the deep end of every terracotta gradient. As heading text it measures 8.04:1 on `{colors.cream}` and 9.24:1 on `{colors.paper}`. `{colors.terracotta-light}` (`#c9673f`) exists only as a gradient highlight (the bakery-card accent panel on the homepage) — never a flat fill or text color on its own.
- **`{colors.olive}` (`#55622f`)** is the secondary accent — kicker labels, the "Food" half of the wordmark, icon strokes, the squiggle divider itself. **`{colors.olive-deep}` (`#3d4722`)** is its badge-text form, used on sage panels. `{colors.olive-light}` (`#6b7a3c`) is the equivalent gradient-only highlight to terracotta-light, used in the farm-card accent and the checkout-success check badge.
- **`{colors.sage-light}` (`#dde3c8`)** is the *positive* state background — "Baked Fresh," "N items available." Its text pairing is always `{colors.olive-deep}` (7.49:1).
- **`{colors.sold-out-bg}` (`#e6dbc0`)** is the canonical *unavailable* state background — sold-out product badges, full pickup-slot rows, disabled buttons. Its text pairing is `{colors.ink-soft}` (5.92:1). *(Note: the approved cart mockup renders its "Full" pickup badge at `#d8c9a3`, a near-duplicate one shade darker than this token — that's mock drift, not a second intentional value; implementation should standardize on `{colors.sold-out-bg}`.)*
- **`{colors.selected-wash}` (`#fdf3ec`)** is a single-purpose tint: the background of a selected pickup-time option, always paired with a `{colors.terracotta}` border.
- **`{colors.disabled-outline}` (`#b9ab8c`)** is a muted utility tone retained in the palette but **no longer used as a radio-dot border** in the full/unavailable pickup-option state — it measured only 2.23:1 against `{colors.paper}` and 1.65:1 against its own row background (`{colors.sold-out-bg}`), both failing the WCAG 1.4.11 non-text 3:1 minimum. The full-state row now relies on `{colors.sold-out-bg}` background plus the `badge-negative` "Full" pill (5.92:1) to carry the state; see `components.pickup-option.full`. **`{colors.placeholder-text}` (`#78654c`, darkened from an earlier `#9c8a70`)** is input placeholder copy — it measures 4.77:1 against `{colors.cream}` and 5.48:1 against `{colors.paper}`, clearing the 4.5:1 AA body-text bar on both (the earlier value measured only 2.86:1/3.28:1 and failed). Neither token is used for real content, only for "this isn't active/filled yet" signaling.
- **`{colors.ink}` (`#2b2015`)** is primary text (15.6:1 on paper). **`{colors.ink-soft}` (`#5c4d3a`)** is secondary text — descriptions, meta labels, field labels (8.0:1 on paper, 7.0:1 on cream).

No red/error color is defined anywhere in the four approved mockups — none of them render an error or destructive state. See Do's and Don'ts and the open-gap note at the end of this document.

## Typography

Two families, doing two different jobs:

- **Georgia** (`serif`, system-installed, zero webfont cost) is the editorial voice: every heading (`{typography.display-lg}` through `{typography.headline-sm}`), every card/item title, italic lede and description copy (`{typography.body-lede}`, `{typography.body-card-desc}`), and the large cart total (`{typography.total-display}`). Headings are always weight 400 — the brand voice is quiet confidence, not bold shouting. Display sizes scale down with page density: the vendor storefront (the flagship screen) gets the largest treatment (`{typography.display-lg}`, 52px); the homepage hero is next (`{typography.display-md}`, 46px); the denser cart and the single-purpose checkout-success screen use the smallest display sizes (`{typography.display-xs}` 38px and `{typography.display-sm}` 40px respectively).
- The system sans stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`) carries everything functional: kickers and panel labels (`{typography.label-caps}` / `{typography.label-caps-tight}`), field labels, body UI copy, prices, button labels, and badge text. It never appears in a heading role.

Kickers and section eyebrows are always uppercase with wide tracking — `{typography.label-caps}` (0.18em) for page-level kickers like "Weekend Bakery" and "Local Marketplace," `{typography.label-caps-tight}` (0.14em) for the tighter in-panel section labels inside the checkout panel ("Your Details," "Pickup Time"). The two-value tracking scale is intentional, not an error: page kickers get slightly more air than in-panel labels.

Heading and title tokens map onto specific rendered elements as follows: `{typography.headline-md}` (28px) is the "Menu" section heading on the vendor page. `{typography.headline-sm}` (24px) is the homepage's "Vendors near you" section heading. `{typography.card-title}` (24px) is the vendor-card name on the homepage directory grid. `card-title` and `headline-sm` are byte-identical in value (Georgia, 24px, weight 400, line-height 1.2) — that's intentional, not an unresolved duplicate: they're kept as two tokens because they play different semantic roles at the same visual size (a page-level section heading vs. a card's own title), not because the size differs. `{typography.item-title-lg}` (21px) is the product name in each vendor-page menu row. `{typography.item-title}` (18px) is the cart item name in each cart line. `{typography.price}` (15px, sans, weight 700) is the per-product price on the vendor page menu row; the cart's own line-item and total prices are the closest analog but render a couple pixels off-scale (16px) in the approved mock — the same kind of mock drift already called out under Layout & Spacing, and implementation should standardize on `{typography.price}` (15px) rather than carry the drifted value forward.

## Layout & Spacing

Every screen shares one browser-chrome-free page shell: a `{spacing.gutter}` (40px) horizontal margin on the site header, hero, section headings, and content grids, held identical across all four surfaces so the page never visually "resets" between screens. `{spacing.section-gap}` (40px) is the vertical rhythm before a major heading ("Menu," "Vendors near you," the cart title). `{spacing.divider-gap}` (30px) is the space around the squiggle divider wherever it appears.

Within lists, `{spacing.list-gap}` (16px) separates stacked rows (cart items) and `{spacing.grid-gap}` (24px) separates grid/column siblings (the homepage vendor grid, the cart's two-column layout). *(Note: the approved mocks show minor unintentional drift here — product rows on the vendor page render at 18px and the cart's two-column gap renders at 28px, a couple pixels off this canonical scale. Treat that as mock slop from independent rendering passes, not an intentional secondary rhythm — implementation should use the scale above.)* `{spacing.panel-gap}` (22px) separates stacked sections inside the checkout panel; `{spacing.tight}` (12px) is the small-scale spacing for stacked form fields and pickup-option rows.

The cart/checkout screen is the one layout departure: because it's the densest page in the app, it splits into a two-column grid (`1.55fr 1fr`) — line items and total on the left, a single grouped panel (contact details → pickup time → checkout action) on the right — so the primary action stays visually anchored beside the details that gate it, rather than living at the bottom of one long stacked form. All other surfaces are single-column.

## Elevation & Depth

Shadows are soft, warm-tinted, and scale with an element's visual weight rather than a strict global elevation system. Two tint families:

- **Neutral ink-tinted** shadows (`rgba(43,32,21, α)`) sit under paper surfaces: `0 4px 14px -8px rgba(43,32,21,0.15)` for list rows (product rows, cart items — the lightest lift), `0 10px 24px -14px rgba(43,32,21,0.25)` for cards with more presence (vendor cards, the checkout panel), up to `0 20px 40px -18px rgba(43,32,21,0.35)` for the single largest surface on the page (the checkout-success confirmation card) and `0 16px 30px -14px rgba(43,32,21,0.4)` under the vendor-page hero photo.
- **Brand-tinted** shadows sit under colored elements, echoing their own hue rather than a neutral shadow: terracotta elements (pickup banner, every pill button) cast `rgba(122,46,25, α)` shadows scaling from `0 6px 14px -6px … 0.5` (standard buttons) to `0 8px 18px -8px … 0.55` (primary/emphasis buttons — Checkout, Back to vendors); the olive check-badge on checkout-success casts `0 10px 20px -8px rgba(61,71,34,0.55)`.

Circular thumbnails (product/cart-item placeholders, icon roundels) get a small `inset 0 -6px 10px rgba(0,0,0,0.15)` — a subtle bottom-shading that reads as gentle dimensionality on an otherwise flat-colored circle, evoking a baked crust rather than a hard 3D bevel.

## Shapes

Corner radius scales with container size and role, from tight-and-functional to soft-and-generous:

- **`{rounded.sm}`** (10px) — input fields, the smallest functional container.
- **`{rounded.DEFAULT}`** (14px) — the pickup banner and each pickup-time option row.
- **`{rounded.md}`** (16px) — list rows: product rows, cart items.
- **`{rounded.lg}`** (18px) — cards with real presence: vendor cards, the checkout panel, the vendor-page hero photo.
- **`{rounded.xl}`** (20px) — the single largest card on the page (the checkout-success confirmation card).
- **`{rounded.full}`** — every pill: buttons, badges, the header cart pill, the quantity stepper.

Anything meant to read as an avatar, icon roundel, or product placeholder (circular thumbs, the pickup-icon roundel, the accent-icon roundel on homepage cards, the check-badge, radio dots) is a true circle (`50%`), never a rounded square — reserved specifically for that "small round token" role and not used elsewhere.

## Components

- **Buttons.** Two pill weights, both `{rounded.full}`, `{colors.terracotta}` fill, `{colors.paper}` text, no border. `{components.button-pill}` (10px/20px padding, 13px label) is the standard action — "Add to cart," "View menu." `{components.button-pill-primary}` (14px/26px padding, 15px label, deeper shadow) marks the one emphasis action per screen — "Checkout," "Back to vendors." A disabled/sold-out state (`{components.button-pill-disabled}`) drops to `{colors.sold-out-bg}` fill, `{colors.ink-soft}` text, and no shadow — it reads as inert, not as a duller version of the active button.
- **Badges.** Small pills, `{typography.badge-label}` (10px, uppercase, 0.1em tracking). `{components.badge-positive}` (sage background, olive-deep text) marks availability — "Baked Fresh," "N items available." `{components.badge-negative}` (sold-out-bg background, ink-soft text) marks unavailability — "Sold Out," "Full."
- **Cards & rows.** `{components.card-row}` is the list-row treatment (product rows, cart items): paper background, card-border hairline, `{rounded.md}`, the lightest shadow tier. `{components.card-panel}` is the heavier-weight card treatment (vendor cards, the checkout panel): same border/background, `{rounded.lg}`, the mid shadow tier.
- **Vendor cards** (`{components.vendor-card}`, homepage directory) extend `card-panel` with one hard behavioral rule: **the whole card is the link.** The entire card is a real `<a href="/vendors/{slug}">`, matching the existing `VendorCard.tsx` pattern in the live app. The "View menu" pill inside the card is a *visual label*, not a second interactive element — it darkens to `{colors.terracotta-deep}` on card hover purely as visual feedback that the card (not the label) is the click target. See Do's and Don'ts.
- **The pickup banner** (`{components.pickup-banner}`, vendor page only) is the one full-bleed colored panel on the storefront: a terracotta→terracotta-deep gradient, paper text, a translucent white icon roundel (a hand-drawn clock icon) on the left, "Next Pickup" label + time/location detail on the right.
- **The squiggle divider** (`{components.squiggle-divider}`) is the signature hand-drawn motif: a single repeating inline-SVG wave (`{colors.olive}` stroke, 2px, round caps), tiled at 34×18px, 0.8 opacity. It appears as a horizontal section divider on every page, and — at low opacity, rotated and scaled at random — as a scattered celebratory flourish behind the checkout-success confirmation card (never confetti, never emoji).
- **Icons** (`{components.icon-line}`) are uniformly hand-drawn-style inline SVG line art: 1.3–1.6px stroke, round caps/joins, no fill, `currentColor` (so an icon inherits paper-on-terracotta inside the pickup banner or cart pill, and ink/olive/terracotta-deep elsewhere). The set covers: basket/cart, clock (pickup), wheat (bakery accent), leaf (farm accent), and checkmark (confirmation). This matches the existing "no product photo" placeholder icon already shipping in `ProductCard.tsx`, which happens to already be stroke-based line art — a point of continuity, not a new pattern.
- **Quantity stepper** (cart items): a pill-shaped `−`/count/`+` control, `{colors.field-border}` border (same token as input fields — `{colors.line}` was considered but fails the 3:1 non-text minimum here too, same failure mode caught for input fields above), `{rounded.full}`, terracotta glyph color on a cream button field.
- **Pickup-time options** (`{components.pickup-option}`, cart panel): a stacked list of `{rounded.DEFAULT}` rows, each with a leading radio dot. Selected = `{colors.terracotta}` border + `{colors.selected-wash}` fill + inset ring. Full/unavailable = `{colors.sold-out-bg}` fill and a `badge-negative` "Full" pill — no separate radio-ring color for this state (see `{colors.disabled-outline}` in Colors, above, for why it was dropped rather than kept).
- **Input fields** (`{components.input-field}`): `{colors.cream}` fill (not paper — a deliberate slight recess so fields read as "inside" the panel), `{colors.field-border}` border (3.78:1 on cream, 4.35:1 on paper — see Colors), `{rounded.sm}`, `{colors.placeholder-text}` placeholder copy, always paired with a `{typography.field-label}` label above.
- **The confirmation card** (`{components.confirm-card}`, checkout success): the largest single card in the system — generous 44px/56px/40px padding, `{rounded.xl}`, centered, holding the `{components.check-badge}` (an 84px olive-gradient circle with a white hand-drawn checkmark), the confirmation headline, italic body copy, and one `button-pill-primary`.
- **Circular thumbnails** (`{components.circular-thumb}`) are the true-circle product placeholders: 84px on the vendor-page menu row (`.thumb`), 56px on the cart item row (`.cart-item-thumb`) — the token's `56px – 84px` size range spans exactly these two real uses. Always the inset bottom-shading shadow, never a hard bevel.
- **The header cart pill** (`{components.header-cart-pill}`, every surface, persistent site header): a `{colors.cream}`-fill, `{colors.line}`-border pill (`{rounded.full}`, 7px/12–16px padding) holding a small inline-SVG basket icon (`{components.icon-line}`, `aria-hidden`) + "Cart" text (`{typography.body-ui}`, `{colors.ink}`) + a trailing circular count badge: 20px diameter, `{colors.terracotta}` fill, `{colors.paper}` text (6.07:1), 11px/700-weight numeral, centered. It is a plain link to `/cart`, never a dropdown or mini-cart — see `EXPERIENCE.md` Component Patterns.
- **Focus ring** (`{components.focus-ring}`): a `{colors.terracotta}` outline (2px, ~2px offset) applied system-wide to every interactive element — not scoped to any one component. Measures 6.07:1 against `{colors.paper}` and 5.28:1 against `{colors.cream}`, both clearing the 3:1 non-text minimum. See `EXPERIENCE.md` Accessibility Floor for the full list of controls this applies to.
- **Hero-photo caption plate** (`{components.caption-plate}`, vendor page hero only): a small near-opaque `{colors.terracotta-deep}` chip (`{rounded.sm}`, 4px/10px padding) sitting behind the caption text ("Fresh from this morning's bake"), holding `{colors.paper}` text (9.24:1). Replaces reliance on the gradient overlay + text-shadow alone, which has no deterministic contrast floor against an arbitrary photo.

## Do's and Don'ts

- **Do** treat this as a visual-only system. It changes how the four storefront screens look and some layout/hierarchy decisions; it does not change cart logic, checkout flow, or pickup-slot availability behavior.
- **Don't** use emoji anywhere in this direction — not for cart/basket, clock, bread, produce, or celebration. Jeff explicitly rejected the emoji glyphs used in earlier drafts (🛒 🕐 🍞 🥕 and confetti/celebration emoji at checkout) as unpolished for a demo meant to read as production-grade. **Every icon is hand-drawn-style inline SVG line art** (`{components.icon-line}`) matching the squiggle-divider's visual language — no exceptions, no glyph fallback.
- **Do** make the entire vendor card a real link (`wholeCardLink: true` on `{components.vendor-card}`). **Don't** put a separate decorative `<button>` or styled span inside a card that *looks* interactive but isn't wired to real navigation — the "View menu" label is presentational only, sitting inside the one real `<a>` that is the card. This matches the existing `VendorCard.tsx` pattern in the live app; the redesign must not regress it.
- **Do** keep headings in Georgia at weight 400 — never bold a heading for emphasis; use `{colors.terracotta-deep}` color and size instead.
- **Don't** introduce a second serif or a webfont without a decision — see the open note below; the approved mocks render Georgia via the system stack only.
- **Do** reuse the two-shadow-tint system (neutral ink-tinted for surfaces, brand-tinted for colored elements) rather than inventing a third tint.
- **Don't** use `{colors.terracotta-light}` or `{colors.olive-light}` as flat fills or text colors — both exist only as gradient highlights.
- **Do** standardize the "unavailable" badge/row background on `{colors.sold-out-bg}` — don't carry forward the cart mock's near-duplicate second value (see Colors, above).

**Open gap — not invented, flagged:** none of the four approved mockups render an error, warning, or destructive state (a failed pickup-slot fetch, a sold-out item already in the cart, a checkout error). No themed color for that role exists in this palette. Until a themed value is chosen, implementation should keep the current app's existing red-600/red-50 semantic pair for these states rather than force-fitting a Terracotta & Olive tone that was never contrast-checked for an error role. See `EXPERIENCE.md` State Patterns for the specific states this affects.
