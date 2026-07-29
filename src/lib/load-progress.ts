/* load-progress.ts — PF-11 D1.1: real progress instrumentation (the honesty contract).
 *
 * The pre-flight dossier (D1.2) must derive its progress bars from REAL byte/record counts,
 * never a timed animation — this repo already refuses fabricated progress UIs (CLAUDE.md
 * measurement discipline; the D1.1 audit found the current HUD's "STREAMING CHUNK" bar sits
 * at 0% then jumps, because nothing on the Babylon boot path reads real bytes at all). This
 * module is the one place that turns a plain `fetch` into a real, monotone byte-progress
 * stream, via the `ReadableStream` reader `fetch().body` already exposes — no server changes,
 * no new asset format, just reading what's already there.
 *
 * Pure and host-agnostic: `now`/`fetchImpl` are injectable so tests never depend on real
 * wall-clock time or network access (same pattern perf-telemetry.ts's `PerfMonitor` uses).
 */

/** One stage of the boot/streaming sequence a visitor's progress can be attributed to.
 * Order here is documentation only — actual sequencing lives in `_boot`/D1.2's state machine. */
export type LoadStage =
  | "engine-init"
  | "star-catalog"
  | "atlas-map"
  | "first-frame"
  | "craft-glb"
  | "havok-wasm"
  | "bonus-layers"
  | "sdss-field"
  | "asteroid-belt"
  | "atlas-photo"
  | "gaia-tiny";

/** A single progress reading for one stage. `totalBytes` is null until the server's
 * `Content-Length` is known (or, for the final `done` event, falls back to `loadedBytes` so a
 * consumer always has SOME total to render against once the stage finishes). */
export interface StageProgress {
  stage: LoadStage;
  loadedBytes: number;
  totalBytes: number | null;
  records?: number;
  done: boolean;
  bootCritical: boolean;
}

/** The minimal set that arms LAUNCH (delivery plan D1.2) — kept small deliberately; every
 * other stage streams in the background and is reported honestly as such, never blocking. */
const BOOT_CRITICAL_STAGES: ReadonlySet<LoadStage> = new Set([
  "engine-init",
  "star-catalog",
  "atlas-map",
  "first-frame",
]);

export function isBootCritical(stage: LoadStage): boolean {
  return BOOT_CRITICAL_STAGES.has(stage);
}

/** The files a DEFAULT visitor must download before LAUNCH can arm, relative to `public/`.
 *
 * Single source of truth, shared by three consumers so they cannot drift: the engine's
 * boot path fetches exactly these under boot-critical stages, `budgets.config.mjs`'s
 * `bootCriticalDownloadKB` ceiling is asserted against their real on-disk sum by a unit
 * test, and D9.3's Render Console reads the same list for its per-layer byte labels.
 * `engine-init` and `first-frame` are boot-critical STAGES but download nothing, so they
 * have no entry here — a stage list and a byte list are different things. */
export const BOOT_CRITICAL_ASSETS = [
  "assets/stars-hip.png",
  "assets/deep.png",
  "assets/atlas-map.json",
] as const;

/** Sums byte progress across the several URLs one stage can span — `star-catalog` is two
 * PNG chunks, `bonus-layers` is four — so a consumer sees ONE monotone counter per stage
 * instead of several that each restart at zero. Without this the dossier's star-catalog
 * bar would visibly jump backwards when the second chunk begins, which is precisely the
 * kind of lying instrument D1's honesty contract exists to prevent.
 *
 * The aggregate `totalBytes` is null while ANY part's total is still unknown — an
 * incomplete sum is not a total, and reporting it as one would understate the denominator
 * and let a bar reach 100% early. On `finish()` it falls back to the summed loaded bytes so
 * a completed stage always has a real denominator to render against. */
export class StageAggregator {
  private readonly parts = new Map<
    string,
    { loaded: number; total: number | null }
  >();
  private finished = false;

  constructor(
    readonly stage: LoadStage,
    private readonly onProgress: (p: StageProgress) => void,
  ) {}

