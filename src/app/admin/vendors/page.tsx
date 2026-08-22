import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin";
import { AddVendorForm } from "@/components/admin/AddVendorForm";

// Admin vendor onboarding (Story 2.2, AD-6). Same per-page gate as
// src/app/admin/page.tsx - no shared layout guard exists yet.
export default async function AdminVendorsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold">Add a vendor</h1>
      <AddVendorForm />
    </div>
  );
}
