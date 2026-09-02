import { useEffect, useRef } from "react";
import { moveFocusTo } from "@/lib/focus-utils";

/**
 * PF-11 D1.3 — the SKIP affordance shown during the launch ascent.
 *
 * Skippable at EVERY moment is a hard requirement (D1.2 mandate, D1-AC3): a visible `SKIP ▸`,
 * plus Esc / Space / click anywhere. It is a full-screen capture layer (`pointer-events-auto`) so
 * a click anywhere skips AND a stray canvas click can't launch a travel mid-cinematic. A skip is
 * a jump-to-end (the engine's `skipAscent` snaps to the handoff), never a second animation.
 *
 * Any input during the ascent must produce a visible response — a recorded no-op is a failure
 * (D1-AC3). Here every path routes to `onSkip`, so there is no silent input.
 */
export default function AscentSkip({ onSkip }: { onSkip: () => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Take focus on mount so Space/Esc reach this layer rather than whatever had focus (the LAUNCH
  // button, now unmounted). Focus is not trapped — this is a transient title-sequence overlay.
  useEffect(() => {
    moveFocusTo(rootRef.current);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      onSkip();
    }
  };

  return (
    <div
      ref={rootRef}
      id="ij-ascent-skip"
      role="button"
      aria-label="Skip the launch sequence"
      tabIndex={0}
      onClick={onSkip}
      onKeyDown={onKeyDown}
      className="pointer-events-auto fixed inset-0 z-[70] flex items-end justify-center pb-14 outline-none"
    >
      <span className="rounded-lg border border-[#283593]/70 bg-[#05081a]/70 px-4 py-2 font-mono text-[11px] tracking-[0.2em] text-[#9fa8da] backdrop-blur-sm">
        SKIP ▸
      </span>
    </div>
  );
}
