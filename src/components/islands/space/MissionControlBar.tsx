import { useEffect, useState } from "react";

export interface CommandSuggestion {
  id: string;
  name: string;
  type: string;
  dist: string;
  color: string;
  /** PF-11 D5.2 — badges stations distinctly and (D5.3) will badge class rows; bodies keep
   * the existing plain-type badge treatment. */
  kind: "body" | "station" | "class";
}

interface MissionControlBarProps {
  cmd: string;
  /** Ranked, already-capped matches for a non-empty query (destination-search.ts `search()`). */
  suggestions: CommandSuggestion[];
  /** Uncapped match count for the same query — drives "N MATCHES · SHOWING 10" honest
   * truncation (D5.2) when it exceeds `suggestions.length`. */
  totalMatches: number;
  /** Empty-query "NOTABLE DESTINATIONS" list (D5.2) — shown on focus before anything is typed. */
  featured: CommandSuggestion[];
  onCmdChange: (value: string) => void;
  /** Fires for keys this component does not itself intercept (currently: Escape only, so the
   * host can still clear `cmd`) — Arrow/Enter navigation is owned locally (D5.2 combobox). */
  onCmdKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSuggestionSelect: (s: CommandSuggestion) => void;
  onRandom: () => void;
  onHome: () => void;
  /** PF-11 D3.3 (ADR-0010) — non-null for as long as a mid-journey retarget is queued. */
  queuedName?: string | null;
}

/**
 * "WHERE TO ▸" command bar with ranked live search against the full catalog + nav stations
 * (PF-11 D5.2). ARIA `combobox`/`listbox` pattern: Arrow Up/Down move the highlighted option,
 * Enter activates it (top-ranked by default, matching D5-AC: "Enter travels to the ACTIVE
 * option"), Escape clears. Ported from lines 371-391 (PF-07); position simplified to fixed
 * bottom-center for Phase 2.
 */
