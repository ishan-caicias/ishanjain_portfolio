/**
 * PF-09 B0 — dual-engine scaffold + perf telemetry.
 *
 * Verifies the B0 exit criterion: both engines load behind the ?engine flag and
 * telemetry reports startup + fps on demand (window.__ijPerf()). The default
 * path must still mount the current <space-engine>; ?engine=babylon swaps to the
 * Babylon preview without console errors.
 */
import { expect, test, type Page } from "@playwright/test";

// Every test here boots a full Babylon scene (168k-star field + B3 nebula
// raymarch + GLB hull decode) on SwiftShader. Under fullyParallel with 4
// local workers these compete with the other GPU-heavy spec files and time
// out non-deterministically (the TR-018/043-046 flake lineage — each report
// re-confirmed the failures pass in isolation). Running THIS file's tests in
// order inside one worker removes that contention; other files still
// parallelize, and CI (workers: 1) is unaffected.
test.describe.configure({ mode: "default" });

type PerfSnapshot = {
  engine: string;
  tier: string;
  startupMs: number | null;
  fps: number;
  frames: number;
};

const perf = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<PerfSnapshot>((resolve) => {
        const read = () => {
          const fn = (window as unknown as { __ijPerf?: () => PerfSnapshot })
            .__ijPerf;
          if (fn) resolve(fn());
          else setTimeout(read, 100);
        };
        read();
      }),
  );

test("default page mounts the current WebGL engine and telemetry reports webgl", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.goto("/");
  await page.waitForSelector("space-engine");
  await expect(page.locator("babylon-scene")).toHaveCount(0);

  const snap = await perf(page);
  expect(snap.engine).toBe("webgl");
  expect(["low", "mid", "high"]).toContain(snap.tier);
  expect(snap.frames).toBeGreaterThan(0);
  expect(pageErrors).toEqual([]);
});

test("?engine=babylon swaps to the Babylon preview, telemetry reports babylon", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.goto("/?engine=babylon");

  // the swap happens post-hydration; the current engine must be gone
  await page.waitForSelector("babylon-scene", { timeout: 15000 });
  await expect(page.locator("space-engine")).toHaveCount(0);

  const snap = await perf(page);
  expect(snap.engine).toBe("babylon");
  // startup is reported once the scene's first frame emits cosmos:ready
  await expect
    .poll(async () => (await perf(page)).startupMs !== null, { timeout: 15000 })
    .toBe(true);

  expect(pageErrors).toEqual([]);
});

test("babylon actually renders the instanced star billboards (pixel proof)", async ({
  page,
}) => {
  // cosmos:ready fires on the first render-loop turn regardless of whether
  // anything drew — so assert on real pixels. This is what catches a silent
  // "instancing produced nothing" regression on the WebGPU-compatible path.
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  const lit = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const start = Date.now();
        const sample = () => {
          const src = document
            .querySelector("babylon-scene")
            ?.querySelector("canvas") as HTMLCanvasElement | null;
          if (src && src.width > 0) {
            const c = document.createElement("canvas");
            c.width = src.width;
            c.height = src.height;
            const ctx = c.getContext("2d");
            if (ctx) {
              ctx.drawImage(src, 0, 0);
              const { data } = ctx.getImageData(0, 0, c.width, c.height);
              let n = 0;
              // background is ~ (1,1,3)/255 — count clearly lit pixels
              for (let i = 0; i < data.length; i += 4)
                if (data[i] + data[i + 1] + data[i + 2] > 60) n++;
              if (n > 0 || Date.now() - start > 12000) return resolve(n);
            }
          }
          if (Date.now() - start > 12000) return resolve(-1);
          setTimeout(sample, 250);
        };
        sample();
      }),
  );

  expect(lit).toBeGreaterThan(100);
});

