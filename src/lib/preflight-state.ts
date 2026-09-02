/* preflight-state.ts — PF-11 D1.2: pure state/formatting logic for the PRE-FLIGHT dossier.
 *
 * Split out of PreFlight.tsx (rather than left inline) so the state machine, stall
 * detection, and byte formatting are unit-testable without React or jsdom — the same
 * reasoning `load-progress.ts` and `perf-telemetry.ts`'s `PerfMonitor` already follow in
 * this codebase: pure logic, DOM-adjacent host code kept separate and thin.
 */
import {
  isBootCritical,
  type LoadStage,
  type StageProgress,
} from "./load-progress";

/** The boot-critical stages, in the fixed order they resolve in `_boot` — engine
 * initialization, then the two real transfers, then the first rendered frame. Fixed order
 * (not derived from arrival order) so the checklist never reflows while loading. */
export const BOOT_CRITICAL_ORDER: readonly LoadStage[] = [
  "engine-init",
  "star-catalog",
  "atlas-map",
  "first-frame",
];

/** Display labels for every stage — the checklist's "STAR CATALOG", "SDSS DEEP FIELD" style
 * rows (delivery plan D1.2 recommendation #4). */
export const STAGE_LABELS: Record<LoadStage, string> = {
  "engine-init": "ENGINE INIT",
  "star-catalog": "STAR CATALOG",
  "atlas-map": "ATLAS MAP",
  "first-frame": "FIRST FRAME",
  "craft-glb": "CRAFT MODEL",
  "havok-wasm": "PHYSICS ENGINE",
  "bonus-layers": "BONUS STAR LAYERS",
  "sdss-field": "SDSS DEEP FIELD",
  "asteroid-belt": "ASTEROID BELT",
  "atlas-photo": "PHOTO ATLAS",
  "gaia-tiny": "GAIA DR3 TINY",
};

/** Formats a byte count the way the rest of this codebase's mono-voice overlays do —
 * whole KB under 1 MB, two-decimal MB above it. */
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export interface StageRowView {
  stage: LoadStage;
  label: string;
  done: boolean;
  started: boolean;
  bootCritical: boolean;
  /** 0-100; 0 when no total is known yet (never shown as "0%" — see PreFlight.tsx's render,
   * which only shows a bar once `started`). */
  pct: number;
  /** The text after the label — "2.02 MB ✓", "1.1 / 2.9 MB", "STREAMING IN BACKGROUND",
   * or "PENDING" before the stage has started at all. */
  statusText: string;
}

/** Builds one checklist row. `p` is undefined for a stage that hasn't started yet (still
 * "PENDING" — not an error, just not its turn). Checkpoint stages (engine-init,
 * first-frame) carry no bytes, so they render a plain status word instead of a byte line —
 * showing "0 B" for a stage that downloads nothing would be its own small dishonesty. */
export function stageRowView(
  stage: LoadStage,
  p: StageProgress | undefined,
): StageRowView {
  const label = STAGE_LABELS[stage];
  const bootCritical = isBootCritical(stage);
  const isCheckpoint =
    p !== undefined ? p.totalBytes === 0 && p.loadedBytes === 0 : false;

  if (!p) {
    return {
      stage,
      label,
      done: false,
      started: false,
      bootCritical,
      pct: 0,
      statusText: "PENDING",
    };
  }

  if (isCheckpoint) {
    return {
      stage,
      label,
      done: p.done,
      started: true,
      bootCritical,
      pct: p.done ? 100 : 0,
      statusText: p.done ? "✓ ONLINE" : "CHECKING…",
    };
  }

  const pct = p.totalBytes
    ? Math.min(100, Math.round((p.loadedBytes / p.totalBytes) * 100))
    : p.done
      ? 100
      : 0;

  let statusText: string;
  if (p.done) {
    statusText = `${fmtBytes(p.loadedBytes)} ✓`;
  } else if (bootCritical) {
    statusText = p.totalBytes
      ? `${fmtBytes(p.loadedBytes)} / ${fmtBytes(p.totalBytes)}`
      : fmtBytes(p.loadedBytes);
  } else {
    // Background layers are deliberately not shown as a running byte counter — the
    // dossier's job for these is "honestly still going", not a second progress bar
    // competing for attention with the boot-critical set that actually gates LAUNCH.
    statusText = "STREAMING IN BACKGROUND";
  }

  return {
    stage,
    label,
    done: p.done,
    started: true,
    bootCritical,
    pct,
    statusText,
  };
}

/** Wall-clock gap after which a boot-critical stage with no progress event is considered
 * stalled (delivery plan D1.2: "a boot-critical stage with no progress event for 10s"). */
export const STAGE_STALL_MS = 10_000;

/** Which boot-critical stages have gone silent — no `cosmos:stage` event (progress OR
 * completion) for `STAGE_STALL_MS`, and still not done. `lastEventAt` should default absent
 * entries to when the dossier itself mounted (`bootStartedAt`), so a stage that never even
 * starts firing also degrades eventually rather than pending forever. */
export function stalledBootCriticalStages(
  lastEventAt: ReadonlyMap<LoadStage, number>,
  doneSet: ReadonlySet<LoadStage>,
  bootStartedAt: number,
  now: number,
): LoadStage[] {
  return BOOT_CRITICAL_ORDER.filter((s) => {
    if (doneSet.has(s)) return false;
    const last = lastEventAt.get(s) ?? bootStartedAt;
    return now - last >= STAGE_STALL_MS;
  });
}

export type PreflightPhase =
  "hidden" | "loading" | "stalled" | "armed" | "launched";

/** The dossier's own tiny state machine, computed rather than stored — every input is
 * already tracked elsewhere (travel mode, the launched flag, `cosmos:ready`, the stall
 * check above), so deriving the phase avoids a second source of truth that could disagree
 * with them. `hidden` covers both non-travel mode (mobile scroll never waits) and the
 * returning-visitor bypass, which skips this component entirely rather than flashing it. */
export function derivePreflightPhase(opts: {
  isTravel: boolean;
  launched: boolean;
  armed: boolean;
  anyStalled: boolean;
}): PreflightPhase {
  if (!opts.isTravel) return "hidden";
  if (opts.launched) return "launched";
  if (opts.anyStalled) return "stalled";
  if (opts.armed) return "armed";
  return "loading";
}
