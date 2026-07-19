/**
 * PF-09 B0 — dual-engine scaffold + perf telemetry.
 *
 * Verifies the B0 exit criterion: both engines load behind the ?engine flag and
 * telemetry reports startup + fps on demand (window.__ijPerf()). The default
 * path must still mount the current <space-engine>; ?engine=babylon swaps to the
 * Babylon preview without console errors.
 */
import { expect, test, type Page } from "@playwright/test";

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
  // 24 particles * 4 verts, 24 * 6 indices — see shooting-stars.ts's default count.
  expect(stats.shootTotalVertices).toBe(96);
  expect(stats.shootTotalIndices).toBe(144);
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

  await page.getByRole("button", { name: "RNG" }).click();

  // Aim phase (~900ms) holds position, then warp starts: the accel readout
  // should appear well inside the ~1.1s accel window (k < 0.47 of 2400ms).
  await expect(page.getByText("ACCELERATION BURN")).toBeVisible({
    timeout: 4000,
  });
  await expect(page.getByText(/APPARENT VELOCITY/)).toBeVisible({
    timeout: 4000,
  });

  // Deceleration burn (k > 0.53) should follow before arrival.
  await expect(page.getByText("DECELERATION BURN")).toBeVisible({
    timeout: 4000,
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
  await expect.poll(readArrivedId, { timeout: 4000 }).not.toBeNull();

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