test("babylon renders the REAL catalog, not the procedural placeholder", async ({
  page,
}) => {
  // B2 step 2. The placeholder fallback exists so an asset failure still draws
  // a sky — which means the pixel proof above passes either way. Without this
  // assertion a broken catalog fetch would look exactly like success, and the
  // ~6x density defect (TR-037) would silently return.
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  // <babylon-scene> is in the DOM before the catalog fetch/decode resolves, so
  // poll rather than sampling once — a single read races the async boot.
  const readStats = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) =>
        (
          el as HTMLElement & { sceneStats(): Record<string, unknown> }
        ).sceneStats(),
      );

  await expect
    .poll(async () => (await readStats()).starSource, { timeout: 20000 })
    .toBe("catalog");

  // 117,964 Hipparcos + 50,995 Gaia deep records, decoded from the shipped PNGs
  expect((await readStats()).starCount).toBe(168959);
});

test("babylon: shooting-star GLSL twin compiles and renders on the default (WebGL2 fallback) project", async ({
  page,
}) => {
  // B3. The bundled-chromium project (this test's environment) has no real
  // WebGPU adapter (TR-039), so it always exercises the GLSL twin via the
  // WebGL2 fallback — this is the path CI actually runs continuously, unlike
  // webgpu-hardware.spec.ts's opt-in real-hardware WGSL check.
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  const readStats = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) =>
        (
          el as HTMLElement & { sceneStats(): Record<string, unknown> }
        ).sceneStats(),
      );

  await expect
    .poll(async () => (await readStats()).shootMeshReady, { timeout: 20000 })
    .toBe(true);

  const stats = await readStats();
  expect(stats.shootMaterialReady).toBe(true);
  // B5 (declared test change): the particle count is tier-budgeted now, so
  // assert geometry CONSISTENCY against the engine's own resolved count
  // (4 verts / 6 indices per particle) instead of pinning the old fixed 24.
  const count = Number(stats.shootCount);
  expect([24, 16, 8]).toContain(count);
  expect(stats.shootTotalVertices).toBe(count * 4);
  expect(stats.shootTotalIndices).toBe(count * 6);
});

test("babylon: B5 quality tiers — default resolution and the ?tier= override", async ({
  page,
}) => {
  // Bundled chromium: WebGL2 backend on a desktop-class machine → "balanced"
  // per the budget-table mapping (webgl2 + high). The override must win.
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  type TierStats = {
    qualityTier: string;
    haloAmp: number;
    asteroidCount: number;
    physicsMode: string;
    shimmerReady: boolean;
    shipState: string;
  };
  const readStats = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) =>
        (el as HTMLElement & { sceneStats(): TierStats }).sceneStats(),
      );

  await expect
    .poll(async () => (await readStats()).physicsMode, { timeout: 30000 })
    .toBe("havok");
  const def = await readStats();
  expect(def.qualityTier).toBe("balanced");
  expect(def.haloAmp).toBe(0.55);
  expect(def.asteroidCount).toBe(32);

  // lite override: fewer bodies, no halo, and the shimmer post-pass is
  // skipped entirely (ship still reaches "ready" without it)
  await page.goto("/?engine=babylon&tier=lite");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });
  await expect
    .poll(async () => (await readStats()).physicsMode, { timeout: 30000 })
    .toBe("havok");
  await expect
    .poll(async () => (await readStats()).shipState, { timeout: 30000 })
    .toBe("ready");
  const lite = await readStats();
  expect(lite.qualityTier).toBe("lite");
  expect(lite.haloAmp).toBe(0);
  expect(lite.asteroidCount).toBe(20);
  expect(lite.shimmerReady).toBe(false); // pass deliberately not created
});

