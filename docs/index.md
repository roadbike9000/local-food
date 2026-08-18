# Project Documentation Index — Local Food

_Generated 2026-07-19 via `bmad-document-project` (deep scan). This is the primary entry point for AI-assisted development on this repo — point brownfield PRD/architecture workflows here._

## Project Overview

- **Type:** Monolith (single part, no monorepo tooling)
- **Primary Language:** TypeScript (strict)
- **Framework:** Next.js 14 (App Router)
- **Architecture:** Layered monolith — Server Components → Prisma → Postgres for reads; API routes for writes/integrations

## Quick Reference

- **Tech Stack:** Next.js 14 · TypeScript · React 18 · Prisma 5 + PostgreSQL (Neon) · Clerk (auth) · Stripe (payments, hosted Checkout) · Twilio (SMS) · Cloudinary (images) · Sentry · Tailwind CSS · Playwright (e2e only)
- **Entry Point:** `src/app/layout.tsx` (providers) · `middleware.ts` (auth gate)
- **Architecture Pattern:** Server Components calling Prisma directly; no service/repository layer

## Generated Documentation

- [Project Overview](./project-overview.md)
- [Architecture](./architecture.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Component Inventory](./component-inventory.md)
- [Development Guide](./development-guide.md)
- [Deployment Guide](./deployment-guide.md)
- [API Contracts](./api-contracts.md)
- [Data Models](./data-models.md)

## Existing Documentation

- [README.md](../README.md) — setup instructions, stack rationale, project layout (consistent with generated docs; used as a primary source)
- [project-context.md](../_bmad-output/project-context.md) — AI-agent implementation rules (critical dos/don'ts, cross-referenced throughout the docs above)

## Getting Started

1. Read [Project Overview](./project-overview.md) for the big picture and known gaps.
2. `npm install && cp .env.example .env` — fill in Neon + Clerk keys at minimum.
3. `npm run prisma:migrate && npm run db:seed && npm run dev`.
4. For any new API/data work, check [Data Models](./data-models.md) and [API Contracts](./api-contracts.md) first — several access-control and pricing invariants (never trust client prices, always scope by `vendorId`, always check availability via `isInStock()`/`stockQuantity`, never a stored boolean) are load-bearing and undocumented in code comments alone.
5. Before implementing, also read `_bmad-output/project-context.md` — it has 45 more granular rules (naming, error-handling patterns, file organization) that complement this documentation set.

## Notable findings from this scan

- Dead code: `formatPrice()` duplicated in `src/lib/stripe.ts`, unused — canonical version is in `src/lib/utils.ts`. See [Source Tree Analysis](./source-tree-analysis.md#notes--discrepancies-found-during-scan).
- Three flows are UI-stubbed but not wired: dashboard "Add product", "Add slot" buttons, and any Cloudinary upload UI. Their backing API routes already exist and work. See [Project Overview — Known gaps](./project-overview.md#known-gaps-scaffold-status-not-bugs).
