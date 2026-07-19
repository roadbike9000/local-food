import Link from "next/link";

// Shared layout for the vendor dashboard. Clerk middleware already guarantees
// the user is signed in before any /dashboard page renders.
const tabs = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/pickups", label: "Pickup slots" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Vendor dashboard</h1>
      <nav className="mb-6 flex gap-4 border-b border-stone-200 text-sm">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="border-b-2 border-transparent pb-2 hover:border-brand hover:text-brand"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
