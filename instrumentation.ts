/**
 * Next.js instrumentation hook - the only place Sentry.init() actually runs
 * for @sentry/nextjs v8+. Without this file, sentry.server.config.ts and
 * sentry.edge.config.ts are inert (the SDK announces this on every
 * `npm run dev`/`npm run build`) - flagged as a deferred item across
 * Stories 1.3 and 1.4's reviews, closed here.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
