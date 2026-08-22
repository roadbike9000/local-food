import type { SmsProvider, SmsSendResult } from "../types";

export interface SentMessage {
  to: string;
  body: string;
  sentAt: Date;
}

// Twilio's documented magic "invalid number" test destination. Sending to it
// here simulates a failed send so tests can exercise the failure path without
// any real Twilio credentials or network call.
const MAGIC_FAILURE_NUMBER = "+15005550001";

// In-memory store, cleared on server restart. Good enough for dev/test.
//
// Cached on globalThis for the same reason src/lib/prisma.ts's client is:
// Next.js's dev-mode App Router compiles each route.ts as a largely
// independent module graph, so two different routes importing this file
// (the webhook, which writes here via sendSms(), and /api/debug/sms,
// which reads it back) can otherwise each get their own separate array
// instance - a message pushed by one route is invisible to the other,
// even with no hot-reload involved (confirmed directly: still reproduces
// against a freshly-started dev server, Story 3.2 investigation).
const globalForSms = globalThis as unknown as {
  sentMessages: SentMessage[] | undefined;
};

export const sentMessages: SentMessage[] =
  globalForSms.sentMessages ?? [];

if (process.env.NODE_ENV !== "production") {
  globalForSms.sentMessages = sentMessages;
}

export const mockProvider: SmsProvider = {
  async send(to: string, body: string): Promise<SmsSendResult> {
    console.log(`[mock-sms] to=${to} body="${body}"`);

    if (to === MAGIC_FAILURE_NUMBER) {
      return { success: false, error: "mock simulated failure" };
    }

    const record = { to, body, sentAt: new Date() };
    sentMessages.push(record);
    return { success: true, id: `mock_${sentMessages.length}` };
  },
};
