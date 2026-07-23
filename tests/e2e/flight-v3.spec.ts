// PINNED TO ?engine=webgl at the ADR-0006 cutover (declared test change):
// this spec guards the ARCHIVED legacy engine during its one-release archival
// window. Babylon-path coverage lives in the engine-select/accessibility/
// perf-budgets/webgpu-hardware specs.
//
// GAP-17 DISPOSITION (2026-07-20, TR-060): the first 3 tests below stay
// pinned deliberately, not as a residual gap — they drive space-engine.js's
// OWN internal API (`_tick(now)`, `.gl`, `.yaw`/`.pitch` as PUBLIC fields)
// with a synthetic-clock harness that has no Babylon equivalent to port to,
// because babylon-engine.ts has no exposed synchronous tick method the same
// way (its render loop only runs via `engine.runRenderLoop`). More to the
// point: test 3's premise ("the camera holds still during aim while the ship
// turns") describes the ARCHIVED engine's specific choreography, which isn't
// how Babylon's aim phase works BY DESIGN — babylon-engine.ts's camera
// itself previews the turn during aim (see that file's WarpMode comment);
// porting this test literally would assert behaviour Babylon was never
// built to have. Test 4 (free-look drag, wall-clock, real UI — no synthetic
// ticks) WAS genuinely portable and now has a direct Babylon-native sibling
// in engine-select.spec.ts, alongside a new accel→flip→decel strict-
// ordering test closing the rest of GAP-17's real gap (the choreography
// itself being unverified on the default engine). See engine-select.spec.ts
// for both.
/**
 * PF-08 F2 — 360° travel choreography + chase camera (incl. the 2026-07-18
 * owner amendments: 30°-elevated thruster chase, ship-turns launch).
 *
 * Covers the phase-F2 exit criteria: a full journey runs the real flight
 * sequence (burn → flip → brake → arrive), the camera holds still during the
 * aim phase while the SHIP turns toward the clicked target, the chase then
 * pans the look during the burn, and free-look drag stays authoritative over
 * the chase (the plan's named UX risk).
 *
 * The three flight-model specs drive the engine's _tick with SYNTHETIC 60 fps
 * timestamps (real engine, real browser, simulated clock): under parallel
 * Playwright workers the WebGL pages drop to single-digit fps, wall-clock
 * windows (the 900 ms aim, the 144 ms flip) fall between frames, and both
 * protocol round-trips and in-page timers are starved — see TR-025 for the
 * flake history. The click-through journey path (nav link → warp → dossier)
 * stays covered wall-clock by space-scene.spec.ts and the drag spec below.
 * Each spec also waits for the engine's nav stations to register: travelTo
 * before SpaceScene calls setStations() is a silent no-op.
 *
 * The harness ALSO requires a live GL context (TR-054). `_tick()` no-ops
 * outright while the context is lost (space-engine.js:1970), and the synthetic
 * loop is synchronous — a context lost mid-loop can never be restored inside
 * it, because restoration is delivered as a DOM event. Headless SwiftShader
 * drops and restores this page's context ~2 s in (~1 s outage, engine recovers
 * correctly via _rebuildGL), which is precisely when these specs used to begin
 * ticking: every tick no-opped, the warp state machine froze in "aim", and the
 * specs reported 0 warp samples. That read as "the aim math doesn't advance
 * under manual ticking" — it was an unstated precondition, not broken math.
 */
import { expect, test, type Page } from "@playwright/test";

const waitForStations = (page: Page) =>
  page.waitForFunction(
    () => {
      const en = document.querySelector("space-engine") as unknown as {
        stations?: unknown[];
      } | null;
      return !!en && (en.stations?.length ?? 0) > 0;
    },
    { timeout: 15000 },
  );

/** Gate the synthetic-tick harness on a CONTINUOUSLY healthy GL context.
 * Any loss resets the stability window, so this clears only once the context
 * has survived a span longer than the observed SwiftShader outage — and after
 * the craft load (which shares the context) has settled either way. */
