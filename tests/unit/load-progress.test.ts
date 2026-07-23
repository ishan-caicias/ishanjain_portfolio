import { describe, expect, it } from "vitest";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import {
  BOOT_CRITICAL_ASSETS,
  fetchWithProgress,
  isBootCritical,
  StageAggregator,
  STAGE_PROGRESS_MAX_HZ,
  type LoadStage,
  type StageProgress,
} from "@/lib/load-progress";
import { assets as assetBudgets } from "../../budgets.config.mjs";

/** Builds a mock `fetch` returning a body that streams `chunks` (each a Uint8Array),
 * one per `reader.read()` call, with an optional Content-Length header. */
function mockStreamingFetch(
  chunks: Uint8Array[],
  opts: { contentLength?: number; contentType?: string } = {},
): typeof fetch {
  return (async () => {
    let i = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i < chunks.length) {
          controller.enqueue(chunks[i]);
          i++;
        } else {
          controller.close();
        }
      },
    });
    const headers = new Headers();
    if (opts.contentLength !== undefined) {
      headers.set("content-length", String(opts.contentLength));
    }
    if (opts.contentType) headers.set("content-type", opts.contentType);
    return new Response(stream, { status: 200, headers });
  }) as unknown as typeof fetch;
}

/** A fetch whose Response has no readable body (the fallback path) but still resolves
 * a real blob via `.blob()` — mirrors what some fetch polyfills / opaque responses give.
 * Built as a plain stand-in rather than `new Response(blob)`: jsdom's fetch polyfill
 * stringifies a Blob body instead of reading it (`res.blob().size` comes back as
 * `"[object Blob]".length`, not the real byte count) — a test-environment quirk, not a
 * behaviour of real browser `Response`, so it's worked around here rather than "fixed". */
function mockNoBodyFetch(bytes: Uint8Array): typeof fetch {
  const headers = new Headers();
  return (async () =>
    ({
      ok: true,
      status: 200,
      headers,
      body: null,
      blob: async () => new Blob([bytes as BlobPart]),
    }) as unknown as Response) as unknown as typeof fetch;
}

function fakeClock(startAtMs = 0) {
  let t = startAtMs;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("isBootCritical", () => {
  it("classifies exactly the four boot-critical stages", () => {
    const critical: LoadStage[] = [
      "engine-init",
      "star-catalog",
      "atlas-map",
      "first-frame",
    ];
    const background: LoadStage[] = [
      "craft-glb",
      "havok-wasm",
      "bonus-layers",
      "sdss-field",
      "asteroid-belt",
      "atlas-photo",
    ];
    for (const s of critical) expect(isBootCritical(s)).toBe(true);
    for (const s of background) expect(isBootCritical(s)).toBe(false);
  });
});

describe("fetchWithProgress", () => {
  it("reports monotonically increasing loadedBytes and a final done:true event", async () => {
    const c1 = new Uint8Array(1000).fill(1);
    const c2 = new Uint8Array(1500).fill(2);
    const c3 = new Uint8Array(500).fill(3);
    const clock = fakeClock();
    const events: StageProgress[] = [];

    const blob = await fetchWithProgress(
      "stars-hip.png",
      "star-catalog",
      (p) => {
        events.push(p);
        clock.advance(1000 / STAGE_PROGRESS_MAX_HZ); // force every chunk past the throttle
      },
      {
        now: clock.now,
        fetchImpl: mockStreamingFetch([c1, c2, c3], { contentLength: 3000 }),
      },
    );

    expect(blob.size).toBe(3000);
    expect(events.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].loadedBytes).toBeGreaterThanOrEqual(
        events[i - 1].loadedBytes,
      );
    }
    const last = events[events.length - 1];
    expect(last.done).toBe(true);
    expect(last.loadedBytes).toBe(3000);
    expect(last.totalBytes).toBe(3000);
    expect(last.bootCritical).toBe(true);
    // exactly one done:true event, and it's the last one
    expect(events.filter((e) => e.done).length).toBe(1);
  });

  it("totals match the fixture's real byte size even when Content-Length is absent", async () => {
    const chunks = [new Uint8Array(2048).fill(7), new Uint8Array(1024).fill(8)];
    const clock = fakeClock();
    let final: StageProgress | null = null;

    await fetchWithProgress(
      "atlas-map.json",
      "atlas-map",
      (p) => {
        final = p;
        clock.advance(1000);
      },
      { now: clock.now, fetchImpl: mockStreamingFetch(chunks) },
    );

    expect(final).not.toBeNull();
    expect(final!.totalBytes).toBe(final!.loadedBytes);
    expect(final!.loadedBytes).toBe(2048 + 1024);
  });

  it("throttles in-progress callbacks to STAGE_PROGRESS_MAX_HZ but never the final event", async () => {
    const chunkCount = 20;
    const chunks = Array.from({ length: chunkCount }, () => new Uint8Array(10));
    const clock = fakeClock();
    const events: StageProgress[] = [];

    // Advance the clock by less than one throttle interval per chunk — most in-progress
    // callbacks should be dropped, but the loop must still converge on one final done event.
    await fetchWithProgress(
      "sdss18.png",
      "sdss-field",
      (p) => {
        events.push(p);
        clock.advance(1); // 1ms << 250ms throttle interval at 4Hz
      },
      { now: clock.now, fetchImpl: mockStreamingFetch(chunks) },
    );

    const inProgress = events.filter((e) => !e.done);
    // 20 chunks at ~1ms apart under a 250ms throttle should collapse to (at most) a
    // small handful of in-progress emits, not 20.
    expect(inProgress.length).toBeLessThan(chunkCount);
    expect(events[events.length - 1].done).toBe(true);
    expect(events[events.length - 1].loadedBytes).toBe(chunkCount * 10);
  });

  it("falls back to blob() and still emits one done:true event when the body has no reader", async () => {
    const bytes = new Uint8Array(512).fill(9);
    const events: StageProgress[] = [];

    const blob = await fetchWithProgress(
      "craft-2k.glb",
      "craft-glb",
      (p) => events.push(p),
      { fetchImpl: mockNoBodyFetch(bytes) },
    );

    expect(blob.size).toBe(512);
    expect(events.length).toBe(1);
    expect(events[0].done).toBe(true);
    expect(events[0].loadedBytes).toBe(512);
    expect(events[0].totalBytes).toBe(512);
    expect(events[0].bootCritical).toBe(false); // craft-glb is background, not boot-critical
  });

  it("rejects on a non-OK response, same as a plain fetch().blob() would surface", async () => {
    const failing = (async () =>
      new Response(null, { status: 404 })) as unknown as typeof fetch;
    await expect(
      fetchWithProgress("missing.png", "star-catalog", () => {}, {
        fetchImpl: failing,
      }),
    ).rejects.toThrow(/404/);
  });
});

