/**
 * PF-11 D6.4 — the Earth home reveal and its orbit (owner requirement R16).
 *
 * WHAT MAKES THIS DIFFERENT FROM EVERY OTHER BODY, and why it needed its own path rather than a
 * catalog entry: this catalog's frame is GEOCENTRIC. Earth's direction is 0/0 and its distance is
 * 0 — not hard to measure, non-existent — and `bodyDepth(0)` would place it deeper than Neptune
 * (Astra, Earth brief §B3). So Earth must never be a `travelTo` destination; it is the origin,
 * revealed by `goHome`.
 *
 * The payoff is the phase angle, and it is the thing these specs actually guard. Every `travelTo`
 * arrival is pinned to 0.000° — the camera parks on the Sun-body line while `sunDirectionFrom`
 * returns the negated body direction, so V = L identically and no body in this scene can show a
 * terminator. At the origin those vectors decouple, and the home vantage is chosen at quadrature:
 * exactly 90°, held all the way around the orbit because the orbit axis IS the Sun direction.
 *
 * Assertions are behaviour through real state (CLAUDE.md #18), and the phase angle is recomputed
 * by `sceneStats()` from the live camera and Sun vectors rather than reported as the constant it
 * is supposed to be — so these tests can catch it being wrong, not just restate the intent.
 */
import { test, expect, type Locator } from "@playwright/test";

type EngineHandle = {
  sceneStats(): Record<string, unknown>;
  travelTo(id: string, quiet?: boolean): void;
  goHome(quiet?: boolean): void;
  arrivedId: string | null;
  cam: [number, number, number];
};

const stats = (en: Locator) =>
  en.evaluate((el) => (el as unknown as EngineHandle).sceneStats());
const cam = (en: Locator) =>
  en.evaluate((el) => (el as unknown as EngineHandle).cam);

/** Boot, dismiss the D1.2 gate, and wait for the real catalog. */
async function boot(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForSelector("babylon-scene");
  await page.getByRole("button", { name: "SKIP INTRO" }).click();
  const en = page.locator("babylon-scene");
  await expect
    .poll(async () => (await stats(en)).starSource, { timeout: 30000 })
    .toBe("catalog");
  return en;
}

