/**
 * TR-016 — strict page-load console hygiene.
 *
 * Unlike the rest of the suite (which attaches console listeners after
 * page.goto, deliberately scoping to post-load behaviour), this spec listens
 * from navigation start. It exists because three classes of load-time errors
 * shipped unnoticed for days: CSP-blocked inline styles (AstronautMascot),
 * 0-byte font files failing to decode, and a no-op frame-ancestors <meta>
 * directive. All three are fixed; this spec keeps them fixed.
 */
import { expect, test } from "@playwright/test";

test("page load produces zero console errors from navigation start", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");
  await expect(page.getByText(/ONLINE ·.*LIVE SOURCES/)).toBeVisible({
    timeout: 15000,
  });

  expect(errors).toEqual([]);
});

test("both variable fonts actually load and apply", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("space-engine");
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      inter: document.fonts.check("16px Inter"),
      spaceGrotesk: document.fonts.check("16px 'Space Grotesk'"),
    };
  });
  expect(fonts.inter).toBe(true);
  expect(fonts.spaceGrotesk).toBe(true);
});
