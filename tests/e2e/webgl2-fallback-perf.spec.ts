/**
 * PF-09 B6 A4 — real-hardware WebGL2-fallback perf measurement.
 *
 * The B6 checklist §A device-class table has five rows; A4 ("No WebGPU
 * (WebGL2)", floor ≥30 fps) is the one row this desk can actually produce a
 * trustworthy reading for without the owner's mobile/tablet hardware.
 * `createEngine()` (babylon-engine.ts ~L1482) probes `navigator.gpu` and
 * silently falls back to WebGL2 on any failure/absence — there is no
 * override hook. webgpu-hardware.spec.ts (TR-039) already proved
 * `chromium.launch({ channel: "chrome" })` gets a genuine hardware adapter on
 * this machine (unlike Playwright's bundled Chromium/SwiftShader, which has
 * none at all). The mirror trick forces the OTHER branch: launch that same
 * real Chrome with WebGPU turned off at the browser level, so
 * `createEngine()`'s own `requestAdapter()` probe resolves null and it takes
 * the real WebGL2 branch — on genuine desktop GPU acceleration, not
 * SwiftShader. **`--disable-features=WebGPU` alone was probed live against
 * this machine's installed Chrome (152.x) and does NOT work** — WebGPU has
 * since shipped to stable and `navigator.gpu.requestAdapter()` still
 * resolves a real adapter with only that flag; `WebGPUService` and
 * `WebGPUDeveloperFeatures` must be disabled alongside it (see
 * `realChromeOrSkip` below) to actually null the adapter — confirmed via a
 * throwaway probe script, not assumed. WebGL2 itself stays completely
 * untouched by this flag combo: the same probe read back
 * `UNMASKED_RENDERER_WEBGL` as a real "ANGLE (<vendor>) ... Direct3D11"
 * string, not SwiftShader. Run against `npm run preview`'s output (a
 * secure `http://localhost` origin), so this reading isolates "WebGPU off"
 * from the insecure-LAN-origin issue that invalidated the owner's own phone
 * readings (see docs/analysis/2026-07-29-owner-device-pass-and-defect-triage.md §1a).
 *
 * What this IS: a legitimate proxy for the A4 floor — real GPU, real
 * browser, the real fallback code path, on a secure origin.
 * What this is NOT: a substitute for the owner's own A1 (desktop 60fps),
 * A2 (iPad), A3 (mid-Android) readings, which stay owner-only (this desk's
 * hardware is the A1 desktop-class machine, not a mobile/tablet device), or
 * for a genuinely GPU-less/software-rendering WebGL2 device — "no WebGPU
 * adapter on a real desktop GPU" and "no real GPU at all" are different
 * failure modes; only the former is measured here.
 *
 * Deliberately NOT the default project and NOT added to CI, same rationale
 * as webgpu-hardware.spec.ts: CI's `ubuntu-latest` runners have no GPU and
 * don't install the `chrome` channel, so this would almost certainly skip
 * there too. Fails OPEN: no real Chrome channel → skip with a stated reason,
 * not a red build.
 */
