// UN-PINNED 2026-07-20 (GAP-18, TR-060): this spec tested the default engine
// before the B6 cutover, then was pinned to ?engine=webgl at the cutover
// ("during its one-release archival window" — this file's own former
// header) because Babylon hadn't wired dataset.craftState/cosmos:craft yet
// (GAP-15) nor honoured the `craft` HTML attribute as an input (GAP-12).
// Both are closed (TR-058): SpaceScene.tsx sets density/constellations/ship/
// craft on whichever engine element it mounts identically regardless of
// engine (src/components/islands/SpaceScene.tsx:339-350), and babylon-
// engine.ts now mirrors dataset.craftState + emits cosmos:craft at the same
// three transitions space-engine.js does. Testing the default (Babylon)
// again, per the header's own original intent.
/**
 * PF-07 ship-v2 P1 — E2E for the flagged textured craft.
 *
 * The craft is opt-in via ?craft=1k|2k (the "craft" HTML attribute, set by
 * SpaceScene.tsx from resolveCraftAttribute's URL/stored/device-policy
 * chain); the engine mirrors its load state onto data-craft-state and emits
 * cosmos:craft events. Flag-off behaviour is covered by the existing test
 * suite — the dedicated check here is that the default page never enters a
 * craft state it wasn't asked for.
 */
import { expect, test } from "@playwright/test";

/**
 * PF-11 D0.1 — named test change, no assertion weakened (CLAUDE.md #15).
 *
 * Every `data-craft-state="ready"` wait in this file used a hand-written
 * 20000ms. TR-080's addendum measured those waits at 19.1s and 14.2s on a
 * QUIET machine — near-zero margin — which is why the failing member of this
 * file rotated between runs under load (TR-052's signature) instead of
 * pointing at a defect. The ceiling was calibrated for a pre-PF-10 scene:
 * craft-ready now competes with the SDSS DR18 fetch/decode/mesh build, the
 * DR3 belt, and the bonus star layers. 45s is the same recalibration TR-080
 * applied to the GAP-03/04/05 and distance-scaled specs; what these tests
 * assert (the craft reaches `ready`, console-clean, at the expected tier) is
 * unchanged — the ceiling simply stops enforcing a CI-renderer performance
 * floor the suite was never meant to enforce.
 */
const CRAFT_READY_TIMEOUT_MS = 45_000;

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
    await page.waitForSelector(`babylon-scene[data-craft-state="ready"]`, {
      timeout: CRAFT_READY_TIMEOUT_MS,
    });

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    // the wireframe-failure fallback warning must not have fired
    expect(
      await page.locator('babylon-scene[data-craft-state="error"]').count(),
    ).toBe(0);
  });
}

test("warp travel completes with the craft active (P2 world-space staging)", async ({
  page,
}) => {
  // PF-10 C2/TR-067: widened alongside engine-select.spec.ts's B5/ship-track/GAP-17 tests —
  // same real reason (SDSS DR18's ~14.5M-vertex background galaxy field extends real frame
  // time under CI's software rendering; this test's own real-clock polls were previously
  // tight enough (5000ms) to be affected).
  // PF-11 D0.1: raised 60s → 90s alongside the CRAFT_READY_TIMEOUT_MS change
  // above — this test's ready-wait used Playwright's implicit 30s default,
  // and a 45s ready ceiling plus the flight polls below does not fit in 60s.
  // Same widening the GAP-03/04/05 test took in TR-080; assertions unchanged.
  test.setTimeout(90000);
  await page.goto("/?craft=2k");
  await page.waitForSelector('babylon-scene[data-craft-state="ready"]', {
    timeout: CRAFT_READY_TIMEOUT_MS,
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // Warp to a station through the full flight sequence (aim → burn → flip →
  // decel → arrive) — exercises the ship track, plume, and chase choreography
  // along the way.
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .locator("ul")
    .first()
    .getByRole("link", { name: "About" })
    .click();

  // P3: while warping, the hero copy steps back so the flight dominates.
  await expect(page.locator("body.ij-warping")).toBeAttached({
    timeout: 15000,
  });
  await expect
    .poll(
      async () =>
        page
          .locator("#ij-hero-copy")
          .evaluate((el) => Number(getComputedStyle(el).opacity)),
      { timeout: 15000 },
    )
    .toBeLessThan(0.5);

  await expect(page.getByRole("dialog", { name: "What I Do" })).toBeVisible({
    timeout: 15000,
  });
  // arrival: warp class released, hero copy restored
  await expect(page.locator("body.ij-warping")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("?craft=on auto-resolves to the 2k tier on a capable desktop (P4)", async ({
  page,
}) => {
  await page.goto("/?craft=on");
  await page.waitForSelector('babylon-scene[data-craft-state="ready"]', {
    timeout: CRAFT_READY_TIMEOUT_MS,
  });
  await expect(page.locator("babylon-scene")).toHaveAttribute("craft", "2k");
});

test("?craft=on picks the 1k tier on a narrow viewport (P4)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?craft=on");
  await page.waitForSelector('babylon-scene[data-craft-state="ready"]', {
    timeout: CRAFT_READY_TIMEOUT_MS,
  });
  await expect(page.locator("babylon-scene")).toHaveAttribute("craft", "1k");
});

test("stored quality override applies without any URL flag (P4)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("ij-craft-quality", "1k");
  });
  await page.goto("/");
  await page.waitForSelector('babylon-scene[data-craft-state="ready"]', {
    timeout: CRAFT_READY_TIMEOUT_MS,
  });
  await expect(page.locator("babylon-scene")).toHaveAttribute("craft", "1k");
});

test("no-WebGL fallback still works with the craft flag on (P4 parity)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error - intentionally narrowing to force the no-WebGL path
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...rest: unknown[]
    ) {
      if (type.indexOf("webgl") !== -1) return null;
      return orig.call(this, type, ...rest);
    };
  });
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.goto("/?craft=2k");
  await page.waitForSelector("babylon-scene");
  await expect(page.getByText(/ONLINE ·.*LIVE SOURCES/)).toBeVisible({
    timeout: 15000,
  });
  expect(pageErrors).toEqual([]);
});

// Deliberately replaced at the P5 rollout (TR-020): the pre-P5 spec asserted
// the default page NEVER engaged the craft. Default-on is now the release
// behaviour; the opt-out below carries the old guarantee.
test("default page loads the craft via the auto policy (P5 rollout)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector('babylon-scene[data-craft-state="ready"]', {
    timeout: CRAFT_READY_TIMEOUT_MS,
  });
  await expect(page.locator("babylon-scene")).toHaveAttribute("craft", "2k");
});

test("?craft=off restores the wireframe (rollout opt-out)", async ({
  page,
}) => {
  await page.goto("/?craft=off");
  await page.waitForSelector("babylon-scene");
  await page.waitForTimeout(1500);
  expect(await page.locator("babylon-scene[data-craft-state]").count()).toBe(0);
});
