/**
 * PF-11 D9 — the Render Console, on the DEFAULT (Babylon) engine.
 *
 * Drives the REAL panel UI (CLAUDE.md #18 — behaviour, not readiness): open via the HUD's
 * RENDER ▸ button, toggle real checkboxes/number inputs, read back `sceneStats()` to prove the
 * engine actually changed state (not just the panel's own local state). No `?engine=` override
 * — the archived WebGL1 engine has no `setLayers()` and its own test (below) proves the control
 * is simply absent there, not present-but-broken.
 *
 * WRITTEN BUT NOT RUN THIS SESSION (owner directive): unit tests only; the owner runs
 * `npm run test:e2e` manually once CPU/GPU capacity is available. See TR-112.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

type EngineHandle = {
  sceneStats(): Record<string, unknown>;
  travelTo(id: string, quiet?: boolean): void;
  goHome(): void;
  arrivedId: string | null;
};

const stats = (engine: Locator) =>
  engine.evaluate((el) => (el as unknown as EngineHandle).sceneStats());

const travel = (engine: Locator, id: string) =>
  engine.evaluate((el, i) => (el as unknown as EngineHandle).travelTo(i), id);

/** Read off the ELEMENT — `arrivedId` is not part of `sceneStats()`. See TR-113. */
const arrivedId = (engine: Locator) =>
  engine.evaluate((el) => (el as unknown as EngineHandle).arrivedId);

const POLL_INTERVALS = [500, 1000];

/** Boot the scene AND dismiss the D1.2 PRE-FLIGHT gate before driving any HUD control — the
 * convention every other Babylon spec in this suite already follows (TR-107 fixed this exact
 * class once before). PreFlight moves focus to LAUNCH the moment it arms, which races any
 * focus assertion made while it is still mounted: the console's focus test passed in a full
 * suite run and failed in isolation until this landed. Added by TR-113; this file previously
 * never dismissed the gate at all. */
const boot = async (page: Page, url = "/", selector = "babylon-scene") => {
  await page.goto(url);
  await page.waitForSelector(selector);
  const skip = page.getByRole("button", { name: "SKIP INTRO" });
  if (await skip.count()) await skip.click();
};

