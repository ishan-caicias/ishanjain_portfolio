export interface CommandSuggestion {
  id: string;
  name: string;
  type: string;
  dist: string;
  color: string;
}

interface MissionControlBarProps {
  cmd: string;
  suggestions: CommandSuggestion[];
  onCmdChange: (value: string) => void;
  onCmdKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSuggestionSelect: (s: CommandSuggestion) => void;
  onRandom: () => void;
  onHome: () => void;
  /** PF-11 D3.3 (ADR-0010) — non-null for as long as a mid-journey retarget is queued.
   * This is a minimal console acknowledgement, not the D5.2 rewrite: the delivery plan
   * scopes "the Where-To console's mid-warp state reflects the queue" to D5.2's own
   * combobox/matching build, which doesn't exist yet. Submitting here already queues
   * correctly today (the engine change is orthogonal to this UI); this prop only makes
   * that visible where the visitor is looking when they pressed Enter. */
  queuedName?: string | null;
}

/**
 * "WHERE TO ▸" command bar with live autocomplete against the full catalog. Ported from
 * lines 371-391. Position simplified to fixed bottom-center for Phase 2 - the source
 * tethers this below the spaceship every frame (see PF-07 delivery plan, deferred to a
 * later phase when the hero-copy/dodge-zone context this needs also exists).
 */
export default function MissionControlBar({
  cmd,
  suggestions,
  onCmdChange,
  onCmdKeyDown,
  onSuggestionSelect,
  onRandom,
  onHome,
  queuedName,
}: MissionControlBarProps) {
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
            value={cmd}
            onChange={(e) => onCmdChange(e.target.value)}
            onKeyDown={onCmdKeyDown}
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

        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-xl border border-[#283593]/60 bg-[#070914]/96 py-1.5 shadow-[0_24px_50px_rgba(0,0,0,0.5)] backdrop-blur-md">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => onSuggestionSelect(s)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left hover:bg-[#1a237e]/50"
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
