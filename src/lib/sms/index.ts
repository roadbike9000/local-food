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

/**
 * Routine "getting low" alert to admin (Story 3.2, AC #2) - sent once
 * per crossing event, deduped via Product.lowStockAlerted.
 */
export function lowStockAlertMessage(
  productName: string,
  vendorName: string,
  stockQuantity: number,
  lowStockThreshold: number,
): string {
  return `Low stock alert: ${productName} (${vendorName}) is down to ${stockQuantity} units (threshold: ${lowStockThreshold}).`;
}

/**
 * Alert to admin when a paid order couldn't be fully decremented (Story
 * 3.2, AC #6) - a distinct message from lowStockAlertMessage, and
 * deliberately never deduped: each shortfall represents a real
 * already-charged order.
 */
export function stockShortfallMessage(
  productName: string,
  vendorName: string,
  orderId: string,
  requested: number,
  available: number,
): string {
  return `Stock shortfall: order #${orderId.slice(-6)} for ${productName} (${vendorName}) couldn't be fully fulfilled - requested ${requested}, only ${available} available. Payment was captured.`;
}
