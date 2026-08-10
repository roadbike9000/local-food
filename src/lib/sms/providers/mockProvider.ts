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
export const sentMessages: SentMessage[] = [];

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