test("babylon: volumetric nebulae render via the GLSL fragment fallback on the default (WebGL2) project", async ({
  page,
}) => {
  // B3 volumetric nebulae. On WebGL2 the raymarch runs as a ProceduralTexture
  // fragment pass (no compute API — nebula-field.ts / ADR-0004); the WebGPU
  // compute producer is exercised by webgpu-hardware.spec.ts on real GPUs.
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  const readStats = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) =>
        (
          el as HTMLElement & { sceneStats(): Record<string, unknown> }
        ).sceneStats(),
      );

  // producer (raymarch effect) and composite (fullscreen triangle) both
  // compile asynchronously — poll each to readiness rather than reading once
  await expect
    .poll(async () => (await readStats()).nebulaProducerReady, {
      timeout: 20000,
    })
    .toBe(true);
  await expect
    .poll(async () => (await readStats()).nebulaCompositeReady, {
      timeout: 20000,
    })
    .toBe(true);

  const stats = await readStats();
  expect(stats.nebulaMode).toBe("fragment"); // bundled chromium has no WebGPU adapter (TR-039)
  expect(stats.nebulaVolumes).toBe(4); // m42, ngc7293, veil, rosette
  // half-res producer texture is live and sized from the render target
  expect(Number(stats.nebulaTexWidth)).toBeGreaterThan(0);
  expect(Number(stats.nebulaTexHeight)).toBeGreaterThan(0);
});

test("babylon: ship track — GLB hull + plume load, fly during warp, dock-fade on arrival", async ({
  page,
}) => {
  // B3 ship track (owner-unblocked): the tiered GLB finally exists on the
  // Babylon path. This drives the full lifecycle on the CI-run WebGL2
  // fallback: load → hidden at idle → visible during travel → docking fade.
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  type ShipStats = {
    shipState: string;
    shipTier: string | null;
    shipVisible: number;
    plumeReady: boolean;
  };
  const readStats = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) =>
        (el as HTMLElement & { sceneStats(): ShipStats }).sceneStats(),
      );

  // GLB fetch + parse is async and deliberately non-blocking (a failure may
  // not delay cosmos:ready) — poll to "ready", and fail loudly on "failed"
  await expect
    .poll(async () => (await readStats()).shipState, { timeout: 30000 })
    .toBe("ready");
  const loaded = await readStats();
  expect(["1k", "2k"]).toContain(loaded.shipTier);
  expect(loaded.shipVisible).toBe(0); // hidden while parked at home

  // launch: the hull materialises during the aim turn and stays up in warp
  await page.locator("babylon-scene").evaluate((el) => {
    (el as HTMLElement & { travelTo(id: string): void }).travelTo("sun");
  });
  await expect
    .poll(async () => (await readStats()).shipVisible, { timeout: 10000 })
    .toBeGreaterThan(0.5);
  expect((await readStats()).plumeReady).toBe(true);

  // arrival: docking polish — hold, then fade out as the dossier takes over
  await expect
    .poll(
      async () =>
        page
          .locator("babylon-scene")
          .evaluate(
            (el) =>
              (el as HTMLElement & { arrivedId: string | null }).arrivedId,
          ),
      { timeout: 30000 },
    )
    .toBe("sun");
  await expect
    .poll(async () => (await readStats()).shipVisible, { timeout: 10000 })
    .toBeLessThan(0.05);
});

test("babylon: Havok asteroid field — WASM boots, bodies exist, and rocks actually move", async ({
  page,
}) => {
  // B4 step 1. Bundled chromium supports WASM SIMD, so this exercises the
  // REAL Havok tier (the physics itself is backend-agnostic — WebGL2 vs
  // WebGPU only changes rendering). The visual-only fallback tier is covered
  // by unit tests on visualDriftStep + the SIMD probe.
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  type PhysStats = {
    physicsMode: string;
    asteroidCount: number;
    physicsBodies: number;
    asteroidSample: number[] | null;
  };
  const readStats = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) =>
        (el as HTMLElement & { sceneStats(): PhysStats }).sceneStats(),
      );

  // WASM fetch + init is async and non-blocking — poll to a terminal mode
  await expect
    .poll(async () => (await readStats()).physicsMode, { timeout: 30000 })
    .toBe("havok");

  const s1 = await readStats();
  expect(s1.asteroidCount).toBeGreaterThan(0);
  expect(s1.physicsBodies).toBe(s1.asteroidCount);
  expect(s1.asteroidSample).not.toBeNull();
  // B4 step 3: every body carries a collision observer feeding the impact
  // shake (the impacts themselves are statistical — the shake math is
  // unit-pinned and a real impact is observed on the hardware probe)
  expect((s1 as unknown as { collisionWired: boolean }).collisionWired).toBe(
    true,
  );

  // rocks drift under Havok integration — the first body's position must
  // change over a real interval (this is what separates "bodies created"
  // from "physics actually stepping")
  await page.waitForTimeout(1500);
  const s2 = await readStats();
  const moved = s1
    .asteroidSample!.map((v, i) => Math.abs(v - s2.asteroidSample![i]))
    .reduce((a, c) => a + c, 0);
  expect(moved).toBeGreaterThan(0.5);
});

