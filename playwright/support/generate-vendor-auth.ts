/**
 * One-time (well, occasional) script to authenticate as the E2E test vendor
 * and save the resulting Clerk session to playwright/.auth/vendor.json.
 *
 * Clerk challenges sign-ins from unrecognized devices with an emailed code,
 * so this can't run unattended in CI — a human has to be present to read the
 * code from E2E_VENDOR_EMAIL's inbox and paste it in when prompted. Once the
 * saved session file exists, authenticated tests reuse it via
 * `test.use({ storageState: 'playwright/.auth/vendor.json' })` and never hit
 * Clerk's UI at all, so this only needs to be re-run when that file is
 * missing, expired, or the test vendor's password changes.
 *
 * Usage: npx tsx playwright/support/generate-vendor-auth.ts
 * (the dev server must be running: npm run dev)
 */
import { chromium } from "@playwright/test";
import { createInterface } from "node:readline/promises";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Minimal .env loader — this script runs outside Next.js, which is the only
// part of the app that auto-loads .env. No dotenv dependency in this repo.
function loadEnvFile() {
  const path = join(__dirname, "../../.env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue; // don't override an already-exported value
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnvFile();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const email = process.env.E2E_VENDOR_EMAIL;
  const password = process.env.E2E_VENDOR_PASSWORD;
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!email || !password || !secretKey) {
    throw new Error(
      "E2E_VENDOR_EMAIL, E2E_VENDOR_PASSWORD, and CLERK_SECRET_KEY must all be set in .env",
    );
  }

  // Clerk Testing Tokens bypass bot-detection challenges that headless
  // browsers can trigger. They do NOT bypass the new-device email
  // verification step below — that's a separate, session-security check.
  const tokenRes = await fetch("https://api.clerk.com/v1/testing_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const { token: testingToken } = (await tokenRes.json()) as { token: string };

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${appUrl}/sign-in?__clerk_testing_token=${testingToken}`, {
    waitUntil: "load",
  });

  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Clerk sometimes re-prompts for the password on a dedicated step even
  // after the combined email+password screen.
  if (page.url().includes("factor-one")) {
    await page.getByRole("textbox", { name: "Password" }).fill(password);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }

  await page.waitForURL(/factor-two|\/(dashboard)?$/, { timeout: 15_000 });

  if (page.url().includes("factor-two")) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    // Clerk's dev instance has been observed sending more than one code per
    // attempt — if the first one is rejected, this will prompt again.
    let authenticated = false;
    while (!authenticated) {
      const code = (
        await rl.question(`Enter the verification code sent to ${email}: `)
      ).trim();

      const codeBox = page.getByRole("textbox", { name: /verification code/i });
      await codeBox.fill("");
      await codeBox.fill(code);
      await page.waitForTimeout(2000);

      authenticated = !page.url().includes("/sign-in");
      if (!authenticated) {
        console.log("Code rejected — check email for a newer one and try again.");
      }
    }
    rl.close();
  }

  const outPath = join(__dirname, "../.auth/vendor.json");
  mkdirSync(dirname(outPath), { recursive: true });
  await context.storageState({ path: outPath });
  console.log(`Saved authenticated session to ${outPath}`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
