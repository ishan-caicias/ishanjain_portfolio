import { fmtC } from "@/lib/spaceHelpers";
import type { NavNotice, WarpState } from "./types";

/**
 * Full-screen warp-transit HUD: letterbox bars, destination name, phase label
 * (aligning trajectory / acceleration / flip & burn / braking), velocity and
 * remaining-distance readouts, progress bar. Ported from lines 843-858.
 *
 * PF-11 D3.3 (ADR-0010) adds two mid-journey acknowledgements so an interrupted press is
 * never silent: `notice` is the one-shot "the press registered" banner (an abort or a
 * queued retarget, auto-cleared by the host after a few seconds — see SpaceScene.tsx's
 * `NAV_NOTICE_MS`); `queuedName` is the PERSISTENT half, shown for as long as a retarget
 * is actually queued, independent of whether the notice banner has already faded. A queue
 * with no visible trace would just be a slower silent no-op — the whole point of this
 * slice was to stop having one of those.
 */
export default function WarpOverlay({
  warp,
  destName,
  notice,
  queuedName,
}: {
  warp: WarpState | null;
  destName: string;
  notice?: NavNotice | null;
  queuedName?: string | null;
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
      {/* data-testid exists so an E2E spec can assert GEOMETRICALLY that the mission console
          clears this bar. A hit-test (`elementFromPoint`) cannot catch that class of defect
          here: this overlay is `pointer-events-none`, so clicks always passed through to the
          button underneath even while it was completely painted over — which is exactly how
          the occlusion shipped unnoticed. */}
      <div
        data-testid="warp-letterbox-bottom"
        className="absolute inset-x-0 bottom-0 h-16 origin-bottom animate-[ij-barin_0.5s_ease-out_both] bg-[#05081a]"
      />

      {/* PF-11 D3.3: the one-shot "the press registered" acknowledgement — an abort or a
          queued retarget — sits above the ongoing readout so it reads as a distinct event
          rather than another line of the same status block. `key` re-triggers the entrance
          animation if a second notice arrives while the first is still fading (last-wins,
          matching the queue itself). */}
      {notice && (
        <div
          key={notice.kind + notice.text}
          data-testid="nav-notice"
          className="absolute inset-x-0 top-20 flex animate-[ij-fadein_0.2s_ease-out_both] justify-center"
        >
          <div className="rounded-full border border-[#ffc107]/40 bg-[#05081a]/90 px-4 py-1.5 font-mono text-[11px] tracking-[0.2em] text-[#ffd54f] shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            {notice.text}
          </div>
        </div>
      )}

      {/* PF-11 post-D8: floor raised 112px → 148px (and 17vh → 20vh) so the mid-warp readout
          cannot collide with the mission console, which now lifts to clear the bottom letterbox
          — see global.css's `body.ij-warping #ij-mission-bar` for why that lift is forced. */}
      <div
        data-testid="warp-readout"
        className="absolute bottom-[clamp(148px,20vh,190px)] left-1/2 -translate-x-1/2 text-center font-mono"
      >
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
        {/* PF-11 D3.3: the PERSISTENT half — stays for as long as a retarget is actually
            queued, independent of the notice banner above (which fades after a few
            seconds regardless of whether the queue has drained yet). */}
        {queuedName && (
          <div
            data-testid="queued-badge"
            className="mt-1 text-[10.5px] tracking-wider text-[#ffd54f]"
          >
            RETARGET QUEUED · {queuedName}
          </div>
        )}
        <div className="mx-auto mt-2.5 h-0.5 w-[260px] overflow-hidden rounded-full bg-[#1a237e]">
          <div className="h-full bg-[#43a047]" style={{ width: pct + "%" }} />
        </div>
      </div>
    </div>
  );
}