test("babylon: nebula gas is destination-gated — hidden at idle and through accel, revealed at arrival", async ({
  page,
}) => {
  // Owner-reported defect (2026-07-19): the gas appeared the instant a nebula
  // destination was selected, during the ACCELERATION burn. The fix gates each
  // volume behind a reveal envelope: 0 until the decel burn (warp k > 0.53),
  // ramp to decelMax at arrival, swell to 1 as the ship stops.
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  type NebulaStats = {
    nebulaReveal: number[];
    nebulaProducerReady: boolean;
  };
  const readStats = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) =>
        (el as HTMLElement & { sceneStats(): NebulaStats }).sceneStats(),
      );

  await expect
    .poll(async () => (await readStats()).nebulaProducerReady, {
      timeout: 20000,
    })
    .toBe(true);

  // idle at home: every volume hidden
  expect((await readStats()).nebulaReveal).toEqual([0, 0, 0, 0]);

  // launch toward the Orion Nebula (volume index 0) and catch the warp early:
  // m42's distance-scaled warpDur is multi-second, so polling for mode==="warp"
  // lands well inside the accel phase (k < 0.53) — reveal must still be 0.
  await page.locator("babylon-scene").evaluate((el) => {
    (el as HTMLElement & { travelTo(id: string): void }).travelTo("m42");
  });
  await expect
    .poll(
      async () =>
        page
          .locator("babylon-scene")
          .evaluate(
            (el) => (el as HTMLElement & { warp: { mode: string } }).warp.mode,
          ),
      { timeout: 10000 },
    )
    .toBe("warp");
  // Read warp progress and reveal in ONE evaluate so they can't drift apart
  // under parallel-worker load. If the sample lands before the decel
  // threshold, reveal must still be 0; if the event loop stalled long enough
  // to push k past it, the sample proves nothing and is skipped — the
  // envelope's k-mapping itself is pinned by nebula-field unit tests.
  const accel = await page.locator("babylon-scene").evaluate((el) => {
    const s = el as HTMLElement & {
      warp: { warpStart?: number; warpDur?: number };
      sceneStats(): { nebulaReveal: number[] };
    };
    const k =
      s.warp.warpStart != null && s.warp.warpDur
        ? Math.min(1, (performance.now() - s.warp.warpStart) / s.warp.warpDur)
        : 1;
    return { k, reveal: s.sceneStats().nebulaReveal[0] };
  });
  if (accel.k <= 0.5) expect(accel.reveal).toBe(0);

  // arrival: the target volume reveals and swells toward 1; others stay dark
  await expect
    .poll(
      async () =>
        page
          .locator("babylon-scene")
          .evaluate(
            (el) =>
              (el as HTMLElement & { arrivedId: string | null }).arrivedId,
          ),
      { timeout: 30000 },
    )
    .toBe("m42");
  await expect
    .poll(async () => (await readStats()).nebulaReveal[0], { timeout: 10000 })
    .toBeGreaterThan(0.95);
  const arrived = await readStats();
  expect(arrived.nebulaReveal[1]).toBe(0);
  expect(arrived.nebulaReveal[2]).toBe(0);
  expect(arrived.nebulaReveal[3]).toBe(0);

  // B4 step 2: the belt ring is deliberately oriented (X–Y plane, axis Z,
  // centre z = −13) so that THIS m42 route crosses its tube nearly
  // dead-centre — raDecToDir puts dec on Z, so m42's dir (0.107, 0.990,
  // −0.094) reaches z ≈ −16 at planar radius 170 (see ASTEROID_BELT's
  // orientation note). The proximity slowdown MUST therefore engage during
  // this journey. warpSlowMin is captured engine-side and persists past
  // arrival — no timing sensitivity.
  const slowStats = await page.locator("babylon-scene").evaluate((el) =>
    (
      el as HTMLElement & {
        sceneStats(): { warpSlowMin: number; warpSlow: number };
      }
    ).sceneStats(),
  );
  expect(slowStats.warpSlowMin).toBeLessThan(0.9);
  expect(slowStats.warpSlowMin).toBeGreaterThanOrEqual(0.44); // never below 1 - maxSlow
  expect(slowStats.warpSlow).toBe(1); // parked — slowdown cleared
});

