import { useEffect, useRef, useState } from "react";
import { moveFocusTo } from "@/lib/focus-utils";
import {
  isBootCritical,
  type LoadStage,
  type StageProgress,
} from "@/lib/load-progress";
import {
  BOOT_CRITICAL_ORDER,
  derivePreflightPhase,
  stageRowView,
  stalledBootCriticalStages,
} from "@/lib/preflight-state";
import type { EngineKind } from "@/lib/engine-select";

export const PREFLIGHT_LAUNCHED_KEY = "ij-launched";

interface PreFlightProps {
  isTravel: boolean;
  engineKind: EngineKind;
  /** Real backend reported by <babylon-scene> ("webgpu"|"webgl2"), null until the probe
   * resolves or on the archived WebGL1 engine (which has no such concept). */
  engineBackend: string | null;
  stages: Partial<Record<LoadStage, StageProgress>>;
  /** === state.ready — every boot-critical stage has closed (see load-progress.ts's
   * isBootCritical / D1.1's wiring). Reused rather than re-derived: it already means
   * exactly this, and tracking a second "armed" boolean would risk the two disagreeing. */
  armed: boolean;
  /** PF-11 D1.3: `ascent` is true only for the real LAUNCH press — the path that should play the
   * launch cinematic. SKIP INTRO, PROCEED ANYWAY and the returning-visitor bypass pass false, so
   * they go straight to content (the whole point of a skip is speed, not a second animation). */
  onLaunch: (ascent: boolean) => void;
}

/**
 * PF-11 D1.2 — the PRE-FLIGHT · SYSTEMS CHECK dossier (delivery plan D1.2; experience
 * review's S0-S4/S1e state machine). Replaces the old automatic body.ij-loading clear:
 * loading is now a real gate the visitor passes through — LAUNCH, SKIP INTRO, or (after a
 * stall) PROCEED ANYWAY — rather than something that silently finishes itself.
 *
 * All progress shown here derives from `cosmos:stage` (D1.1's honesty contract) plus the
 * `armed` flag SpaceScene already tracks from `cosmos:ready` — nothing here is a timed
 * animation standing in for real data.
 */
