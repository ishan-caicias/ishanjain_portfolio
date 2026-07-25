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
 *  - D2.3: the constellation figures dissolve on their OWN, nearer schedule
 *    (ly 50→500) — full at Mars, partial at Polaris (433 ly, inside the
 *    dissolve band), gone by M42 (1,344 ly) well before the local field's own
 *    extragalactic collapse would zero them anyway.
 *
 * Behaviour, not readiness (#18): the assertions drive real `travelTo`/`goHome`
 * and read `sceneStats()` fades, exactly as the D0.2 planet-pixel spec drives
 * the Babylon path. No `?engine=` override — the default engine is under test.
 */
import { test, expect, type Locator } from "@playwright/test";
import sharp from "sharp";

type EngineHandle = {
  sceneStats(): Record<string, unknown>;
  travelTo(id: string, quiet?: boolean): void;
  goHome(): void;
  aimAt(id: string): boolean;
  arrivedId: string | null;
};

const stats = (engine: Locator) =>
  engine.evaluate((el) => (el as unknown as EngineHandle).sceneStats());

const travel = (engine: Locator, id: string) =>
  engine.evaluate((el, i) => (el as unknown as EngineHandle).travelTo(i), id);

test("the frame ladder fades furniture, the band, and the constellation figures by destination (D2.1/D2.2/D2.3)", async ({
  page,
}) => {
  // Boots the full catalog scene, waits out the band's boot fade-in, and runs
  // five sequential journeys — well past the default 30s (planet-pixels.spec
  // sets the same budget for the same reason).
  // NAMED CHANGE (PF-11 D3.2, #15): journey-arrival poll budgets 20s → 40s and
  // the total 180s → 240s. ADR-0011's flip screen-time floor lengthens every
  // journey by ~1.1–1.3 s BY DESIGN (owner-flagged duration table), and under
  // SwiftShader this spec's own ~100 ms sceneStats polling starves rAF so that
  // frames land ~every 2 s while _dtWarpS caps each at 0.5 s — wall-clock runs
  // ~4× engine time (TR-089 measured multi-second evals; TR-094 derives the
  // 4× factor). 20 s budgets sat at the new margin and the failing LEG rotated
  // with load (polaris in isolation, home in the suite) — the same
  // near-zero-margin ceiling class TR-080/081 recalibrated. No assertion or
  // assertion value changed, time budgets only.
  //
  // NAMED CHANGE (2026-07-25 E2E audit, recommendation #3 — TR-104): every
  // `expect.poll` below now sets `intervals: POLL_INTERVALS` (500ms, then
  // 1000ms) instead of Playwright's default (100/250/500/1000ms escalating).
  // This is the fix this file's own comment above already diagnosed but never
  // applied — each `sceneStats()` poll is a real cross-context CDP
  // `evaluate()` round trip, and firing one every ~100ms competes with rAF for
  // the single SwiftShader-bound main thread. Widening the cadence gives the
  // render loop more uninterrupted time per tick; timeouts and every
  // assertion value are unchanged, only how often we ask.
  test.setTimeout(240000);
  const POLL_INTERVALS = [500, 1000];
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  // ?testhooks arms aimAt() — the impostor pixel proof below needs it. It
  // changes nothing else about the scene (same gate D0.2's spec uses).
  await page.goto("/?testhooks");
  await page.waitForSelector("babylon-scene");
  const engine = page.locator("babylon-scene");

  await expect
    .poll(async () => (await stats(engine)).starSource, {
      timeout: 20000,
      intervals: POLL_INTERVALS,
    })
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
  await expect
    .poll(arrivedId, { timeout: 40000, intervals: POLL_INTERVALS })
    .toBe("mars");
  await expect
    .poll(async () => (await stats(engine)).furnitureFade, {
      timeout: 15000,
      intervals: POLL_INTERVALS,
    })
    .toBe(1);
  {
    const s = await stats(engine);
    expect(s.beltPhysicsAwake, "belt physics awake at Mars").toBe(true);
    expect(s.localFieldFade, "local field intact at Mars").toBe(1);
    expect(s.impostorVisible, "no impostor at Mars").toBe(false);
    expect(s.figureFade, "constellation figures visible at Mars").toBe(1);
  }

  // --- Polaris (433 ly): inside the D2.3 dissolve band (50→500) — the
  // figures are partially faded here, distinct from (and nearer than) the
  // M42/nbg checkpoints below. ---
  await travel(engine, "polaris");
  await expect
    .poll(arrivedId, { timeout: 40000, intervals: POLL_INTERVALS })
    .toBe("polaris");
  {
    const s = await stats(engine);
    const figureFade = s.figureFade as number;
    expect(
      figureFade,
      "figures partially dissolved at Polaris (inside ly 50-500)",
    ).toBeGreaterThan(0);
    expect(
      figureFade,
      "figures partially dissolved at Polaris (inside ly 50-500)",
    ).toBeLessThan(1);
    expect(s.localFieldFade, "local field intact at Polaris").toBe(1);
  }

  // --- M42 (1,344 ly): furniture GONE, but still inside the galaxy. ---
  await travel(engine, "m42");
  await expect
    .poll(arrivedId, { timeout: 40000, intervals: POLL_INTERVALS })
    .toBe("m42");
  await expect
    .poll(async () => (await stats(engine)).furnitureFade, {
      timeout: 15000,
      intervals: POLL_INTERVALS,
    })
    .toBe(0);
  {
    const s = await stats(engine);
    expect(s.beltPhysicsAwake, "belt physics asleep at a DSO").toBe(false);
    expect(s.localFieldFade, "the band still reads inside the galaxy").toBe(1);
    expect(s.impostorVisible, "no impostor inside the galaxy").toBe(false);
    // Past the D2.3 dissolve band (1,344 ly > FIGURE_GONE_LY) — the figures
    // are gone here on their OWN schedule, independent of the band/star
    // field, which are still present (localFieldFade above).
    expect(s.figureFade, "constellation figures gone past ly 500").toBe(0);
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
  await expect
    .poll(arrivedId, { timeout: 40000, intervals: POLL_INTERVALS })
    .toBe("nbg-a0554-07");
  await expect
    .poll(async () => (await stats(engine)).localFieldFade, {
      timeout: 15000,
      intervals: POLL_INTERVALS,
    })
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
    expect(
      s.figureFade,
      "constellation figures gone at an extragalactic arrival",
    ).toBe(0);
  }

  // --- PIXEL PROOF: the impostor renders real pixels, not just a state flag. ---
  // Added by the Fable-5 review (TR-090 addendum): the first implementation
  // placed the impostor world-fixed at 1800 from the ORIGIN — ~2840 from the
  // camera at this arrival, beyond the band skybox's opaque depth-writing shell
  // at 2000-from-camera, so every fragment depth-failed. `impostorVisible` was
  // true throughout; zero pixels reached the screen (the B4 state-correct-but-
  // no-pixels class). This assertion is what would have caught it.
  {
    const aimed = await engine.evaluate((el) =>
      (el as unknown as EngineHandle).aimAt("impostor"),
    );
    expect(aimed, "aimAt('impostor') should arm under ?testhooks").toBe(true);
    // aimAt only sets _yaw/_pitch; the idle tick re-derives the camera next
    // pass (same margin the D0.2 spec uses).
    await page.waitForTimeout(300);
    const png = await page.locator("babylon-scene canvas").screenshot();
    const { data, info } = await sharp(png)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // The disc subtends ~3.4° × ~1.2° (floored size 45 at distance 1500 under
    // the 70° FOV) — a tight 10% centre crop sits on it once aimed, against a
    // near-black background (band collapsed, local field gone, SDSS specks).
    const cropFrac = 0.1;
    const x0 = Math.floor(info.width * (0.5 - cropFrac / 2));
    const x1 = Math.floor(info.width * (0.5 + cropFrac / 2));
    const y0 = Math.floor(info.height * (0.5 - cropFrac / 2));
    const y1 = Math.floor(info.height * (0.5 + cropFrac / 2));
    let sum = 0;
    let sumSq = 0;
    let bright = 0;
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * info.width + x) * info.channels;
        const lum =
          0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
        sum += lum;
        sumSq += lum * lum;
        if (lum > 25) bright++;
        n++;
      }
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    // A depth-occluded impostor gives a black crop (mean ≈ 0, bright ≈ 0); the
    // rendered disc gives a bright core over black (high variance, real bright
    // pixels). Floors deliberately conservative vs the measured signal.
    expect(mean, "impostor centre-crop mean luminance").toBeGreaterThan(1);
    expect(variance, "impostor centre-crop variance").toBeGreaterThan(20);
    expect(bright, "impostor bright-pixel count").toBeGreaterThan(30);
  }

  // --- Return home: everything restores; the impostor is gone. ---
  await engine.evaluate((el) => (el as unknown as EngineHandle).goHome());
  await expect
    .poll(async () => (await stats(engine)).homeOrbit, {
      timeout: 40000,
      intervals: POLL_INTERVALS,
    })
    .toBe(true);
  // Let the home orbit settle a couple of frames past the arrival tick.
  await expect
    .poll(async () => (await stats(engine)).localFieldFade, {
      timeout: 15000,
      intervals: POLL_INTERVALS,
    })
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
    expect(s.figureFade, "constellation figures restored at home").toBe(1);
  }

  // The whole ladder must run without a WebGPU/console error (#6 — a bad
  // sampler bind or reserved id shows up only here).
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
