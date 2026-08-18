# Deferred Work

- source_spec: `_bmad-output/implementation-artifacts/spec-wire-dashboard-forms.md`
  summary: No Clerk test-auth infrastructure exists for authenticated dashboard e2e coverage.
  evidence: tests/dashboard.spec.ts only covers the unauthenticated redirect case (see its own header comment noting a Clerk test user/token is "a good next step"). This predates the new AddProductForm/AddSlotForm components and blocks e2e coverage for the authenticated create-product/create-slot flow.

## Deferred from: code review of 1-1-verify-cart-line-removal-and-total-accuracy (2026-08-18)

- source_spec: `_bmad-output/implementation-artifacts/1-1-verify-cart-line-removal-and-total-accuracy.md`
  summary: The saved Clerk vendor session fixture is expired, so 10 authenticated `dashboard.spec.ts` tests fail and `npm run test:e2e` is not a usable green gate.
  evidence: The `__session` JWT in `playwright/.auth/vendor.json` has `exp` = 2026-08-07T23:59:50Z. Independently confirmed pre-existing and unrelated to Story 1.1 — running `npx playwright test tests/dashboard.spec.ts` in isolation (story's cart test not executing) still yields 10 failed / 5 passed, and `git diff b581db2 HEAD -- src/ prisma/ playwright/ package.json` is empty. Regenerating is blocked by a second gap: `npm run test:e2e:auth` runs `tsx playwright/support/generate-vendor-auth.ts` outside `playwright test`, so `playwright.config.ts`'s `webServer` auto-start does not apply and it fails with ERR_CONNECTION_REFUSED unless a dev server is already running. Fix should both regenerate the fixture and make the auth script self-sufficient (or document the two-step run).

- source_spec: `_bmad-output/implementation-artifacts/1-1-verify-cart-line-removal-and-total-accuracy.md`
  summary: Cart e2e locators lean on brittle document-order `.last()` heuristics over bare `div` selectors.
  evidence: tests/storefront-cart.spec.ts:120 and :136 use `page.locator("div").filter({ hasText: ... }).last()` for the product card and the total row. `hasText` is a case-insensitive substring match, so introducing a "Subtotal" or "Order total" div later in DOM order in src/app/cart/page.tsx would silently retarget the P0 total assertion rather than fail loudly. Correct against today's DOM and consistent with the repo's role/text-locator convention; a `data-testid` on the total row would make it durable.
