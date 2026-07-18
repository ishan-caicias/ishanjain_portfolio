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
