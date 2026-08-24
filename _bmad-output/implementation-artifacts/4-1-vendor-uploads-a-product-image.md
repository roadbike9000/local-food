---
baseline_commit: 58c86cdbae6977fc3b6e7c505d8af88879eb6969
---

# Story 4.1: Vendor uploads a product image

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a vendor,
I want to upload a photo for a product,
so that customers can see what they're buying before they order.

## Acceptance Criteria

1. `AddProductForm` (`src/components/dashboard/AddProductForm.tsx`) gains an optional image file input, alongside the existing name/description/price/stock fields.
2. On submit, if an image was selected, it uploads to Cloudinary via a new server-side endpoint before the product is created — the browser never receives or uses Cloudinary credentials.
3. The resulting Cloudinary `secure_url` is saved to `Product.imageUrl` on creation.
4. `CreateProductSchema`'s `imageUrl` validation rejects any URL that doesn't start with `https://res.cloudinary.com/` — not just "any well-formed URL" as it does today — so a direct API call bypassing the UI can't set an arbitrary host.
5. An upload that fails (network error, oversized file, non-image file type) shows an inline error on the form and does not create the product with a broken or missing `imageUrl`.
6. A product created with no image behaves exactly as it does today — `imageUrl` stays optional, no product is blocked on having one.
7. Scope is creation-only. There is no product-edit form in this codebase today (`PATCH /api/products/[id]` only ever touched Stock Quantity/Low-Stock Threshold, by Story 1.2's deliberate design) — adding a way to set/replace an image on an *existing* product is out of scope for this story.

*(FR14, NFR2. Decision carried from epics.md: single image per product, matching the current schema — multiple images would need a new `ProductImage[]` relation, out of scope. Scope correction from epics.md's original "create or edit" phrasing: confirmed by reading `src/app/api/products/[id]/route.ts` that no edit path exists to extend — AC #7 documents this correction.)*

## Tasks / Subtasks

- [ ] Task 1: New image-upload API route (AC #2, #3, #5)
  - [ ] Create `src/app/api/products/upload-image/schema.ts` — `UploadImageSchema = z.object({ image: z.string() })`, where `image` is validated as a data URL: `.refine((v) => /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(v), "Must be a base64-encoded image")`. Reject at the schema layer, not just via the client's `accept="image/*"` (bypassable by a direct API call).
  - [ ] Create `src/app/api/products/upload-image/route.ts` — `POST` only. Mirrors `src/app/api/pickup-slots/route.ts`'s exact auth shape: `getCurrentVendor()` (401 if null) → `assertVendorActive()` (403 + `VendorDeactivatedError` message if deactivated, same try/catch shape as that file) → parse body with `UploadImageSchema.safeParse()` (400 on failure) → call `uploadImage(parsed.data.image)` from `@/lib/cloudinary` (already exists, already does the full server-side upload — the browser never sees `CLOUDINARY_API_SECRET`) → return `{ imageUrl: secureUrl }` (200) on success.
  - [ ] Wrap the `uploadImage()` call in try/catch — a Cloudinary-side failure (network, invalid image data, quota) must not throw an unhandled 500. Return `{ error: "Could not upload image. Try again." }` at 502, mirroring `src/app/api/admin/vendors/route.ts`'s `Sentry.captureException` + friendly-500 pattern for its own external-failure branch.
  - [ ] **Request body size**: this endpoint receives a base64-encoded image as JSON, not a raw file upload — base64 inflates the original file size by ~1.33x. Vercel's serverless function request body ceiling is 4.5MB. Enforce a **3MB raw-file cap** (client-side in Task 3, confirmed server-side in Task 2's schema — see below) so the worst-case encoded payload (~4MB) stays safely under that ceiling with headroom for JSON framing. Do not skip the server-side half of this check — the client-side one alone is trivially bypassable via a direct API call.
  - [ ] Add a length-based size guard to `UploadImageSchema`'s `.refine()` (or a second `.refine()`) — reject a data URL whose payload exceeds the 3MB-raw-equivalent base64 length (~4,000,000 characters) with a clear "Image is too large — max 3MB" error, distinct from the format-rejection message.

- [ ] Task 2: Narrow `CreateProductSchema.imageUrl` to Cloudinary's host only (AC #4)
  - [ ] `src/app/api/products/schema.ts` — change `imageUrl: z.string().url().optional()` to add `.refine((url) => url.startsWith("https://res.cloudinary.com/"), "imageUrl must be a Cloudinary URL")` (chained after `.url()`, still `.optional()`). Matches `next.config.mjs`'s existing `images.remotePatterns` entry for `res.cloudinary.com` — same host, don't introduce a second source of truth for it.
  - [ ] Existing `src/app/api/products/schema.test.ts` already has `imageUrl` cases (per repo grep) — read them first, extend rather than duplicate; add a case proving a non-Cloudinary URL (e.g. `https://evil.example.com/x.png`) is now rejected where it previously passed.

- [ ] Task 3: Wire `AddProductForm.tsx` to the new upload flow (AC #1, #2, #5, #6)
  - [ ] Add a file input: `<input type="file" name="image" accept="image/*" />`, optional (no `required`), styled consistently with the form's other inputs (`className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"` — match the existing pattern in this same file, don't invent a new input style).
  - [ ] Client-side, before upload: reject a selected file over **3MB** immediately (`file.size > 3 * 1024 * 1024`) with the same inline error pattern the form already uses (`setError(...)`) — don't let an oversized file even reach the network call.
  - [ ] Read the file as a base64 data URL via `FileReader.readAsDataURL()`, wrapped in a `Promise` (no existing helper for this in the codebase — this is new).
  - [ ] In `handleSubmit`, if a file was selected: `POST /api/products/upload-image` first with `{ image: dataUrl }`. On failure, `setError()` with the response's error message (mirror the existing `body?.error ?? "..."` fallback pattern already used for the product-create call) and **stop** — do not proceed to create the product with no image or a stale one. On success, take the returned `imageUrl` and include it in the existing `POST /api/products` payload's body (alongside `name`, `description`, `priceCents`, `stockQuantity`, `lowStockThreshold`).
  - [ ] If no file was selected, skip the upload call entirely and omit `imageUrl` from the `POST /api/products` payload, same as today.
  - [ ] `form.reset()` on success already exists — confirm it also clears the new file input (native `<form>.reset()` does this for `type="file"` inputs by default, no extra code needed, but verify in the e2e test in Task 4).

- [ ] Task 4: Tests (AC #1-#6)
  - [ ] Unit (Vitest), extend `src/app/api/products/schema.test.ts`: Cloudinary-host `imageUrl` accepted, non-Cloudinary-host `imageUrl` rejected, `imageUrl` still optional (omitted entirely still passes).
  - [ ] Unit (Vitest), new `src/app/api/products/upload-image/schema.test.ts`: valid `data:image/png;base64,...` accepted; non-data-URL string rejected; a plain URL (not base64) rejected; an oversized base64 string (construct a string past the ~4M-character threshold) rejected.
  - [ ] **No test image fixture exists anywhere in this repo yet** (confirmed: `tests/` has no `.png`/`.jpg`/fixtures directory) — create one: a small (few-hundred-byte) real PNG committed at `tests/fixtures/test-product-image.png`, used by both the Playwright route test below and the dashboard form test. Don't synthesize a fake base64 string for the route test's happy-path case — Cloudinary needs a real decodable image; a malformed-fixture case (Task 4's 400 test) is the one place a deliberately-invalid string belongs.
  - [ ] Playwright, extend `tests/products-api.spec.ts` (read it first, matches its existing vendor-auth fixture pattern): `[P0]` `POST /api/products/upload-image` as the authenticated test vendor with the new fixture image (base64-encoded) returns 200 and an `imageUrl` starting with `https://res.cloudinary.com/`; `[P0]` the same call with no auth returns 401; `[P0]` a malformed (non-image) `image` value returns 400; `[P1]` an oversized payload returns 400 with the size-specific error message. This is a real Cloudinary API call (no mock exists for `uploadImage()`) — matches this codebase's established "no mocking of external services" testing convention (see `payment.spec.ts`'s real-Stripe pattern) as long as `CLOUDINARY_*` env vars are configured; if they're not, the call will fail at `uploadImage()` — confirm whether to `test.skip()` on missing Cloudinary env vars (mirroring `payment.spec.ts`'s Stripe-key-skip pattern) or let it fail loudly, and note the decision in Dev Notes.
  - [ ] Playwright, extend `tests/dashboard.spec.ts`'s "vendor can add a new product" test (read the existing test first, don't duplicate — extend or add a sibling case): `[P1]` uploading a small real test image file (a tiny fixture PNG, not a synthetic string) via the file input results in a product row whose underlying `imageUrl` is set (assert via the products API/DB, not by trying to visually verify the image rendered — Story 4.2 owns storefront/dashboard display, this story only owns the data getting saved correctly).

- [ ] Task 5: Docs sync (housekeeping, matches established precedent)
  - [ ] `docs/data-models.md:40` — currently reads `imageUrl | String? | Cloudinary URL — not yet populated by any UI flow`. Update to remove "not yet populated by any UI flow" now that `AddProductForm` populates it.
  - [ ] `docs/api-contracts.md:57` — currently reads `imageUrl?: string, // must be a valid URL`. Update the comment to `// must be a Cloudinary URL (https://res.cloudinary.com/...)`, and add a new section documenting `POST /api/products/upload-image`'s request/response shape, matching this doc's existing per-endpoint format (read a couple of neighboring endpoint entries first to match structure exactly).

## Dev Notes

**`src/lib/cloudinary.ts` already exists and already does the real work — this story wires UI/routes to it, it does not build the Cloudinary integration from scratch.** `uploadImage(fileOrUrl, folder = "local-food")` (read in full before starting) takes a base64 data URL *or* a remote URL, calls `cloudinary.uploader.upload()` server-side with the full API secret (already configured via `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` in `.env`), and returns `result.secure_url`. This is a full server-side upload, not a client-side signed-upload widget — simpler than what the epics.md draft implied, and already the safer pattern (the API secret never has to leave the server, no signature-generation endpoint needed either). Do not build a Cloudinary upload widget or a signing endpoint — call `uploadImage()` directly from the new route in Task 1.

**`next.config.mjs` already has `images.remotePatterns` configured for `res.cloudinary.com`** — this was set up in anticipation of exactly this feature (Story 4.2's `next/image` usage will need it) and is also the authoritative host string Task 2's `imageUrl` validation must match exactly. Don't hardcode a different Cloudinary URL pattern.

**Request body size is a real, non-obvious constraint — read this before designing the upload flow.** This app's serverless functions (Next.js App Router Route Handlers, deployed to Vercel per `project-context.md`) have roughly a 4.5MB request body ceiling. A raw image file sent as base64-encoded JSON inflates by ~1.33x before it ever reaches the route handler. A naive "let the vendor pick any image" flow with no cap will work fine in local dev (no such limit) and then silently break in production the first time someone uploads a normal 5-8MB phone photo. Task 1/Task 3's 3MB raw-file cap (yielding ~4MB encoded) is the fix — enforce it on **both** the client (fast UX feedback, Task 3) and the server (Task 1 — the only check that actually matters for correctness, since the client-side one is trivially bypassed by a direct API call).

**Scope correction from epics.md:** the epic's original Story 4.1 draft said "the vendor's product form (create or edit)." There is no edit form for name/description/price/image today — confirmed by reading `src/app/api/products/[id]/route.ts` in full: `PATCH /api/products/[id]` only ever handles `stockQuantity`/`lowStockThreshold` (Story 1.2's own deliberate, stated scope: "not a full product-edit form"). This story is creation-only (AC #7). If a future story adds general product editing, wiring an image *change* into it is that story's job, not a silent addition to this one.

**No new auth/gating pattern needed.** The new upload route follows the exact same shape as every other vendor-scoped write route in this codebase (`POST /api/products`, `POST /api/pickup-slots`): `getCurrentVendor()` + `assertVendorActive()`, self-checked in the route handler, not covered by `middleware.ts` (only `/api/admin/*` is covered there, per the `requireAdmin()` decision work — vendor routes have always self-checked and this story doesn't change that convention).

**Sequencing: upload, then create — not a combined single request.** Considered folding the base64 image directly into `POST /api/products`'s existing payload (avoiding a second network round-trip) instead of a dedicated upload endpoint, but rejected: every other route in this codebase is single-purpose (e.g. `POST /api/admin/vendors/[id]/deactivate` is its own dedicated action route, not folded into a general vendor-update endpoint), and a dedicated upload endpoint gives the form a natural place to show upload-specific progress/errors distinct from product-creation errors. Two sequential requests, matching this codebase's existing simple-fetch style (no client-side request-batching anywhere else in this app).

### Project Structure Notes

- **New:** `src/app/api/products/upload-image/route.ts`, `src/app/api/products/upload-image/schema.ts`, `src/app/api/products/upload-image/schema.test.ts`, `tests/fixtures/test-product-image.png`.
- **Modified:** `src/components/dashboard/AddProductForm.tsx` (file input + upload wiring), `src/app/api/products/schema.ts` (`imageUrl` host restriction), `src/app/api/products/schema.test.ts` (extended), `tests/products-api.spec.ts` (extended), `tests/dashboard.spec.ts` (extended), `docs/data-models.md`, `docs/api-contracts.md`.
- Matches the existing `src/app/api/{resource}/route.ts` + `schema.ts` convention exactly (e.g. `src/app/api/pickup-slots/`), and `src/lib/` stays one-file-per-external-service (`cloudinary.ts` already exists, not modified by this story).

### Testing Standards Summary

- Vitest for both schema files' pure validation logic (`src/app/api/products/schema.test.ts`, new `src/app/api/products/upload-image/schema.test.ts`) — no Prisma/Clerk/Cloudinary involved, matches this codebase's existing schema-test pattern exactly.
- Playwright for the route (real auth, real DB) and the form (real browser file input) — extends `tests/products-api.spec.ts` and `tests/dashboard.spec.ts`, no new spec files (matches this codebase's "one file per feature area" convention — this is the existing "products" and "dashboard" areas, not a new one).
- **Real Cloudinary calls, no mock** — this codebase never mocks external services (Stripe, Clerk, Twilio all use real dev-mode calls with graceful `test.skip()` when unconfigured). Confirm `CLOUDINARY_*` env vars are present in this dev environment before assuming the new Playwright tests will run for real rather than skip; document whichever is true in the Dev Agent Record, matching how `payment.spec.ts` documents its own Stripe-key dependency.
- Uses the existing vendor Playwright auth fixture (`playwright/.auth/vendor.json` via `@clerk/testing`) — no new auth infrastructure needed, this is a vendor-scoped route like every other one already covered by that fixture.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1] — story definition and ACs (corrected in this story per AC #7 — see Dev Notes).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4] — epic scope, single-image decision, Cloudinary-host-restriction decision.
- [Source: src/lib/cloudinary.ts] — current file (read in full for this story): `uploadImage()`'s exact signature and behavior, already does the full server-side upload.
- [Source: next.config.mjs] — `images.remotePatterns` for `res.cloudinary.com`, the authoritative host string for Task 2's validation.
- [Source: src/app/api/products/route.ts, src/app/api/products/schema.ts] — current product-creation route and schema (read in full for this story) — `imageUrl` already accepted, just needs the host restriction narrowed.
- [Source: src/app/api/products/[id]/route.ts, src/app/api/products/[id]/schema.ts] — current product-update route (read in full for this story) — confirms no edit path exists for name/description/image, grounding AC #7's scope correction.
- [Source: src/app/api/pickup-slots/route.ts] — the exact `getCurrentVendor()` + `assertVendorActive()` auth shape the new upload route mirrors.
- [Source: src/components/dashboard/AddProductForm.tsx] — current file (read in full for this story) — the exact form this story extends; match its existing input styling, error-handling, and submit-flow patterns exactly.
- [Source: .env.example] — confirms `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` are the expected env var names, already documented.
- [Source: project-context.md#Technology Stack] — Cloudinary 2.5 already an established dependency; deployment target is Vercel (the source of the 4.5MB body-size constraint driving this story's size cap).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
