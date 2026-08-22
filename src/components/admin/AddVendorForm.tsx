"use client";

/**
 * Admin vendor-creation form. POSTs to /api/admin/vendors; on success shows
 * a confirmation with a link to the new storefront (AC #3) instead of just
 * resetting - the admin gets visible proof the vendor is live immediately,
 * without needing to navigate away to check.
 */
import { useState, type FormEvent } from "react";
import { slugify } from "@/lib/utils";

type CreatedVendor = { name: string; slug: string };

export function AddVendorForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // Auto-suggests the slug from the name until the admin edits the slug
  // field themselves - a common "auto-fill until touched" pattern, not
  // full auto-generation with no admin control (AC #1 has the admin
  // explicitly submitting a slug).
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedVendor | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
    if (error) setError(null);
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    setSlugTouched(true);
    if (error) setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    setError(null);

    const formData = new FormData(form);
    const phone = String(formData.get("phone") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    try {
      const res = await fetch("/api/admin/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          phone: phone || undefined,
          description: description || undefined,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session expired. Sign in again.");
          return;
        }
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not create vendor. Check the fields and try again.");
        return;
      }

      const body = await res.json();
      setCreated({ name: body.vendor.name, slug: body.vendor.slug });
      form.reset();
      setName("");
      setSlug("");
      setSlugTouched(false);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4">
        <p className="text-sm text-stone-700">
          <span className="font-medium">{created.name}</span> was created.
        </p>
        <a
          href={`/vendors/${created.slug}`}
          className="mt-1 inline-block text-sm text-brand hover:underline"
        >
          View storefront: /vendors/{created.slug}
        </a>
        <button
          type="button"
          onClick={() => setCreated(null)}
          className="mt-3 block text-sm text-stone-500 hover:text-stone-700"
        >
          Add another vendor
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Add vendor"
      className="mt-4 space-y-3 rounded-lg border border-stone-200 bg-white p-4"
    >
      <div>
        <label htmlFor="name" className="block text-sm text-stone-600">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={1}
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm text-stone-600">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          required
          minLength={1}
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm text-stone-600">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm text-stone-600">
          Description
        </label>
        <input
          id="description"
          name="description"
          className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        />
      </div>

      {error ? (
        <p role="alert" aria-live="polite" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-brand px-3 py-1.5 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save vendor"}
      </button>
    </form>
  );
}
