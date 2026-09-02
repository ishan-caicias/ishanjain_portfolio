/**
 * PF-11 TR-103 — planet-class arrival standoff + user zoom control (owner-reported: "camera
 * pointing away from Mars on arrival, zoom out a little so the star field is also partially
 * visible" + "add a zoom in/out feature"; Vega SHOT-BRIEF).
 *
 * Drives the REAL wheel/keyboard input paths (CLAUDE.md #18) rather than calling the private
 * `_adjustZoom` method directly, so a defect in the actual event wiring (wrong element, wrong
 * event type, a stale listener) would fail these tests, not just a reimplementation of the math
 * (already covered separately in `tests/unit/ship-dynamics.test.ts`'s `clampZoomDistance`/
 * `dampScalar` tests).
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

type EngineHandle = {
  sceneStats(): Record<string, unknown>;
  travelTo(id: string, quiet?: boolean): void;
  arrivedId: string | null;
  warp: { mode: string };
  cam: [number, number, number];
  bodies: {
    e: { id: string; t?: string };
    pos: [number, number, number];
    vis?: boolean;
    sx?: number;
    sy?: number;
  }[];
};

async function boot(page: Page): Promise<Locator> {
  await page.goto("/?engine=babylon&testhooks");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });
  await page.getByRole("button", { name: "SKIP INTRO" }).click();
  const en = page.locator("babylon-scene");
  await expect
    .poll(
      async () =>
        (
          (await en.evaluate((el) =>
            (el as unknown as EngineHandle).sceneStats(),
          )) as Record<string, unknown>
        ).starSource,
      { timeout: 30000 },
    )
    .toBe("catalog");
  return en;
}

async function travelAndWait(
  en: Locator,
  id: string,
): Promise<{ dist: number }> {
  await en.evaluate(
    (el, bodyId) => (el as unknown as EngineHandle).travelTo(bodyId),
    id,
  );
  await expect
    .poll(
      async () =>
        en.evaluate((el) => (el as unknown as EngineHandle).arrivedId),
      { timeout: 60000 },
    )
    .toBe(id);
  const dist = await en.evaluate((el, bodyId) => {
    const eng = el as unknown as EngineHandle;
    const b = eng.bodies.find((x) => x.e.id === bodyId)!;
    return Math.hypot(
      eng.cam[0] - b.pos[0],
      eng.cam[1] - b.pos[1],
      eng.cam[2] - b.pos[2],
    );
  }, id);
  return { dist };
}

async function currentZoomDist(en: Locator, id: string): Promise<number> {
  return en.evaluate((el, bodyId) => {
    const eng = el as unknown as EngineHandle;
    const b = eng.bodies.find((x) => x.e.id === bodyId)!;
    return Math.hypot(
      eng.cam[0] - b.pos[0],
      eng.cam[1] - b.pos[1],
      eng.cam[2] - b.pos[2],
    );
  }, id);
}

/** Dispatches a real WheelEvent on the canvas — the exact path `_bindPointer`'s new zoom
 * listener actually wires up, not a call to the private `_adjustZoom` method. */
async function wheelZoom(page: Page, deltaY: number, ticks = 1) {
  for (let i = 0; i < ticks; i++) {
    await page.evaluate((dy) => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      canvas.dispatchEvent(
        new WheelEvent("wheel", { deltaY: dy, bubbles: true }),
      );
    }, deltaY);
    // One rAF settle so the eased _zoomDist has a tick to move before the next input.
    await page.evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => r())),
    );
  }
  // Let the spring converge close to its target before reading the result.
  await page.waitForTimeout(500);
}

