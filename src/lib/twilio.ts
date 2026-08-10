/**
 * Twilio SMS helper.
 *
 * We wrap the client so the rest of the app calls one simple `sendSms`
 * function. If Twilio is not configured we log instead of throwing, so local
 * development works without real credentials.
 */
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

const client =
  accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Returns whether the SMS was actually sent (or intentionally skipped in
 * dev-mode without credentials). Callers that gate state on delivery — e.g.
 * the Stripe webhook's `smsNotified` flag — must check this rather than
 * assuming success, since a Twilio failure must not be treated as sent.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!client || !fromNumber) {
    console.log(`[twilio:disabled] would send to ${to}: ${body}`);
    return true;
  }

  try {
    await client.messages.create({ to, from: fromNumber, body });
    return true;
  } catch (err) {
    // Don't let an SMS failure break the order flow — just report it.
    console.error("[twilio] failed to send SMS", err);
    return false;
  }
}

/** Standard message sent when an order is confirmed/paid. */
export function orderConfirmedMessage(
  vendorName: string,
  orderId: string,
): string {
  return `Your ${vendorName} order (#${orderId.slice(-6)}) is confirmed! We'll text you when it's ready for pickup.`;
}
