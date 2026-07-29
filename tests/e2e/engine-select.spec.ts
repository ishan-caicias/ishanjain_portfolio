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

// DEFAULT-ENGINE TESTS REWRITTEN AT THE B6 CUTOVER (ADR-0006, owner decision
// 2026-07-19) — declared test changes: the default is now BABYLON, and
// ?engine=webgl mounts the archived legacy engine (kept fully functional for
// one release as the rollback lever; the pinned legacy specs keep guarding it).

test("default page mounts the BABYLON engine (ADR-0006 cutover), telemetry reports babylon", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.goto("/");

  await page.waitForSelector("babylon-scene", { timeout: 15000 });
  await expect(page.locator("space-engine")).toHaveCount(0);

  const snap = await perf(page);
  expect(snap.engine).toBe("babylon");
  expect(["low", "mid", "high"]).toContain(snap.tier);
  // startup is reported once the scene's first frame emits cosmos:ready
  await expect
    .poll(async () => (await perf(page)).startupMs !== null, { timeout: 20000 })
    .toBe(true);

  // GAP-20: this assertion moved to the ?engine=webgl test at the B6 cutover
  // and never came back to the new default test — the shipping default's
  // render loop went unasserted. `cosmos:ready` (what startupMs waits on)
  // fires before sustained frame production (CLAUDE.md #18: "assert
  // behaviour, not readiness"), so the poll above alone doesn't prove the
  // scene is actually drawing. TR-059 is exactly the class of defect this
  // was blind to: `scene.render()` threw on every frame while `cosmos:ready`
  // had already fired, and no default-path test read `frames` to notice.
  await expect
    .poll(async () => (await perf(page)).frames, { timeout: 10000 })
    .toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);
});

test("?engine=webgl mounts the ARCHIVED legacy engine (the cutover rollback lever)", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.goto("/?engine=webgl");

  await page.waitForSelector("space-engine");
  await expect(page.locator("babylon-scene")).toHaveCount(0);

  const snap = await perf(page);
  expect(snap.engine).toBe("webgl");
  expect(snap.frames).toBeGreaterThan(0);
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

  // 117,964 Hipparcos + 50,995 Gaia deep records, decoded from the shipped PNGs. PF-10 C1
  // (TR-066) changed this from an exact equality to a floor: `_loadBonusStarLayers` merges 3
  // more real bulk populations (white dwarfs/CNS5/Oort cloud) into the SAME mesh right after
  // cosmos:ready, and on a fast local run that merge can complete before this assertion even
  // runs — a real, named consequence of the new architecture (CLAUDE.md non-negotiable #15),
  // not a loosened check: starCount can only ever be 168,959 (base only) or a specific real
  // total once bonus layers land (see the dedicated "PF-10 bonus star layers" test below for the
  // exact merged total), never anything else.
  expect((await readStats()).starCount).toBeGreaterThanOrEqual(168959);
});

test("babylon: GAP-01 curated bodies render (pixel proof) — the portfolio's actual destinations are no longer invisible", async ({
  page,
}) => {
  // The cutover gap analysis's headline finding: window.CELESTIAL was loaded
  // into travel-target coordinates only, with no mesh ever created for a
  // curated body. sceneStats readiness alone would pass even if the mesh
  // drew nothing (materialReady proves nothing — TR-045), so this asserts
  // real pixels, mirroring the star billboard pixel proof above.
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  type BodyStats = {
    bodyCount: number;
    bodyMeshReady: boolean;
    bodyMaterialReady: boolean;
    photoBodyCount: number;
    photoBodyMeshReady: boolean;
    photoBodyMaterialReady: boolean;
    photoBodyTextureReady: boolean;
  };
  const readStats = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) =>
        (el as HTMLElement & { sceneStats(): BodyStats }).sceneStats(),
      );

  await expect
    .poll(async () => (await readStats()).photoBodyTextureReady, {
      timeout: 20000,
    })
    .toBe(true);

  const stats = await readStats();
  // The real catalog is ~2,525 entries (2,500 curated + a small Gaia top-up);
  // a hardcoded count would break the moment the catalog grows, so this
  // asserts order-of-magnitude and internal consistency instead.
  expect(stats.bodyCount).toBeGreaterThan(2000);
  expect(stats.photoBodyCount).toBeGreaterThan(100); // the atlas-mapped subset
  expect(stats.bodyMeshReady).toBe(true);
  expect(stats.bodyMaterialReady).toBe(true);
  expect(stats.photoBodyMeshReady).toBe(true);
  expect(stats.photoBodyMaterialReady).toBe(true);

  // Real pixels: the home view has no arrival vista and the volumetric
  // nebulae are destination-gated (invisible at idle), so any non-background
  // colour here is attributable to the new body billboards, not a
  // pre-existing feature.
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