import {
  chromium,
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";
import type { PerfSnapshot } from "@/lib/perf-telemetry";

// Manually-launched browsers (chromium.launch(), not the page/browser
// fixture) don't inherit playwright.config.ts's use.baseURL.
const BASE_URL = "http://localhost:4321";

// PF-09 budget table row for "No WebGPU (WebGL2)": sustained fps floor.
const WEBGL2_FALLBACK_FPS_FLOOR = 30;

async function realChromeOrSkip(): Promise<Browser> {
  try {
    return await chromium.launch({
      headless: true,
      channel: "chrome",
      // `--disable-features=WebGPU` ALONE is a no-op on this machine's
      // Chrome 152 (WebGPU has since shipped to stable) — requestAdapter()
      // still resolves a real adapter. WebGPUService +
      // WebGPUDeveloperFeatures must go with it to actually null the
      // adapter and force createEngine()'s real WebGL2 fallback branch
      // (not a mocked/stubbed one). Confirmed live, see header comment.
      // WebGL2/ANGLE hardware acceleration itself is untouched by this.
      args: ["--disable-features=WebGPU,WebGPUService,WebGPUDeveloperFeatures"],
    });
  } catch (e) {
    test.skip(
      true,
      `real Chrome channel unavailable in this environment (${String(e).slice(0, 150)})`,
    );
    throw e; // unreachable — test.skip(true, ...) throws to abort the test
  }
}

const perfSnapshot = (page: Page) =>
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

test("A4: WebGL2 fallback (WebGPU disabled) sustains the >=30fps floor on real desktop GPU hardware", async () => {
  test.setTimeout(90_000); // real catalog decode + WASM inits, not SwiftShader-slow but not instant either

  const browser = await realChromeOrSkip();
  try {
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    // Pin the current default engine explicitly (this spec is asserting
    // Babylon-specific fallback behaviour, not an engine-agnostic mechanism —
    // CLAUDE.md's E2E convention #17) and opt into the debug overlay so the
    // host-side perf harness (window.__ijPerf) is armed.
    await page.goto(`${BASE_URL}/?engine=babylon&perf=1`);
    await page.waitForSelector("babylon-scene", { timeout: 15000 });

    // Confirm the WebGPU path is really closed off before trusting anything
    // else below — this is what makes the reading "WebGL2 fallback", not an
    // accidental WebGPU pass. `navigator.gpu` stays present as an object
    // (real Chrome keeps the API surface) but `requestAdapter()` resolves
    // null under the flag combo above — exactly the condition
    // `createEngine()`'s own probe checks before falling back.
    const adapter = await page.evaluate(async () => {
      const gpu = (
        navigator as Navigator & {
          gpu?: { requestAdapter(): Promise<unknown | null> };
        }
      ).gpu;
      if (!gpu) return null;
      try {
        return await gpu.requestAdapter();
      } catch {
        return null;
      }
    });
    expect(adapter).toBeNull();

    // Wait for the engine to actually resolve a backend, then confirm it
    // landed on webgl2 — the fallback branch this test exists to measure,
    // not a silent success on the primary path (TR-038's "a fallback must
    // report its provenance" doctrine, applied to the backend instead of
    // starSource).
    await expect
      .poll(async () => (await perfSnapshot(page)).backend, { timeout: 20000 })
      .toBe("webgl2");

    // Cross-check against the OTHER backend-reporting mechanism
    // (<babylon-scene>.sceneStats(), the one webgpu-hardware.spec.ts already
    // uses) — two independent readers agreeing is stronger evidence than one.
    const stats = await page
      .locator("babylon-scene")
      .evaluate((el) =>
        (
          el as HTMLElement & { sceneStats(): Record<string, unknown> }
        ).sceneStats(),
      );
    expect(stats.backend).toBe("webgl2");

    // Let the scene run for real before sampling: renderFps is a 2s
    // trailing-window rate (RENDER_FPS_WINDOW_MS), and startup-adjacent
    // asset loads (ship GLB, Havok WASM, nebula compute-or-fragment setup)
    // are still settling for the first second or two.
    await page.waitForTimeout(6000);
    const snap = await perfSnapshot(page);

    // --- Measurement-validity guards (CLAUDE.md "Measurement discipline") ---
    // An instrument needs its own validity checks before its number is
    // trusted — reject rather than silently report an impossible reading.
    expect(snap.backend, "backend must still read webgl2 at sample time").toBe(
      "webgl2",
    );
    expect(
      snap.renderFrames,
      "renderFrames must be a positive count — 0/null means the scene animated host-side rAF ticks without the engine actually drawing",
    ).not.toBeNull();
    expect(snap.renderFrames as number).toBeGreaterThan(0);
    expect(
      snap.renderFps,
      "renderFps needs >=2 engine-frame samples to exist at all",
    ).not.toBeNull();
    expect(
      snap.displayHz,
      "displayHz must be a real, positive estimate",
    ).toBeGreaterThan(0);
    expect(
      snap.renderFps as number,
      `renderFps (${snap.renderFps}) exceeds displayHz (${snap.displayHz}) — rAF is vsync-locked, so this is an impossible reading, not a fast one`,
    ).toBeLessThanOrEqual(snap.displayHz);
    expect(
      snap.startupMs,
      "startupMs must have resolved (cosmos:ready fired) by sample time",
    ).not.toBeNull();
    expect(
      snap.startupMs as number,
      "startupMs < 300ms is implausible for this scene's real asset/catalog load and signals an instrument bug, not a fast boot",
    ).toBeGreaterThanOrEqual(300);

    // --- The actual A4 gate assertion ---
    expect(
      snap.renderFps as number,
      `A4 floor: WebGL2-fallback renderFps (${snap.renderFps}) must be >=${WEBGL2_FALLBACK_FPS_FLOOR} on real (non-SwiftShader) desktop GPU hardware`,
    ).toBeGreaterThanOrEqual(WEBGL2_FALLBACK_FPS_FLOOR);

    // Report the actual numbers into the test output for the record — this
    // is the whole point of the spec, not incidental logging.
    console.log(
      `[A4 measured] backend=${snap.backend} tier=${snap.tier} startupMs=${snap.startupMs} ` +
        `fps=${snap.fps} renderFps=${snap.renderFps} renderFrames=${snap.renderFrames} ` +
        `displayHz=${snap.displayHz} device=${JSON.stringify(snap.device)}`,
    );

    expect(
      consoleErrors,
      `unexpected console errors: ${consoleErrors.join(" | ")}`,
    ).toEqual([]);
    expect(
      pageErrors,
      `unexpected page errors: ${pageErrors.join(" | ")}`,
    ).toEqual([]);

    await page.close();
  } finally {
    await browser.close();
  }
});
