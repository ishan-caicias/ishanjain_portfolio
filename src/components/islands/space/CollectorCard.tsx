import { useEffect, useRef } from "react";
import type { CelestialEntry } from "@/data/celestial/celestial.d.ts";
import { figGeom, drawGlobe, rarityColor } from "@/lib/spaceHelpers";
import { moveFocusTo, restoreFocusTo, trapFocus } from "@/lib/focus-utils";
import type { CardStyleMode } from "./types";

const RARITY_TIERS: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

const FOIL_OPACITY: Record<string, number> = {
  legendary: 0.42,
  epic: 0.34,
  rare: 0.26,
  uncommon: 0.2,
  common: 0.16,
};

interface CollectorCardProps {
  entry: CelestialEntry;
  styleMode: CardStyleMode;
  tilt: { rx: number; ry: number };
  onClose: () => void;
  onReturnHome: () => void;
  onSetStyle: (mode: CardStyleMode) => void;
  onTilt: (rx: number, ry: number) => void;
  onUntilt: () => void;
}

/**
 * The collector card for a curated body or field star, in one of three visual variants
 * (holo/dossier/plate — "dossier" here names one visual SKIN, not the whole card; see the
 * header note on why the card itself is never called that) the user can switch between.
 * Ported from lines 900-1016 (template) + the `card`/`v*` computed groups in renderVals()
 * (lines 1651-1710).
 *
 * PF-11 D4.3: a real modal — it floats over a live, still-interactive scene (unlike PreFlight
 * or ArrivalVista, neither of which has anything behind them to trap Tab away from) — so it's
 * the first `trapFocus` consumer: focused on mount, restored on unmount (`moveFocusTo`/
 * `restoreFocusTo`, same as ArrivalVista), and Tab/Shift+Tab kept inside its own controls
 * (close button, style dots, RETURN HOME) rather than leaking into the mission bar/header.
 */
