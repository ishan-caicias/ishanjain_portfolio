import { fmtRa } from "@/lib/spaceHelpers";
import { SECTOR_LABELS } from "./types";
import type { WarpState } from "./types";

interface HUDProps {
  progress: { loaded: number; total: number };
  ready: boolean;
  catalogCount: number;
  aim: { ra: number; dec: number };
  warp: WarpState | null;
  arrivedId: string | null;
  sector: string;
  onOpenCredits: () => void;
  isTravel: boolean;
  onToggleNavMode: () => void;
}

/**
 * Top-left catalog-stream readout + top-right bearing readout. Always visible during travel.
 * Ported from Space Portfolio.dc.html lines 351-369.
 */
export default function HUD({
  progress,
  ready,
  catalogCount,
  aim,
  warp,
  arrivedId,
  sector,
  onOpenCredits,
  isTravel,
  onToggleNavMode,
}: HUDProps) {
  const streamLine = ready
    ? "ONLINE · " +
      progress.total.toLocaleString() +
      " LIVE SOURCES · " +
      catalogCount +
      " CHARTED"
    : "STREAMING CHUNK · " +
      progress.loaded.toLocaleString() +
      " / " +
      (progress.total || 200000).toLocaleString();
  const pct = progress.total
    ? Math.round((progress.loaded / progress.total) * 100)
    : 0;
  const bearingLine =
    "RA " +
    fmtRa(aim.ra) +
    " · DEC " +
    (aim.dec >= 0 ? "+" : "−") +
    Math.abs(aim.dec).toFixed(1) +
    "°";
  const statusLine = warp
    ? "WARP TRANSIT"
    : arrivedId
      ? "ON STATION"
      : "STATION-KEEPING";
  const sectorLine = "SECTOR · " + (SECTOR_LABELS[sector] || "SOL");

  return (
    <>
      <div className="pointer-events-none fixed left-6 top-[clamp(72px,12vh,78px)] z-10 select-none font-mono text-[11.5px] tracking-wider text-[#7986cb]">
        <div className="hidden md:block">
          <div className="text-[#9fa8da]">
            GAIA DR3 · HIPPARCOS · CNS5 · NGC2000
          </div>
          <div>
            {streamLine}
            <span className="animate-pulse">▌</span>
          </div>
          <div className="mt-0.5 h-0.5 w-[210px] overflow-hidden rounded-full bg-[#1a237e]">
            <div
              className="h-full transition-[width] duration-200"
              style={{
                background: ready ? "#43a047" : "#ffd54f",
                width: pct + "%",
              }}
            />
          </div>
          <div className="mt-1.5 text-[#3f51b5]">ORIGIN · SOL-3 (EARTH)</div>
        </div>
        <button
          onClick={onOpenCredits}
          className="pointer-events-auto mt-1.5 rounded border border-[#3f51b5]/50 px-2.5 py-0.5 text-[10.5px] tracking-widest text-[#7986cb] hover:border-[#ffc107]/40 hover:text-[#ffd54f]"
        >
          DATA &amp; LICENSES ▸
        </button>
        <div className="mt-2.5 hidden max-w-[190px] text-[10px] leading-relaxed tracking-wider text-[#5c6bc0] md:block">
          DRAG TO LOOK 360°
          <br />
          CLICK A CRAFT OR GOLD BEACON TO TRAVEL
          <br />
          KEYS · ← → ↑ ↓ LOOK · ENTER TRAVEL · H HOME
        </div>
      </div>

      <div className="pointer-events-none fixed right-6 top-[clamp(72px,12vh,78px)] z-10 select-none text-right font-mono text-[11.5px] tracking-wider text-[#7986cb]">
        <div aria-hidden="true" className="hidden md:block">
          <div className="text-[#9fa8da]">BEARING</div>
          <div>{bearingLine}</div>
          <div className="text-[#ffd54f]">{sectorLine}</div>
          <div className="text-[#3f51b5]">{statusLine}</div>
        </div>
        <button
          onClick={onToggleNavMode}
          title="Switch between spaceship navigation and a classic scrolling page"
          className="pointer-events-auto mt-2 whitespace-nowrap rounded-md border border-[#3f51b5]/50 bg-[#1a237e]/30 px-2.5 py-1 text-[9.5px] tracking-widest text-[#9fa8da] hover:border-[#ffc107]/40 hover:text-[#ffd54f]"
        >
          {isTravel ? "◈ CLASSIC VIEW" : "◈ TRAVEL MODE"}
        </button>
      </div>
    </>
  );
}
