import { twilioProvider } from "./providers/twilioProvider";
import { mockProvider } from "./providers/mockProvider";
import type { SmsProvider } from "./types";

function resolveProvider(): SmsProvider {
  const mode = process.env.SMS_PROVIDER ?? "mock";
  return mode === "twilio" ? twilioProvider : mockProvider;
}

export const smsProvider = resolveProvider();

/**
 * Returns whether the SMS was actually sent. Callers that gate state on
 * delivery — e.g. the Stripe webhook's `smsNotified` flag — must check this
 * rather than assuming success, since a failed send must not be treated as
 * sent.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const result = await smsProvider.send(to, body);
  if (!result.success) {
    console.error("[sms] failed to send", result.error);
  }
  return result.success;
}

/** Standard message sent when an order is confirmed/paid. */
export function orderConfirmedMessage(
  vendorName: string,
  orderId: string,
): string {
  return `Your ${vendorName} order (#${orderId.slice(-6)}) is confirmed! We'll text you when it's ready for pickup.`;
}