describe("StageAggregator", () => {
  it("sums two chunks into ONE monotone counter that never jumps backwards", () => {
    const seen: StageProgress[] = [];
    const agg = new StageAggregator("star-catalog", (p) => seen.push(p));
    const a = agg.sink("assets/stars-hip.png");
    const b = agg.sink("assets/deep.png");

    // Interleave the two chunks the way parallel fetches really arrive.
    a({
      stage: "star-catalog",
      loadedBytes: 500,
      totalBytes: 2000,
      done: false,
      bootCritical: true,
    });
    b({
      stage: "star-catalog",
      loadedBytes: 300,
      totalBytes: 900,
      done: false,
      bootCritical: true,
    });
    a({
      stage: "star-catalog",
      loadedBytes: 2000,
      totalBytes: 2000,
      done: true,
      bootCritical: true,
    });
    b({
      stage: "star-catalog",
      loadedBytes: 900,
      totalBytes: 900,
      done: true,
      bootCritical: true,
    });

    for (let i = 1; i < seen.length; i++) {
      expect(seen[i].loadedBytes).toBeGreaterThanOrEqual(
        seen[i - 1].loadedBytes,
      );
    }
    const last = seen[seen.length - 1];
    expect(last.loadedBytes).toBe(2900);
    expect(last.totalBytes).toBe(2900);
    // The per-URL `done` flags must NOT leak through as a stage completion —
    // only finish() ends the stage.
    expect(seen.every((p) => !p.done)).toBe(true);
  });

  it("withholds a total until every part's total is known, so a bar cannot hit 100% early", () => {
    const seen: StageProgress[] = [];
    const agg = new StageAggregator("bonus-layers", (p) => seen.push(p));
    const a = agg.sink("a.png");
    agg.sink("b.png"); // registered but never started — its total is still unknown

    a({
      stage: "bonus-layers",
      loadedBytes: 100,
      totalBytes: 100,
      done: true,
      bootCritical: false,
    });

    expect(seen[seen.length - 1].totalBytes).toBeNull();
    expect(seen[seen.length - 1].loadedBytes).toBe(100);
  });

  it("finish() emits exactly one done event, is idempotent, and carries records", () => {
    const seen: StageProgress[] = [];
    const agg = new StageAggregator("star-catalog", (p) => seen.push(p));
    const a = agg.sink("x.png");
    a({
      stage: "star-catalog",
      loadedBytes: 42,
      totalBytes: 42,
      done: true,
      bootCritical: true,
    });

    agg.finish(168959);
    agg.finish(168959); // second call must be a no-op
    agg.sink("late.png")({
      stage: "star-catalog",
      loadedBytes: 7,
      totalBytes: 7,
      done: false,
      bootCritical: true,
    }); // post-finish sinks must not emit either

    const doneEvents = seen.filter((p) => p.done);
    expect(doneEvents.length).toBe(1);
    expect(doneEvents[0].records).toBe(168959);
    expect(doneEvents[0].loadedBytes).toBe(42);
    expect(seen[seen.length - 1].done).toBe(true);
  });

  it("falls back to the summed loaded bytes as the total when finishing with unknown totals", () => {
    const seen: StageProgress[] = [];
    const agg = new StageAggregator("atlas-map", (p) => seen.push(p));
    agg.sink("m.json")({
      stage: "atlas-map",
      loadedBytes: 11624,
      totalBytes: null,
      done: false,
      bootCritical: true,
    });
    agg.finish();

    const last = seen[seen.length - 1];
    expect(last.totalBytes).toBe(11624);
    expect(last.done).toBe(true);
  });
});

describe("boot-critical download budget", () => {
  // The honesty contract has a weight consequence: whatever the engine fetches under a
  // boot-critical stage is what a default visitor waits through before LAUNCH arms. This
  // asserts the REAL on-disk sum against the declared ceiling, so growth in either the
  // asset or the boot-critical list trips the gate rather than silently lengthening the
  // wait. Deliberate raises go in budgets.config.mjs with a comment, per that file's rule.
  it("the real on-disk sum of BOOT_CRITICAL_ASSETS stays within budgets.config.mjs", () => {
    let totalBytes = 0;
    for (const rel of BOOT_CRITICAL_ASSETS) {
      const abs = resolve(process.cwd(), "public", rel);
      const size = statSync(abs).size; // throws if the engine's list names a missing file
      expect(size).toBeGreaterThan(0);
      totalBytes += size;
    }
    const totalKB = totalBytes / 1024;
    expect(assetBudgets.bootCriticalDownloadKB).toBeGreaterThan(0);
    expect(totalKB).toBeLessThanOrEqual(assetBudgets.bootCriticalDownloadKB);
  });
});