test("babylon: GAP-02 photographic bodies — travelling to a real atlas-mapped nebula renders the real texture, console-clean", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  const readStats = () =>
    page.locator("babylon-scene").evaluate((el) =>
      (
        el as HTMLElement & {
          sceneStats(): {
            photoBodyTextureReady: boolean;
            arrivedId: string | null;
          };
        }
      ).sceneStats(),
    );
  await expect
    .poll(async () => (await readStats()).photoBodyTextureReady, {
      timeout: 20000,
    })
    .toBe(true);

  // m42 (Orion Nebula) is in the shipped atlas-map.json and is NOT one of
  // the pre-existing B3 volumetric nebula locations' redundant path here —
  // travelTo drives the real state machine, matching this repo's
  // "assert behaviour, not readiness" rule.
  await page.evaluate(() => {
    (
      document.querySelector("babylon-scene") as unknown as {
        travelTo: (id: string) => void;
      }
    ).travelTo("m42");
  });

  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (
              document.querySelector("babylon-scene") as unknown as {
                arrivedId: string | null;
              }
            ).arrivedId,
        ),
      { timeout: 15000 },
    )
    .toBe("m42");

  // WebGPU validates shader modules asynchronously — materialReady proves
  // nothing (TR-045); zero console output is the assertion that actually
  // catches a broken texture bind or a reserved-identifier-class failure.
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("babylon: GAP-03/04/05 — galactic band, constellation figures, and warp trails all build console-clean", async ({
  page,
}) => {
  // PF-10 scale (declared test change, same reasoning as the B5 tiers test
  // above): this test's own workload grew — boot now competes with the SDSS
  // DR18 fetch/decode/mesh-build, the DR3 belt, and the bonus star layers,
  // and the band's 20-rows-per-frame progressive build is FRAME-coupled, so
  // its wall-clock cost scales inversely with fps under SwiftShader software
  // rendering. The owner's 2026-07-22 run failed at 30.2s against the default
  // 30s ceiling with every assertion up to the final readStats already green.
  // Correctness assertions below are unchanged; the ceiling stops enforcing a
  // CI-renderer performance floor this suite was never meant to enforce. The
  // frame-coupled band build itself is a named PF-11 investigation item.
  // PF-11 D0.1 (2026-07-22) closed that item: the band build is no longer
  // frame-coupled (time-budgeted slices + a setTimeout chain between frames).
  // The widened ceiling STAYS — the rest of this test's workload still grew
  // with PF-10 — but the band is no longer the mechanism it was widened for.
  test.setTimeout(90000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  type GapStats = {
    bandReady: boolean;
    bandMeshReady: boolean;
    bandTextureReady: boolean;
    bandFade: number;
    constellationSegments: number;
    constellationMeshReady: boolean;
    trailMeshReady: boolean;
    trailVisible: boolean;
    trailWarpSpeed: number;
  };
  const readStats = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) =>
        (el as HTMLElement & { sceneStats(): GapStats }).sceneStats(),
      );

  // GAP-03: the band's 1024x512 grid is built progressively, so poll rather
  // than assume it lands by the first read. The 45s (not 20s) ceiling dates
  // from when the build was 20 rows per RENDERED frame — ~26 frames, and
  // frame delivery under a loaded SwiftShader run can drop near 1 fps
  // (TR-067 measured ~3 fps on an idle CI machine), which was the C7
  // "bandReady never true" full-suite failure mode. PF-11 D0.1 decoupled the
  // build from frame delivery (time-budgeted slices, plus a setTimeout chain
  // running between frames), so this poll should now land in CPU-bounded
  // time; the ceiling is kept as headroom, not as the mechanism's budget.
  await expect
    .poll(async () => (await readStats()).bandReady, { timeout: 45000 })
    .toBe(true);
  const idle = await readStats();
  expect(idle.bandMeshReady).toBe(true);
  expect(idle.bandTextureReady).toBe(true);

  // GAP-04: real catalog entries carry .fig data, so this is never zero on
  // the real page (as opposed to the pure-module test's synthetic fixtures).
  expect(idle.constellationMeshReady).toBe(true);
  expect(idle.constellationSegments).toBeGreaterThan(0);

  // GAP-05: trails must be GATED OFF at idle (no false-positive streaking)...
  expect(idle.trailMeshReady).toBe(true);
  expect(idle.trailVisible).toBe(false);
  expect(idle.trailWarpSpeed).toBeLessThanOrEqual(0.4);

  // ...and gate ON while the camera is actually moving during a real warp —
  // assert behaviour, not readiness (CLAUDE.md rule), by driving travel
  // through the engine's own imperative API rather than inspecting state.
  await page.evaluate(() => {
    (
      document.querySelector("babylon-scene") as unknown as {
        randomBody: () => void;
      }
    ).randomBody();
  });
  await page.waitForTimeout(700); // land mid-acceleration-burn
  const warping = await readStats();
  expect(warping.trailVisible).toBe(true);
  expect(warping.trailWarpSpeed).toBeGreaterThan(0.4);

  // WebGPU validates shader modules asynchronously — materialReady proves
  // nothing (TR-045); zero console output is the assertion that actually
  // catches a broken texture bind, a bad line-list fillMode, or a reserved-
  // identifier-class failure across all three new shader-twin pairs.
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
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
  // PF-10 C2/TR-067: two full page loads/boots in one test, each now competing for frame time
  // with the SDSS DR18 galaxy field's background fetch/decode/mesh-build (14.5M+ vertices, the
  // largest single asset this site ships) — under CI's SwiftShader software rendering this
  // measurably extends real boot time; the default 30s test timeout was calibrated before that
  // layer existed. Real device testing (owner-provided Android hardware) is what determines
  // whether this scale is production-viable, not CI's software renderer — this timeout widening
  // keeps the test asserting CORRECTNESS (the tier override wins) rather than a CI-specific
  // performance ceiling this suite was never meant to enforce.
  test.setTimeout(90000);
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
  // 11 as of the 2026-07-20 ADR-0004 amendment (TR-072): the original 4
  // showcase volumes (m42, ngc7293, veil, rosette) plus the 7 remaining
  // real NGC2000 Volume-archetype objects (ngc6543, ngc2000-box-nebula,
  // ngc6302, ngc2000-hourglass-nebula, m1, m57, ngc6514).
  expect(stats.nebulaVolumes).toBe(11);
  // half-res producer texture is live and sized from the render target
  expect(Number(stats.nebulaTexWidth)).toBeGreaterThan(0);
  expect(Number(stats.nebulaTexHeight)).toBeGreaterThan(0);
});

