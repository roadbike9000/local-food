import type { SmsProvider, SmsSendResult } from "../types";

export interface SentMessage {
  to: string;
  body: string;
  sentAt: Date;
  // Records a failed attempt too, not just successful deliveries
  // (review finding) - without this, a test simulating a failure via
  // MAGIC_FAILURE_NUMBER has no way to positively prove sendSms() was
  // ever called, only that whatever DB flag it gates stayed false -
  // indistinguishable from the code path never running at all.
  success: boolean;
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

// Caps unbounded growth across a long-lived dev server session - the
// globalThis cache above means this array now survives hot reloads
// too, not just individual requests.
const MAX_MESSAGES = 500;

let sendCount = 0;

export const mockProvider: SmsProvider = {
  async send(to: string, body: string): Promise<SmsSendResult> {
    console.log(`[mock-sms] to=${to} body="${body}"`);
    sendCount += 1;

    const success = to !== MAGIC_FAILURE_NUMBER;
    sentMessages.push({ to, body, sentAt: new Date(), success });
    if (sentMessages.length > MAX_MESSAGES) {
      sentMessages.splice(0, sentMessages.length - MAX_MESSAGES);
    }

    if (!success) {
      return { success: false, error: "mock simulated failure" };
    }
    return { success: true, id: `mock_${sendCount}` };
  },
};
