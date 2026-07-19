# Deferred Work

- source_spec: `_bmad-output/implementation-artifacts/spec-wire-dashboard-forms.md`
  summary: No Clerk test-auth infrastructure exists for authenticated dashboard e2e coverage.
  evidence: tests/dashboard.spec.ts only covers the unauthenticated redirect case (see its own header comment noting a Clerk test user/token is "a good next step"). This predates the new AddProductForm/AddSlotForm components and blocks e2e coverage for the authenticated create-product/create-slot flow.