test("babylon: ship track — GLB hull + plume load, fly during warp, dock-fade on arrival", async ({
  page,
}) => {
  // PF-10 C2/TR-067: widened for the same real reason as the B5 tier test above — the SDSS
  // DR18 galaxy field's background load competes for frame time under CI's software rendering.
  test.setTimeout(150000);
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

  // launch: the hull materialises during the aim turn and stays up in warp.
  //
  // PF-10 C1 (TR-071, real root cause — see TR-070's investigation): travelling to "sun"
  // (0.0000158 ly, the CLOSEST possible target) hits its warpDurationForLy() floor,
  // ~1.4s configured aim+warp duration total. Under CI's SwiftShader-rendered Chromium, THIS
  // heavier scene (post PF-10's SDSS/white-dwarf/cluster additions) now renders at roughly
  // ~1fps — confirmed by direct measurement (scripts/diag-ship-visible-swiftshader.mjs,
  // deleted after use): renderFrames advanced by only ~13 over a 14.5s real-time window. That
  // means the ENTIRE aim+warp+arrival sequence for "sun" completes within essentially ONE
  // rendered frame, so shipVisible's per-frame-dt-clamped expDamp ramp (babylon-engine.ts
  // ~line 3112, rate 8, SHIP_MAX_DT=0.05s/frame) only gets ~0.05s of accumulated simulated
  // time before the state machine — which progresses on real wall-clock time, not frame count —
  // has already declared arrival and started the docking FADE-OUT. No timeout, however large,
  // fixes this: the target has already moved from 1 (visible) back to a fading value before a
  // 2nd or 3rd frame can even render. Measured directly: 25000ms and 60000ms polls BOTH failed,
  // the latter with shipVisible landing at exactly 0 (already fully faded), not "still ramping."
  // CONFIRMED on real GPU hardware (channel:'chrome') that the underlying mechanism is correct —
  // shipVisible crosses 0.5 in 534ms for "sun" there, since real hardware renders far more than
  // one frame within the ~1.4s window. The fix is choosing a target whose LONGER configured warp
  // duration gives even a ~1fps renderer enough real frames to complete the ramp before arrival —
  // verified directly: switching to "m42" (Orion Nebula, 1344 ly, near warpDurationForLy's
  // 4200ms cap) measured shipVisible reaching 0.996 at t+4789ms with warp still 67% through its
  // progress, comfortably crossing 0.5 well before arrival. "sun" was an edge-case choice that
  // happened to be the worst possible pairing with a slow renderer, not a meaningful part of
  // this test's actual intent (full ship lifecycle: hidden -> visible in transit -> dock-fade).
  await page.locator("babylon-scene").evaluate((el) => {
    (el as HTMLElement & { travelTo(id: string): void }).travelTo("m42");
  });
  await expect
    .poll(async () => (await readStats()).shipVisible, { timeout: 25000 })
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
    .toBe("m42");
  await expect
    .poll(async () => (await readStats()).shipVisible, { timeout: 20000 })
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
  // PF-11 D0.1 (named test change, no assertion touched): this test had no
  // explicit ceiling, so it ran against Playwright's 30s default — and under
  // PF-10 scene scale it now sits ON that line. Measured under a moderate
  // 4-worker CPU load, three passes per arm: 29.6s / TIMEOUT / 37.0s on the
  // current build and 30.5s / 33.5s / 27.8s on the pre-D0.1 build (stashed
  // and rebuilt) — i.e. the margin was already gone before this slice, the
  // same near-zero-margin class TR-080 fixed for GAP-03/04/05, the
  // distance-scaled travel test, and (in this slice) the craft specs. 90s
  // matches those; every assertion below is unchanged.
  //
  // PF-11 D6.2 raised this to 150s: the belt-crossing assertion at the end now flies TWO more
  // journeys (home, then Aldebaran) after the original m42 journey — see that block's own
  // comment for why going home first is required.
  test.setTimeout(150000);
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

  // idle at home: every volume hidden (11 volumes as of the 2026-07-20
  // ADR-0004 amendment — the 7 remaining real NGC2000 objects, TR-072)
  expect((await readStats()).nebulaReveal).toEqual(new Array(11).fill(0));

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
  for (let i = 1; i < arrived.nebulaReveal.length; i++) {
    expect(arrived.nebulaReveal[i]).toBe(0);
  }

  // PF-11 D6.2 named test change (CLAUDE.md #15): the belt is now correctly inclined to the
  // real ecliptic (23.44 deg from this catalog's equatorial frame), so m42's route no longer
  // crosses its tube — measured directly, peak density along the m42 ray fell from ~0.98 to
  // ~0.0001 once the belt plane moved to match real astronomy (ASTEROID_BELT's ORIENTATION
  // note has the numbers). A real showcase route that DOES cross the newly-honest belt was
  // found by testing several already-catalogued destinations, not chosen to make a test pass:
  // Aldebaran (alpha Tauri) sits genuinely near the ecliptic — Taurus is a zodiac constellation
  // — so its real ra/dec threads the tube at peak density 0.964, as good as m42's old
  // (declared, not real) crossing ever was — measured from ORIGIN, since that's where the
  // straight-line route the density model assumes actually starts. The ship is still parked at
  // m42 from the nebula-reveal block above, so go home FIRST — travelling straight from m42 to
  // Aldebaran would fly an entirely different real-space line, not the origin-to-Aldebaran ray
  // the numbers above were measured against.
  await page.locator("babylon-scene").evaluate((el) => {
    (el as HTMLElement & { goHome(): void }).goHome();
  });
  await expect
    .poll(
      async () =>
        page.locator("babylon-scene").evaluate(
          (el) =>
            (
              el as HTMLElement & {
                sceneStats(): { homeOrbit: boolean };
              }
            ).sceneStats().homeOrbit,
        ),
      { timeout: 60000 },
    )
    .toBe(true);
  // Second journey in this same test, after m42's nebula-reveal assertions and the home return
  // above, so warpSlowMin below reflects only this leg (the engine resets it at every new
  // journey's launch).
  await page.locator("babylon-scene").evaluate((el) => {
    (el as HTMLElement & { travelTo(id: string): void }).travelTo("aldebaran");
  });
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
    .toBe("aldebaran");
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

  // PF-11 D1.2 named test change (CLAUDE.md #15): the mission control bar (and its RNG
  // button) is hidden under body.ij-loading until a real visitor action, same as the hero
  // copy — dismiss the PRE-FLIGHT gate first, as a real visitor would before ever seeing
  // this button. Assertions below unchanged.
  await page.getByRole("button", { name: "SKIP INTRO" }).click();

  // PF-11 D5.1 (ADR-0010) named test change: RNG → RANDOM JUMP ▸ (aria-label "Jump to a
  // random destination").
  await page
    .getByRole("button", { name: "Jump to a random destination" })
    .click();

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
  // PF-11 D3.1: install a warp-FOV peak tracker BEFORE the journey. The lens
  // breathes off dsdk, peaking (+6%) at k=0.5 — which every completed warp
  // passes through — so tracking the peak here is robust and does NOT depend on
  // catching the tight flip window (that's GAP-17's fragile job, deliberately
  // kept separate). Read back after arrival: breathed > +2% over base, relaxed
  // to base at the dock.
  await page.locator("babylon-scene").evaluate((el) => {
    const en = el as HTMLElement & { sceneStats(): Record<string, number> };
    const w = window as unknown as { __fovPeak: number; __fovBase: number };
    w.__fovPeak = 0;
    w.__fovBase = 0;
    window.addEventListener("cosmos:warp", () => {
      const s = en.sceneStats();
      if (s.fov > w.__fovPeak) w.__fovPeak = s.fov;
      w.__fovBase = s.baseFov;
    });
  });

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

  // Braking burn (k > WARP_DECEL_START) should follow before arrival.
  // PF-11 D3.1 renamed the decel HUD label DECELERATION BURN → BRAKING BURN
  // (the tighter NASA-ops cue that matches the picture); the underlying
  // cosmos:warp `phase: "decel"` string is unchanged, so flight-v3's
  // phase-order assertion is unaffected.
  await expect(page.getByText("BRAKING BURN")).toBeVisible({
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

  // PF-11 D3.1: the warp lens breathed and relaxed. `__fovPeak` (max over the
  // journey, ~+6% at k=0.5) must clear +2% over base; the live FOV at the dock
  // must be back at rest — the speed cue is proven on the real render loop, not
  // just in the pure warpFovMult unit test.
  const fov = await page.locator("babylon-scene").evaluate((el) => {
    const w = window as unknown as { __fovPeak: number; __fovBase: number };
    const s = (
      el as HTMLElement & { sceneStats(): Record<string, number> }
    ).sceneStats();
    return { peak: w.__fovPeak, base: w.__fovBase, live: s.fov };
  });
  expect(fov.base).toBeGreaterThan(0);
  expect(fov.peak).toBeGreaterThan(fov.base * 1.02);
  expect(fov.live).toBeCloseTo(fov.base, 5);
});

test("babylon: GAP-17 — the flight sequence runs accel → flip → decel in strict order via the real HUD", async ({
  page,
}) => {
  // PF-10 C2/TR-067: widened for the same real reason as the B5/ship-track tests above — SDSS
  // DR18's background load competes for frame time under CI's software rendering, and this
  // test's flip window is only k∈[0.47,0.53] of the ~3.2s polaris journey (~195ms real time),
  // already the tightest timing assertion in this file even before that extra load existed.
  test.setTimeout(60000);
  // GAP-17's remaining gap after the "chase-camera choreography" test above:
  // that test asserts accel and decel appear, but not the FLIP window between
  // them, and not that the ordering is strict. This is the direct Babylon-
  // native equivalent of flight-v3.spec.ts's synthetic-tick "burn → flip →
  // brake → arrive" test — driven by the real render loop and real timers
  // instead (that spec's 3 remaining synthetic-tick tests stay pinned to
  // ?engine=webgl; they poke space-engine.js-specific internals — `_tick()`,
  // `.gl` — that have no Babylon equivalent, see that file's header).
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });
  await expect
    .poll(
      async () =>
        page
          .locator("babylon-scene")
          .evaluate((el) =>
            (
              el as HTMLElement & { sceneStats(): Record<string, unknown> }
            ).sceneStats(),
          )
          .then((s) => s.starSource),
      { timeout: 20000 },
    )
    .toBe("catalog");

  // Same deterministic target as the choreography test above, for the same
  // reason: polaris (ly 433, dec 89.26°) is provably clear of the asteroid
  // belt's proximity-slowdown tube, so the phase windows land on schedule.
  //
  // The flip window is only k∈[0.47,0.53] — ~6% of polaris's ~3.2s journey,
  // roughly 195ms of wall clock. Asserting it via DOM TEXT (as first
  // attempted) is fragile: React's own state-update batching can coalesce
  // several cosmos:warp events into one render, and if "flip" and "decel"
  // both land in the same batch only the last one ever paints — a false
  // negative on ordering that's actually correct, just never rendered).
  // Capturing the cosmos:warp EVENT STREAM directly (same technique
  // flight-v3.spec.ts's synthetic-tick harness uses, just with the real
  // clock instead of manual ticks) sidesteps React's render layer entirely
  // and asserts the engine's actual phase sequence, which is what GAP-17 is
  // really about.
  const result = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const en = document.querySelector("babylon-scene") as unknown as {
          travelTo(id: string): void;
          arrivedId: string | null;
        };
        const phases: string[] = [];
        const onWarp = ((e: CustomEvent) => {
          const p = e.detail?.phase as string | undefined;
          if (p && phases[phases.length - 1] !== p) phases.push(p);
        }) as EventListener;
        const onArrive = ((e: CustomEvent) => {
          window.removeEventListener("cosmos:warp", onWarp);
          window.removeEventListener("cosmos:arrive", onArrive);
          resolve({ phases, arrivedId: e.detail?.id as string });
        }) as EventListener;
        window.addEventListener("cosmos:warp", onWarp);
        window.addEventListener("cosmos:arrive", onArrive);
        en.travelTo("polaris");
        // PF-10 C2/TR-067: widened 10000->20000 alongside the outer test.setTimeout above —
        // same real reason (SDSS DR18's background load extends real frame time under CI's
        // software rendering).
        setTimeout(() => {
          window.removeEventListener("cosmos:warp", onWarp);
          window.removeEventListener("cosmos:arrive", onArrive);
          resolve({ phases, arrivedId: null, timedOut: true });
        }, 20000);
      }),
  );

  const r = result as { phases: string[]; arrivedId: string | null };
  expect(r.phases.indexOf("accel")).toBe(0);
  expect(r.phases.indexOf("flip")).toBeGreaterThan(r.phases.indexOf("accel"));
  expect(r.phases.indexOf("decel")).toBeGreaterThan(r.phases.indexOf("flip"));
  expect(r.arrivedId).toBe("polaris");
});