const waitForLiveContext = (page: Page) =>
  page.waitForFunction(
    () => {
      const w = window as unknown as { __ctxStableFrom?: number };
      const en = document.querySelector("space-engine") as unknown as {
        gl?: { isContextLost: () => boolean } | null;
        _ctxLost?: boolean;
        dataset?: DOMStringMap;
      } | null;
      const healthy =
        !!en &&
        !!en.gl &&
        !en._ctxLost &&
        !en.gl.isContextLost() &&
        en.dataset?.craftState !== "loading";
      if (!healthy) {
        w.__ctxStableFrom = 0;
        return false;
      }
      const t = performance.now();
      if (!w.__ctxStableFrom) {
        w.__ctxStableFrom = t;
        return false;
      }
      return t - w.__ctxStableFrom > 1500;
    },
    { timeout: 25000 },
  );

/** Both preconditions, in the order the engine satisfies them. */
const waitForTickableEngine = async (page: Page) => {
  await waitForStations(page);
  await waitForLiveContext(page);
};

/** Run a full synthetic journey to st-about at a simulated 60 fps and return
 * everything the specs assert on. Resumes the live rAF loop afterwards. */
const flyToAbout = (page: Page) =>
  page.evaluate(() => {
    const en = document.querySelector("space-engine") as unknown as {
      _raf: number;
      _kick: () => void;
      _tick: (t: number) => void;
      travelTo: (id: string) => void;
      yaw: number;
      pitch: number;
      arrivedId: string | null;
      warp: { mode: string };
      gl: { isContextLost: () => boolean } | null;
      _ctxLost: boolean;
      _frame: number;
    };
    cancelAnimationFrame(en._raf);
    // _tick() is a no-op while the context is lost; a loss here would silently
    // produce zero samples, so surface it as a first-class result (TR-054).
    const ctxDown = () => !en.gl || en._ctxLost || en.gl.isContextLost();
    let ctxLostDuringRun = ctxDown();
    const framesAtStart = en._frame;
    const phases: string[] = [];
    const arrived: string[] = [];
    const onWarp = ((e: CustomEvent) => {
      const p = e.detail?.phase;
      if (p && phases[phases.length - 1] !== p) phases.push(p);
    }) as EventListener;
    const onArrive = ((e: CustomEvent) => {
      arrived.push(e.detail?.id);
    }) as EventListener;
    window.addEventListener("cosmos:warp", onWarp);
    window.addEventListener("cosmos:arrive", onArrive);
    const aimYaws: number[] = [];
    const aimPitches: number[] = [];
    const warpYaws: number[] = [];
    let now = performance.now();
    en.travelTo("st-about");
    for (let f = 0; f < 400 && !en.arrivedId; f++) {
      now += 16;
      en._tick(now);
      if (ctxDown()) {
        ctxLostDuringRun = true;
        break;
      }
      if (en.warp.mode === "aim") {
        aimYaws.push(en.yaw);
        aimPitches.push(en.pitch);
      } else if (en.warp.mode === "warp") {
        warpYaws.push(en.yaw);
      }
    }
    window.removeEventListener("cosmos:warp", onWarp);
    window.removeEventListener("cosmos:arrive", onArrive);
    en._kick();
    const spread = (a: number[]) =>
      a.length ? Math.max(...a) - Math.min(...a) : -1;
    return {
      ctxLostDuringRun,
      // proof the synthetic ticks actually reached the render loop rather than
      // being swallowed by the lost-context guard
      ticksApplied: en._frame - framesAtStart,
      phases,
      arrived,
      arrivedId: en.arrivedId,
      aimSamples: aimYaws.length,
      aimYawSpread: spread(aimYaws),
      aimPitchSpread: spread(aimPitches),
      warpSamples: warpYaws.length,
      warpYawSpread: spread(warpYaws),
    };
  });

test("a full journey emits the flight sequence burn → flip → brake → arrive", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.goto("/?engine=webgl");
  await page.waitForSelector("space-engine");
  await waitForTickableEngine(page);

  const r = await flyToAbout(page);

  // the harness only means anything if the ticks reached the render loop
  expect(r.ctxLostDuringRun).toBe(false);
  expect(r.ticksApplied).toBeGreaterThan(100);

  // ordered flight profile: accelerate, flip at midpoint, decelerate, arrive
  expect(r.phases.indexOf("accel")).toBe(0);
  expect(r.phases.indexOf("flip")).toBeGreaterThan(r.phases.indexOf("accel"));
  expect(r.phases.indexOf("decel")).toBeGreaterThan(r.phases.indexOf("flip"));
  expect(r.arrived).toContain("st-about");
  expect(r.arrivedId).toBe("st-about");
  // (arrival → dossier UI is owned by space-scene.spec.ts's click-through
  // journey — asserting it here too just double-counts the flakiest wait)
  expect(pageErrors).toEqual([]);
});

