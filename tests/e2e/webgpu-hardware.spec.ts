/**
 * PF-09 B2 — real-hardware WebGPU validation (correction to TR-036/TR-038; see TR-039).
 *
 * TR-038 claimed "the WGSL twin is still unvalidated on real WebGPU hardware... Playwright's
 * chromium has no WebGPU adapter." Revalidated 2026-07-19: that conflated two different things.
 *
 *  - `navigator.gpu` DOES exist in Playwright's bundled chromium on a secure context (http(s), not
 *    about:blank) — no flags needed.
 *  - `requestAdapter()` on that BUNDLED binary genuinely returns null under every flag tried
 *    (--enable-unsafe-webgpu, ANGLE SwiftShader/Vulkan variants) — that part held.
 *  - Pointing Playwright at the REAL installed system browser instead (`channel: "chrome"`) DOES
 *    yield a real hardware adapter, no flags required — that is what this spec exercises.
 *
 * This is deliberately NOT the default project (playwright.config.ts is untouched) and NOT added
 * to the CI workflow: CI runs on GitHub's `ubuntu-latest`, which has no GPU hardware and does not
 * install the `chrome` channel, so this would almost certainly skip there too — adding it to CI
 * would be speculative cost with no proven payoff. Run this file locally on a machine with a real
 * GPU and an installed Chrome to get a genuine, if non-continuous, hardware proof.
 *
 * Every test here fails OPEN: if the real channel can't launch or no real adapter is available,
 * the test SKIPS with a stated reason rather than going red — this is an environment capability
 * check, not a regression gate.
 */
import {
  chromium,
  expect,
  test,
  type Browser,
  type Page,
} from "@playwright/test";

// Manually-launched browsers (chromium.launch(), not the page/browser fixture)
// don't inherit playwright.config.ts's use.baseURL — that's applied by the
// fixture layer. Spelled out explicitly rather than relying on relative goto().
const BASE_URL = "http://localhost:4321";

const readStats = (page: Page) =>
  page
    .locator("babylon-scene")
    .evaluate((el) =>
      (
        el as HTMLElement & { sceneStats(): Record<string, unknown> }
      ).sceneStats(),
    );

async function realAdapterOrSkip(): Promise<Browser> {
  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
  } catch (e) {
    test.skip(
      true,
      `real Chrome channel unavailable in this environment (${String(e).slice(0, 150)})`,
    );
    throw e; // unreachable — test.skip(true, ...) throws to abort the test
  }
  const probe = await browser.newPage();
  await probe.goto(BASE_URL);
  const hasAdapter = await probe.evaluate(async () => {
    const gpu = (
      navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }
    ).gpu;
    if (!gpu) return false;
    try {
      return !!(await gpu.requestAdapter());
    } catch {
      return false;
    }
  });
  await probe.close();
  if (!hasAdapter) {
    await browser.close();
    test.skip(true, "no real WebGPU adapter available in this environment");
  }
  return browser;
}