test("babylon: GAP-17/GAP-08 — free-look drag stays authoritative over the chase mid-flight", async ({
  page,
}) => {
  // Direct Babylon port of flight-v3.spec.ts's wall-clock "free-look drag
  // stays authoritative" test (that one drives the archived engine via real
  // clicks/mouse events too, not synthetic ticks — genuinely portable, just
  // pointed at the wrong engine since the B6 cutover). `_yaw`/`_dragging` are
  // babylon-engine.ts's private fields — still readable at runtime, same
  // pattern this suite already uses for other private-field reads.
  //
  // PF-11 D1.2 named test change (CLAUDE.md #15): this test had no explicit
  // ceiling and ran on Playwright's 30s default — measured at 27-31s across
  // repeated runs even before this slice, near-zero margin (TR-080's exact
  // signature). The added SKIP INTRO step below tips it over that margin
  // often enough to be a real flake, not a one-off; 60s matches the budget
  // this file's other multi-step real-interaction tests already carry.
  // Assertions unchanged.
  test.setTimeout(60000);
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });
  await expect
    .poll(
      async () =>
        page
          .locator("babylon-scene")
          .evaluate((el) =>
            (
              el as HTMLElement & { sceneStats(): Record<string, unknown> }
            ).sceneStats(),
          )
          .then((s) => s.starSource),
      { timeout: 20000 },
    )
    .toBe("catalog");

  // PF-11 D1.2 named test change (CLAUDE.md #15): the PRE-FLIGHT dossier now covers the
  // lower hero region until a real visitor action (LAUNCH/SKIP INTRO), including its
  // pointer-events over the viewport-center coordinate this test drags at — dismissing it
  // is what a real visitor would do before ever reaching free-look, so this test does the
  // same rather than fighting the gate. Assertion below (drag pins yaw) is unchanged.
  await page.getByRole("button", { name: "SKIP INTRO" }).click();

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .locator("ul")
    .first()
    .getByRole("link", { name: "About" })
    .click();
  await page.waitForFunction(
    () => {
      const en = document.querySelector("babylon-scene") as unknown as {
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
    const en = document.querySelector("babylon-scene") as unknown as {
      _yaw: number;
      _dragging: boolean;
    };
    return { yaw: en._yaw, dragging: en._dragging };
  });
  expect(during.dragging).toBe(true);
  // held still: the chase would pan the yaw; authoritative drag pins it
  await page.waitForTimeout(250);
  const held = await page.evaluate(
    () =>
      (document.querySelector("babylon-scene") as unknown as { _yaw: number })
        ._yaw,
  );
  expect(Math.abs(held - during.yaw)).toBeLessThan(1e-6);
  await page.mouse.up();

  // released: the chase re-engages and the journey still completes cleanly
  await expect(page.getByRole("dialog", { name: "What I Do" })).toBeVisible({
    timeout: 15000,
  });
  expect(pageErrors).toEqual([]);
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
  // Declared test change (owner's 2026-07-22 failing run, root-caused): the
  // goHome(true) "reset" that used to sit here was DEAD CODE — goHome() is a
  // guarded no-op while warp.mode is "aim"/"warp" (babylon-engine.ts), and it
  // was always called ~1ms into the sun warp's aim phase. The poll below only
  // ever passed because the short sun journey itself finished and set mode
  // back to "idle". Removed rather than kept as false reassurance. 15s not
  // 4s: warp progress is per-frame-dt-clamped, so a ~1.5s-configured journey
  // stretches multiple-fold under SwiftShader at PF-10 scene scale — the same
  // investigated mechanism the reduced-motion test below documents (TR-066).
  // The second launch needs no position reset anyway: warpDur derives from
  // the target's catalog ly (warpDurationForLy), not the camera's position.
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as TravelEl).warp.mode),
      { timeout: 15000 },
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

  // And it actually arrives — proving the short duration is live, not just recorded in state.
  //
  // PF-10 C1 (TR-066) widened this poll's timeout from 2000ms to 8000ms — a real, investigated
  // consequence of `_loadBonusStarLayers` (babylon-engine.ts), not an arbitrary loosening.
  // Real investigation this session (isolating the cause by temporarily disabling the bonus-
  // layer merge entirely and re-testing): a real, permanent frame-time cost from the larger
  // merged star mesh, not a one-time rebuild hitch — the mesh had already finished merging and
  // settled well before travelTo() was even called, yet arrival still took 4-6+ real seconds for
  // a 350ms-configured warp under SwiftShader/software rendering. Two real, independent bugs
  // were found and fixed in the same investigation (a genuine VertexBuffer leak on every mesh
  // rebuild — disposed now; white dwarfs, the dominant vertex-count cost, moved from
  // balanced+lite to full-tier-only), but neither fully closed the gap: even the smaller
  // CNS5+Oort-only merge (+62k vertices, ~9%) reliably pushes real warp-arrival time past the
  // original 2000ms budget on this environment's WebGL2/SwiftShader path. Read as evidence that
  // warp-progress integration is per-frame-dt-clamped (a real frame-time increase costs
  // disproportionately more wall-clock time to reach a fixed configured duration, not linearly)
  // rather than as an unexplained flake — the original 2000ms budget assumed a scene that no
  // longer exists now that background bulk-layer loading is a real, intentional feature.
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as TravelEl).arrivedId),
      { timeout: 8000 },
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

