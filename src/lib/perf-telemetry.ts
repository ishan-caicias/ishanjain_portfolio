/* perf-telemetry.ts — PF-09 B0: engine-agnostic startup + fps harness.
 *
 * The B1 go/no-go gate compares the current engine against Babylon on real
 * devices; that comparison needs a measurement instrument that works
 * identically for both. This module is that instrument. It is host-side: it
 * times mount → `cosmos:ready` for startup and samples requestAnimationFrame
 * deltas for a rolling fps, so it needs NO change to either engine's internals.
 *
 * Pure helpers are unit-tested; the monitor takes `now` as an argument (like
 * springStep takes dt) so its logic is deterministic and testable.
 */
import type { EngineKind } from "./engine-select";
import type { TierSignals } from "./craft-tier";

/** Coarse device class for per-tier budget reporting (PF-09 budget table). */
export type DeviceTier = "low" | "mid" | "high";

/** Classify a device from the same signals craft-tier reads. Constrained
 * signals → low; roomy memory on a wide viewport → high; otherwise mid. */
export function classifyDeviceTier(s: TierSignals): DeviceTier {
  if (s.saveData) return "low";
  if (s.deviceMemory !== null && s.deviceMemory <= 4) return "low";
  if (s.viewportWidth < 768) return "low";
  if (s.deviceMemory !== null && s.deviceMemory >= 8 && s.viewportWidth >= 1280)
    return "high";
  return "mid";
}

/** Rolling fps from a window of frame deltas (ms). Empty → 0. */
export function rollingFps(deltasMs: readonly number[]): number {
  if (!deltasMs.length) return 0;
  const avg = deltasMs.reduce((a, b) => a + b, 0) / deltasMs.length;
  return avg > 0 ? 1000 / avg : 0;
}

export interface PerfSnapshot {
  engine: EngineKind;
  tier: DeviceTier;
  /** ms from monitor start to `cosmos:ready`, or null if not yet ready. */
  startupMs: number | null;
  /** rolling fps over the recent frame window. */
  fps: number;
  /** total frames sampled since start. */
  frames: number;
  /**
   * Estimated display refresh rate (Hz), from the fastest observed frame.
   *
   * requestAnimationFrame is vsync-locked, so `fps` can NEVER exceed this.
   * Recording it makes a reading self-validating: "60 fps on a 60 Hz panel" is
   * a perfect score, while "140 fps" on a 60 Hz phone is an impossible reading
   * that must be rejected rather than entered into the gate table.
   */
  displayHz: number;
  /**
   * Frames the ENGINE actually rendered (not merely rAF ticks the host counted).
   * null when the engine exposes no counter. If this stays 0/null while `fps`
   * looks healthy, the page is animating but the scene is NOT drawing.
   */
  renderFrames: number | null;
  /**
   * **The number the PF-09 gate is decided on.** Actual engine render rate,
   * derived from the engine's own frame counter over elapsed time — as opposed
   * to `fps`, which counts host requestAnimationFrame ticks and structurally
   * over-reports (measured 130 host ticks against 73 real renders). null until
   * two samples exist or when the engine exposes no counter.
   */
  renderFps: number | null;
  /**
   * Babylon's actual render backend for this reading ("webgpu" | "webgl2"),
   * or null on the archived WebGL1 engine / before `createEngine()` resolves.
   * Without this, a captured snapshot's fps/startup numbers can't be
   * attributed to a specific fallback tier (PF-09 B6 checklist §A4 needs the
   * WebGL2-fallback row distinguished from the WebGPU rows) — the reader had
   * to cross-reference `<babylon-scene>.sceneStats().backend` separately.
   */
  backend: "webgpu" | "webgl2" | null;
  /** Which hardware produced this reading — makes gate rows attributable. */
  device: DeviceContext;
}

/** Identifying context recorded with every reading. */
export interface DeviceContext {
  ua: string;
  dpr: number;
  cores: number | null;
  memoryGb: number | null;
  screen: string;
  viewport: string;
}

// deviceMemory is non-standard (Chromium-only); hardwareConcurrency is standard.
interface NavigatorPerfSignals extends Navigator {
  deviceMemory?: number;
}

export function readDeviceContext(win: Window): DeviceContext {
  const nav = win.navigator as NavigatorPerfSignals;
  return {
    ua: nav.userAgent.slice(0, 120),
    dpr: win.devicePixelRatio || 1,
    cores:
      typeof nav.hardwareConcurrency === "number"
        ? nav.hardwareConcurrency
        : null,
    memoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    screen: `${win.screen?.width ?? 0}x${win.screen?.height ?? 0}`,
    viewport: `${win.innerWidth}x${win.innerHeight}`,
  };
}

/** Frames kept in the rolling fps window (~1 s at 60 fps). */
export const FPS_WINDOW = 60;
/** Deltas above this (ms) are dropped as tab-sleep / throttle outliers. */
export const FRAME_OUTLIER_MS = 1000;

