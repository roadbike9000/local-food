import twilio from "twilio";
import type { SmsProvider, SmsSendResult } from "../types";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

const client =
  accountSid && authToken ? twilio(accountSid, authToken) : null;

export const twilioProvider: SmsProvider = {
  async send(to: string, body: string): Promise<SmsSendResult> {
    if (!client || !fromNumber) {
      return {
        success: false,
        error: "Twilio is not configured (missing TWILIO_* env vars)",
      };
    }

    try {
      const message = await client.messages.create({ to, from: fromNumber, body });
      return { success: true, id: message.sid };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown Twilio error",
      };
    }
  },
};
