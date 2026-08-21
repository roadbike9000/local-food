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