export default function CollectorCard({
  entry: e,
  styleMode,
  tilt,
  onClose,
  onReturnHome,
  onSetStyle,
  onTilt,
  onUntilt,
}: CollectorCardProps) {
  const globeRef = useRef<(HTMLCanvasElement & { _drawnFor?: string }) | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    moveFocusTo(rootRef.current);
    return () => restoreFocusTo(previousFocusRef.current);
  }, []);

  const tier = RARITY_TIERS[e.r] || 1;
  const rc = rarityColor(e.r);
  const isGlobe =
    (e.t === "planet" || e.t === "moon" || e.t === "dwarf") && !!e.img;
  const isFig = !!e.fig;
  const isStar = !e.img && !isFig;
  const isImg = !!e.img && !isGlobe;
  const fig = isFig ? figGeom(e) : null;
  const c = e.c || "#ffd54f";
  const foilOpacity = FOIL_OPACITY[e.r] ?? 0.16;
  const foilPos = `${50 + tilt.ry * 3}% ${50 + tilt.rx * 3}%`;
  const gems = "◆".repeat(tier) + "◇".repeat(5 - tier);

  let vHeadTag: string;
  let vImgRadius: string;
  let vImgFilter: string;
  let vShowBars: boolean;
  let vShowFoil: boolean;
  let vLabel: string;
  let variantClass: string;
  let variantStyle: React.CSSProperties = {};

  if (styleMode === "dossier") {
    vHeadTag = "OBSERVATION DOSSIER · GAIA DR3";
    vImgRadius = "4px";
    vImgFilter = "saturate(0.9) contrast(1.05)";
    vShowBars = true;
    vShowFoil = false;
    vLabel = "DOSSIER";
    variantClass = "rounded-lg border font-mono";
    variantStyle = {
      borderColor: "rgba(63,81,181,0.6)",
      background:
        "linear-gradient(rgba(13,17,32,0.97), rgba(13,17,32,0.97)), repeating-linear-gradient(0deg, rgba(92,107,192,0.12) 0px, rgba(92,107,192,0.12) 1px, transparent 1px, transparent 3px)",
    };
  } else if (styleMode === "plate") {
    vHeadTag = "OBSERVATORY PLATE · ARCHIVE EDITION";
    vImgRadius = "9999px 9999px 12px 12px";
    vImgFilter = "sepia(0.25) saturate(0.9)";
    vShowBars = false;
    vShowFoil = false;
    vLabel = "PLATE";
    variantClass = "rounded-[14px] border-2";
    variantStyle = {
      borderColor: rc + "55",
      outline: `1px solid ${rc}33`,
      outlineOffset: "5px",
      background: "linear-gradient(170deg, #14183c, #0a0e27 90%)",
    };
  } else {
    vHeadTag = "COLLECTOR CARD · CELESTIAL SERIES";
    vImgRadius = "12px";
    vImgFilter = "none";
    vShowBars = true;
    vShowFoil = true;
    vLabel = "HOLO";
    variantClass = "rounded-[18px] border";
    variantStyle = {
      borderColor: rc + "77",
      background: "linear-gradient(160deg, #1b2150, #0d1257 65%, #101540)",
    };
  }

  const stats = (e.st || []).map((row) => ({
    label: row[0].toUpperCase(),
    value: row[1],
    pct: Math.round(Math.max(0.04, Math.min(1, row[2] ?? 0.5)) * 100) + "%",
  }));
  const lore = (e.lo || []).map((l) => ({
    culture: l[0].toUpperCase(),
    text: l[1],
  }));

  const dotStyle = (
    name: CardStyleMode,
    color: string,
  ): React.CSSProperties => ({
    background: color,
    boxShadow:
      styleMode === name ? "0 0 0 2px #0a0e27, 0 0 0 3.5px #ffd54f" : undefined,
    opacity: styleMode === name ? 1 : 0.55,
  });

  return (
    <div
      data-screen-label="Collector card"
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ perspective: "1400px" }}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-[#0a0e27]/72 backdrop-blur-sm"
      />

      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="collector-card-name"
        tabIndex={-1}
        onKeyDown={(ev) => {
          if (rootRef.current) trapFocus(rootRef.current, ev);
        }}
        onMouseMove={(ev) => {
          const r = ev.currentTarget.getBoundingClientRect();
          const mx = (ev.clientX - r.left) / r.width;
          const my = (ev.clientY - r.top) / r.height;
          onTilt((0.5 - my) * 7, (mx - 0.5) * 9);
        }}
        onMouseLeave={onUntilt}
        className={`relative z-10 max-h-[88vh] w-[min(380px,calc(100vw-40px))] animate-[ij-cardin_0.32s_ease-out_both] overflow-y-auto p-4 shadow-[0_40px_80px_rgba(0,0,0,0.6)] outline-none transition-transform duration-150 ease-out ${variantClass}`}
        style={{
          ...variantStyle,
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close card"
          className="absolute right-2.5 top-2.5 z-30 flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[#3f51b5]/35 bg-[#0a0e27]/80 text-[#9fa8da] hover:bg-[#1a237e]/80 hover:text-text-primary"
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

        <div className="flex items-baseline justify-between gap-2.5 px-1 pb-2.5 pt-0.5">
          <div className="min-w-0">
            <div
              className="font-mono text-[9.5px] tracking-[0.28em]"
              style={{ color: rc }}
            >
              {vHeadTag}
            </div>
            <div
              id="collector-card-name"
              className="mt-0.5 font-heading text-[23px] font-bold leading-tight text-text-primary"
            >
              {e.n}
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-[#5c6bc0]">
              {e.d}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div
              className="whitespace-nowrap text-[13px] tracking-wider"
              style={{ color: rc }}
            >
              {gems}
            </div>
            <div
              className="mt-0.5 font-mono text-[8.5px] tracking-[0.2em]"
              style={{ color: rc }}
            >
              {e.r.toUpperCase()}
            </div>
          </div>
        </div>

        <div
          className="relative aspect-[4/3] overflow-hidden border"
          style={{
            borderRadius: vImgRadius,
            borderColor: rc + "66",
            background:
              "radial-gradient(ellipse at 50% 60%, #111638 0%, #05081a 80%)",
          }}
        >
          {isImg && (
            <div
              role="img"
              aria-label={e.n}
              className="absolute inset-0"
              style={{
                background: `url('${e.img || ""}') center/cover`,
                filter: vImgFilter,
              }}
            />
          )}
          {isStar && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="aspect-square w-[64%] rounded-full blur-[0.5px]"
                style={{
                  background: `radial-gradient(circle, #ffffff 0%, #ffffff 7%, ${c} 22%, ${c}55 44%, transparent 68%), linear-gradient(0deg, transparent 46.5%, ${c}44 49%, rgba(255,255,255,0.85) 50%, ${c}44 51%, transparent 53.5%), linear-gradient(90deg, transparent 46.5%, ${c}44 49%, rgba(255,255,255,0.85) 50%, ${c}44 51%, transparent 53.5%), radial-gradient(circle, ${c}26 36%, transparent 70%)`,
                }}
              />
              <div
                aria-hidden="true"
                className="absolute left-[14%] top-[8%] aspect-square w-[72%] rounded-full opacity-85 mix-blend-screen"
                style={{
                  background: "url('/assets/star-tex.jpg') center/cover",
                }}
              />
            </div>
          )}
          {isGlobe && (
            <div className="absolute inset-0 flex items-center justify-center">
              <canvas
                width={480}
                height={360}
                ref={(el) => {
                  globeRef.current = el;
                  if (el) drawGlobe(el, e);
                }}
                className="h-full w-full"
              />
            </div>
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
                  stroke="#5c6bc0"
                  strokeWidth={1}
                  opacity={0.65}
                />
              ))}
              {fig.figStars.map((st, i) => (
                <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#ffe082" />
              ))}
            </svg>
          )}
          {vShowFoil && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 animate-[ij-foil_7s_ease-in-out_infinite] mix-blend-color-dodge"
              style={{
                opacity: foilOpacity,
                background:
                  "linear-gradient(115deg, transparent 20%, rgba(121,134,203,0.9) 36%, rgba(255,213,79,0.9) 46%, rgba(128,222,234,0.9) 55%, rgba(244,143,177,0.85) 64%, transparent 80%)",
                backgroundSize: "280% 280%",
                backgroundPosition: foilPos,
              }}
            />
          )}
          <div className="absolute bottom-1.5 left-2 font-mono text-[9px] tracking-wider text-[#e8eaf6]/60">
            {isFig
              ? "FIGURE · HIPPARCOS POSITIONS"
              : isGlobe
                ? "SURFACE MAP · NASA / GAIA SKY"
                : isStar
                  ? "SPECTRAL RENDER · " + (e.sp || "")
                  : "IMAGE · " + (e.crd || "NASA / ESA ARCHIVES")}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span
            className="rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-[#0a0e27]"
            style={{ background: rc }}
          >
            {e.t === "deepfield" ? "DEEP FIELD" : e.t.toUpperCase()}
          </span>
          <span className="rounded border border-[#3f51b5]/55 px-2 py-0.5 font-mono text-[10px] tracking-wider text-[#9fa8da]">
            {e.sp}
          </span>
          {e.con && e.con !== "—" && (
            <span className="rounded border border-[#3f51b5]/55 px-2 py-0.5 font-mono text-[10px] tracking-wider text-[#9fa8da]">
              IN {e.con.toUpperCase()}
            </span>
          )}
          <span className="rounded border border-[#3f51b5]/55 px-2 py-0.5 font-mono text-[10px] tracking-wider text-[#9fa8da]">
            RA {e.ra.toFixed(1)}° · DEC {e.dec >= 0 ? "+" : ""}
            {e.dec.toFixed(1)}°
          </span>
        </div>

        {vShowBars && stats.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {stats.map((st, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[10px] tracking-wider text-[#7986cb]">
                    {st.label}
                  </span>
                  <span className="text-right text-[13px] text-text-primary">
                    {st.value}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-0.5 h-[3px] overflow-hidden rounded-full bg-[#1a237e]/55"
                >
                  <div
                    className="h-full rounded-full opacity-85"
                    style={{ background: rc, width: st.pct }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 rounded-[10px] bg-[#1a237e]/35 px-3 py-2.5">
          <div className="font-mono text-[9.5px] tracking-[0.24em] text-[#ffd54f]">
            ✦ FIELD NOTE
          </div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#c5cae9]">
            {e.f}
          </p>
        </div>

        {lore.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 font-mono text-[8.5px] tracking-[0.24em] text-[#5c6bc0]">
              SKY LORE · MYTHOLOGIES OF THE WORLD
            </div>
            <div className="flex flex-col gap-2">
              {lore.map((l, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 whitespace-nowrap rounded border border-[#ffc107]/35 px-1.5 py-px font-mono text-[8.5px] tracking-wider text-[#ffd54f]">
                    {l.culture}
                  </span>
                  <p className="text-xs leading-relaxed text-[#9fa8da]">
                    {l.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3.5 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5">
            {/* PF-11 D4.3: the 24px button is the real hit target (WCAG 2.5.8) — the visible
                14px dot inside it is purely decorative and stays aria-hidden, since the
                button's own aria-label/aria-pressed already name and state the control. */}
            <button
              onClick={() => onSetStyle("holo")}
              title="Holo card style"
              aria-label="Holo card style"
              aria-pressed={styleMode === "holo"}
              className="flex h-6 w-6 items-center justify-center rounded-full"
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-full border border-[#9fa8da]/50"
                style={dotStyle("holo", "#ffd54f")}
              />
            </button>
            <button
              onClick={() => onSetStyle("dossier")}
              title="Dossier card style"
              aria-label="Dossier card style"
              aria-pressed={styleMode === "dossier"}
              className="flex h-6 w-6 items-center justify-center rounded-full"
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-full border border-[#9fa8da]/50"
                style={dotStyle("dossier", "#5c6bc0")}
              />
            </button>
            <button
              onClick={() => onSetStyle("plate")}
              title="Plate card style"
              aria-label="Plate card style"
              aria-pressed={styleMode === "plate"}
              className="flex h-6 w-6 items-center justify-center rounded-full"
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-full border border-[#9fa8da]/50"
                style={dotStyle("plate", "#b39ddb")}
              />
            </button>
            <span className="ml-1 font-mono text-[8.5px] tracking-wider text-[#3f51b5]">
              {vLabel}
            </span>
          </div>
          <button
            onClick={onReturnHome}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2e7d32]/45 bg-[#1b5e20]/15 px-3.5 py-1.5 font-mono text-[11px] tracking-wider text-[#43a047] hover:bg-[#1b5e20]/30"
          >
            ◂ RETURN HOME
          </button>
        </div>
      </div>
    </div>
  );
}
