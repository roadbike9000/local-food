import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { CartProvider } from "@/components/CartProvider";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local Food",
  description: "Order from local food vendors for pickup.",
};

// The root layout wraps every page. We put app-wide providers here:
// - ClerkProvider: makes auth/session available everywhere
// - CartProvider: shares cart state across pages (client-side)
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <CartProvider>
            <Navbar />
            <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          </CartProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
