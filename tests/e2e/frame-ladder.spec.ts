/**
 * PF-11 D2 — the frame ladder, on the DEFAULT (Babylon) engine.
 *
 * Astra's brief (§1-2) makes two claims the scene must now honour by
 * DESTINATION distance, and this spec walks the whole ladder in one boot:
 *
 *  - D2.1: solar-system furniture (belt + its Havok physics) is present at a
 *    planet (Mars) and GONE at any DSO (M42, 1,344 ly) — the belt subtends
 *    16 mas from there, so a visible ring is wrong by ~7 orders of magnitude.
 *  - D2.2: the whole local Milky Way (the 360° band) collapses at an
 *    extragalactic arrival (nbg-a0554-07, 17.9 Mly), where the external-galaxy
 *    impostor appears instead — and RESTORES on the way home.
 *
 * Behaviour, not readiness (#18): the assertions drive real `travelTo`/`goHome`
 * and read `sceneStats()` fades, exactly as the D0.2 planet-pixel spec drives
 * the Babylon path. No `?engine=` override — the default engine is under test.
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

test("the frame ladder fades furniture and the band by destination (D2.1/D2.2)", async ({
  page,
}) => {
  // Boots the full catalog scene, waits out the band's boot fade-in, and runs
  // four sequential journeys — well past the default 30s (planet-pixels.spec
  // sets the same budget for the same reason).
  test.setTimeout(150000);
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await page.goto("/");
  await page.waitForSelector("babylon-scene");
  const engine = page.locator("babylon-scene");

  await expect
    .poll(async () => (await stats(engine)).starSource, { timeout: 20000 })
    .not.toBeNull();

  const arrivedId = () =>
    engine.evaluate((el) => (el as unknown as EngineHandle).arrivedId);

  // The band fades IN over boot at its own slow ramp (independent of the frame
  // ladder). We don't wait it out — instead the collapse is proven RELATIVELY:
  // `bandFade` = bandFadeAmt × localFieldFade, so it drops to exactly 0 at an
  // extragalactic arrival regardless of the ramp, and recovers to ≥ its
  // pre-collapse value on the way home (bandFadeAmt only ever grows).
  let bandPreCollapse = 0;

  // --- Mars: solar-system furniture present, band not collapsed, no impostor. ---
  await travel(engine, "mars");
  await expect.poll(arrivedId, { timeout: 20000 }).toBe("mars");
  await expect
    .poll(async () => (await stats(engine)).furnitureFade, { timeout: 15000 })
    .toBe(1);
  {
    const s = await stats(engine);
    expect(s.beltPhysicsAwake, "belt physics awake at Mars").toBe(true);
    expect(s.localFieldFade, "local field intact at Mars").toBe(1);
    expect(s.impostorVisible, "no impostor at Mars").toBe(false);
  }

  // --- M42 (1,344 ly): furniture GONE, but still inside the galaxy. ---
  await travel(engine, "m42");
  await expect.poll(arrivedId, { timeout: 20000 }).toBe("m42");
  await expect
    .poll(async () => (await stats(engine)).furnitureFade, { timeout: 15000 })
    .toBe(0);
  {
    const s = await stats(engine);
    expect(s.beltPhysicsAwake, "belt physics asleep at a DSO").toBe(false);
    expect(s.localFieldFade, "the band still reads inside the galaxy").toBe(1);
    expect(s.impostorVisible, "no impostor inside the galaxy").toBe(false);
    // The band IS present here (ramping in); capture it for the collapse/restore
    // comparison below.
    bandPreCollapse = s.bandFade as number;
    expect(
      bandPreCollapse,
      "band present (ramping) inside the galaxy",
    ).toBeGreaterThan(0);
  }

  // --- nbg-a0554-07 (17.9 Mly): the local galaxy collapses to the impostor. ---
  await travel(engine, "nbg-a0554-07");
  await expect.poll(arrivedId, { timeout: 20000 }).toBe("nbg-a0554-07");
  await expect
    .poll(async () => (await stats(engine)).localFieldFade, { timeout: 15000 })
    .toBe(0);
  {
    const s = await stats(engine);
    expect(s.bandFade, "no 360° band at an extragalactic arrival").toBe(0);
    expect(s.impostorVisible, "the external-galaxy impostor appears").toBe(
      true,
    );
    expect(s.impostorTextureReady, "impostor texture bound").toBe(true);
    expect(s.beltPhysicsAwake, "belt asleep beyond the solar system").toBe(
      false,
    );
  }

  // --- Return home: everything restores; the impostor is gone. ---
  await engine.evaluate((el) => (el as unknown as EngineHandle).goHome());
  await expect
    .poll(async () => (await stats(engine)).homeOrbit, { timeout: 20000 })
    .toBe(true);
  // Let the home orbit settle a couple of frames past the arrival tick.
  await expect
    .poll(async () => (await stats(engine)).localFieldFade, { timeout: 15000 })
    .toBe(1);
  {
    const s = await stats(engine);
    expect(s.furnitureFade, "furniture restored at home").toBe(1);
    // The band is back (uncollapsed), at least where it was before nbg — the
    // boot ramp only grows, so this proves restoration, not just "> 0".
    expect(
      s.bandFade as number,
      "the band is back over home",
    ).toBeGreaterThanOrEqual(bandPreCollapse);
    expect(s.bandFade as number, "the band is present at home").toBeGreaterThan(
      0,
    );
    expect(s.impostorVisible, "impostor gone at home").toBe(false);
    expect(s.beltPhysicsAwake, "belt physics awake at home").toBe(true);
  }

  // The whole ladder must run without a WebGPU/console error (#6 — a bad
  // sampler bind or reserved id shows up only here).
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