test("chase camera pans the look mid-warp without any input", async ({
  page,
}) => {
  await page.goto("/?engine=webgl");
  await page.waitForSelector("space-engine");
  await waitForTickableEngine(page);

  const r = await flyToAbout(page);

  // the harness only means anything if the ticks reached the render loop
  expect(r.ctxLostDuringRun).toBe(false);
  expect(r.ticksApplied).toBeGreaterThan(100);

  // the whole 2.4 s warp was observed frame-by-frame at simulated 60 fps
  expect(r.warpSamples).toBeGreaterThanOrEqual(100);
  expect(r.warpYawSpread).toBeGreaterThan(0.005);
});

test("launch points at the click: camera holds during aim while the ship turns", async ({
  page,
}) => {
  await page.goto("/?engine=webgl");
  await page.waitForSelector("space-engine");
  await waitForTickableEngine(page);

  // F2 amendment: the aim phase no longer eases the camera onto the target —
  // the ship's orientation damp does the turning. The view holds exactly
  // still for the whole 900 ms aim window, then the warp chase takes over.
  const r = await flyToAbout(page);

  // the harness only means anything if the ticks reached the render loop
  expect(r.ctxLostDuringRun).toBe(false);
  expect(r.ticksApplied).toBeGreaterThan(100);

  expect(r.aimSamples).toBeGreaterThanOrEqual(50); // ~56 frames of aim
  expect(r.aimYawSpread).toBeLessThan(1e-9);
  expect(r.aimPitchSpread).toBeLessThan(1e-9);
  expect(r.warpSamples).toBeGreaterThan(0); // and the burn followed
});

test("free-look drag stays authoritative over the chase mid-flight", async ({
  page,
}) => {
  // PF-11 D1.2 named test change (CLAUDE.md #15): this file's tests all rely on
  // Playwright's 30s default; this one gains one more real step below (dismissing the
  // PRE-FLIGHT gate) than it had before, and its Babylon-path twin
  // (engine-select.spec.ts's equivalent test) measured 27-31s across repeated runs even
  // pre-D1.2 — near-zero margin. Widened defensively to the same 60s budget rather than
  // wait for this one to flake too. Assertions unchanged.
  test.setTimeout(60000);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.goto("/?engine=webgl");
  await page.waitForSelector("space-engine");
  // PF-11 D1.2 named test change (CLAUDE.md #15): the PRE-FLIGHT dossier now covers the
  // lower hero region until a real visitor action (LAUNCH/SKIP INTRO), including its
  // pointer-events over the viewport-center coordinate this test drags at — dismissing it
  // is what a real visitor would do before ever reaching free-look, so this test does the
  // same rather than fighting the gate. Assertion below (drag pins yaw) is unchanged.
  await page.getByRole("button", { name: "SKIP INTRO" }).click();
  await waitForStations(page);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .locator("ul")
    .first()
    .getByRole("link", { name: "About" })
    .click();
  await page.waitForFunction(
    () => {
      const en = document.querySelector("space-engine") as unknown as {
        warp?: { mode: string };
      } | null;
      return en?.warp?.mode === "warp";
    },
    { timeout: 10000 },
  );

  // drag mid-warp: while the pointer is down the chase must not write the look
  const vp = page.viewportSize();
  const cx = (vp?.width ?? 1280) / 2,
    cy = (vp?.height ?? 720) / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 220, cy + 60, { steps: 8 });
  const during = await page.evaluate(() => {
    const en = document.querySelector("space-engine") as unknown as {
      yaw: number;
      _dragging: boolean;
    };
    return { yaw: en.yaw, dragging: en._dragging };
  });
  expect(during.dragging).toBe(true);
  // held still: the chase would pan the yaw; authoritative drag pins it
  await page.waitForTimeout(250);
  const held = await page.evaluate(
    () =>
      (document.querySelector("space-engine") as unknown as { yaw: number })
        .yaw,
  );
  expect(Math.abs(held - during.yaw)).toBeLessThan(1e-6);
  await page.mouse.up();

  // released: the chase re-engages and the journey still completes cleanly
  await expect(page.getByRole("dialog", { name: "What I Do" })).toBeVisible({
    timeout: 15000,
  });
  expect(pageErrors).toEqual([]);
});
