// PINNED TO ?engine=webgl at the ADR-0006 cutover (declared test change):
// this spec guards the ARCHIVED legacy engine during its one-release archival
// window. Babylon-path coverage lives in the engine-select/accessibility/
// perf-budgets/webgpu-hardware specs.
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
    // engine=webgl per this file's archival pin (TR-054: this goto was the one
    // the ADR-0006 cutover missed, so it still resolved to the Babylon default
    // and waited forever for a <space-engine> that never mounts)
    await page.goto(`/?craft=${tier}&engine=webgl`);
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
  await page.goto("/?craft=2k&engine=webgl");
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

  // P3: while warping, the hero copy steps back so the flight dominates.
  await expect(page.locator("body.ij-warping")).toBeAttached({ timeout: 5000 });
  await expect
    .poll(
      async () =>
        page
          .locator("#ij-hero-copy")
          .evaluate((el) => Number(getComputedStyle(el).opacity)),
      { timeout: 5000 },
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
  await page.goto("/?craft=on&engine=webgl");
  await page.waitForSelector('space-engine[data-craft-state="ready"]', {
    timeout: 20000,
  });
  await expect(page.locator("space-engine")).toHaveAttribute("craft", "2k");
});

test("?craft=on picks the 1k tier on a narrow viewport (P4)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/?craft=on&engine=webgl");
  await page.waitForSelector('space-engine[data-craft-state="ready"]', {
    timeout: 20000,
  });
  await expect(page.locator("space-engine")).toHaveAttribute("craft", "1k");
});

test("stored quality override applies without any URL flag (P4)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("ij-craft-quality", "1k");
  });
  await page.goto("/?engine=webgl");
  await page.waitForSelector('space-engine[data-craft-state="ready"]', {
    timeout: 20000,
  });
  await expect(page.locator("space-engine")).toHaveAttribute("craft", "1k");
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
  await page.goto("/?craft=2k&engine=webgl");
  await page.waitForSelector("space-engine");
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
  await page.goto("/?engine=webgl");
  await page.waitForSelector('space-engine[data-craft-state="ready"]', {
    timeout: 20000,
  });
  await expect(page.locator("space-engine")).toHaveAttribute("craft", "2k");
});

test("?craft=off restores the wireframe (rollout opt-out)", async ({
  page,
}) => {
  await page.goto("/?craft=off&engine=webgl");
  await page.waitForSelector("space-engine");
  await page.waitForTimeout(1500);
  expect(await page.locator("space-engine[data-craft-state]").count()).toBe(0);
});