// Engine-agnostic since the ADR-0006 cutover (TR-054): this test asserts the
// OPT-IN MECHANISM, not which renderer is mounted, so it follows the default
// rather than being pinned to the archived engine. It previously hard-coded
// `space-engine` + "ENGINE webgl" and so silently stopped exercising the
// default the moment that default became Babylon.
// The Babylon line carries an extra backend segment ("ENGINE babylon · WEBGL2
// · TIER full") that the legacy line does not, hence the tolerant middle.
const PERF_OVERLAY = /ENGINE (webgl|babylon).*· TIER/;

test("perf overlay is opt-in via ?perf=1", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("space-engine, babylon-scene");
  await expect(page.getByText(PERF_OVERLAY)).toHaveCount(0);

  await page.goto("/?perf=1");
  await page.waitForSelector("space-engine, babylon-scene");
  await expect(page.getByText(PERF_OVERLAY)).toBeVisible({
    timeout: 10000,
  });
});

// PF-10 C1 — star-cluster hall-of-fame wiring (celestial-clusters.js), the NGC2000 billboard
// nebulae, and the GD-1 connected-trail visual, merged into ONE boot (2026-07-25 E2E audit,
// recommendation #4 — TR-104). These were three separate tests, each re-booting the full
// 555,825+-object catalog scene from scratch to read one more `window.CELESTIAL_*_COUNT` or
// travel to one more real target; the NGC2000 count in particular was already asserted below
// via `counts.ngc2000`, making the old standalone NGC2000 test's count check a pure duplicate.
// No assertion was dropped — every check from all three original tests survives below, just
// sharing one boot. Console-error checking is added for the clusters/NGC2000 legs too (only the
// GD-1 leg had it before) since it's now free in the same test.
//
// The 35 curated clusters use the same window.CELESTIAL merge pattern GAP-01 already proved
// renders (celestial-bodies.ts billboard path, no new rendering code) — this test proves the NEW
// data file is actually wired into the load chain and travelable, not just present as an unused
// module. Real data check: Pleiades' own real ra/dec/ly (see
// docs/datasets/star_clusters_hall_of_fame.md) is asserted, not just presence, so a future edit
// that silently corrupts the entry would fail this test too.
test("babylon: PF-10 catalog layers — clusters, NGC2000 nebulae, and the GD-1 trail — load and are real travel targets", async ({
  page,
}) => {
  // TR-107 (declared test change, CLAUDE.md #15): widened 45000->90000 alongside the two
  // arrival-poll timeouts below. This test does TWO back-to-back real travel journeys
  // (cluster-pleiades then ngc2000-lagoon-nebula) on the full 555,825+-object PF-10 scene —
  // the same per-frame-dt-clamped, wall-clock-driven warp state machine documented throughout
  // this file (e.g. the "distance-scaled travel" test below) stretches multiple-fold under
  // CI's SwiftShader software rendering, and that stretch compounds across two sequential
  // journeys instead of one. Observed directly (2026-07-28 full-suite run, TR-106 lineage):
  // cluster-pleiades arrived at 6.9s against a 10000ms poll (already near the edge), and
  // ngc2000-lagoon-nebula — the farther, near-WARP_MAX_MS journey — never arrived within its
  // own 10000ms poll. Isolated reruns of this exact test passed 3/3 in 7.1-10.5s total,
  // confirming this is the full-run contention class, not a functional regression. Assertions
  // below are unchanged.
  test.setTimeout(90000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  const counts = await page.evaluate(() => {
    const w = window as unknown as {
      CELESTIAL?: unknown[];
      CELESTIAL_CLUSTERS_COUNT?: number;
      CELESTIAL_MINORPLANETS_COUNT?: number;
      CELESTIAL_NBG_COUNT?: number;
      CELESTIAL_GD1_COUNT?: number;
      CELESTIAL_NGC2000_COUNT?: number;
      CELESTIAL_SATURNMOONS_COUNT?: number;
      CELESTIAL_MISSINGMOONS_COUNT?: number;
    };
    return {
      celestial: w.CELESTIAL?.length,
      clusters: w.CELESTIAL_CLUSTERS_COUNT,
      minorplanets: w.CELESTIAL_MINORPLANETS_COUNT,
      nbg: w.CELESTIAL_NBG_COUNT,
      gd1: w.CELESTIAL_GD1_COUNT,
      ngc2000: w.CELESTIAL_NGC2000_COUNT,
      saturnmoons: w.CELESTIAL_SATURNMOONS_COUNT,
      missingmoons: w.CELESTIAL_MISSINGMOONS_COUNT,
    };
  });
  expect(counts.clusters).toBe(35);
  // PF-10 C1 landed four more bulk datasets across this and a follow-up session (minor planets,
  // NEARGALCAT, GD-1, NGC2000 billboards) — real per-file counts asserted individually, not just
  // the total, so a future regression in any one loader is attributable rather than just "the
  // sum changed".
  expect(counts.minorplanets).toBe(4);
  expect(counts.nbg).toBe(856); // real .vot nrows — see celestial-nbg.js header for the 875-vs-856 discrepancy note
  expect(counts.gd1).toBe(1365);
  expect(counts.ngc2000).toBe(41); // 41 of 47 real NGC2000 objects — the other 8 are Volume-archetype, still blocked
  // PF-10 C4 closeout (TR-079): Tethys, Dione and Rhea became real destinations. They shipped
  // sphere textures with no catalog entry, so 17.5 MB of real imagery could never render — found
  // by live validation, not by a test. Counted individually here per the convention above.
  expect(counts.saturnmoons).toBe(3);
  // PF-11 D5.4 missing-body audit: Mimas, Iapetus, Phobos, Triton, Charon — real curated
  // entries (no photograph, img:null), same "counted individually" convention.
  expect(counts.missingmoons).toBe(5);
  // 2,525 pre-existing + 35 clusters + 4 minor planets + 856 NBG + 1,365 GD-1 + 41 NGC2000
  // + 3 Saturn moons + 5 D5.4 missing moons, none dropped as an id collision.
  expect(counts.celestial).toBe(4834);

  const pleiades = await page.evaluate(() =>
    (
      window as unknown as {
        CELESTIAL?: {
          id: string;
          ra: number;
          dec: number;
          ly: number | null;
        }[];
      }
    ).CELESTIAL?.find((e) => e.id === "cluster-pleiades"),
  );
  expect(pleiades?.ra).toBeCloseTo(56.75, 2);
  expect(pleiades?.dec).toBeCloseTo(24.12, 2);
  expect(pleiades?.ly).toBe(444);

  type TravelEl = HTMLElement & {
    travelTo(id: string): void;
    arrivedId: string | null;
  };
  await page.locator("babylon-scene").evaluate((el) => {
    (el as TravelEl).travelTo("cluster-pleiades");
  });
  // TR-107: 10000->20000 — see the test-level comment above; measured at 6.9s under full-run
  // contention, close enough to the old 10000ms ceiling to be the same near-zero-margin class.
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as TravelEl).arrivedId),
      { timeout: 20000 },
    )
    .toBe("cluster-pleiades");

  // --- PF-10 C1 continued: 41 real Billboard-archetype NGC2000 nebulae (of 47; the other 8 are
  // custom-shader Volume objects, still blocked on the reveal-mechanism redesign, see
  // TR-065/066), wired live via celestial-ngc2000.js, same window.CELESTIAL merge pattern as
  // clusters/GD-1/NBG/minor-planets. Real data check on a real, well-known nebula, not just
  // presence. `counts.ngc2000` above already proved the count; this proves a real member is
  // travelable with real coordinates. ---
  const lagoon = await page.evaluate(() =>
    (
      window as unknown as {
        CELESTIAL?: { id: string; ra: number; dec: number; ly: number }[];
      }
    ).CELESTIAL?.find((e) => e.id === "ngc2000-lagoon-nebula"),
  );
  expect(lagoon?.ra).toBeCloseTo(270.6258, 3);
  expect(lagoon?.dec).toBeCloseTo(-24.2872, 3);
  expect(lagoon?.ly).toBeCloseTo(5199.99, 1);

  await page.locator("babylon-scene").evaluate((el) => {
    (el as TravelEl).travelTo("ngc2000-lagoon-nebula");
  });
  // TR-107: 10000->25000 — the actual full-run failure (5199.99 ly is near WARP_MAX_MS's
  // distance ceiling, ship-dynamics.ts, the longest-configured-duration journey class; sibling
  // near-max-distance journeys elsewhere in this file (e.g. the ship-track test's m42 poll) are
  // already given 25000-30000ms for the same reason).
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as TravelEl).arrivedId),
      { timeout: 25000 },
    )
    .toBe("ngc2000-lagoon-nebula");

  // --- PF-10 C1's last remaining item: GD-1's connected-trail visual (TR-073). A static
  // Material.LineListDrawMode mesh connecting the 1,365 real member stars in their real physical
  // order along the stream (a great-circle fit to the real sample, NOT catalog row order — see
  // gd1-trail.ts and docs/analysis/2026-07-20-gd1-connected-trail-science-brief.md), coloured
  // along its length by real radial velocity. No travel needed — this reads sceneStats()
  // directly, so it costs nothing extra beyond the boot already paid for above. ---
  type Gd1StatsEl = HTMLElement & {
    sceneStats(): { gd1TrailSegments: number; gd1TrailMeshReady: boolean };
  };
  await expect
    .poll(
      async () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as Gd1StatsEl).sceneStats().gd1TrailMeshReady),
      { timeout: 20000 },
    )
    .toBe(true);

  const gd1Stats = await page
    .locator("babylon-scene")
    .evaluate((el) => (el as Gd1StatsEl).sceneStats());
  // n-1 segments for n=1,365 real stars — proves every real star was included (not silently
  // truncated) and the mesh isn't a degenerate loop.
  expect(gd1Stats.gd1TrailSegments).toBe(1364);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