test("babylon: RNG mission control button drives real travel through the real UI", async ({
  page,
}) => {
  // B2 step 3. This is the end-to-end regression test for the bug the owner's
  // pushback this session led to fixing: SpaceScene.tsx's engineEl() queried
  // "space-engine" unconditionally, so on the Babylon path every host-driven
  // call (travelTo, goHome, HUD sync) silently no-op'd — nothing wired into
  // <babylon-scene> was reachable from the actual UI, only from its own
  // self-running preview. Exercising the RNG button (not calling travelTo()
  // directly) is the point: it proves the full chain — button click →
  // SpaceScene → engineEl() → randomBody() → travelTo() → cosmos:* events →
  // HUD React state — not just the engine's internals in isolation.
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  const readStats = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) =>
        (
          el as HTMLElement & { sceneStats(): Record<string, unknown> }
        ).sceneStats(),
      );
  // wait past the async boot (catalog decode + body population) before
  // interacting, same race class as the catalog-source test above.
  await expect
    .poll(async () => (await readStats()).starSource, { timeout: 20000 })
    .toBe("catalog");

  await page.getByRole("button", { name: "RNG" }).click();

  // Same HUD assertion space-scene.spec.ts uses for the live engine — proves
  // the UI layer is engine-agnostic, driven by cosmos:* events either engine
  // can emit, not by space-engine-specific internals. This fires as soon as
  // travel STARTS (cosmos:select), not once it completes.
  await expect(page.getByText("STATION-KEEPING")).toHaveCount(0, {
    timeout: 10000,
  });

  // And the engine-side proof of actual ARRIVAL (the spring settling +
  // cosmos:arrive firing), not just a UI label that changed for an unrelated
  // reason. Poll rather than a single read — the spring takes a couple of
  // seconds to settle after the click above.
  const readArrivedId = () =>
    page
      .locator("babylon-scene")
      .evaluate(
        (el) => (el as unknown as { arrivedId: string | null }).arrivedId,
      );
  await expect.poll(readArrivedId, { timeout: 10000 }).not.toBeNull();

  const cam = await page
    .locator("babylon-scene")
    .evaluate((el) => (el as unknown as { cam: [number, number, number] }).cam);
  expect(Math.hypot(cam[0], cam[1], cam[2])).toBeGreaterThan(50);
});