export default function MissionControlBar({
  cmd,
  suggestions,
  totalMatches,
  featured,
  onCmdChange,
  onCmdKeyDown,
  onSuggestionSelect,
  onRandom,
  onHome,
  queuedName,
}: MissionControlBarProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const hasQuery = cmd.trim().length > 0;
  const list = hasQuery ? suggestions : featured;
  const noMatch = hasQuery && suggestions.length === 0;

  // A fresh query (or the query clearing back to the featured list) always re-tops the
  // highlight — Enter with no arrow press yet must still travel to the ACTIVE (top-ranked)
  // option, never a stale highlight left over from a previous keystroke's list.
  useEffect(() => {
    setActiveIndex(0);
  }, [cmd]);

  const listboxId = "ij-mission-listbox";
  const activeId =
    open && list[activeIndex] ? `ij-mission-option-${activeIndex}` : undefined;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (!list.length) return;
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % list.length);
      return;
    }
    if (e.key === "ArrowUp") {
      if (!list.length) return;
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i - 1 + list.length) % list.length);
      return;
    }
    if (e.key === "Enter") {
      const active = list[activeIndex] ?? list[0];
      if (active) {
        e.preventDefault();
        onSuggestionSelect(active);
        setOpen(false);
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      onCmdKeyDown(e);
      return;
    }
    onCmdKeyDown(e);
  };

  const showList = open && (list.length > 0 || noMatch);

  return (
    <div
      id="ij-mission-bar"
      className="pointer-events-auto fixed bottom-8 left-1/2 z-[62] w-[min(520px,calc(100vw-28px))] -translate-x-1/2"
    >
      <div className="relative">
        <div className="flex items-center gap-2.5 rounded-xl border border-[#2e7d32]/40 bg-[#070914]/85 px-3.5 py-2.5 backdrop-blur-md">
          <span
            className={`max-w-[45%] flex-shrink truncate font-mono text-xs tracking-wider ${
              queuedName ? "text-[#ffd54f]" : "flex-shrink-0 text-[#43a047]"
            }`}
          >
            {queuedName ? (
              <>QUEUED&nbsp;▸&nbsp;{queuedName.toUpperCase()}</>
            ) : (
              <>WHERE&nbsp;TO&nbsp;▸</>
            )}
          </span>
          <input
            role="combobox"
            aria-expanded={showList}
            aria-controls={listboxId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            value={cmd}
            // PF-11 D5.2 follow-up (2026-07-29 code review, finding 1): typing MUST re-open the
            // list. Escape closes it while leaving the input focused, so without this a visitor
            // who pressed Escape and kept typing got a permanently dead search box — no
            // suggestions until they blurred and refocused. `onFocus` alone is not enough
            // because focus never changes across that sequence.
            onChange={(e) => {
              setOpen(true);
              onCmdChange(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            placeholder="Andromeda, Betelgeuse, Saturn…"
            aria-label="Mission control: type a destination"
            className="min-w-0 flex-1 bg-transparent font-mono text-[13.5px] tracking-tight text-text-primary outline-none placeholder:text-text-dim"
          />
          <button
            onClick={onRandom}
            title="Jump to a random destination"
            aria-label="Jump to a random destination"
            className="flex-shrink-0 rounded-md border border-[#283593]/70 bg-[#1a237e]/35 px-2.5 py-1 font-mono text-[11px] tracking-wider text-[#9fa8da] hover:border-[#ffc107]/40 hover:text-[#ffd54f]"
          >
            {/* PF-11 D5.1 (ADR-0010) — RNG → RANDOM JUMP ▸, compressed to JUMP ▸ under
                400px. Both strings render (one hidden by the breakpoint) so aria-label
                stays the single source of truth for the accessible name at every width. */}
            <span className="max-[399px]:hidden">RANDOM JUMP ▸</span>
            <span className="hidden max-[399px]:inline">JUMP ▸</span>
          </button>
          <button
            onClick={onHome}
            title="Return home to Earth orbit"
            aria-label="Return home to Earth orbit"
            className="flex-shrink-0 rounded-md border border-[#283593]/70 bg-[#1a237e]/35 px-2.5 py-1 font-mono text-[11px] tracking-wider text-[#9fa8da] hover:border-[#ffc107]/40 hover:text-[#ffd54f]"
          >
            {/* PF-11 D5.1 (ADR-0010) — SOL → ◂ RETURN HOME, compressed to ◂ HOME. */}
            <span className="max-[399px]:hidden">◂ RETURN HOME</span>
            <span className="hidden max-[399px]:inline">◂ HOME</span>
          </button>
        </div>

        {showList && (
          <div
            id={listboxId}
            role="listbox"
            aria-label={
              hasQuery ? "Matching destinations" : "Notable destinations"
            }
            // PF-11 D5.2 — the bar is fixed to the bottom of the viewport at every width (not
            // just on mobile), so a list opening downward (the old `top-[calc(100%+8px)]`)
            // always ran off the bottom of the screen for anything but a one-row list. Opening
            // upward is correct at every breakpoint, not only under a mobile keyboard.
            className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-40 max-h-[min(60vh,340px)] overflow-y-auto rounded-xl border border-[#283593]/60 bg-[#070914]/96 py-1.5 shadow-[0_-24px_50px_rgba(0,0,0,0.5)] backdrop-blur-md"
          >
            {!hasQuery && (
              <div className="px-3.5 py-1 font-mono text-[10.5px] tracking-[0.2em] text-[#5c6bc0]">
                NOTABLE DESTINATIONS
              </div>
            )}
            {noMatch ? (
              <div className="px-3.5 py-2 font-mono text-[12px] tracking-wide text-[#7986cb]">
                NO CONTACT · TRY &quot;ORION&quot; OR &quot;SATURN&quot;
              </div>
            ) : (
              list.map((s, i) => (
                <button
                  key={s.id}
                  id={`ij-mission-option-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => {
                    onSuggestionSelect(s);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left ${
                    i === activeIndex ? "bg-[#1a237e]/50" : ""
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{
                      background: s.color,
                      boxShadow: `0 0 6px ${s.color}`,
                    }}
                  />
                  <span className="text-sm font-medium text-text-primary">
                    {s.name}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#7986cb]">
                    {s.type}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-[#5c6bc0]">
                    {s.dist}
                  </span>
                </button>
              ))
            )}
            {hasQuery && !noMatch && totalMatches > suggestions.length && (
              <div className="px-3.5 py-1 font-mono text-[10.5px] tracking-wider text-[#5c6bc0]">
                {totalMatches} MATCHES · SHOWING {suggestions.length}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