test("RENDER ▸ opens the console, focuses it, and Escape closes it", async ({
  page,
}) => {
  await boot(page);

  await page.getByText("RENDER ▸").click();
  const dialog = page.getByRole("dialog", { name: "Render console" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("the RENDER ▸ control is absent on the archived WebGL1 engine (no setLayers to drive)", async ({
  page,
}) => {
  await boot(page, "/?engine=webgl", "space-engine");
  await expect(page.getByText("RENDER ▸")).toHaveCount(0);
  // DATA & LICENSES, the sibling control this sits next to, is still there —
  // proving the absence is deliberate (engine-gated), not a broken render.
  //
  // TR-113: scoped to the HUD's own button. `getByText` alone matches TWO nodes — this one and
  // the mobile navigation menu's `[data-mobile-menu-action="credits"]` item — so the original
  // assertion strict-mode-violated on a perfectly healthy build, independently of the render
  // freeze that was masking it.
  await expect(
    page
      .getByRole("button", { name: "DATA & LICENSES ▸" })
      .and(page.locator(":not([data-mobile-menu-action])")),
  ).toBeVisible();
});

test("disabling sdss-field disposes the mesh; re-enabling re-fetches it", async ({
  page,
}) => {
  test.setTimeout(60000);
  await boot(page);
  const engine = page.locator("babylon-scene");

  await expect
    .poll(async () => (await stats(engine)).sdssGalaxyCount, {
      timeout: 30000,
      intervals: POLL_INTERVALS,
    })
    .toBeGreaterThan(0);

  await page.getByText("RENDER ▸").click();
  const sdssCheckbox = page.getByLabel("SDSS DR18 DEEP FIELD");
  await expect(sdssCheckbox).toBeChecked();
  await sdssCheckbox.click();

  await expect
    .poll(async () => (await stats(engine)).sdssGalaxyCount, {
      intervals: POLL_INTERVALS,
    })
    .toBe(0);
  const afterDisable = await stats(engine);
  expect(
    (afterDisable.layers as Record<string, unknown>)["sdss-field"],
    "layer state reflects the disable",
  ).toBe(false);

  await sdssCheckbox.click();
  await expect
    .poll(async () => (await stats(engine)).sdssGalaxyCount, {
      timeout: 30000,
      intervals: POLL_INTERVALS,
    })
    .toBeGreaterThan(0);
});

test("disabling belt-visual disposes the mesh; re-enabling re-fetches it", async ({
  page,
}) => {
  test.setTimeout(60000);
  await boot(page);
  const engine = page.locator("babylon-scene");

  await expect
    .poll(async () => (await stats(engine)).asteroidVisualCount, {
      timeout: 30000,
      intervals: POLL_INTERVALS,
    })
    .toBeGreaterThan(0);

  await page.getByText("RENDER ▸").click();
  const beltCheckbox = page.getByLabel("GAIA DR3 ASTEROID BELT · VISUAL");
  await beltCheckbox.click();

  await expect
    .poll(async () => (await stats(engine)).asteroidVisualCount, {
      intervals: POLL_INTERVALS,
    })
    .toBe(0);

  await beltCheckbox.click();
  await expect
    .poll(async () => (await stats(engine)).asteroidVisualCount, {
      timeout: 30000,
      intervals: POLL_INTERVALS,
    })
    .toBeGreaterThan(0);
});

test("disabling belt-physics keeps the Havok bodies asleep even where the D2.1 distance fade would otherwise wake them", async ({
  page,
}) => {
  test.setTimeout(60000);
  await boot(page);
  const engine = page.locator("babylon-scene");

  await page.getByText("RENDER ▸").click();
  const beltPhysicsInput = page.getByLabel("GAIA DR3 ASTEROID BELT · PHYSICS");
  await beltPhysicsInput.fill("0");
  await page.keyboard.press("Escape");

  await travel(engine, "mars");
  // TR-113: `arrivedId` is a property on the ELEMENT, not a field of `sceneStats()` — this
  // spec's own EngineHandle type declares it as a sibling of `sceneStats`. Reading it through
  // `stats()` polled `undefined` for the full 40s and could never have passed; it was written
  // but never run. Every other spec in this suite reads it off the element directly.
  await expect
    .poll(() => arrivedId(engine), {
      timeout: 40000,
      intervals: POLL_INTERVALS,
    })
    .toBe("mars");

  const s = await stats(engine);
  expect(
    s.beltPhysicsAwake,
    "belt-physics layer disabled overrides the distance fade wanting it awake at Mars",
  ).toBe(false);
});

test("layer choices persist across reload via localStorage", async ({
  page,
}) => {
  test.setTimeout(60000);
  await boot(page);

  await page.getByText("RENDER ▸").click();
  await page.getByLabel("SDSS DR18 DEEP FIELD").click();
  await page.keyboard.press("Escape");

  await page.reload();
  await page.waitForSelector("babylon-scene");
  const engine = page.locator("babylon-scene");
  await expect
    .poll(
      async () =>
        (await stats(engine)).sdssGalaxyCount as number satisfies number,
      { timeout: 15000, intervals: POLL_INTERVALS },
    )
    .toBe(0);
  const s = await stats(engine);
  expect((s.layers as Record<string, unknown>)["sdss-field"]).toBe(false);
});

test("?layers= URL param wins over a stored preference and shows the override chip", async ({
  page,
}) => {
  test.setTimeout(60000);
  // Prime a stored preference that would otherwise enable sdss-field.
  await boot(page);
  await page.evaluate(() => {
    localStorage.setItem("ij-layers", JSON.stringify({ "sdss-field": true }));
  });

  await boot(page, "/?layers=sdss-field:0");
  const engine = page.locator("babylon-scene");
  await expect
    .poll(async () => (await stats(engine)).sdssGalaxyCount, {
      timeout: 15000,
      intervals: POLL_INTERVALS,
    })
    .toBe(0);

  await page.getByText("RENDER ▸").click();
  await expect(page.getByText("URL OVERRIDE")).toBeVisible();
  await expect(page.getByLabel("SDSS DR18 DEEP FIELD")).not.toBeChecked();
});

test("gaia-tiny renders as a disabled, always-off row (D8 has not shipped its data yet)", async ({
  page,
}) => {
  await boot(page);
  await page.getByText("RENDER ▸").click();
  const tinyCheckbox = page.getByLabel(/GAIA DR3 TINY.*not adjustable/);
  await expect(tinyCheckbox).toBeDisabled();
  // TR-113: this test's NAME always said "always-off" but it only ever asserted `toBeDisabled`,
  // so it passed while the row shipped TICKED — claiming 2.55M stars were being drawn from a
  // dataset that doesn't exist. The missing half of its own contract:
  await expect(tinyCheckbox).not.toBeChecked();
  await expect(page.getByText(/COMING IN A FUTURE UPDATE/)).toBeVisible();
});

test("bonus-stars is a real boot-time escape hatch: ?layers=bonus-stars:0 skips the merge", async ({
  page,
}) => {
  test.setTimeout(60000);
  // TR-113 (H1): the bonus-layer merge is the heaviest post-first-frame work the engine does
  // AND the path that made C1 unrecoverable, because nothing could switch it off. It is
  // `status: "reload"` — not live-toggleable, but skippable at boot.
  await boot(page, "/?layers=bonus-stars:0");
  const engine = page.locator("babylon-scene");

  await expect
    .poll(async () => (await stats(engine)).starCount, {
      timeout: 30000,
      intervals: POLL_INTERVALS,
    })
    .toBeGreaterThan(0);
  // Base catalog only — the merge would take this past 500,000.
  await page.waitForTimeout(8000);
  expect((await stats(engine)).starCount).toBeLessThan(200_000);
});

test("belt-physics cannot be driven past its ceiling from the URL", async ({
  page,
}) => {
  // TR-113 (M3): the count becomes a per-frame Havok rigid-body budget; every entry point
  // clamps, including a hand-typed share link.
  await boot(page, "/?layers=belt-physics:100000");
  const engine = page.locator("babylon-scene");
  const layers = (await stats(engine)).layers as Record<string, unknown>;
  expect(layers["belt-physics"]).toBe(192);
});