// PF-10 C1 continued — the 3 Track B (PNG-pack) populations proven mechanism-only in TR-063/065
// (white dwarfs, CNS5, Oort cloud) are now actually wired into the live star mesh via
// `_loadBonusStarLayers` (babylon-engine.ts), fetched AFTER cosmos:ready fires so they never
// gate startup. Real behaviour asserted, not just readiness (CLAUDE.md non-negotiable #18): the
// exact final starCount (543,742 — see the derivation below) is only reachable if the merge
// actually ran and rebuilt the mesh, not just readiness/no-console-errors.
//
// PF-10 owner direction, TR-067: build the ideal state for every tier first (desktop baseline),
// introduce tiers/settings LATER from real extended device testing. This REVERSES the earlier
// TR-066 tier gate (white dwarfs full-tier-only, from a SwiftShader/software-rendering
// measurement — a worst-case proxy, not a real device). All 3 bonus layers now merge on every
// tier; this test forces full to make the assertion deterministic regardless of what tier this
// environment resolves to by default, and the companion test below proves the SAME total merges
// on balanced too (the reversal itself, not just full-tier behaviour).
test("babylon: PF-10 bonus star layers (white dwarfs, CNS5, Oort cloud) merge into the live star mesh on the full tier", async ({
  page,
}) => {
  await page.goto("/?engine=babylon&tier=full");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  type SceneStatsEl = HTMLElement & {
    sceneStats(): { starCount: number; starSource: string };
  };
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as SceneStatsEl).sceneStats().starSource),
      { timeout: 20000 },
    )
    .toBe("catalog");

  // NOT asserting an intermediate "base-only" count here — a real race, not a test bug: on a
  // fast local run the bonus fetch (small assets, localhost) can complete before this next line
  // even executes, so "starCount === 168,959 right after cosmos:ready" is not a reliable
  // observation. The merge having genuinely ADDED records (not just having always been present
  // some other way) is what the exact final total below proves: it only equals the real merged
  // sum, so the earlier build path did not have to have already contained it.
  //
  // Real total: EVERY chunk's actual pixel-rectangle byte count divided by 15
  // (RECORD_BYTES) — NOT simply each dataset's own written record count summed, because the
  // shared PNG-pack format pads to a full width x height rectangle, and any trailing padding
  // that happens to fill 5+ more RGB pixels (15 bytes / 3 bytes-per-pixel = exactly 5 px per
  // record) decodes as extra all-zero "phantom" records — real, pre-existing behaviour of
  // writeRecordsAsPng/decodeStarCatalog (present in the shipped stars-hip.png/deep.png too),
  // not a defect introduced by this session's bonus layers. Confirmed independently against the
  // real shipped PNG dimensions, not just predicted from source row counts:
  //   stars-hip.png (1024x576) 117,964 + deep.png (1024x249) 50,995 = 168,959 (base, unchanged)
  //   cns5.png (1024x27) 5,529 + oortcloud.png (1024x49) 10,035 + whitedwarfs-edr3.png
  //   (1024x1754) 359,219 = 374,783 bonus  ->  168,959 + 374,783 = 543,742
  // (Declared test change, PF-10 C1) 543,742 -> 555,825: clusters-bg.png (1024x59, MWSC + Hunt-
  // Reffert 2023 + OCDR2 minus the 35 already-curated named clusters, scripts/gaia-clusters-
  // pngpack.mjs) added to BONUS_CATALOG_CHUNKS — 12,083 real+phantom records (12,065 real, same
  // padding-record behaviour as every other chunk above).
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as SceneStatsEl).sceneStats().starCount),
      { timeout: 30000 }, // white dwarfs alone is a real ~5.4 MB asset; give it real time to fetch+decode
    )
    .toBe(555_825);

  // The merge rebuilds mesh geometry — confirm the mesh is still valid/ready afterward, not
  // left in a broken half-rebuilt state.
  const stats = await page
    .locator("babylon-scene")
    .evaluate((el) => (el as SceneStatsEl).sceneStats());
  expect((stats as unknown as { meshReady: boolean }).meshReady).toBe(true);
});