/** Fastest credible frame (ms) — guards the displayHz estimate against a
 * spurious sub-millisecond delta reporting an absurd refresh rate. */
export const MIN_CREDIBLE_FRAME_MS = 4; // 250 Hz ceiling
/** Trailing window (ms) over which the engine render rate is computed. */
export const RENDER_FPS_WINDOW_MS = 2000;
/** Percentile of frame deltas used for the refresh estimate — resists the
 * one-off coalesced-callback outlier that a plain `min` would latch onto. */
export const DISPLAY_HZ_PERCENTILE = 0.1;

/** Compact hardware signature for the on-screen overlay, so a recorded row can
 * never be ambiguous about which machine produced it (TR-033). */
export function deviceSignature(d: DeviceContext): string {
  const ua = d.ua;
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : "other";
  const emulated = /Android|iPhone|iPad/.test(ua) && (d.cores ?? 0) >= 12;
  return `${os} · ${d.screen} · dpr${d.dpr} · ${d.cores ?? "?"}c${
    emulated ? "  ⚠LOOKS EMULATED" : ""
  }`;
}

export class PerfMonitor {
  private t0: number | null = null;
  private startupMs: number | null = null;
  private last: number | null = null;
  private deltas: number[] = [];
  private minDelta = Infinity;
  frames = 0;
  /** Latest engine frame count (fed by the host via setRenderFrames). */
  renderFrames: number | null = null;
  private rfSamples: { t: number; n: number }[] = [];
  /** Latest Babylon render backend (fed by the host via setBackend). */
  private backend: "webgpu" | "webgl2" | null = null;

  constructor(
    readonly engine: EngineKind,
    readonly tier: DeviceTier,
    readonly device: DeviceContext,
  ) {}

  /**
   * Fastest *sustained* frame cadence (Hz) — a plausibility ceiling on `fps`.
   *
   * Uses the 10th-percentile delta, NOT the minimum: a single pair of coalesced
   * rAF callbacks produces a sub-4 ms delta that made the old `min`-based
   * estimate report 250 Hz on hardware that has no such panel (see TR-033).
   * Note this is derived from the same rAF stream as `fps`, so it is a weak
   * self-check — the strong check that a reading came from the hardware it
   * claims is the `device` block.
   */
  displayHz(): number {
    if (!this.deltas.length) return 0;
    const sorted = [...this.deltas].sort((a, b) => a - b);
    const idx = Math.min(
      sorted.length - 1,
      Math.floor(sorted.length * DISPLAY_HZ_PERCENTILE),
    );
    const d = Math.max(sorted[idx], MIN_CREDIBLE_FRAME_MS);
    return Math.round(1000 / d);
  }

  /** Feed the engine's own frame counter (call once per host frame). */
  setRenderFrames(n: number | null, now: number): void {
    this.renderFrames = n;
    if (n === null) return;
    this.rfSamples.push({ t: now, n });
    // keep a ~2 s trailing window so the rate reflects current conditions
    while (
      this.rfSamples.length > 2 &&
      now - this.rfSamples[0].t > RENDER_FPS_WINDOW_MS
    )
      this.rfSamples.shift();
  }

  /** Feed Babylon's resolved render backend (call once per host frame, same
   * cadence as setRenderFrames — cheap property read, no allocation). */
  setBackend(b: "webgpu" | "webgl2" | null): void {
    this.backend = b;
  }

  /** Actual engine render rate — the gate metric. */
  renderFps(): number | null {
    if (this.rfSamples.length < 2) return null;
    const a = this.rfSamples[0];
    const b = this.rfSamples[this.rfSamples.length - 1];
    const dt = b.t - a.t;
    return dt > 0 ? Math.round(((b.n - a.n) / dt) * 1000) : null;
  }

  /** Begin timing (call at component mount). */
  start(now: number): void {
    this.t0 = now;
    this.last = now;
  }

  /** Record the startup completion (call on `cosmos:ready`). */
  markReady(now: number): void {
    if (this.t0 !== null && this.startupMs === null)
      this.startupMs = now - this.t0;
  }

  /** Sample one animation frame. */
  frame(now: number): void {
    if (this.last !== null) {
      const d = now - this.last;
      if (d > 0 && d < FRAME_OUTLIER_MS) {
        this.deltas.push(d);
        if (this.deltas.length > FPS_WINDOW) this.deltas.shift();
        if (d >= MIN_CREDIBLE_FRAME_MS && d < this.minDelta) this.minDelta = d;
      }
    }
    this.last = now;
    this.frames++;
  }

  snapshot(): PerfSnapshot {
    return {
      engine: this.engine,
      tier: this.tier,
      startupMs: this.startupMs,
      fps: Math.round(rollingFps(this.deltas)),
      frames: this.frames,
      displayHz: this.displayHz(),
      renderFrames: this.renderFrames,
      renderFps: this.renderFps(),
      backend: this.backend,
      device: this.device,
    };
  }
}
