import { fmtC } from "@/lib/spaceHelpers";
import type { WarpState } from "./types";

/**
 * Full-screen warp-transit HUD: letterbox bars, destination name, phase label
 * (aligning trajectory / acceleration / flip & burn / braking), velocity and
 * remaining-distance readouts, progress bar. Ported from lines 843-858.
 */
export default function WarpOverlay({
  warp,
  destName,
}: {
  warp: WarpState | null;
  destName: string;
}) {
  if (!warp) return null;

  const warpPhase =
    warp.phase === "aim"
      ? "ALIGNING TRAJECTORY"
      : warp.wphase === "flip"
        ? "FLIP & BURN — ROTATING SHIP"
        : warp.wphase === "decel"
          ? "BRAKING BURN"
          : "ACCELERATION BURN";

  const warpVel =
    warp.phase === "aim"
      ? ""
      : warp.vC
        ? "APPARENT VELOCITY " + fmtC(warp.vC)
        : warp.home
          ? "RETROGRADE TRANSIT"
          : "";

  let warpLy: string;
  if (warp.ly != null && !warp.home) {
    const ly = warp.ly;
    warpLy =
      ly > 1e6
        ? (ly / 1e6).toFixed(2) + " million ly remaining"
        : ly > 1000
          ? Math.round(ly).toLocaleString() + " ly remaining"
          : ly > 0.01
            ? ly.toFixed(2) + " ly remaining"
            : "final approach";
  } else {
    warpLy = warp.home ? "returning to origin" : "spooling warp core";
  }

  const pct = Math.round((warp.t || 0) * 100);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70]"
    >
      <div className="absolute inset-x-0 top-0 h-16 origin-top animate-[ij-barin_0.5s_ease-out_both] bg-[#05081a]" />
      <div className="absolute inset-x-0 bottom-0 h-16 origin-bottom animate-[ij-barin_0.5s_ease-out_both] bg-[#05081a]" />
      <div className="absolute bottom-[clamp(112px,17vh,170px)] left-1/2 -translate-x-1/2 text-center font-mono">
        <div className="text-xs tracking-[0.3em] text-[#43a047]">
          {warpPhase}
        </div>
        <div className="mt-1 font-heading text-3xl font-bold tracking-tight text-text-primary">
          {destName}
        </div>
        <div className="mt-1 text-[12.5px] text-[#7986cb]">{warpLy}</div>
        <div className="mt-0.5 text-[11px] tracking-wider text-[#5c6bc0]">
          {warpVel}
        </div>
        <div className="mx-auto mt-2.5 h-0.5 w-[260px] overflow-hidden rounded-full bg-[#1a237e]">
          <div className="h-full bg-[#43a047]" style={{ width: pct + "%" }} />
        </div>
      </div>
    </div>
  );
}