// Companion to the full-tier test above: TR-067 REVERSED the tier gate (owner direction — ideal
// state on every tier first, real tiers introduced later from actual device testing), so the
// SAME full total (555,825 — see the full-tier test's comment for the PF-10 C1 cluster-layer
// breakdown) now merges on balanced too, not a reduced one.
test("babylon: PF-10 bonus star layers merge the SAME full total on the balanced tier (TR-067 tier-gate reversal)", async ({
  page,
}) => {
  await page.goto("/?engine=babylon&tier=balanced");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  type SceneStatsEl = HTMLElement & {
    sceneStats(): { starCount: number; starSource: string };
  };
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as SceneStatsEl).sceneStats().starSource),
      { timeout: 20000 },
    )
    .toBe("catalog");

  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as SceneStatsEl).sceneStats().starCount),
      { timeout: 30000 },
    )
    .toBe(555_825);
});

// PF-10 C2/C3 — SDSS DR18 galaxy field (3,637,836 real records, TR-066/067) and the full real
// Gaia DR3 asteroid belt, merged into ONE boot (2026-07-25 E2E audit, recommendation #4 —
// TR-104). Both background layers fetch/decode CONCURRENTLY during the same boot regardless of
// which test reads them — the two were never sequential-dependent costs, just two separate 90s-
// budgeted tests each paying for a boot the other already incurred. No assertion dropped.
//
// SDSS: wired into a SEPARATE mesh (log-depth-scaled positions, incompatible with the star
// field's linear-ly convention — see ADR-0007's consequences and
// scripts/gaia-sdss18-pngpack.mjs's header). Real behaviour asserted: the exact real record
// count and mesh readiness, not just "no console errors" — a broken/empty decode would still
// leave meshReady false or count 0.
//
// Asteroid belt: replaces the seeded-LCG procedural torus. Two tiers, both asserted because they
// fail independently: the VISUAL layer (154,662 real objects on their own mesh, object-type byte
// 6) and the PHYSICS layer (a bounded subset of real bodies with real Keplerian velocities,
// built at boot from a generated module). `asteroidRealSource` is the assertion that actually
// matters — the body COUNT is identical either way, so only the source field can distinguish
// real catalog bodies from the procedural fallback, which is exactly the confusion a "belt
// renders" test would sail past.
test("babylon: PF-10 SDSS DR18 galaxy field and the real Gaia DR3 asteroid belt both load into their own live meshes", async ({
  page,
}) => {
  // Both are real multi-MB assets (SDSS ~47 MB / 14.5M+ vertices, belt ~2.0 MB / 619k+ vertices)
  // decoding CONCURRENTLY on top of everything else this scene does at boot — the default 30s
  // Playwright timeout is too tight, and since both loads race in parallel rather than stacking,
  // 120s (not 90+90) covers the pair with headroom.
  test.setTimeout(120000);
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  type SceneStatsEl = HTMLElement & {
    sceneStats(): {
      sdssGalaxyCount: number;
      sdssMeshReady: boolean;
      asteroidVisualCount: number;
      asteroidVisualReady: boolean;
      asteroidRealSource: string;
      asteroidRealEpoch: string;
      asteroidCatalogSize: number;
      asteroidCount: number;
      physicsMode: string;
    };
  };

  // Real count is 3,637,862, not the dataset's stated 3,637,836 — the shared PNG-pack format
  // pads to a full 1024x17763 rectangle, and the trailing padding decodes as 26 extra all-zero
  // "phantom" records, the same real, pre-existing behaviour documented for every other
  // background layer (TR-066's derivation note on the bonus-star-layers test above).
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as SceneStatsEl).sceneStats().sdssGalaxyCount),
      { timeout: 90000 },
    )
    .toBe(3_637_862);

  const sdssStats = await page
    .locator("babylon-scene")
    .evaluate((el) => (el as SceneStatsEl).sceneStats());
  expect(sdssStats.sdssMeshReady).toBe(true);

  // Real decoded count is 154,828, not the catalog's 154,662 — the shared PNG-pack format pads
  // to a full 1024x756 rectangle and the trailing padding decodes as 166 all-zero "phantom"
  // records. Identical, pre-existing behaviour to every other background layer (see SDSS above);
  // asserted at its real value rather than rounded off. Already loading in parallel with SDSS
  // above, so this poll should resolve near-instantly if it hasn't already.
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate(
            (el) => (el as SceneStatsEl).sceneStats().asteroidVisualCount,
          ),
      { timeout: 30000 },
    )
    .toBe(154_828);

  const beltStats = await page
    .locator("babylon-scene")
    .evaluate((el) => (el as SceneStatsEl).sceneStats());
  expect(beltStats.asteroidVisualReady).toBe(true);
  // The physics tier is real catalog data, not the procedural fallback.
  expect(beltStats.asteroidRealSource).toBe("gaia-dr3");
  expect(beltStats.asteroidCatalogSize).toBe(154_662);
  expect(beltStats.asteroidRealEpoch).toBe("2026-07-20");
  // ...and it still honours the tier budget rather than trying to instance the catalog.
  expect(beltStats.asteroidCount).toBeGreaterThan(0);
  expect(beltStats.asteroidCount).toBeLessThanOrEqual(48);
});

// PF-10 C4 — real planetary spheres. Before this phase every body in the scene, Mars included,
// was a flat billboard sampling a 128x128 cell of the shared atlas; there were no meshes at all.
// The assertion that matters is BEHAVIOURAL (non-negotiable #18): travel to Mars via the real
// state machine and prove a sphere is actually visible, dressed as the right body, with its real
// elevation map bound — not merely that a mesh object exists.
test("babylon: PF-10 C4 arriving at Mars reveals a real textured sphere with real elevation", async ({
  page,
}) => {
  test.setTimeout(90000);
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  type SceneEl = HTMLElement & {
    travelTo: (id: string) => void;
    arrivedId: string | null;
    sceneStats(): {
      planetSphereBody: string | null;
      planetSphereVisible: boolean;
      planetSphereReady: boolean;
      planetBodiesAvailable: number;
    };
  };

  // The manifest drives which bodies are sphere-capable; 0 here means the fetch failed and every
  // later assertion would be vacuous.
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as SceneEl).sceneStats().planetBodiesAvailable),
      { timeout: 20000 },
    )
    .toBeGreaterThan(0);

  // No destination yet — the sphere must be hidden, not floating at the origin.
  const idle = await page
    .locator("babylon-scene")
    .evaluate((el) => (el as SceneEl).sceneStats());
  expect(idle.planetSphereVisible).toBe(false);
  expect(idle.planetSphereBody).toBeNull();

  await page
    .locator("babylon-scene")
    .evaluate((el) => (el as SceneEl).travelTo("mars"));
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as SceneEl).arrivedId),
      { timeout: 30000 },
    )
    .toBe("mars");

  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as SceneEl).sceneStats().planetSphereVisible),
      { timeout: 15000 },
    )
    .toBe(true);

  const stats = await page
    .locator("babylon-scene")
    .evaluate((el) => (el as SceneEl).sceneStats());
  expect(stats.planetSphereBody).toBe("mars");
  expect(stats.planetSphereReady).toBe(true);
  // Binding two samplers is the TR-059 failure class; on WebGPU a bad bind kills the whole
  // frame and surfaces only as console output.
  expect(consoleErrors).toEqual([]);
});

