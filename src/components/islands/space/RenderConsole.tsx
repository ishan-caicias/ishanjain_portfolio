import { useCallback, useEffect, useRef, useState } from "react";
import {
  LAYERS,
  tierDefaults,
  LAYERS_STORAGE_KEY,
  clampLayerValue,
  formatBytes,
  formatVerts,
  isAvailable,
  isLiveToggleable,
  serializeLayersParam,
  type LayerId,
} from "@/lib/render-layers";
import type { QualityTierName } from "@/lib/babylon-tiers";
import { moveFocusTo, restoreFocusTo, trapFocus } from "@/lib/focus-utils";

type LayerState = Partial<Record<LayerId, boolean | number>>;

interface EngineHandle {
  sceneStats(): Record<string, unknown>;
  setLayers(config: LayerState, opts?: { persist?: boolean }): void;
}

function getEngine(): EngineHandle | null {
  const el = document.querySelector("babylon-scene");
  return el && "setLayers" in el ? (el as unknown as EngineHandle) : null;
}

const PRESETS: { id: QualityTierName | "everything"; label: string }[] = [
  { id: "lite", label: "LITE" },
  { id: "balanced", label: "BALANCED" },
  { id: "full", label: "FULL" },
  { id: "everything", label: "EVERYTHING" },
];

/**
 * PF-11 D9.2 — the Render Console: a dossier-format dialog (DATA & LICENSES precedent, see
 * SectionOverlay.tsx's `credits` section) letting a visitor multi-select which DSO/celestial
 * layers render, independent of the automatic device-tier preset (ADR-0010: tiers are the
 * default, never the ceiling). Talks to the engine only through `sceneStats()`/`setLayers()` —
 * the same arm's-length pattern `CraftQualityControl` (SectionOverlay.tsx) already uses for the
 * ship-quality override.
 *
 * A real modal over a live, still-interactive scene (like CollectorCard, unlike PreFlight/
 * ArrivalVista) — focused on mount, restored on unmount, Tab/Shift+Tab trapped inside it.
 */
