import { useEffect, useRef } from "react";
import type { CelestialEntry } from "@/data/celestial/celestial.d.ts";
import {
  fmtDist,
  figGeom,
  drawGlobe,
  resolveCardVisual,
  clusterDots,
  moonCraters,
  asteroidSilhouette,
  nebulaGradient,
  galaxyGradient,
  blackholeGradient,
  moonGradient,
} from "@/lib/spaceHelpers";
import { moveFocusTo, restoreFocusTo } from "@/lib/focus-utils";

/**
 * Cinematic landing screen shown after physically arriving at a body, until dismissed -
 * before the collector card opens. Renders one of: real photo (nebula/galaxy), a procedural
 * "star" glow, a hand-rendered rotating globe (planets/moons), or a constellation figure.
 * Ported from lines 860-898.
 *
 * PF-11 D4.1: a real `role="dialog"` surface — pointer-events-auto and above
 * `#ij-mission-bar`'s z-index (62) so a dismissing click can never fall through to the mission
 * bar or the canvas and start a new warp (that gap was the TR-086/R7 "babylon doesn't show the
 * card" seam's actual cause: the vista had no dismiss input, so clicks meant to close it
 * either landed on the mission bar underneath or reached the canvas). Click anywhere except
 * the card button, or press Space, to dismiss; Escape is handled one level up by
 * SpaceScene's `useEscapeStack` (a single dispatcher owns Escape across every layer, so this
 * component doesn't also race it). The 5.5s auto-timeout this used to have is gone —
 * SpaceScene no longer schedules one.
 */