// PF-10 C4.2 — the Venus cloud descent. The assertion that matters is Astra's honesty mandate:
// once the Magellan RADAR surface is on screen, the directional-lighting fork must be fully
// engaged, because lighting a radar map manufactures geometry that is not there. That is
// invisible in a screenshot and would pass any review, so it is asserted as behaviour here.
test("babylon: PF-10 C4.2 arriving at Venus descends through the real cloud deck", async ({
  page,
}) => {
  test.setTimeout(120000);
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  type SceneEl = HTMLElement & {
    travelTo: (id: string) => void;
    arrivedId: string | null;
    sceneStats(): {
      venusAltitudeKm: number;
      venusCloudVisible: boolean;
      planetSphereBody: string | null;
    };
  };

  await page
    .locator("babylon-scene")
    .evaluate((el) => (el as SceneEl).travelTo("venus"));
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as SceneEl).arrivedId),
      { timeout: 40000 },
    )
    .toBe("venus");

  // Deliberately NOT asserting "entry is above 70 km" here: arrival and the first descent tick
  // are a frame apart, and the poll above can land anywhere in the first seconds of a 20 s
  // descent, so that assertion is a race. What IS invariant is that the descent starts inside
  // the deck's range and falls monotonically, which is checked below.
  const entry = await page
    .locator("babylon-scene")
    .evaluate((el) => (el as SceneEl).sceneStats());
  expect(entry.planetSphereBody).toBe("venus");
  expect(entry.venusAltitudeKm).toBeGreaterThan(47.5);

  // The descent runs for 20 s of real time; by the end it must be BELOW the real cloud base
  // (47.5 km) and above the surface — Astra: do not land, there is nothing to see at 0 km.
  await expect
    .poll(
      () =>
        page
          .locator("babylon-scene")
          .evaluate((el) => (el as SceneEl).sceneStats().venusAltitudeKm),
      { timeout: 40000, intervals: [1000] },
    )
    .toBeLessThan(47.5);

  const end = await page
    .locator("babylon-scene")
    .evaluate((el) => (el as SceneEl).sceneStats());
  expect(end.venusAltitudeKm).toBeGreaterThan(0);
  expect(consoleErrors).toEqual([]);
});

// PF-10 C3 follow-up — the visual layer now ORBITS (real Keplerian differential rotation, rate
// derived in-shader from Kepler's third law so it costs no per-vertex data). The rotated
// positions live on the GPU and JS cannot read them, so the assertable behaviour is the clock
// that drives them — and specifically its reduced-motion contract, which is a real
// non-negotiable (#24) and not merely a source-text fact.
test("babylon: PF-10 C3 belt orbital clock runs normally and freezes under reduced motion", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  type SceneStatsEl = HTMLElement & {
    sceneStats(): { asteroidOrbitClock: number };
  };
  const clock = () =>
    page
      .locator("babylon-scene")
      .evaluate((el) => (el as SceneStatsEl).sceneStats().asteroidOrbitClock);

  await expect.poll(clock, { timeout: 20000 }).toBeGreaterThan(0);
  const first = await clock();
  await page.waitForTimeout(600);
  // The belt is genuinely animating, not merely non-zero once.
  expect(await clock()).toBeGreaterThan(first);
});

test("babylon: PF-10 C3 belt holds still under prefers-reduced-motion", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });

  type SceneStatsEl = HTMLElement & {
    sceneStats(): { asteroidOrbitClock: number; asteroidRealSource: string };
  };
  // Let the scene run long enough that a non-frozen clock would certainly have advanced.
  await page.waitForTimeout(1500);
  const stats = await page
    .locator("babylon-scene")
    .evaluate((el) => (el as SceneStatsEl).sceneStats());
  // Frozen, NOT missing: the belt still exists at its real snapshot positions — the reduced
  // motion contract is "no motion", not "no belt".
  expect(stats.asteroidOrbitClock).toBe(0);
  expect(stats.asteroidRealSource).toBe("gaia-dr3");
});

// NGC2000 billboard nebulae and the GD-1 connected-trail visual are now covered inside the
// merged "PF-10 catalog layers" test above (2026-07-25 E2E audit, TR-104) — they shared this
// same full-catalog boot with no reason to pay for it twice.

test("babylon: the star mesh survives the bonus-layer rebuild — the renderer keeps drawing (TR-113 C1)", async ({
  page,
}) => {
  test.setTimeout(90000);
  // THE REGRESSION GUARD THIS SUITE DID NOT HAVE.
  //
  // `_applyStarFieldGeometry` runs twice: once at boot, once when `_loadBonusStarLayers`
  // merges ~387k more records into the base star mesh. PF-11 D7.1 added
  // `geometry.clearCachedData()` to that method to free the CPU-side vertex copy; on the
  // SECOND call it left the mesh with no reconstructible `BoundingInfo`, so Babylon's
  // transparent depth sort threw INSIDE `scene.render()`. The throw landed before
  // `renderFrames++`, so the renderer froze permanently ~10 frames in, on every load and
  // every backend — and 880 green unit tests could not see any of it, because none of them
  // instantiates a GPU.
  //
  // This asserts BEHAVIOUR, not readiness (CLAUDE.md #18): frames must still be advancing
  // after the merge has demonstrably happened. `starCount` growing past the base catalog is
  // the proof the rebuild ran, so this can never pass by simply never merging.
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/?engine=babylon");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });
  const engine = page.locator("babylon-scene");
  const frames = () =>
    engine.evaluate(
      (el) => (el as unknown as { renderFrames: number }).renderFrames,
    );
  const starCount = () =>
    engine.evaluate((el) => (el as unknown as { starCount: number }).starCount);

  const base = await starCount();
  // The rebuild actually happened.
  await expect
    .poll(starCount, { timeout: 45000, intervals: [500, 1000] })
    .toBeGreaterThan(base);

  // ...and the renderer is still alive on the far side of it.
  const afterMerge = await frames();
  await expect
    .poll(frames, { timeout: 20000, intervals: [500, 1000] })
    .toBeGreaterThan(afterMerge);

  expect(
    errors,
    "an uncaught exception in the render loop freezes every later frame",
  ).toEqual([]);
});