test("babylon: chase-camera choreography drives the real WarpOverlay phase/velocity readout and lands exactly on target", async ({
  page,
}) => {
  // B2 step 4. WarpOverlay is engine-agnostic — it renders purely off React
  // state.warp, populated from cosmos:warp events. If babylon-engine.ts emits
  // the same {t, phase, vC, ly} shape the live engine does, the SAME transit
  // HUD text should appear for a Babylon journey with zero UI changes. This
  // is the most direct proof the ported choreography (not just camera math in
  // isolation) is wired correctly end to end.
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  const readStats = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) =>
        (
          el as HTMLElement & { sceneStats(): Record<string, unknown> }
        ).sceneStats(),
      );
  await expect
    .poll(async () => (await readStats()).starSource, { timeout: 20000 })
    .toBe("catalog");

  // DETERMINISTIC target (test modified for B4 step 2, declared): this test
  // previously launched via the RNG button, which made its 4s phase windows
  // depend on a RANDOM route — some catalog bodies have lyTotal 0 (no
  // velocity line renders), and since the proximity slowdown landed, routes
  // crossing the asteroid belt legitimately stretch their phase timing. The
  // RNG→UI chain has its own dedicated test above; THIS test's purpose is
  // choreography→HUD wiring, which needs a stable journey. Polaris: ly 433
  // (velocity line always renders) and dec 89.26° — its route hugs the
  // world-Z axis (planar ≤ ~8 units), provably clear of the belt tube at
  // planar 170, so no slowdown affects the windows.
  await page.locator("babylon-scene").evaluate((el) => {
    (el as HTMLElement & { travelTo(id: string): void }).travelTo("polaris");
  });

  // Aim phase (~900ms) holds position, then warp starts: the accel readout
  // should appear well inside the accel window (k < 0.47).
  await expect(page.getByText("ACCELERATION BURN")).toBeVisible({
    timeout: 6000,
  });
  await expect(page.getByText(/APPARENT VELOCITY/)).toBeVisible({
    timeout: 4000,
  });

  // Deceleration burn (k > 0.53) should follow before arrival.
  await expect(page.getByText("DECELERATION BURN")).toBeVisible({
    timeout: 8000,
  });

  // Arrival: the eased+waypoint path lands EXACTLY on the computed target —
  // not "close enough" like step 3's spring — because chaseOffsetAt's
  // endpoints both equal [0,0,SHIP_VIEW_DEPTH] by construction, so cam(1)=to
  // algebraically. Verified here, not just asserted in a comment.
  const readWarpTo = () =>
    page
      .locator("babylon-scene")
      .evaluate(
        (el) =>
          (el as unknown as { warp: { to?: [number, number, number] } }).warp
            .to,
      );
  const to = await readWarpTo();

  const readArrivedId = () =>
    page
      .locator("babylon-scene")
      .evaluate(
        (el) => (el as unknown as { arrivedId: string | null }).arrivedId,
      );
  await expect.poll(readArrivedId, { timeout: 8000 }).not.toBeNull();

  const finalCam = await page
    .locator("babylon-scene")
    .evaluate((el) => (el as unknown as { cam: [number, number, number] }).cam);
  expect(to).not.toBeUndefined();
  expect(finalCam[0]).toBeCloseTo(to![0], 6);
  expect(finalCam[1]).toBeCloseTo(to![1], 6);
  expect(finalCam[2]).toBeCloseTo(to![2], 6);
});

test("babylon: distance-scaled travel — a near body warps faster than a far one", async ({
  page,
}) => {
  // B2 step 5. Not a live-engine port (it hardcodes a fixed warp duration
  // regardless of distance) — this is new math (warpDurationForLy), so it's
  // asserted against real catalog bodies, not just the pure-math unit tests.
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  const readStats = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) =>
        (
          el as HTMLElement & { sceneStats(): Record<string, unknown> }
        ).sceneStats(),
      );
  await expect
    .poll(async () => (await readStats()).starSource, { timeout: 20000 })
    .toBe("catalog");

  type TravelEl = HTMLElement & {
    travelTo(id: string, quiet?: boolean): void;
    goHome(quiet?: boolean): void;
    warp: { warpDur?: number; mode: string };
  };

  const nearDur = await page.locator("babylon-scene").evaluate((el) => {
    const e = el as TravelEl;
    e.travelTo("sun"); // ly = 0.0000158 — solar system
    return e.warp.warpDur;
  });
  await page
    .locator("babylon-scene")
    .evaluate((el) => (el as TravelEl).goHome(true)); // reset for a clean second launch
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as TravelEl).warp.mode),
      { timeout: 4000 },
    )
    .toBe("idle");

  const farDur = await page.locator("babylon-scene").evaluate((el) => {
    const e = el as TravelEl;
    e.travelTo("m42"); // Orion Nebula, ly = 1,344 — the delivery plan's own example
    return e.warp.warpDur;
  });

  expect(nearDur).toBeDefined();
  expect(farDur).toBeDefined();
  expect(farDur!).toBeGreaterThan(nearDur! + 500);
});

