---
title: 'Wire dashboard "Add product" / "Add slot" forms'
type: 'feature'
created: '2026-07-19'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** The dashboard's "Add product" and "Add slot" buttons were unwired — their POST API routes (`/api/products`, `/api/pickup-slots`) exist and are tested, but no form called them.

**Approach:** Added two client form components (`AddProductForm`, `AddSlotForm`) that toggle open inline, POST to the existing routes, and call `router.refresh()` to re-render the server-rendered list on success.

## Suggested Review Order

**Form submission logic**

- Entry point: collects form fields, guards a `NaN`/non-positive price before sending, POSTs, and distinguishes 401/validation/network failures.
  [`AddProductForm.tsx:17`](../../src/components/dashboard/AddProductForm.tsx#L17)

- Same pattern for slots, plus client-side start/end date validation mirroring the server's `.refine()` check.
  [`AddSlotForm.tsx:17`](../../src/components/dashboard/AddSlotForm.tsx#L17)

**Dashboard wiring**

- Static button replaced with the live form component.
  [`products/page.tsx:20`](../../src/app/dashboard/products/page.tsx#L20)

- Same swap for the pickups tab.
  [`pickups/page.tsx:21`](../../src/app/dashboard/pickups/page.tsx#L21)

**Supporting UI**

- Toggle button / cancel-while-submitting / accessible error state.
  [`AddProductForm.tsx:65`](../../src/components/dashboard/AddProductForm.tsx#L65)

- Toggle button / cancel-while-submitting / accessible error state.
  [`AddSlotForm.tsx:74`](../../src/components/dashboard/AddSlotForm.tsx#L74)
