# Glossary — local-food Admin & Inventory Expansion

- **Admin** — A platform-operator identity, distinct from a Vendor account. Not tied to any single vendor's storefront. New concept (ARCHITECTURE-SPINE.md AD-1).
- **Vendor** — An existing concept: one seller, owns Products, Orders, PickupSlots. Previously 1:1 with a Clerk user via `clerkUserId`; that field is now nullable for admin-created vendors (AD-8).
- **Product** — Something a Vendor sells.
- **Stock Quantity** — Numeric count of units available for a Product. Sole source of truth for availability; `isAvailable` is dropped (AD-2).
- **Low-Stock Threshold** — A per-product number, set at product creation, below which a Product triggers a Low-Stock Alert.
- **Low-Stock Alert** — An SMS sent to Admin when a Product's Stock Quantity crosses at or below its Low-Stock Threshold.
- **Inventory Report** — An admin-facing dashboard page showing current Stock Quantity across all Products, viewed on demand.
- **Cart** — Client-side, single-vendor-at-a-time collection of line items, held in `CartProvider`.
