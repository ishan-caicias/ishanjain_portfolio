/**
 * PF-07 ship-v2 P1 — E2E for the flagged textured craft.
 *
 * The craft is opt-in via ?craft=1k|2k (space-engine "craft" attribute); the
 * engine mirrors its load state onto data-craft-state and emits cosmos:craft
 * events. Flag-off behaviour is covered by the existing 33-test suite — the
 * dedicated check here is that the default page never enters a craft state.
 */
import { expect, test } from "@playwright/test";

for (const tier of ["1k", "2k"] as const) {
  test(`?craft=${tier} loads the textured craft without errors`, async ({
    page,
  }) => {
    await page.goto(`/?craft=${tier}`);
    // Listeners attach post-goto, matching the suite's established convention
    // (space-scene.spec.ts): page-load-time noise is out of scope here — the
    // craft-specific failure detector is the data-craft-state assertion below.
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await page.waitForSelector(`space-engine[data-craft-state="ready"]`, {
      timeout: 20000,
    });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    // the wireframe-failure fallback warning must not have fired
    expect(
      await page.locator('space-engine[data-craft-state="error"]').count(),
    ).toBe(0);
  });
}

test("warp travel completes with the craft active (P2 world-space staging)", async ({
  page,
}) => {
  await page.goto("/?craft=2k");
  await page.waitForSelector('space-engine[data-craft-state="ready"]');
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // Warp to a station through the full flight sequence (aim → burn → flip →
  // decel → arrive) — exercises the view-space placement, FOV breathing, and
  // spring dynamics along the way.
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .locator("ul")
    .first()
    .getByRole("link", { name: "About" })
    .click();
  await expect(page.getByRole("dialog", { name: "What I Do" })).toBeVisible({
    timeout: 15000,
  });
  expect(pageErrors).toEqual([]);
});

test("without the flag, the craft path never engages", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("space-engine");
  // give the engine ample time to mount and (wrongly) start a craft load
  await page.waitForTimeout(1500);
  expect(await page.locator("space-engine[data-craft-state]").count()).toBe(0);
});