test.describe("Camera zoom (PF-11 TR-103)", () => {
  test("a planet-class arrival (Mars) parks farther back than a star-class arrival (Sirius) — the new PLANET_ARRIVE_STANDOFF", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    const mars = await travelAndWait(en, "mars");
    // PLANET_ARRIVE_STANDOFF = 80, well clear of the old universal ARRIVE_STANDOFF = 38 — a
    // generous threshold (60) so this doesn't become a brittle exact-pixel assertion while
    // still failing hard if the type-based branch in travelTo regresses to the old constant.
    expect(mars.dist).toBeGreaterThan(60);

    await en.evaluate((el) =>
      (el as unknown as EngineHandle).travelTo("sirius"),
    );
    await expect
      .poll(
        async () =>
          en.evaluate((el) => (el as unknown as EngineHandle).arrivedId),
        { timeout: 60000 },
      )
      .toBe("sirius");
    const siriusDist = await currentZoomDist(en, "sirius");
    expect(siriusDist).toBeCloseTo(38, 0);
  });

  test("scrolling the wheel over the canvas zooms out, then back in, via the real input path", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    const arrival = await travelAndWait(en, "mars");

    // Positive deltaY (scroll down) = zoom OUT, the natural map/inspection-camera mapping.
    await wheelZoom(page, 300, 3);
    const zoomedOut = await currentZoomDist(en, "mars");
    expect(
      zoomedOut,
      "scrolling down should have moved the camera farther from Mars",
    ).toBeGreaterThan(arrival.dist * 1.1);

    // Negative deltaY (scroll up) = zoom IN, back toward (not necessarily past) arrival.
    await wheelZoom(page, -300, 3);
    const zoomedIn = await currentZoomDist(en, "mars");
    expect(
      zoomedIn,
      "scrolling up should have moved the camera back closer than the zoomed-out point",
    ).toBeLessThan(zoomedOut);
  });

  test("zoom respects its bounds — cannot be scrolled through the planet surface or off to infinity", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    await travelAndWait(en, "mars");

    // One large single wheel delta reaches the CLAMPED TARGET in one dispatch —
    // `_adjustZoom`'s step is proportional to `deltaY`, so this needs far fewer round
    // trips than many small ticks to set the same target. Reaching it is a different
    // question: the eased approach (`dampScalar`) converges against ACCUMULATED
    // in-engine dt, which is itself capped per frame (`SHIP_MAX_DT` = 50ms) — under a
    // slow/contended render rate (SwiftShader, documented elsewhere in this repo:
    // TR-032/033/081/094/096/097), a fixed wall-clock wait can undershoot convergence
    // for a jump this large even though the TARGET itself is already correctly
    // clamped. `expect.poll` waits for genuine convergence instead of guessing a
    // wall-clock duration, matching every other asynchronous-settle assertion in this
    // suite (warp arrivals, vista dismissal, etc.).
    await wheelZoom(page, -6000, 1);
    await expect
      .poll(() => currentZoomDist(en, "mars"), { timeout: 15000 })
      .toBeLessThan(40);
    const zoomedInFloor = await currentZoomDist(en, "mars");
    // PLANET_SPHERE_RADIUS (26) + PLANET_ZOOM_NEAR_MARGIN (5) = 31 — clamped there, not 0
    // and not negative (which would mean the camera passed through the sphere).
    expect(zoomedInFloor).toBeGreaterThan(25);

    await wheelZoom(page, 6000, 1);
    await expect
      .poll(() => currentZoomDist(en, "mars"), { timeout: 15000 })
      .toBeGreaterThan(200);
    const zoomedOutCeiling = await currentZoomDist(en, "mars");
    // PLANET_ARRIVE_STANDOFF (80) * ZOOM_MAX_MULT (3) = 240 — clamped there, not unbounded.
    expect(zoomedOutCeiling).toBeLessThan(260);
  });

  test("keyboard +/- zooms the same way as the wheel, via the real key-handling path", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    const arrival = await travelAndWait(en, "mars");

    // _bindKeys attaches its keydown listener to the engine element itself, which needs
    // real DOM focus (tabIndex=0) to receive it — the same requirement the existing
    // arrow-key/Enter/H handlers already have.
    await en.evaluate((el) => (el as unknown as HTMLElement).focus());
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("-");
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(500);
    const zoomedOut = await currentZoomDist(en, "mars");
    expect(
      zoomedOut,
      "pressing '-' repeatedly should zoom out from the arrival distance",
    ).toBeGreaterThan(arrival.dist * 1.1);

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("+");
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(500);
    const zoomedIn = await currentZoomDist(en, "mars");
    expect(
      zoomedIn,
      "pressing '+' repeatedly should zoom back in from the zoomed-out distance",
    ).toBeLessThan(zoomedOut);
  });

  test("zooming does not change orientation — the aim-fix framing (TR-102) survives zoom", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    await travelAndWait(en, "mars");

    await wheelZoom(page, 300, 3);

    // Read Mars's own PROJECTED screen position directly, rather than `_hoverId` — `_pick`
    // has a pre-existing (not introduced by this feature) planet-sphere self-occlusion
    // quirk where the arrived body's own catalog point can be nulled out by the occlusion
    // check meant for OTHER bodies behind its rendered sphere, since the sphere's near
    // surface is always closer than the point it represents. That's a separate, narrower
    // concern from what this test actually exists to prove: that zoom is a pure dolly
    // along the FIXED arrival bearing (never an orbit), so Mars's projected position stays
    // at screen-centre regardless of standoff distance. `_projectBody` runs unconditionally
    // inside `_pick` before that occlusion check, so a real pointermove still refreshes
    // `sx`/`sy` correctly even though `_hoverId` itself isn't the right signal here.
    await en.evaluate(() => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          pointerId: 1,
          bubbles: true,
        }),
      );
    });
    const proj = await en.evaluate((el) => {
      const eng = el as unknown as EngineHandle;
      const b = eng.bodies.find((x) => x.e.id === "mars")!;
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      return { sx: b.sx, sy: b.sy, cx: rect.width / 2, cy: rect.height / 2 };
    });
    expect(
      Math.abs(proj.sx! - proj.cx),
      `Mars's projected screen X (${proj.sx}) should stay within a few px of canvas centre (${proj.cx}) after zooming`,
    ).toBeLessThan(5);
    expect(
      Math.abs(proj.sy! - proj.cy),
      `Mars's projected screen Y (${proj.sy}) should stay within a few px of canvas centre (${proj.cy}) after zooming`,
    ).toBeLessThan(5);
  });
});