  /** A progress sink for one URL inside this stage — pass straight to `fetchWithProgress`.
   * Registering up front means an unstarted part still counts toward "total unknown". */
  sink(url: string): (p: StageProgress) => void {
    this.parts.set(url, { loaded: 0, total: null });
    return (p) => {
      this.parts.set(url, { loaded: p.loadedBytes, total: p.totalBytes });
      if (!this.finished) this.onProgress(this.snapshot(false));
    };
  }

  /** Emits the stage's single `done: true` event. Idempotent, and callers should invoke it
   * from a `finally` — a stage that failed and degraded gracefully has still FINISHED, and
   * leaving it open would hang D1.2's stall detector on a path the engine already
   * recovered from. */
  finish(records?: number): void {
    if (this.finished) return;
    this.finished = true;
    this.onProgress(this.snapshot(true, records));
  }

  private snapshot(done: boolean, records?: number): StageProgress {
    let loaded = 0;
    let total = 0;
    let anyUnknown = false;
    for (const part of this.parts.values()) {
      loaded += part.loaded;
      if (part.total === null) anyUnknown = true;
      else total += part.total;
    }
    const p: StageProgress = {
      stage: this.stage,
      loadedBytes: loaded,
      totalBytes: anyUnknown ? (done ? loaded : null) : total,
      done,
      bootCritical: isBootCritical(this.stage),
    };
    if (records !== undefined) p.records = records;
    return p;
  }
}

/** Progress callbacks are throttled to at most this often per stage (delivery plan D1.1:
 * "≤ 4 Hz per stage") — a byte-progress reader can otherwise fire on every single chunk,
 * which is real data but far more UI churn than a visible counter needs. The final `done:
 * true` event is never throttled — a stage's completion must always be observable. */
export const STAGE_PROGRESS_MAX_HZ = 4;

/** Fetches `url`, reporting real byte progress for `stage` via `onProgress` as the response
 * body streams in. Falls back to a plain `blob()` (a single `done: true` callback) when the
 * environment gives no readable body — some fetch polyfills and opaque/no-cors responses
 * have none, and this must never throw where a plain `fetch().blob()` would have succeeded. */
export async function fetchWithProgress(
  url: string,
  stage: LoadStage,
  onProgress: (p: StageProgress) => void,
  opts: { now?: () => number; fetchImpl?: typeof fetch } = {},
): Promise<Blob> {
  const now = opts.now ?? (() => performance.now());
  const doFetch = opts.fetchImpl ?? fetch;
  const bootCritical = isBootCritical(stage);

  const res = await doFetch(url);
  if (!res.ok) {
    throw new Error(`fetchWithProgress: ${url} responded ${res.status}`);
  }
  const totalHeader = res.headers.get("content-length");
  const headerTotal = totalHeader ? Number(totalHeader) : null;
  const totalBytes =
    headerTotal !== null && Number.isFinite(headerTotal) ? headerTotal : null;

  const body = res.body;
  if (!body) {
    const blob = await res.blob();
    onProgress({
      stage,
      loadedBytes: blob.size,
      totalBytes: totalBytes ?? blob.size,
      done: true,
      bootCritical,
    });
    return blob;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  let lastEmit = -Infinity;
  const minIntervalMs = 1000 / STAGE_PROGRESS_MAX_HZ;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) {
      chunks.push(value);
      loadedBytes += value.byteLength;
      const t = now();
      if (t - lastEmit >= minIntervalMs) {
        lastEmit = t;
        onProgress({
          stage,
          loadedBytes,
          totalBytes,
          done: false,
          bootCritical,
        });
      }
    }
  }

  onProgress({
    stage,
    loadedBytes,
    totalBytes: totalBytes ?? loadedBytes,
    done: true,
    bootCritical,
  });

  const contentType = res.headers.get("content-type");
  return new Blob(
    chunks as BlobPart[],
    contentType ? { type: contentType } : undefined,
  );
}