test("WGSL twin runs the real WebGPU backend on real GPU hardware", async () => {
  const browser = await realAdapterOrSkip();
  try {
    const page = await browser.newPage();
    // TR-045: WebGPU shader-module creation does NOT throw synchronously on
    // invalid WGSL — Babylon's isReady()/materialReady report true regardless,
    // because the browser validates asynchronously and reports failures via
    // an "uncaptured error" device event, which only ever surfaces as a
    // console message. A shader using a RESERVED WGSL IDENTIFIER (`meta`,
    // `ref` — real example, see git history) shipped with materialReady:true
    // and zero thrown exceptions, yet silently blanked the entire frame. This
    // listener is what would have caught it; materialReady alone did not.
    const consoleIssues: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning")
        consoleIssues.push(m.text());
    });
    await page.goto(`${BASE_URL}/?engine=babylon`);
    await page.waitForSelector("babylon-scene", { timeout: 15000 });

    // sceneStats() is the tested, definitive signal (see babylon-engine.ts) rather
    // than re-deriving a canvas pixel proof — this test's job is confirming the
    // WGSL twin actually ran, not re-proving drawing (engine-select.spec.ts does that).
    // <babylon-scene> mounts before the async engine/catalog boot resolves, so poll
    // rather than reading once (same race the catalog-source test hit — TR-038).
    // starSource resolves AFTER backend in _boot()'s sequential awaits, so polling
    // on it guarantees backend is already set too.
    await expect
      .poll(async () => (await readStats(page)).starSource, { timeout: 20000 })
      .not.toBeNull();

    // Let a few frames actually render before checking for async validation
    // errors — the uncaptured-error event fires on first submission of the
    // offending pipeline, not at shader-module creation time.
    await page.waitForTimeout(1000);

    const stats = await readStats(page);

    // This is ADR-0003 condition 2's exact assertion, run in an automatable
    // environment: previously discharged only via the owner reading a badge on a
    // physical Android. Real hardware, not emulation, driving the WGSL path.
    expect(stats.backend).toBe("webgpu");
    // B5: real WebGPU on a desktop-class machine resolves the FULL tier
    expect(stats.qualityTier).toBe("full");
    expect(stats.materialReady).toBe(true);
    expect(stats.starSource).toBe("catalog");
    expect(stats.starCount).toBe(168959);
    expect(Number(stats.activeIndices)).toBeGreaterThan(0);

    // B3: the shooting-star WGSL twin compiles and its mesh is ready too — a
    // second, independent shader pair on the same real adapter. A WGSL syntax
    // error here (unlike a TS type error) only ever surfaces at shader-compile
    // time, so this is the one place that would actually catch it.
    expect(stats.shootMeshReady).toBe(true);
    expect(stats.shootMaterialReady).toBe(true);
    expect(Number(stats.shootTotalVertices)).toBeGreaterThan(0);

    // B3 volumetric nebulae: on real WebGPU the producer must be the COMPUTE
    // raymarch (storage texture + dispatch), not the fragment fallback — and
    // its WGSL plus the composite's WGSL twin are two more shader programs
    // that only real hardware validates (same TR-045 class of risk).
    expect(stats.nebulaMode).toBe("compute");
    expect(stats.nebulaVolumes).toBe(4);
    await expect
      .poll(async () => (await readStats(page)).nebulaProducerReady, {
        timeout: 20000,
      })
      .toBe(true);
    await expect
      .poll(async () => (await readStats(page)).nebulaCompositeReady, {
        timeout: 20000,
      })
      .toBe(true);

    // B4 step 1: Havok must reach the real-physics tier on real hardware and
    // its WASM init must stay console-clean (covered by the assertion below).
    await expect
      .poll(async () => (await readStats(page)).physicsMode, {
        timeout: 30000,
      })
      .toBe("havok");
    expect(Number((await readStats(page)).physicsBodies)).toBeGreaterThan(0);

    // B3 ship track: hull GLB + plume + shimmer on the real WGSL path. The
    // plume material and shimmer post-process are two more WGSL programs only
    // real hardware validates — covered by the console assertion below.
    await expect
      .poll(async () => (await readStats(page)).shipState, { timeout: 30000 })
      .toBe("ready");
    await expect
      .poll(async () => (await readStats(page)).plumeReady, { timeout: 20000 })
      .toBe(true);

    // The check that actually catches TR-045's class of bug: no WebGPU
    // validation errors, no reserved-keyword/parse errors, nothing async that
    // materialReady's synchronous check can't see.
    expect(consoleIssues).toEqual([]);

    await page.close();
  } finally {
    await browser.close();
  }
});

test("HiDPI: WebGPU canvas renders at physical-pixel resolution, not CSS-pixel resolution (owner-reported blur)", async () => {
  // The owner reported the deployed demo reads as blurry on desktop. Root
  // cause: WebGPUEngine's adaptToDeviceRatio has NO positional constructor
  // slot (unlike the WebGL2 Engine, which took it as a 4th arg and was
  // already correct) — it must be set via the options object, and was
  // silently defaulting to false. On any HiDPI display the canvas rendered
  // at 1x CSS-pixel resolution, then got stretched by the browser to fill the
  // physical pixel grid. Simulated here with deviceScaleFactor: 2 (a common
  // Windows/macOS HiDPI value) rather than trusting the fix by inspection.
  const browser = await realAdapterOrSkip();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    await page.goto(`${BASE_URL}/?engine=babylon`);
    await page.waitForSelector("babylon-scene", { timeout: 15000 });
    await expect
      .poll(async () => (await readStats(page)).starSource, { timeout: 20000 })
      .not.toBeNull();

    const res = await page.locator("babylon-scene canvas").evaluate((c) => {
      const canvas = c as HTMLCanvasElement;
      return {
        bufferWidth: canvas.width,
        clientWidth: canvas.clientWidth,
        dpr: window.devicePixelRatio,
      };
    });

    // Buffer resolution must scale with the emulated 2x DPR, not stay at 1x
    // CSS-pixel resolution. Allow rounding slack rather than an exact ratio.
    const ratio = res.bufferWidth / res.clientWidth;
    expect(res.dpr).toBe(2);
    expect(ratio).toBeGreaterThan(1.8);

    await page.close();
  } finally {
    await browser.close();
  }
});