export default function RenderConsole({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [layers, setLayers] = useState<LayerState>(
    () => (getEngine()?.sceneStats().layers as LayerState | undefined) ?? {},
  );
  const [tier, setTier] = useState<QualityTierName | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [urlOverride, setUrlOverride] = useState(false);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    moveFocusTo(rootRef.current);
    return () => restoreFocusTo(previousFocusRef.current);
  }, []);

  useEffect(() => {
    setUrlOverride(new URLSearchParams(window.location.search).has("layers"));
    const stats = getEngine()?.sceneStats();
    if (stats) {
      setLayers(stats.layers as LayerState);
      setTier((stats.qualityTier as QualityTierName) ?? null);
    }
  }, []);

  useEffect(() => {
    const onLayers = (e: Event) => {
      setLayers({ ...(e as CustomEvent).detail } as LayerState);
    };
    window.addEventListener("cosmos:layers", onLayers as EventListener);
    return () =>
      window.removeEventListener("cosmos:layers", onLayers as EventListener);
  }, []);

  // Live measured fps (perf-telemetry made user-facing — "measure, don't assert" as UX),
  // via the same on-demand cosmos:perf:req/cosmos:perf pair SpaceScene's ?perf=1 HUD uses.
  useEffect(() => {
    const onPerf = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        renderFps: number | null;
      };
      setFps(detail?.renderFps ?? null);
    };
    window.addEventListener("cosmos:perf", onPerf as EventListener);
    const request = () =>
      window.dispatchEvent(new CustomEvent("cosmos:perf:req"));
    request();
    const timer = window.setInterval(request, 1000);
    return () => {
      window.removeEventListener("cosmos:perf", onPerf as EventListener);
      window.clearInterval(timer);
    };
  }, []);

  const apply = useCallback((config: LayerState, persist = true) => {
    getEngine()?.setLayers(config, { persist });
  }, []);

  const applyPreset = useCallback(
    (preset: QualityTierName | "everything", persist = true) => {
      const source =
        preset === "everything" ? tierDefaults("full") : tierDefaults(preset);
      const config: LayerState = {};
      for (const l of LAYERS) {
        // `reload` layers (bonus-stars) ARE included: a preset should be able to set them, and
        // the engine persists the choice for the next boot even though it can't act now.
        // `always-on` and `unavailable` are not settable at all.
        if (!isLiveToggleable(l) && l.status !== "reload") continue;
        config[l.id] =
          preset === "everything" && l.id !== "belt-physics"
            ? true
            : source[l.id];
      }
      apply(config, persist);
    },
    [apply],
  );

  // TR-113: RESET TO AUTO must leave NOTHING stored, so the next load resolves from the device
  // tier again. It previously deleted the key and then immediately re-persisted the full state
  // through `setLayers()` — correct for the live session, wrong on reload, and invisible to a
  // manual check that never reloads. `persist: false` is what makes the removeItem stick.
  const resetToAuto = useCallback(() => {
    const stats = getEngine()?.sceneStats();
    const currentTier = (stats?.qualityTier as QualityTierName) ?? "balanced";
    applyPreset(currentTier, false);
    try {
      localStorage.removeItem(LAYERS_STORAGE_KEY);
    } catch {
      /* private browsing / storage disabled — the live reset above still applies */
    }
  }, [applyPreset]);

  const [copied, setCopied] = useState(false);
  const copyLink = useCallback(() => {
    const settable: LayerState = {};
    for (const l of LAYERS) {
      if (!isLiveToggleable(l) && l.status !== "reload") continue;
      const v = layers?.[l.id];
      if (v !== undefined) settable[l.id] = v;
    }
    const url = `${window.location.origin}${window.location.pathname}?layers=${serializeLayersParam(settable)}`;
    void navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }, [layers]);

  return (
    <div data-screen-label="Render console" className="fixed inset-0 z-[85]">
      <div
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-[#04050f]/72 backdrop-blur-sm"
      />
      <div className="flex h-full items-center justify-center px-5 pb-7 pt-20">
        <div
          ref={rootRef}
          role="dialog"
          aria-modal="true"
          aria-label="Render console"
          tabIndex={-1}
          onKeyDown={(ev) => {
            if (rootRef.current) trapFocus(rootRef.current, ev);
          }}
          className="relative w-[min(720px,95vw)] max-h-[calc(100vh-116px)] animate-[ij-cardin_0.32s_ease-out_both] overflow-y-auto overscroll-contain rounded-lg border border-[#3f51b5]/60 px-7 pb-8 pt-6 shadow-[0_40px_80px_rgba(0,0,0,0.6)] outline-none [background:linear-gradient(rgba(10,13,26,0.97),rgba(10,13,26,0.97)),repeating-linear-gradient(0deg,rgba(92,107,192,0.12)_0px,rgba(92,107,192,0.12)_1px,transparent_1px,transparent_3px)]"
        >
          <div className="flex items-start justify-between gap-3.5">
            <div>
              <div className="font-mono text-[10.5px] tracking-[0.28em] text-[#43a047]">
                MISSION SYSTEMS · GRAPHICS
              </div>
              <h2 className="mt-1.5 font-heading text-[clamp(22px,3vh,28px)] font-bold text-text-primary">
                RENDER CONSOLE
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close render console"
              className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full border border-[#3f51b5]/35 bg-[#0a0e27]/80 text-[#9fa8da] hover:bg-[#1a237e]/80 hover:text-text-primary"
            >
              <svg
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2.5 font-mono text-[10.5px] tracking-wider text-[#9fa8da]">
            <span>
              MEASURED FPS ·{" "}
              <span className="text-[#ffd54f]">
                {fps == null ? "—" : Math.round(fps)}
              </span>
            </span>
            {tier && (
              <span className="rounded border border-[#3f51b5]/50 px-2 py-0.5 text-[#7986cb]">
                DEVICE PRESET · {tier.toUpperCase()}
              </span>
            )}
            {urlOverride && (
              <span
                title="A ?layers= URL parameter is overriding your saved settings"
                className="rounded border border-[#ffc107]/50 px-2 py-0.5 text-[#ffd54f]"
              >
                URL OVERRIDE
              </span>
            )}
          </div>

          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className="rounded px-2.5 py-1 font-mono text-[10px] tracking-wider text-[#9fa8da] hover:border-[#ffc107]/40 hover:text-[#ffd54f] border border-[#3f51b5]/50"
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={resetToAuto}
              className="rounded px-2.5 py-1 font-mono text-[10px] tracking-wider text-[#7986cb] hover:border-[#ffc107]/40 hover:text-[#ffd54f] border border-[#3f51b5]/50"
            >
              RESET TO AUTO
            </button>
            <button
              onClick={copyLink}
              className="rounded px-2.5 py-1 font-mono text-[10px] tracking-wider text-[#7986cb] hover:border-[#ffc107]/40 hover:text-[#ffd54f] border border-[#3f51b5]/50"
            >
              {copied ? "LINK COPIED ✓" : "COPY LINK"}
            </button>
          </div>

          <div className="mt-4.5 flex flex-col gap-2.5">
            {LAYERS.map((l) => {
              const value = layers?.[l.id];
              // TR-113: an `unavailable` layer is NEVER on, whatever its stored state says —
              // `gaia-tiny` used to render as a ticked box claiming 2.55M stars were being
              // drawn from a dataset that does not exist yet. `always-on` is genuinely always
              // ticked. Everything else reflects real engine state.
              const on =
                l.status === "unavailable"
                  ? false
                  : l.status === "always-on"
                    ? true
                    : value !== false && value !== 0;
              const isCount = typeof l.defaultByTier.full === "number";
              const note =
                l.status === "always-on"
                  ? " · ALWAYS ON"
                  : l.status === "reload"
                    ? " · MERGED INTO STAR FIELD — APPLIES ON RELOAD"
                    : l.status === "unavailable"
                      ? " · COMING IN A FUTURE UPDATE"
                      : "";
              return (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-[#283593]/50 bg-[#10142c]/60 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <label
                      htmlFor={`ij-layer-${l.id}`}
                      className="font-mono text-[12px] tracking-wider text-text-primary"
                    >
                      {l.label}
                    </label>
                    <div className="mt-0.5 font-mono text-[10px] tracking-wider text-[#5c6bc0]">
                      {formatBytes(l.assetBytes)}
                      {l.vertsApprox > 0 && ` · ${formatVerts(l.vertsApprox)}`}
                      {note}
                    </div>
                  </div>
                  {!isAvailable(l) || l.status === "always-on" ? (
                    <input
                      id={`ij-layer-${l.id}`}
                      type="checkbox"
                      checked={on}
                      disabled
                      readOnly
                      aria-label={`${l.label} (not adjustable)`}
                      className="h-4 w-4 flex-shrink-0 opacity-40"
                    />
                  ) : isCount ? (
                    <input
                      id={`ij-layer-${l.id}`}
                      type="number"
                      min={0}
                      max={l.maxCount}
                      value={typeof value === "number" ? value : 0}
                      onChange={(e) =>
                        apply({
                          [l.id]: clampLayerValue(l.id, Number(e.target.value)),
                        })
                      }
                      className="w-16 flex-shrink-0 rounded border border-[#3f51b5] bg-[#0d1126] px-2 py-1 text-right font-mono text-[11px] text-[#c5cae9]"
                    />
                  ) : (
                    <input
                      id={`ij-layer-${l.id}`}
                      type="checkbox"
                      checked={on}
                      onChange={(e) => apply({ [l.id]: e.target.checked })}
                      className="h-4 w-4 flex-shrink-0 accent-[#ffc107]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
