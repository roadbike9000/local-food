/**
 * Signs in via Clerk's Backend API (no UI navigation beyond the initial
 * page load, no email 2FA challenge) and saves the resulting session to a
 * storageState file. Shared by playwright/support/global-setup.ts (mints
 * both identities once at the very start of a run) and by any spec file
 * that needs to re-mint its own session immediately before its tests run —
 * see tests/products-api.spec.ts's beforeAll for why that's needed.
 */
import { chromium } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export async function signInAndSave(
  baseURL: string,
  email: string,
  outPath: string,
): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(baseURL);
    try {
      await clerk.signOut({ page });
    } catch {
      // No active session to sign out of - expected on global-setup's very
      // first mint of a run. Harmless no-op otherwise.
    }
    await clerk.signIn({ page, emailAddress: email });

    mkdirSync(dirname(outPath), { recursive: true });
    await page.context().storageState({ path: outPath });
  } finally {
    await browser.close();
  }
}
