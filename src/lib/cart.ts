/**
 * Pure, framework-free cart helpers - kept out of CartProvider.tsx (a "use
 * client" component) so this logic has a plain .ts home Vitest can import
 * directly, matching the pattern src/lib/availability.ts already
 * established for the same reason.
 */

// Floor 1, ceiling stockQuantity - shared by CartProvider's addItem
// repeat-click increment and the cart page's stepper (via updateQuantity)
// so the two paths can't drift into enforcing two different limits (Story
// 1.5, AC #3/#6).
export function clampQuantity(quantity: number, stockQuantity: number): number {
  return Math.max(1, Math.min(quantity, stockQuantity));
}

// The header cart-pill's accessible label (Story 8.1, AC #2) - singular for
// exactly 1, plural otherwise. Pulled out of Navbar.tsx so the count === 1
// branch is unit-testable without a Playwright browser (review round 1
// finding: the bug this exists to prevent - "Cart, 1 items" - shipped once
// already because nothing pinned the singular case directly).
export function formatCartCountLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}

// The badge's *visible* digits only - aria-label always carries the exact
// count via formatCartCountLabel above, this just keeps the small circular
// badge from overflowing at 3+ digits (review round 2 finding: untested).
export function formatCartBadgeText(count: number): string {
  return count > 99 ? "99+" : String(count);
}
