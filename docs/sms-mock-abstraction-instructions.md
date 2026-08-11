# Task: Add a mockable SMS abstraction, on a new branch

## Branch

Create a new branch off `main` before making any changes:

```
git checkout main
git pull
git checkout -b feature/mock-sms-provider
```

## Why

Twilio's fraud/verification checks are currently blocking test account setup. Rather than
depend on Twilio during local development and CI, introduce a small provider interface so
SMS sending can be swapped between a real provider (Twilio) and a fake one (mock) based on
environment. This also makes Playwright tests faster and independent of any third-party
network call.

## Step 1: Find the existing Twilio integration

Search the repo for the current Twilio usage (likely something like `lib/twilio.ts`,
`lib/sms.ts`, or inline inside an API route / webhook handler for order confirmation).
Note every call site that sends an SMS, we will redirect all of them through the new
abstraction in Step 4.

## Step 2: Create the provider interface

Create `lib/sms/types.ts`:

```typescript
export interface SmsSendResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface SmsProvider {
  send(to: string, body: string): Promise<SmsSendResult>;
}
```

## Step 3: Create the two providers

Create `lib/sms/providers/twilioProvider.ts`. Move the existing Twilio client
initialization and send logic here, wrapped to match the interface:

```typescript
import twilio from "twilio";
import type { SmsProvider, SmsSendResult } from "../types";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const twilioProvider: SmsProvider = {
  async send(to: string, body: string): Promise<SmsSendResult> {
    try {
      const message = await client.messages.create({
        to,
        from: process.env.TWILIO_FROM_NUMBER,
        body,
      });
      return { success: true, id: message.sid };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown Twilio error",
      };
    }
  },
};
```

Create `lib/sms/providers/mockProvider.ts`. This logs to the console and keeps an
in-memory record so tests can assert against what was "sent":

```typescript
import type { SmsProvider, SmsSendResult } from "../types";

export interface SentMessage {
  to: string;
  body: string;
  sentAt: Date;
}

// In-memory store, cleared on server restart. Good enough for dev/test.
export const sentMessages: SentMessage[] = [];

export const mockProvider: SmsProvider = {
  async send(to: string, body: string): Promise<SmsSendResult> {
    const record = { to, body, sentAt: new Date() };
    sentMessages.push(record);
    console.log(`[mock-sms] to=${to} body="${body}"`);
    return { success: true, id: `mock_${sentMessages.length}` };
  },
};
```

## Step 4: Create the provider selector

Create `lib/sms/index.ts`:

```typescript
import { twilioProvider } from "./providers/twilioProvider";
import { mockProvider } from "./providers/mockProvider";
import type { SmsProvider } from "./types";

function resolveProvider(): SmsProvider {
  const mode = process.env.SMS_PROVIDER ?? "mock";
  return mode === "twilio" ? twilioProvider : mockProvider;
}

export const smsProvider = resolveProvider();

export async function sendSms(to: string, body: string) {
  return smsProvider.send(to, body);
}
```

Now update every call site found in Step 1 to import `sendSms` from `lib/sms` instead of
calling Twilio directly.

## Step 5: Add a test-only debug endpoint (optional but recommended)

For Playwright tests to assert on what was sent, add a route that only responds outside
production, e.g. `app/api/debug/sms/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { sentMessages } from "@/lib/sms/providers/mockProvider";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  return NextResponse.json({ messages: sentMessages });
}
```

## Step 6: Environment variables

Add to `.env.example` (and local `.env`):

```
# "mock" (default, no external calls) or "twilio" (real sends)
SMS_PROVIDER=mock
```

Leave `SMS_PROVIDER` unset or `mock` in local dev and CI. Set it to `twilio` only in
the production environment variables on Vercel, once Twilio is unblocked.

## Step 7: Update the existing Playwright SMS test file

Point the existing SMS-related test at `GET /api/debug/sms` to confirm a message was
recorded with the expected phone number and content, instead of asserting against any
real Twilio response.

## Step 8: Commit

```
git add -A
git commit -m "Add mockable SMS provider abstraction"
```

Leave the branch pushed for review, do not merge to main yet.