test.describe("PF-11 D6.4 Earth home reveal", () => {
  test("Earth is revealed at the origin, and is NOT a travel destination", async ({
    page,
  }) => {
    test.setTimeout(150000);
    const en = await boot(page);

    // At BOOT the reveal must NOT be live. The camera sits at [0,0,0], which is inside a sphere
    // of radius 26 — revealing Earth there would put the camera inside the planet and fetch
    // ~2.5 MB of its textures during startup. The trigger is arriving home, not being near the
    // origin; the delivery plan's own name for this slice is the "goHome reveal".
    expect((await stats(en)).homeOrbit).toBe(false);
    expect((await stats(en)).planetSphereBody).toBeNull();

    // Travel away and back, and NOW it is revealed.
    await en.evaluate((el) => (el as unknown as EngineHandle).travelTo("moon"));
    await expect
      .poll(
        async () =>
          en.evaluate((el) => (el as unknown as EngineHandle).arrivedId),
        { timeout: 45000 },
      )
      .toBe("moon");
    await en.evaluate((el) => (el as unknown as EngineHandle).goHome());
    await expect
      .poll(async () => (await stats(en)).planetSphereBody, { timeout: 45000 })
      .toBe("earth");
    expect((await stats(en)).planetSphereVisible).toBe(true);

    // The rule that must not rot: Earth is unreachable by travel. `travelTo` looks Earth up in
    // `bodies`, which deliberately has no entry for it, so this is a no-op rather than a warp.
    await en.evaluate((el) =>
      (el as unknown as EngineHandle).travelTo("earth"),
    );
    await page.waitForTimeout(1200);
    expect(
      await en.evaluate((el) => (el as unknown as EngineHandle).arrivedId),
    ).toBeNull();
  });

  test("the home vantage sits at exactly 90° phase — the terminator geometry", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const en = await boot(page);
    // Travel away and come back, so this exercises the real goHome path rather than boot state.
    await en.evaluate((el) => (el as unknown as EngineHandle).travelTo("mars"));
    await expect
      .poll(
        async () =>
          en.evaluate((el) => (el as unknown as EngineHandle).arrivedId),
        { timeout: 45000 },
      )
      .toBe("mars");
    // Departing home must disarm the orbit.
    expect((await stats(en)).homeOrbit).toBe(false);

    await en.evaluate((el) => (el as unknown as EngineHandle).goHome());
    await expect
      .poll(async () => (await stats(en)).homeOrbit, { timeout: 45000 })
      .toBe(true);

    const s = await stats(en);
    expect(s.planetSphereBody).toBe("earth");
    expect(s.planetSphereVisible).toBe(true);
    // THE assertion. Recomputed from the live camera against the Sun's own catalog entry.
    expect(s.homePhaseDeg as number).toBeGreaterThan(88);
    expect(s.homePhaseDeg as number).toBeLessThan(92);
  });

  test("the orbit advances and HOLDS the 90° phase while it does", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const en = await boot(page);
    expect((await stats(en)).homeOrbit).toBe(false); // not armed until we arrive home
    await en.evaluate((el) => (el as unknown as EngineHandle).travelTo("moon"));
    await expect
      .poll(
        async () =>
          en.evaluate((el) => (el as unknown as EngineHandle).arrivedId),
        { timeout: 45000 },
      )
      .toBe("moon");
    await en.evaluate((el) => (el as unknown as EngineHandle).goHome());
    await expect
      .poll(async () => (await stats(en)).homeOrbit, { timeout: 45000 })
      .toBe(true);

    const before = await cam(en);
    const phaseBefore = (await stats(en)).homePhaseDeg as number;
    await page.waitForTimeout(5000);
    const after = await cam(en);
    const phaseAfter = (await stats(en)).homePhaseDeg as number;

    // The camera really moves — asserted as displacement rather than as a rate, because the rate
    // is wall-clock-derived and this environment's frame pacing is not something to pin.
    const moved = Math.hypot(
      after[0] - before[0],
      after[1] - before[1],
      after[2] - before[2],
    );
    expect(moved).toBeGreaterThan(0.5);

    // And the standoff is unchanged — it is an orbit, not a drift outward or inward.
    expect(Math.hypot(...after)).toBeCloseTo(Math.hypot(...before), 1);

    // The invariant that makes the orbit worth having: lighting does not change as it moves.
    expect(phaseAfter).toBeGreaterThan(88);
    expect(phaseAfter).toBeLessThan(92);
    expect(Math.abs(phaseAfter - phaseBefore)).toBeLessThan(1);
  });

  test("goHome from within the orbit is a no-op, not a re-warp", async ({
    page,
  }) => {
    test.setTimeout(120000);
    // The regression this guards is specific: "already home" used to mean |cam| < 1, and the
    // orbit sits at 38 units, so leaving that test alone would have made every goHome press
    // re-warp out of the orbit and back into it.
    const en = await boot(page);
    await en.evaluate((el) => (el as unknown as EngineHandle).travelTo("moon"));
    await expect
      .poll(
        async () =>
          en.evaluate((el) => (el as unknown as EngineHandle).arrivedId),
        { timeout: 45000 },
      )
      .toBe("moon");
    await en.evaluate((el) => (el as unknown as EngineHandle).goHome());
    await expect
      .poll(async () => (await stats(en)).homeOrbit, { timeout: 45000 })
      .toBe(true);

    const phaseBefore = (await stats(en)).homeOrbitPhaseDeg as number;
    await en.evaluate((el) => (el as unknown as EngineHandle).goHome());
    await page.waitForTimeout(800);
    const s = await stats(en);
    // Still in orbit, and the phase kept advancing from where it was rather than resetting to 0
    // (which is what a re-warp would do).
    expect(s.homeOrbit).toBe(true);
    expect(s.homeOrbitPhaseDeg as number).toBeGreaterThanOrEqual(phaseBefore);
  });

  test("reduced motion parks at the vantage instead of orbiting", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const en = await boot(page);
    await en.evaluate((el) => (el as unknown as EngineHandle).travelTo("moon"));
    await expect
      .poll(
        async () =>
          en.evaluate((el) => (el as unknown as EngineHandle).arrivedId),
        { timeout: 45000 },
      )
      .toBe("moon");
    await en.evaluate((el) => (el as unknown as EngineHandle).goHome());
    await expect
      .poll(async () => (await stats(en)).homeOrbit, { timeout: 45000 })
      .toBe(true);

    const before = await cam(en);
    await page.waitForTimeout(3000);
    const after = await cam(en);
    // Frozen — but frozen AT A REAL POSITION (phase 0 is the spec'd ra 160 / dec 0 vantage),
    // which is this repo's established reduced-motion pattern: not motionless at a default, but
    // motionless at the correct place. The sphere and its terminator are still there.
    for (let i = 0; i < 3; i++) expect(after[i]).toBeCloseTo(before[i], 3);
    const s = await stats(en);
    expect(s.planetSphereVisible).toBe(true);
    expect(s.homePhaseDeg as number).toBeGreaterThan(88);
    expect(s.homePhaseDeg as number).toBeLessThan(92);
  });
});
