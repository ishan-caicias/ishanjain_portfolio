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
import { test, expect, type Locator } from "@playwright/test";

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

const POLL_INTERVALS = [500, 1000];

test("RENDER ▸ opens the console, focuses it, and Escape closes it", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector("babylon-scene");

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
  await page.goto("/?engine=webgl");
  await page.waitForSelector("space-engine");
  await expect(page.getByText("RENDER ▸")).toHaveCount(0);
  // DATA & LICENSES, the sibling control this sits next to, is still there —
  // proving the absence is deliberate (engine-gated), not a broken render.
  await expect(page.getByText("DATA & LICENSES ▸")).toBeVisible();
});

test("disabling sdss-field disposes the mesh; re-enabling re-fetches it", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.waitForSelector("babylon-scene");
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
  await page.goto("/");
  await page.waitForSelector("babylon-scene");
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
  await page.goto("/");
  await page.waitForSelector("babylon-scene");
  const engine = page.locator("babylon-scene");

  await page.getByText("RENDER ▸").click();
  const beltPhysicsInput = page.getByLabel("GAIA DR3 ASTEROID BELT · PHYSICS");
  await beltPhysicsInput.fill("0");
  await page.keyboard.press("Escape");

  await travel(engine, "mars");
  await expect
    .poll(async () => (await stats(engine)).arrivedId, {
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
  await page.goto("/");
  await page.waitForSelector("babylon-scene");

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
  await page.goto("/");
  await page.waitForSelector("babylon-scene");
  await page.evaluate(() => {
    localStorage.setItem("ij-layers", JSON.stringify({ "sdss-field": true }));
  });

  await page.goto("/?layers=sdss-field:0");
  await page.waitForSelector("babylon-scene");
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
  await page.goto("/");
  await page.waitForSelector("babylon-scene");
  await page.getByText("RENDER ▸").click();
  const tinyCheckbox = page.getByLabel(/GAIA DR3 TINY.*not adjustable/);
  await expect(tinyCheckbox).toBeDisabled();
  await expect(page.getByText(/COMING IN A FUTURE UPDATE/)).toBeVisible();
});
