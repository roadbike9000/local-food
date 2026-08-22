import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin";

// Admin route tree root (architecture AD-6). Still minimal - proves
// getCurrentAdmin()'s gate end to end (Story 2.1) and links to the one
// real page that exists so far (Story 2.2). Story 3.1 adds /admin/inventory.
//
// middleware.ts's isProtectedRoute matcher already guarantees the visitor
// is signed in (some Clerk user); getCurrentAdmin() below is what proves
// they're specifically an Admin - notFound() otherwise. Mirrors this
// codebase's only other notFound() precedent (src/app/vendors/[slug]/page.tsx)
// rather than a 403 page, so a non-admin isn't told the route/check exists.
export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="mt-2 text-stone-600">Signed in as {admin.clerkUserId}.</p>
      <Link href="/admin/vendors" className="mt-4 inline-block text-brand hover:underline">
        Add a vendor
      </Link>
    </div>
  );
}
