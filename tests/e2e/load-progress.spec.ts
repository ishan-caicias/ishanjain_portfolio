/**
 * PF-11 D1.1 — the honesty contract, asserted end to end.
 *
 * The pre-flight dossier (D1.2) will show a visitor how much of the scene has actually
 * loaded. This repo refuses fabricated progress UIs (CLAUDE.md measurement discipline —
 * it has voided its own gate rounds over broken instruments before, TR-032/033), so the
 * numbers behind that dossier have to be real: bytes read off a `ReadableStream` reader,
 * compared here against the true sizes of the files on disk that the preview server is
 * serving.
 *
 * What this spec is actually guarding, beyond "an event fires":
 *   1. **Monotonicity.** A counter that jumps backwards is a lying counter. The
 *      `star-catalog` stage spans TWO parallel PNG fetches, which is exactly the shape
 *      that produces a backwards jump if the aggregation is wrong.
 *   2. **Totals are the real file sizes**, byte for byte — not a plausible-looking number.
 *      This is D1-AC4's automated half (the manual half is a human reading the dossier).
 *   3. **Every stage closes.** A stage that streams forever would hang D1.2's stall
 *      detector, and several engine paths degrade gracefully rather than throwing —
 *      those are precisely the paths where a stage could be left open.
 *
 * Per CLAUDE.md #18 these are behaviours observed through the real event bus on a real
 * boot, not readiness flags.
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

interface StageEvent {
  stage: string;
  loadedBytes: number;
  totalBytes: number | null;
  records?: number;
  done: boolean;
  bootCritical: boolean;
}

declare global {
  interface Window {
    __ijStages?: StageEvent[];
  }
}

/** Installed BEFORE any page script runs — `cosmos:stage` events for the boot-critical
 * stages fire during `_boot`, long before `page.goto` resolves, so a listener attached
 * afterwards would miss the very events under test. */
async function captureStages(page: Page) {
  await page.addInitScript(() => {
    window.__ijStages = [];
    window.addEventListener("cosmos:stage", (e) => {
      window.__ijStages!.push((e as CustomEvent).detail as StageEvent);
    });
  });
}

const readStages = (page: Page) =>
  page.evaluate(() => window.__ijStages ?? []) as Promise<StageEvent[]>;

const sizeOf = (relPath: string) =>
  statSync(resolve(process.cwd(), relPath)).size;

/** The Vite-emitted Havok binary carries a content hash, so it is located by extension
 * rather than by a name that would rot on every dependency bump. */
function havokWasmSize(): number {
  const dir = resolve(process.cwd(), "dist/_astro");
  const wasm = readdirSync(dir).filter((f) => f.endsWith(".wasm"));
  expect(
    wasm.length,
    `expected exactly one .wasm in dist/_astro, found ${wasm.length}`,
  ).toBe(1);
  return statSync(resolve(dir, wasm[0])).size;
}

/** Collapses a stage's event list to its last reading, and asserts the invariants every
 * stage must satisfy regardless of which stage it is. */
function assertStageWellFormed(
  events: StageEvent[],
  stage: string,
): StageEvent {
  const mine = events.filter((e) => e.stage === stage);
  expect(mine.length, `no cosmos:stage events for "${stage}"`).toBeGreaterThan(
    0,
  );

  for (let i = 1; i < mine.length; i++) {
    expect(
      mine[i].loadedBytes,
      `"${stage}" loadedBytes went BACKWARDS (${mine[i - 1].loadedBytes} -> ${mine[i].loadedBytes}) — a counter that decreases is a lying counter`,
    ).toBeGreaterThanOrEqual(mine[i - 1].loadedBytes);
  }

  const done = mine.filter((e) => e.done);
  expect(
    done.length,
    `"${stage}" must emit exactly ONE done event, saw ${done.length}`,
  ).toBe(1);
  expect(
    mine[mine.length - 1].done,
    `"${stage}"'s done event must be its last`,
  ).toBe(true);

  return done[0];
}

