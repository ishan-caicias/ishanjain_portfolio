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

// Retries mirror CI's global retries:2 (TR-019). This absorbs only
// nondeterministic infra noise (SwiftShader contention starving the star-stream
// readiness wait) — a real console error fails deterministically on every
// attempt, so nothing this spec exists to catch can slip through.
test.describe.configure({ retries: 2 });

test("page load produces zero console errors from navigation start", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");
  // readiness precondition (not the assertion under test): generous timeout —
  // star streaming can be slow under parallel-suite GPU contention
  await expect(page.getByText(/ONLINE ·.*LIVE SOURCES/)).toBeVisible({
    timeout: 25000,
  });

  expect(errors).toEqual([]);
});

test("both variable fonts actually load and apply", async ({ page }) => {
  await page.goto("/");
  // engine-agnostic since the ADR-0006 cutover: either engine may mount
  await page.waitForSelector("space-engine, babylon-scene");
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
