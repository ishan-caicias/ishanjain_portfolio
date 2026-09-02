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

test("gaia-tiny is a live, off-by-default count layer (PF-11 D8, ADR-0012)", async ({
  page,
}) => {
  await boot(page);
  const engine = page.locator("babylon-scene");
  await page.getByText("RENDER ▸").click();
  const tinyInput = page.getByLabel(/GAIA DR3 TINY · FULL BACKGROUND FIELD/);
  await expect(tinyInput).toBeEnabled();
  await expect(tinyInput).toHaveValue("0");
  await expect(page.getByText(/COMING IN A FUTURE UPDATE/)).toHaveCount(0);
  expect((await stats(engine)).gaiaTinyCount).toBe(0);
});

test("gaia-tiny chunk-prefix partial enable fetches only that many chunks, brightest first", async ({
  page,
}) => {
  test.setTimeout(60000);
  // Mirrors the belt-physics ceiling test's ?layers= entry point — a chunk-prefix count is the
  // same "COUNT layer" shape, not a boolean.
  await boot(page, "/?layers=gaia-tiny:3");
  const engine = page.locator("babylon-scene");

  await expect
    .poll(async () => (await stats(engine)).gaiaTinyEnabledChunks, {
      timeout: 30000,
      intervals: POLL_INTERVALS,
    })
    .toBe(3);
  const s = await stats(engine);
  expect(
    s.gaiaTinyCount,
    "3 of 8 chunks worth of stars are rendering",
  ).toBeGreaterThan(0);
  expect((s.layers as Record<string, unknown>)["gaia-tiny"]).toBe(3);
});

test("gaia-tiny: shrinking then re-growing the chunk-prefix count never re-fetches (instant either direction)", async ({
  page,
}) => {
  test.setTimeout(60000);
  await boot(page, "/?layers=gaia-tiny:2");
  const engine = page.locator("babylon-scene");
  // TR-115 fix to a TR-114 race: poll the DECODED STAR COUNT, not just the chunk index.
  // `_setGaiaTinyChunks` assigns `_gaiaTinyEnabledChunks = target` BEFORE the fetch/decode
  // resolves, so `gaiaTinyEnabledChunks === 2` is true while `gaiaTinyCount` is still 0 —
  // and `countAt2` would capture 0, making the later `toBeLessThan(countAt2)` unsatisfiable.
  // It passed in TR-114 only because the decode happened to win that race.
  await expect
    .poll(async () => (await stats(engine)).gaiaTinyCount, {
      timeout: 30000,
      intervals: POLL_INTERVALS,
    })
    .toBeGreaterThan(0);
  const countAt2 = (await stats(engine)).gaiaTinyCount as number;
  expect((await stats(engine)).gaiaTinyEnabledChunks).toBe(2);

  await page.getByText("RENDER ▸").click();
  const tinyInput = page.getByLabel(/GAIA DR3 TINY · FULL BACKGROUND FIELD/);
  await tinyInput.fill("1");
  // Shrink is a pure visibility toggle — near-instant, no network wait needed.
  await expect
    .poll(async () => (await stats(engine)).gaiaTinyEnabledChunks, {
      intervals: POLL_INTERVALS,
    })
    .toBe(1);
  expect((await stats(engine)).gaiaTinyCount as number).toBeLessThan(countAt2);

  await tinyInput.fill("2");
  // Growing back to an already-fetched chunk is also instant — no fresh network fetch is
  // observable from here, but the count must land back at exactly what it was before.
  await expect
    .poll(async () => (await stats(engine)).gaiaTinyCount, {
      intervals: POLL_INTERVALS,
    })
    .toBe(countAt2);
});

test("disabling gaia-tiny (count -> 0) disposes every chunk mesh", async ({
  page,
}) => {
  test.setTimeout(60000);
  await boot(page, "/?layers=gaia-tiny:2");
  const engine = page.locator("babylon-scene");
  await expect
    .poll(async () => (await stats(engine)).gaiaTinyEnabledChunks, {
      timeout: 30000,
      intervals: POLL_INTERVALS,
    })
    .toBe(2);

  await page.getByText("RENDER ▸").click();
  await page.getByLabel(/GAIA DR3 TINY · FULL BACKGROUND FIELD/).fill("0");
  await expect
    .poll(async () => (await stats(engine)).gaiaTinyCount, {
      intervals: POLL_INTERVALS,
    })
    .toBe(0);
  const s = await stats(engine);
  expect((s.layers as Record<string, unknown>)["gaia-tiny"]).toBe(0);
});

test("gaia-tiny cannot be driven past its 8-chunk ceiling from the URL", async ({
  page,
}) => {
  // TR-115 fix to a TR-114 oversight: this is a pure `clampLayerValue` assertion, but booting
  // with the clamped value ALSO kicks off a real fetch of all 8 chunks (36.8 MB, ~2.44M records
  // decoded on SwiftShader). That comfortably exceeds the 30s default under full-suite load —
  // it timed out in the suite while passing in isolation. The budget is raised to match what
  // the test actually does; no assertion is weakened.
  test.setTimeout(90000);
  await boot(page, "/?layers=gaia-tiny:9999");
  const engine = page.locator("babylon-scene");
  const layers = (await stats(engine)).layers as Record<string, unknown>;
  expect(layers["gaia-tiny"]).toBe(8);
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
