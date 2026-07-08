import { useRef } from "react";
import CraftIcon from "./CraftIcons";
import { STATIONS } from "./types";

export type SpriteRefMap = Record<string, HTMLDivElement | null>;

/**
 * The 7 nav-station markers (About/Experience/Achievements/Projects/Skills/Contact/Moon
 * Base). Rendered once with opacity:0/visibility:hidden; per-frame position/visibility is
 * mutated imperatively via `onRefsReady` rather than through React state, matching the
 * source's own rationale (`_sprTick` in the DC logic class) - re-rendering 7 positioned
 * elements every animation frame through React would be wasteful. Ported from lines 65-182.
 */
export default function StationSprites({
  onRefsReady,
  onGo,
}: {
  onRefsReady: (refs: SpriteRefMap) => void;
  onGo: (sec: string) => void;
}) {
  const refs = useRef<SpriteRefMap>({});

  return (
    <>
      {STATIONS.map((st, i) => (
        <div
          key={st.sec}
          ref={(el) => {
            refs.current[st.sec] = el;
            onRefsReady(refs.current);
          }}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: 200,
            display: "flex",
            justifyContent: "center",
            zIndex: 5,
            pointerEvents: "none",
            opacity: 0,
            visibility: "hidden",
            transition: "opacity 0.4s",
            willChange: "transform",
          }}
        >
          <div
            style={{
              animation: `ij-drift ${(8 + i * 1.3).toFixed(1)}s ease-in-out infinite alternate`,
            }}
          >
            <button
              onClick={() => onGo(st.sec)}
              aria-label={"Travel to " + st.label}
              className="flex flex-col items-center gap-1.5 border-none bg-transparent p-1.5"
              style={{ pointerEvents: "auto", cursor: "pointer" }}
            >
              <span
                style={{
                  display: "block",
                  animation: `ij-tumble ${(6.5 + i * 1.1).toFixed(1)}s ease-in-out infinite alternate`,
                  filter: "drop-shadow(0 0 10px rgba(63,81,181,0.5))",
                }}
              >
                <CraftIcon craft={st.craft} />
              </span>
              <span className="flex flex-col items-center gap-0.5">
                <span className="whitespace-nowrap rounded-md border border-[#3f51b5]/55 bg-[#070914]/82 px-2.5 py-1 font-mono text-[11.5px] tracking-wider text-text-primary">
                  {st.label}
                </span>
                <span className="whitespace-nowrap font-mono text-[9.5px] tracking-wider text-[#7986cb]">
                  {st.sub}
                </span>
              </span>
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
