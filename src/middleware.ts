// Clerk middleware. Protects the vendor dashboard while leaving the public
// storefront and API webhooks open.
//
// Docs: https://clerk.com/docs/references/nextjs/clerk-middleware
import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Page routes that REQUIRE a signed-in user. auth().protect()'s default
// signed-out behavior is a redirect to the sign-in page, which is correct
// for a browser navigating here directly.
const isProtectedPageRoute = createRouteMatcher(["/dashboard(.*)", "/admin(.*)"]);

// API routes that REQUIRE a signed-in user. Handled separately from the page
// routes above: auth().protect()'s default signed-out behavior is a redirect
// to the sign-in page, which is wrong for a JSON API (a fetch/curl caller
// can't follow it usefully, and it breaks the plain-401 contract every
// admin route handler already returns for its own "not an Admin" case) - so
// this checks auth().userId directly and returns a matching 401 JSON body
// instead of calling protect().
//
// This only proves "signed in", not "is an Admin" - the Admin-role check
// still has to happen per-route via getCurrentAdmin() (src/lib/admin.ts),
// because that's a Prisma/Postgres lookup and this middleware runs on the
// Edge runtime, where the standard (non-Data-Proxy) Prisma Client this repo
// uses cannot run. So this layer closes "an unauthenticated request reaches
// an admin API route handler at all", not "a route forgot its admin check" -
// the latter still relies on every /api/admin route calling getCurrentAdmin(),
// same as before.
const isProtectedApiRoute = createRouteMatcher(["/api/admin(.*)"]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedApiRoute(req)) {
    if (!auth().userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return;
  }
  if (isProtectedPageRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    // Run on everything except static files and Next internals...
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpg|jpeg|gif|png|svg|ico|webp)).*)",
    // ...but always run on API routes.
    "/(api|trpc)(.*)",
  ],
};