export default function PreFlight({
  isTravel,
  engineKind,
  engineBackend,
  stages,
  armed,
  onLaunch,
}: PreFlightProps) {
  // Marks that the JS-driven gate is actually running, so global.css's 9s no-JS/failed-
  // hydration failsafe can tell "PreFlight is genuinely showing" apart from "PreFlight
  // never mounted at all" — the failsafe must only ever fire for the latter (a real
  // hydration failure), never merely because a visitor with working JS hasn't clicked
  // LAUNCH yet, which can legitimately take longer than 9s (see global.css's comment).
  useEffect(() => {
    document.body.classList.add("ij-preflight-mounted");
  }, []);

  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const [launched, setLaunched] = useState(false);
  // Returning-visitor bypass (delivery plan D1.2): a visitor who has already completed one
  // launch this session goes straight to S4 rather than re-watching the dossier. Read once,
  // synchronously, in the initializer — a later effect would render the dossier for one
  // frame first, which is exactly the flash this bypass exists to avoid.
  const [returningVisitor] = useState(() => {
    try {
      return sessionStorage.getItem(PREFLIGHT_LAUNCHED_KEY) === "1";
    } catch {
      return false; // storage blocked (private mode/quota) — fall through to the full gate
    }
  });
  // The bypass makes this component render as already-launched on its very first paint
  // (`derivePreflightPhase` below sees `returningVisitor` immediately) — but the PARENT
  // still needs to hear about it to clear `body.ij-loading`. Without this, a returning
  // visitor's dossier would render null while the hero copy stayed hidden forever.
  useEffect(() => {
    if (returningVisitor) onLaunch(false); // bypass = straight to content, no ascent
    // Deliberately mount-once: `returningVisitor` never changes, and `onLaunch` is a
    // stable setState callback from SpaceScene.
  }, [returningVisitor, onLaunch]);

  // Stall detection (S1e): tracks the last cosmos:stage event per boot-critical stage,
  // independent of the byte counters above, so a stage that goes silent for
  // STAGE_STALL_MS degrades even if its last known percentage looked fine.
  const lastEventAtRef = useRef(new Map<LoadStage, number>());
  const bootStartedAtRef = useRef(Date.now());
  const [stalledStages, setStalledStages] = useState<LoadStage[]>([]);

  useEffect(() => {
    for (const stage of Object.keys(stages) as LoadStage[]) {
      lastEventAtRef.current.set(stage, Date.now());
    }
  }, [stages]);

  useEffect(() => {
    if (armed) {
      setStalledStages([]);
      return;
    }
    const doneSet = new Set(BOOT_CRITICAL_ORDER.filter((s) => stages[s]?.done));
    const check = () => {
      setStalledStages(
        stalledBootCriticalStages(
          lastEventAtRef.current,
          doneSet,
          bootStartedAtRef.current,
          Date.now(),
        ),
      );
    };
    check();
    const id = window.setInterval(check, 1000);
    return () => window.clearInterval(id);
  }, [armed, stages]);

  const launchButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasArmedRef = useRef(false);
  useEffect(() => {
    if (armed && !wasArmedRef.current) {
      moveFocusTo(launchButtonRef.current);
    }
    wasArmedRef.current = armed;
  }, [armed]);

  const launch = (ascent: boolean) => {
    if (launched) return;
    setLaunched(true);
    try {
      sessionStorage.setItem(PREFLIGHT_LAUNCHED_KEY, "1");
    } catch {
      /* storage blocked — the bypass simply won't apply next load, which is safe */
    }
    onLaunch(ascent);
  };

  const phase = derivePreflightPhase({
    isTravel,
    launched: launched || returningVisitor,
    armed,
    anyStalled: stalledStages.length > 0,
  });

  if (phase === "hidden" || phase === "launched") return null;

  const rows = [
    ...BOOT_CRITICAL_ORDER,
    ...(Object.keys(stages) as LoadStage[]).filter((s) => !isBootCritical(s)),
  ].map((s) => stageRowView(s, stages[s]));

  const bootRows = rows.filter((r) => r.bootCritical);
  const backgroundRows = rows.filter((r) => !r.bootCritical && r.started);
  const armPct = Math.round(
    bootRows.reduce((sum, r) => sum + r.pct, 0) / (bootRows.length || 1),
  );

  const engineLine =
    engineKind === "babylon"
      ? engineBackend
        ? `BABYLON · ${engineBackend.toUpperCase()}`
        : "BABYLON · PROBING…"
      : "LEGACY · WEBGL1";

  const transition = reduced ? "" : "transition-[width] duration-300 ease-out";

  return (
    <div
      id="ij-preflight"
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 mx-auto max-w-xl px-6 pb-14 text-center font-mono"
      data-preflight-phase={phase}
    >
      <h2 className="text-xs tracking-[0.3em] text-[#9fa8da]">
        PRE-FLIGHT · SYSTEMS CHECK
      </h2>
      <div className="mt-2 font-heading text-2xl font-bold text-text-primary">
        ISHAN JAIN
      </div>
      <div className="mt-0.5 text-sm text-text-muted">
        Software Engineer · Sydney, AU
      </div>
      <div className="mt-1 text-[11px] tracking-wider text-[#5c6bc0]">
        {engineLine}
      </div>

      {/* Visible checklist — updates freely on every real byte tick; NOT a live region
          (a separate, sparser announcer below covers screen readers, per the review's
          "announce completions only, never per-byte"). */}
      <div className="mt-4 space-y-1.5 text-left text-[12px]">
        {bootRows.map((r) => (
          <div
            key={r.stage}
            className="flex items-center justify-between gap-3"
          >
            <span
              className={
                stalledStages.includes(r.stage)
                  ? "text-[#ef5350]"
                  : r.done
                    ? "text-[#66bb6a]"
                    : "text-[#7986cb]"
              }
            >
              {r.label}
            </span>
            <span className="text-[#5c6bc0]">
              {stalledStages.includes(r.stage) ? "STALLED" : r.statusText}
            </span>
          </div>
        ))}
        {backgroundRows.map((r) => (
          <div
            key={r.stage}
            className="flex items-center justify-between gap-3 text-[#5c6bc0]"
          >
            <span>{r.label}</span>
            <span>{r.statusText}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[#1a237e]">
        <div
          className={`h-full bg-[#43a047] ${transition}`}
          style={{ width: `${armPct}%` }}
        />
      </div>

      {/* Sparse announcer: text only changes on a stage completion or on arming, so AT
          users hear discrete milestones instead of a running byte count. */}
      <div role="status" className="sr-only">
        {phase === "stalled"
          ? "Systems check stalled — proceed anyway available"
          : phase === "armed"
            ? "Launch ready"
            : `${bootRows.filter((r) => r.done).length} of ${bootRows.length} systems check stages complete`}
      </div>

      <div className="mt-5 flex flex-col items-center gap-2">
        {phase === "stalled" && (
          <button
            type="button"
            onClick={() => launch(false)}
            className="min-h-[24px] rounded-lg bg-[#ef5350] px-6 py-3 font-medium text-white transition-colors hover:bg-[#e53935]"
          >
            PROCEED ANYWAY ▸
          </button>
        )}
        {phase !== "stalled" && (
          <button
            type="button"
            ref={launchButtonRef}
            onClick={() => launch(true)}
            disabled={!armed}
            aria-disabled={!armed}
            className={
              armed
                ? "min-h-[24px] rounded-lg bg-royal-600 px-6 py-3 font-medium text-text-primary transition-all hover:bg-royal-500 hover:shadow-lg hover:shadow-royal-600/25"
                : "min-h-[24px] cursor-not-allowed rounded-lg border border-royal-700/50 px-6 py-3 font-medium text-text-dim"
            }
          >
            {armed ? "LAUNCH ▸" : `ARMING… ${armPct}%`}
          </button>
        )}
        {armed && (
          <div className="text-[11px] tracking-wider text-[#5c6bc0]">
            ENTER PORTFOLIO · FLIGHT MODE
          </div>
        )}
        <button
          type="button"
          onClick={() => launch(false)}
          className="min-h-[24px] text-[11px] tracking-wider text-[#5c6bc0] underline-offset-4 hover:text-[#9fa8da] hover:underline"
        >
          SKIP INTRO
        </button>
      </div>
    </div>
  );
}
