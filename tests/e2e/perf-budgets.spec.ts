/**
 * PF-09 B6 — CI performance regression canaries.
 *
 * HONESTY FIRST (doctrine #4 / ADR-0003): the real per-device budgets
 * (60 fps desktop, ≥40 mid-Android, startup ≤2.5–4.0 s by class) can ONLY be
 * measured on real hardware — this CI class (SwiftShader, shared runners) is
 * not a device class. What CI *can* guard is order-of-magnitude regression:
 * a startup that balloons, a render loop that dies, an engine that stops
 * producing frames. Ceilings here are deliberately generous CI-class values,
 * NOT the product budgets; the cutover checklist carries the real ones.
 */
import { expect, test, type Page } from "@playwright/test";

type PerfSnapshot = {
  engine: string;
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

// CI-class regression ceilings (not device budgets — see header).
const STARTUP_CEILING_MS = { webgl: 10000, babylon: 25000 } as const;
const FPS_FLOOR = 5; // render-loop-death canary on SwiftShader
const SETTLE_MS = 2500;

for (const engine of ["webgl", "babylon"] as const) {
  test(`${engine}: startup and frame-production stay within CI regression ceilings`, async ({
    page,
  }) => {
    // post-cutover (ADR-0006): babylon IS the default; webgl is the archived
    // engine behind its explicit flag
    await page.goto(engine === "webgl" ? "/?engine=webgl" : "/");
    await page.waitForSelector(
      engine === "webgl" ? "space-engine" : "babylon-scene",
      { timeout: 15000 },
    );

    // startup = mount → cosmos:ready, reported by the shared perf harness
    await expect
      .poll(async () => (await perf(page)).startupMs !== null, {
        timeout: STARTUP_CEILING_MS[engine],
      })
      .toBe(true);
    const boot = await perf(page);
    expect(boot.engine).toBe(engine);
    expect(boot.startupMs!).toBeLessThan(STARTUP_CEILING_MS[engine]);

    // frame production: fps above the death-canary floor and frames advancing
    await page.waitForTimeout(SETTLE_MS);
    const settled = await perf(page);
    expect(settled.fps).toBeGreaterThan(FPS_FLOOR);
    expect(settled.frames).toBeGreaterThan(boot.frames);
  });
}
