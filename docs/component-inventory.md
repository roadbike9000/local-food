# Component Inventory

All components live flat in `src/components/` (no subfolders, no design-system library — Tailwind utility classes inline). No shared UI kit; each component owns its own markup.

| Component | Type | Purpose | Depends on |
|---|---|---|---|
| `CartProvider` | Client (Context) | Holds cart state (single vendor, in-memory, lost on refresh) app-wide | none — pure React state |
| `Navbar` | Client | Top nav: logo, cart badge (item count), Clerk `SignedIn`/`SignedOut` links | `useCart()`, `@clerk/nextjs` |
| `ProductCard` | Client | Storefront product row + "Add" button that calls `useCart().addItem` | `useCart()`, `formatPrice` |
| `VendorCard` | Server | Directory listing card — pure display, no state | none |

## Patterns

- **Client/Server split is intentional and narrow**: only components with state, effects, or event handlers get `"use client"` (`CartProvider`, `Navbar`, `ProductCard`, and the two pages that need interactivity: `cart/page.tsx`). Everything else — including all data-fetching pages — is a Server Component that calls `prisma` directly in the component body.
- **No design system / no component library**: styling is Tailwind utility classes written inline in JSX; no `className` abstraction, no CSS modules, no styled-components.
- **Naming**: PascalCase, one component per file, filename matches export name.
- **State management**: React Context only (`CartProvider`). No Redux/Zustand/MobX. Cart is intentionally single-vendor — adding an item from a different vendor **replaces** the cart rather than merging (documented behavior, not a bug — see `CartProvider.tsx` comment).
- **Money formatting**: always go through `formatPrice()` from `@/lib/utils` — never format `*Cents` inline. (Note: an unused duplicate exists in `src/lib/stripe.ts`; see [Source Tree Analysis](./source-tree-analysis.md#notes--discrepancies-found-during-scan).)

## Providers (app-wide, in `src/app/layout.tsx`)

```
ClerkProvider          # auth/session context
  └─ CartProvider       # cart state
      └─ Navbar
      └─ {page content}
```

New app-wide providers should be added here, not in individual pages.