test.describe("PF-11 D1.1 real progress instrumentation", () => {
  test("boot-critical stages all complete, monotonically, with totals equal to the real files on disk", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await captureStages(page);
    await page.goto("/");
    await page.waitForSelector("babylon-scene");

    // Drive on real behaviour: wait until all four boot-critical stages have closed.
    // This is the exact condition D1.2 will arm LAUNCH on.
    await expect
      .poll(
        async () => {
          const events = await readStages(page);
          return new Set(
            events.filter((e) => e.done && e.bootCritical).map((e) => e.stage),
          ).size;
        },
        { timeout: 40000 },
      )
      .toBe(4);

    const events = await readStages(page);

    const engineInit = assertStageWellFormed(events, "engine-init");
    const catalog = assertStageWellFormed(events, "star-catalog");
    const atlas = assertStageWellFormed(events, "atlas-map");
    const firstFrame = assertStageWellFormed(events, "first-frame");

    for (const s of [engineInit, catalog, atlas, firstFrame]) {
      expect(s.bootCritical, `${s.stage} must be flagged boot-critical`).toBe(
        true,
      );
    }

    // THE honesty assertion: the star-catalog stage aggregates two real PNG chunks, and
    // its reported total must equal their true combined size — not approximately.
    const catalogBytes =
      sizeOf("public/assets/stars-hip.png") + sizeOf("public/assets/deep.png");
    expect(
      catalog.totalBytes,
      "star-catalog total must equal stars-hip.png + deep.png on disk",
    ).toBe(catalogBytes);
    expect(catalog.loadedBytes).toBe(catalogBytes);
    // The real catalog decoded, so the stage carries the real record count.
    expect(catalog.records).toBeGreaterThanOrEqual(168959);

    expect(
      atlas.totalBytes,
      "atlas-map total must equal atlas-map.json on disk",
    ).toBe(sizeOf("public/assets/atlas-map.json"));

    // engine-init and first-frame are checkpoints, not transfers — zero bytes is the
    // honest reading, and claiming otherwise would be the fabrication this slice exists
    // to prevent.
    expect(engineInit.loadedBytes).toBe(0);
    expect(firstFrame.loadedBytes).toBe(0);
  });

  test("background stages report their real byte totals too (D1-AC4 automated half)", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await captureStages(page);
    await page.goto("/");
    await page.waitForSelector("babylon-scene");

    // Havok WASM and the craft GLB are both post-ready, non-boot-critical downloads —
    // the two D1-AC4 names besides stars-hip (covered above). Neither was observable by
    // ANY progress UI before this slice: Havok fetched its binary inside the Emscripten
    // factory, and ImportMeshAsync's onProgress was simply never passed.
    await expect
      .poll(
        async () => {
          const events = await readStages(page);
          const closed = new Set(
            events.filter((e) => e.done).map((e) => e.stage),
          );
          return closed.has("havok-wasm") && closed.has("craft-glb");
        },
        { timeout: 60000 },
      )
      .toBe(true);

    const events = await readStages(page);
    const havok = assertStageWellFormed(events, "havok-wasm");
    const craft = assertStageWellFormed(events, "craft-glb");

    expect(havok.bootCritical).toBe(false);
    expect(craft.bootCritical).toBe(false);

    expect(
      havok.totalBytes,
      "havok-wasm total must equal the emitted .wasm on disk",
    ).toBe(havokWasmSize());

    // The craft tier is resolved at runtime from device signals, so the file to compare
    // against is whichever tier the engine actually chose — read it back rather than
    // assumed.
    const tier = await page
      .locator("babylon-scene")
      .evaluate(
        (el) =>
          (
            el as HTMLElement & { sceneStats(): Record<string, unknown> }
          ).sceneStats().shipTier as string,
      );
    expect(["1k", "2k"]).toContain(tier);
    expect(
      craft.totalBytes,
      `craft-glb total must equal the ${tier} GLB on disk`,
    ).toBe(sizeOf(`public/assets/craft/sci-fi-fighter-${tier}.glb`));
  });

  test("cosmos:progress keeps its original payload shape (additive-events contract)", async ({
    page,
  }) => {
    // The event bus is shared by both engines and asserted by the rest of this suite;
    // cosmos:stage is ADDITIVE and must not have changed cosmos:progress out from under
    // the HUD. Cheap to assert, and it is exactly the kind of silent contract break the
    // repo's own rules call out.
    await page.addInitScript(() => {
      (window as unknown as { __ijProgress: unknown[] }).__ijProgress = [];
      window.addEventListener("cosmos:progress", (e) => {
        (window as unknown as { __ijProgress: unknown[] }).__ijProgress.push(
          (e as CustomEvent).detail,
        );
      });
    });
    await page.goto("/");
    await page.waitForSelector("babylon-scene");

    await expect
      .poll(
        async () =>
          (
            await page.evaluate(
              () =>
                (window as unknown as { __ijProgress: unknown[] }).__ijProgress,
            )
          ).length,
        { timeout: 40000 },
      )
      .toBeGreaterThan(0);

    const payloads = (await page.evaluate(
      () => (window as unknown as { __ijProgress: unknown[] }).__ijProgress,
    )) as Array<Record<string, unknown>>;

    for (const p of payloads) {
      expect(Object.keys(p).sort()).toEqual(["loaded", "total"]);
      expect(typeof p.loaded).toBe("number");
      expect(typeof p.total).toBe("number");
    }
  });
});

test("the boot-critical asset list matches what budgets.config.mjs gates", () => {
  // Guards the seam between the engine's real download set and the declared ceiling.
  // The unit suite asserts the sum against the budget; this asserts the list itself has
  // not drifted from the files the engine actually fetches on the boot path, read out of
  // the module rather than restated here.
  const src = readFileSync(
    resolve(process.cwd(), "src/lib/load-progress.ts"),
    "utf8",
  );
  for (const asset of [
    "assets/stars-hip.png",
    "assets/deep.png",
    "assets/atlas-map.json",
  ]) {
    expect(
      src.includes(asset),
      `${asset} should be listed in BOOT_CRITICAL_ASSETS`,
    ).toBe(true);
  }
});