export default function ArrivalVista({
  entry,
  onOpenCard,
  onDismiss,
}: {
  entry: CelestialEntry;
  onOpenCard: () => void;
  /** `via` names the input that dismissed the vista, for the funnel's diagnostic log. */
  onDismiss: (via: "click" | "space") => void;
}) {
  const globeRef = useRef<(HTMLCanvasElement & { _drawnFor?: string }) | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus the dialog on mount (announces it to assistive tech via its aria-label) and give
  // focus back to whatever had it before on unmount — the standard modal-dialog pattern.
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    moveFocusTo(rootRef.current);
    return () => restoreFocusTo(previousFocusRef.current);
  }, []);

  const c = entry.c || "#ffd54f";
  // PF-11 defect P1 fix — same class-aware fallback as CollectorCard.tsx, sharing the exact same
  // `resolveCardVisual` decision so the two components cannot drift apart again. See that
  // function's header comment (src/lib/spaceHelpers.ts) for the full account.
  const visual = resolveCardVisual(entry);
  const isGlobe = visual.kind === "globe";
  const isFig = visual.kind === "figure";
  const isPhoto = visual.kind === "photo";
  const isStar = visual.kind === "star";
  const isNebula = visual.kind === "nebula";
  const isGalaxy = visual.kind === "galaxy";
  const isCluster = visual.kind === "cluster";
  const isBlackhole = visual.kind === "blackhole";
  const isMoon = visual.kind === "moon";
  const isAsteroid = visual.kind === "asteroid";
  const isGeneric = visual.kind === "generic";
  const fig = isFig ? figGeom(entry) : null;

  return (
    <div
      ref={rootRef}
      data-screen-label="Arrival vista"
      role="dialog"
      aria-label={`Arrival: ${entry.n}`}
      tabIndex={-1}
      onClick={() => onDismiss("click")}
      onKeyDown={(e) => {
        // Space at the dialog level dismisses; Space on the focused card button must keep
        // its native activate-the-button behaviour instead (hence the currentTarget check).
        if (e.key === " " && e.target === e.currentTarget) {
          e.preventDefault();
          onDismiss("space");
        }
      }}
      className="pointer-events-auto fixed inset-0 z-[65] flex animate-[ij-fadein_0.4s_ease-out_both] items-center justify-center backdrop-blur-sm outline-none"
      style={{
        background:
          "radial-gradient(ellipse at 50% 50%, rgba(4,5,15,0.92) 0%, rgba(4,5,15,0.78) 55%, rgba(4,5,15,0.45) 100%)",
      }}
    >
      <div className="-mt-[9vh] animate-[ij-land_1.2s_cubic-bezier(0.16,1,0.3,1)_both] text-center">
        <div className="relative mx-auto aspect-square w-[min(46vmin,380px)]">
          <div
            aria-hidden="true"
            className="absolute rounded-full border opacity-35"
            style={{ inset: "-12%", borderColor: c }}
          />
          <div
            aria-hidden="true"
            className="absolute rounded-full border opacity-[0.14]"
            style={{ inset: "-24%", borderColor: c }}
          />
          {isPhoto && (
            <div
              role="img"
              aria-label={entry.n}
              className="absolute inset-0 rounded-full border border-[#e8eaf6]/18"
              style={{
                background: `url('${entry.img}') center/cover`,
                boxShadow: `0 0 90px ${c}44, 0 0 200px ${c}22`,
              }}
            />
          )}
          {isStar && (
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full blur-[0.6px]"
              style={{
                background: `radial-gradient(circle, #ffffff 0%, #ffffff 6%, ${c} 20%, ${c}55 42%, transparent 68%), linear-gradient(0deg, transparent 47%, ${c}44 49.2%, rgba(255,255,255,0.8) 50%, ${c}44 50.8%, transparent 53%), linear-gradient(90deg, transparent 47%, ${c}44 49.2%, rgba(255,255,255,0.8) 50%, ${c}44 50.8%, transparent 53%), radial-gradient(circle, ${c}22 38%, transparent 70%)`,
              }}
            />
          )}
          {isGlobe && (
            <canvas
              width={480}
              height={480}
              ref={(el) => {
                globeRef.current = el;
                if (el) drawGlobe(el, entry);
              }}
              className="absolute inset-0 h-full w-full"
            />
          )}
          {isFig && fig && (
            <svg
              viewBox="0 0 400 300"
              className="absolute inset-0 h-full w-full"
              aria-label="Constellation figure"
            >
              {fig.figLines.map((l, i) => (
                <line
                  key={i}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  stroke="#7986cb"
                  strokeWidth={1.2}
                  opacity={0.8}
                />
              ))}
              {fig.figStars.map((st, i) => (
                <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#ffe082" />
              ))}
            </svg>
          )}
          {isNebula && (
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full blur-[0.5px]"
              style={{
                background: nebulaGradient(c),
                boxShadow: `0 0 90px ${c}33, 0 0 200px ${c}18`,
              }}
            />
          )}
          {isGalaxy && (
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full blur-[0.5px]"
              style={{
                background: galaxyGradient(c),
                boxShadow: `0 0 90px ${c}33, 0 0 200px ${c}18`,
              }}
            />
          )}
          {isBlackhole && (
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full"
              style={{ background: blackholeGradient(c) }}
            />
          )}
          {isCluster && (
            <svg
              viewBox="0 0 400 300"
              className="absolute inset-0 h-full w-full"
              aria-label="Cluster member scatter, illustrative"
            >
              {clusterDots(entry).map((d, i) => (
                <circle
                  key={i}
                  cx={d.x}
                  cy={d.y}
                  r={d.r}
                  fill={c}
                  opacity={0.8}
                />
              ))}
            </svg>
          )}
          {isMoon && (
            <>
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-full"
                style={{ background: moonGradient(c) }}
              />
              <svg
                viewBox="0 0 400 300"
                className="absolute inset-0 h-full w-full"
                aria-label="Surface relief, illustrative"
              >
                {moonCraters(entry).map((d, i) => (
                  <circle
                    key={i}
                    cx={d.x}
                    cy={d.y}
                    r={d.r}
                    fill="#000"
                    opacity={0.22}
                  />
                ))}
              </svg>
            </>
          )}
          {isAsteroid && (
            <svg
              viewBox="0 0 400 300"
              className="absolute inset-0 h-full w-full"
              aria-label="Silhouette, illustrative"
            >
              <polygon
                points={asteroidSilhouette(entry)}
                fill={c}
                opacity={0.85}
                stroke={c}
                strokeWidth={1.5}
              />
            </svg>
          )}
          {isGeneric && (
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full blur-[0.6px]"
              style={{
                background: `radial-gradient(circle, ${c}cc 0%, ${c}55 45%, transparent 75%)`,
              }}
            />
          )}
        </div>
      </div>
      <div className="fixed bottom-3 left-1/2 z-[61] flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 animate-[ij-fadein_0.6s_ease-out_both] flex-col items-center gap-1.5 text-center">
        <div className="font-mono text-[10.5px] tracking-[0.32em] text-[#43a047]">
          ARRIVAL CONFIRMED
        </div>
        <div className="flex flex-wrap items-baseline justify-center gap-2.5">
          <span className="font-heading text-[clamp(20px,3vh,26px)] font-bold text-text-primary">
            {entry.n}
          </span>
          <span className="font-mono text-xs text-[#7986cb]">
            {entry.d} · {fmtDist(entry)}
          </span>
        </div>
        <button
          onClick={(e) => {
            // Stop the click here so the dialog root's onDismiss doesn't also fire — opening
            // the card already closes the vista (SpaceScene's onOpenCard sets vista: null).
            e.stopPropagation();
            onOpenCard();
          }}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-[#ffc107]/40 bg-[#ffc107]/10 px-4 py-1.5 font-mono text-[11px] tracking-wider text-[#ffd54f] hover:bg-[#ffc107]/20"
        >
          OPEN COLLECTOR CARD ▸
        </button>
        {/* PF-11 D4.1: replaces the old "HOVER THE BODY FOR VITALS" line, which was dead
            copy on touch (nothing to hover). Both render; the media query picks one. */}
        <div className="font-mono text-[9.5px] tracking-wider text-[#5c6bc0] [@media(pointer:coarse)]:hidden">
          CLICK ANYWHERE OR PRESS SPACE TO RESUME FLIGHT
        </div>
        <div className="hidden font-mono text-[9.5px] tracking-wider text-[#5c6bc0] [@media(pointer:coarse)]:block">
          TAP ANYWHERE TO RESUME FLIGHT
        </div>
      </div>
    </div>
  );
}
