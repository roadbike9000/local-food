---
name: 'Tech-Verify Review — Admin & Inventory Expansion Spine'
type: review
target: architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md
lens: 'reality-check — versions, technology existence/fit, codebase claims, no-new-dependency claim'
created: '2026-08-10'
verdict: PASS-WITH-NOTES
---

# Tech-Verify Review — Admin & Inventory Expansion Spine

## Verdict

**PASS with two notes.** Every checkable factual claim in the spine was verified directly against the repo at `/Users/jeffsmathers/Projects/local-food` and holds up. No fabricated file paths, function signatures, or behaviors were found. One real completeness gap and one cosmetic imprecision are flagged below — neither invalidates an AD, but both should be corrected before this spine is treated as ground truth for story-writing.

## Verified Claims (checked, confirmed true)

| Claim | Where checked | Result |
| --- | --- | --- |
| Next.js 14.2.13 | `package.json` (`"next": "14.2.13"`), `package-lock.json` resolved `14.2.13` | Exact match |
| Prisma / @prisma/client ^5.20.0 | `package.json` — `"@prisma/client": "^5.20.0"`, `"prisma": "^5.20.0"` | Declared floor matches; see Note 2 |
| Clerk 5.7 | `package.json` — `"@clerk/nextjs": "^5.7.0"`; lockfile resolves `5.7.6` | Match |
| "No new external dependency" | Full `package.json` dependencies/devDependencies reviewed; spine's proposed additions (`Admin` Prisma model, `adjustStock()` via conditional `updateMany`/raw SQL, `assertVendorActive()`, admin auth via existing `@clerk/nextjs`) all use libraries already present | Confirmed — nothing in the spine requires a new package. FR-9's Inventory Report is explicitly "on-demand page, no scheduling infra" per PRD (line 170), so no cron/queue package either. |
| `getCurrentVendor()` shape | `src/lib/vendor.ts` | Matches spine's description exactly: resolves Clerk `userId` via `auth()`, returns `null` if unauthenticated, looks up `prisma.vendor.findUnique({ where: { clerkUserId: userId } })` — the pattern AD-1/AD-6 say `getCurrentAdmin()` should mirror is real and mirror-able as described. |
| `isProtectedRoute` middleware matcher | `src/middleware.ts` | Confirmed: `createRouteMatcher(["/dashboard(.*)"])`, used inside `clerkMiddleware`. AD-6's instruction to add admin routes to this matcher is actionable against the real file. |
| `Order.smsNotified` one-shot flag pattern | `prisma/schema.prisma` (field), `src/app/api/webhooks/stripe/route.ts` (usage) | Confirmed: `smsNotified Boolean @default(false)`; webhook checks `if (!order.smsNotified)` before sending, and only sets it `true` after `sendSms()` returns success. Spine's `lowStockAlerted` "same shape as `Order.smsNotified`" claim is accurate to both the field and the check-before-send/set-after-success behavior, not just the field name. |
| Existing SMS module reused, not replaced | `src/lib/sms/index.ts`, `types.ts`, `providers/{twilioProvider,mockProvider}.ts` | Confirmed real, already provider-abstracted (`SMS_PROVIDER` env toggle between `twilio`/`mock`), exports `sendSms()` — exactly the surface FR-10 would call. No new SMS dependency needed. |
| `where: { isAvailable: true }` call sites named in AD-2 | `src/app/api/checkout/route.ts:28`, `src/app/vendors/[slug]/page.tsx:16` | Both confirmed present verbatim. |
| `Vendor.clerkUserId` unique, `Product.isAvailable` currently a stored column | `prisma/schema.prisma` | Confirmed — `isAvailable Boolean @default(true)` exists today, so AD-2's "column is dropped" is a real, checkable migration, not describing already-derived state. |
| `Order.smsNotified`/vendor/admin FK cascade posture | `prisma/schema.prisma` | `Product.vendor`, `PickupSlot.vendor`, `Order.vendor`, `OrderItem.order` all use `onDelete: Cascade`. Spine's `Vendor.deletedAt` is a **soft**-delete addition (AD-4/AD-5), not a hard delete, so the existing hard-delete cascades are correctly left undisturbed — the spine doesn't claim otherwise, and doesn't need to. |
| Deployment/Vercel assumption unchanged | `_bmad-output/project-context.md:84` | Confirmed: "deployment is assumed to be Vercel but not configured in-repo" — matches the spine's Deferred-section claim verbatim. |

## Findings

### 1. AD-2's "every existing query that filters on product availability" misses one real read site (Medium)

**Claim:** AD-2 binds "every existing query that filters on product availability" and names two rewrite targets: `src/app/api/checkout/route.ts` and "storefront listing queries." Both are real and correctly identified.

**Gap:** `src/app/dashboard/products/page.tsx:40` also reads `p.isAvailable` directly (`{p.isAvailable ? "Yes" : "No"}`) from an un-`select`-scoped `prisma.product.findMany(...)` result. This is a third call site, on the vendor's own dashboard, that isn't named in AD-2's rule text or in the Capability → Architecture Map's `FR-6, FR-7` row. Once the `isAvailable` column is dropped as AD-2 mandates, this file will fail to typecheck (the field won't exist on the generated `Product` type) — it isn't a filter, so a literal reading of "queries that filter on availability" excuses it, but the practical effect (a real compile break) is the same class of problem AD-2 exists to prevent.

**Recommendation:** Either broaden AD-2's rule text to "every existing query that reads or filters on `isAvailable`" and add this file to the Capability Map row, or explicitly note it in Deferred as an implementation-detail cleanup. As written, a story-writer relying on the spine's file list would miss this site.

### 2. Minor: stated "Prisma 5.20" is the declared floor, not the resolved version (Low)

`package.json` declares `"@prisma/client": "^5.20.0"`, but `package-lock.json` resolves `5.22.0`. Referring to the stack as "Prisma 5.20" is normal shorthand for the declared minimum and isn't wrong, but a strict reading of "current library version" would be `5.22.0`. No action needed — noting only because the review's mandate is version accuracy.

## What Was Not a Problem

- No hallucinated APIs, functions, or file paths were found anywhere in the spine.
- No new package, service, or env var is secretly required — verified against the full dependency list and the PRD's own note that FR-9/FR-10 need no scheduling infrastructure.
- `getCurrentVendor()`, `isProtectedRoute`, `Order.smsNotified`, and the SMS module all exist exactly as characterized, including behavioral nuance (e.g., smsNotified is only set after confirmed send, not on attempt).
