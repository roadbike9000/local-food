// Sentry configuration for the browser. Loaded automatically by @sentry/nextjs.
// No-op when NEXT_PUBLIC_SENTRY_DSN is empty, so local dev stays quiet.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
});
