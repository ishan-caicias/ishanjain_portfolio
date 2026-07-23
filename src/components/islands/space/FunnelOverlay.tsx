import { useState } from "react";
import type { FunnelSession } from "@/lib/funnel";
import {
  accidentalWarpEvents,
  armedToPressMs,
  zeroResultSearches,
} from "@/lib/funnel";

interface FunnelOverlayProps {
  session: FunnelSession;
}

/**
 * PF-11 D1.4 — the `?funnel=1` debug overlay (UX research plan §3). Read-only view of the
 * session `FunnelRecorder` already keeps; COPY DIAGNOSTICS is the "solo-owner backend" the
 * research plan describes — a visitor pastes the blob into chat/email, nothing here ever
 * makes a network request. Tailwind utility classes only, no dynamic inline styling, so this
 * component needs no runtime `style` prop at all — CLAUDE.md #12 is a non-issue here rather
 * than worked around (unlike the `?perf=1` overlay it sits beside).
 */
export default function FunnelOverlay({ session }: FunnelOverlayProps) {
  const [copied, setCopied] = useState(false);

  const armedToPress = armedToPressMs(session.events);
  const accidentalWarps = accidentalWarpEvents(session.events);
  const zeroResults = zeroResultSearches(session.events);

  const copyDiagnostics = async () => {
    const perfWin = window as unknown as {
      __ijPerf?: () => Record<string, unknown>;
    };
    // "funnel timeline + the perf-telemetry device-signature line + engine/tier resolution"
    // (research plan §3) — window.__ijPerf() already carries engine/tier/device in one call.
    const blob = { funnel: session, perf: perfWin.__ijPerf?.() ?? null };
    try {
      await navigator.clipboard.writeText(JSON.stringify(blob, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard permission denied/unavailable — the visible timeline is still readable */
    }
  };

  return (
    <div
      id="ij-funnel"
      role="status"
      aria-label="Funnel diagnostics"
      className="pointer-events-auto fixed bottom-8 right-2 z-[80] max-h-[70vh] w-[min(340px,calc(100vw-16px))] overflow-y-auto rounded-lg border border-[#1a237e] bg-[#05081a]/90 p-3 font-mono text-[11px] leading-relaxed tracking-wide text-[#9fa8da] backdrop-blur-sm"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="tracking-[0.2em] text-[#7986cb]">
          FUNNEL · DIAGNOSTICS
        </span>
        <button
          type="button"
          onClick={copyDiagnostics}
          className="rounded border border-[#283593]/70 bg-[#1a237e]/35 px-2 py-0.5 text-[10px] tracking-wider text-[#9fa8da] hover:border-[#ffc107]/40 hover:text-[#ffd54f]"
        >
          {copied ? "COPIED ✓" : "COPY DIAGNOSTICS"}
        </button>
      </div>

      <div className="text-[#5c6bc0]">{session.device}</div>

      <div className="mt-2 space-y-0.5">
        {session.events.length === 0 && (
          <div className="text-[#5c6bc0]">No events yet.</div>
        )}
        {session.events.map((e, i) => (
          <div key={i} className="flex justify-between gap-2">
            <span>{e.event}</span>
            <span className="text-[#5c6bc0]">
              {(e.t / 1000).toFixed(1)}s
              {typeof e.meta?.query === "string" ? ` · "${e.meta.query}"` : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 space-y-0.5 border-t border-[#1a237e] pt-2 text-[#7986cb]">
        <div>
          ARMED→PRESS{" "}
          {armedToPress === null ? "—" : `${Math.round(armedToPress)}ms`}
        </div>
        <div>
          ACCIDENTAL WARPS {accidentalWarps.length}
          {accidentalWarps.length > 0 ? " ⚠" : ""}
        </div>
        <div>
          ZERO-RESULT SEARCHES{" "}
          {zeroResults.length === 0 ? "—" : zeroResults.join(", ")}
        </div>
      </div>
    </div>
  );
}