test("babylon: reduced motion forces fixed short durations and CHASE_OFFSET_REST regardless of distance", async ({
  page,
}) => {
  // B2 step 6, ported from the live engine's own `reduced` branches. Emulate
  // BEFORE navigation — matches the established pattern in space-scene.spec.ts
  // (the reducedMotion context/test.use option doesn't reliably apply before
  // the first navigation here).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  const readStats = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) =>
        (
          el as HTMLElement & { sceneStats(): Record<string, unknown> }
        ).sceneStats(),
      );
  await expect
    .poll(async () => (await readStats()).starSource, { timeout: 20000 })
    .toBe("catalog");

  const reduced = await page
    .locator("babylon-scene")
    .evaluate((el) => (el as unknown as { _reduced: boolean })._reduced);
  expect(reduced).toBe(true);

  type TravelEl = HTMLElement & {
    travelTo(id: string): void;
    arrivedId: string | null;
    warp: { warpDur?: number; aimDur?: number };
  };

  // m42 (Orion Nebula, 1,344 ly) would take the longest non-reduced duration
  // of anything in the catalog — reduced motion must still floor it to the
  // fixed short value, not a fraction of the distance-scaled one.
  const warpDur = await page.locator("babylon-scene").evaluate((el) => {
    const e = el as TravelEl;
    e.travelTo("m42");
    return e.warp.warpDur;
  });
  expect(warpDur).toBe(350);

  // And it actually arrives fast — proving the short duration is live, not
  // just recorded in state.
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as TravelEl).arrivedId),
      { timeout: 2000 },
    )
    .toBe("m42");
});

test("babylon: idle-at-home view drifts slowly rather than staying frozen (owner-reported 'static')", async ({
  page,
}) => {
  // Owner feedback on the deployed demo: "the background remains static ...
  // no glimmer ... no 360 nav ... no spaceship". Free-look drag and the ship
  // mesh are genuinely not built yet (see TR-040/041/042) — this test covers
  // the one part of that report that WAS a real, cheap gap: nothing animated
  // at all while parked at home, which reads as "the scene is dead" rather
  // than "parked." Ported from the live engine's own ambient yaw drift.
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  const readQuat = () =>
    page
      .locator("babylon-scene")
      .evaluate(
        (el) =>
          (el as unknown as { _camQuat: [number, number, number, number] })
            ._camQuat,
      );

  await expect
    .poll(
      async () =>
        page.locator("babylon-scene").evaluate(
          (el) =>
            (
              el as HTMLElement & {
                sceneStats(): Record<string, unknown>;
              }
            ).sceneStats().starSource,
        ),
      { timeout: 20000 },
    )
    .toBe("catalog");

  const before = await readQuat();
  await page.waitForTimeout(1500);
  const after = await readQuat();

  const delta = Math.hypot(
    after[0] - before[0],
    after[1] - before[1],
    after[2] - before[2],
    after[3] - before[3],
  );
  expect(delta).toBeGreaterThan(0);
});

test("perf overlay is opt-in via ?perf=1", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("space-engine");
  await expect(page.getByText(/ENGINE webgl · TIER/)).toHaveCount(0);

  await page.goto("/?perf=1");
  await page.waitForSelector("space-engine");
  await expect(page.getByText(/ENGINE webgl · TIER/)).toBeVisible({
    timeout: 10000,
  });
});
