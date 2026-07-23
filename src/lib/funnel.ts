/* funnel.ts — PF-11 D1.4: first-party funnel instrumentation (`?funnel=1`).
 *
 * UX research plan §3: no analytics services, ever (ADR-0005 CSP posture; the absence of
 * tracking is itself a credential for this site's audience). What ships instead is entirely
 * first-party and stays on the visitor's own machine: a session recorder subscribing to the
 * existing `cosmos:*` bus (both engines implement it) plus D1.1's `cosmos:stage` progress
 * events, a ring buffer capped in size, and a COPY DIAGNOSTICS button (FunnelOverlay.tsx) a
 * visitor can paste into chat/email by choice. Nothing here ever makes a network request.
 *
 * Pure and host-agnostic (`now`/`storage` injectable), same convention as
 * `perf-telemetry.ts`'s `PerfMonitor` and `load-progress.ts`'s `StageAggregator` — logic is
 * unit-testable without a browser; `SpaceScene.tsx` is the only place that touches `window`.
 */

/** The nine UX milestones named in the research plan's funnel design (§3):
 * dossier-visible → launch-armed → launch-pressed → cinematic-done → first-travel →
 * first-arrival → vista-dismissed → first-search-keystroke → first-search-travel.
 *
 * The recorder stores the underlying REPEATABLE action names below rather than the plan's
 * "first-X" labels directly — `vista-dismissed` needs every occurrence to drive the
 * accidental-warp detector (a click right after a LATER dismissal, not just the first), and
 * collapsing `travel`/`search-keystroke` to one entry each would make that detector and the
 * zero-result-query flag structurally unable to see anything past the first session action.
 * `firstEventTime()` below recovers the plan's exact "first-X" semantics on demand for
 * display. Recorded scope decision, not a silent deviation (this repo's documentation
 * convention — see TR-084/TR-085's own "notes as built"). */
export type FunnelEventName =
  | "dossier-visible"
  | "launch-armed"
  | "launch-pressed"
  | "cinematic-done"
  | "travel"
  | "arrival"
  | "vista-dismissed"
  | "search-keystroke"
  | "search-travel";

/** One-shot gate milestones — a visitor passes through each of these exactly once per
 * session, so repeat calls are no-ops rather than separate log entries. */
const ONCE_ONLY: ReadonlySet<FunnelEventName> = new Set([
  "dossier-visible",
  "launch-armed",
  "launch-pressed",
  "cinematic-done",
]);

export interface FunnelEvent {
  event: FunnelEventName;
  t: number;
  /** Free-form context — currently the search query text + result count, and which path
   * dismissed a vista — so a pasted diagnostics blob shows what actually happened, not just
   * that something happened. */
  meta?: Record<string, string | number>;
}

export interface FunnelSession {
  /** Identifies this recorder's OWN entry in the persisted ring buffer so repeated
   * `persist()` calls across one page load update it in place instead of appending a
   * duplicate. A monotonic counter rather than `startedAt` deliberately — two recorders
   * created within the same millisecond (a real risk: `Date.now()`'s resolution, not just a
   * test artifact) must never collide. */
  id: number;
  startedAt: number;
  /** `deviceSignature()`'s line (perf-telemetry.ts) — reused rather than re-derived, so a
   * pasted blob is self-identifying without a second device-fingerprint implementation. */
  device: string;
  events: FunnelEvent[];
}

export const FUNNEL_STORAGE_KEY = "ij-funnel";
export const FUNNEL_OVERLAY_STORAGE_KEY = "ij-funnel-overlay";

/** Hard size cap (research plan §3: "the last ~10 sessions... a hard size cap") — nowhere
 * near a real visit's event count, but the cap exists so a runaway recorder can never grow
 * localStorage without bound, the same discipline `StageAggregator`/`fetchWithProgress`
 * already apply to byte counters. */
export const MAX_SESSIONS = 10;
export const MAX_EVENTS_PER_SESSION = 40;

/** Resolve whether the debug overlay renders: URL param → stored override → default off.
 * Mirrors `resolveEngine`'s shape exactly (the established one-hand-roll-per-callsite
 * convention every escape hatch in this repo follows — no shared URL-param helper exists,
 * and this deliberately doesn't introduce one). Recording itself is NOT gated by this: like
 * `window.__ijPerf()`, the recorder always runs so a visitor who adds `?funnel=1` mid-session
 * (or a remote tester told to add it up front) sees the whole session, not just the tail. */
export function resolveFunnelOverlay(
  urlParam: string | null,
  stored: string | null,
): boolean {
  if (urlParam === "1") return true;
  if (urlParam === "0") return false;
  return stored === "1";
}

/** First occurrence of `name` in `events`, or null. Recovers the research plan's "first-X"
 * milestone semantics from the repeatable event log (see the `FunnelEventName` doc comment). */
export function firstEventTime(
  events: readonly FunnelEvent[],
  name: FunnelEventName,
): number | null {
  return events.find((e) => e.event === name)?.t ?? null;
}

/** Assumption 1's validation metric (research plan §2 rank 1): wall-clock from the gate
 * arming to the visitor actually pressing it. */
export function armedToPressMs(events: readonly FunnelEvent[]): number | null {
  const armed = firstEventTime(events, "launch-armed");
  const pressed = firstEventTime(events, "launch-pressed");
  return armed === null || pressed === null ? null : pressed - armed;
}

/** Assumption 3's residual-risk detector (research plan §2 rank 3): a `travel` entry within
 * 1s of a `vista-dismissed` entry suggests the dismissing click (or a click right after it)
 * fell through to the canvas and launched a new warp — checked at EVERY dismissal, not only
 * the first, which is why `vista-dismissed` is never deduped above. */
export function accidentalWarpEvents(
  events: readonly FunnelEvent[],
): readonly FunnelEvent[] {
  const hits: FunnelEvent[] = [];
  for (let i = 0; i < events.length; i++) {
    if (events[i].event !== "vista-dismissed") continue;
    const next = events[i + 1];
    if (next?.event === "travel" && next.t - events[i].t < 1000)
      hits.push(next);
  }
  return hits;
}

/** D5's ranking-in-the-wild flag (research plan §3): distinct queries that produced zero
 * suggestions, in first-seen order. */
export function zeroResultSearches(events: readonly FunnelEvent[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of events) {
    if (e.event !== "search-keystroke") continue;
    const query = e.meta?.query;
    const results = e.meta?.resultCount;
    if (typeof query !== "string" || results !== 0 || seen.has(query)) continue;
    seen.add(query);
    out.push(query);
  }
  return out;
}

/** Reject a pasted diagnostics blob whose data cannot be trusted — the same instrument-
 * fabrication discipline `perf-telemetry` applies to device readings (research plan §3:
 * "reject blobs where timestamps are non-monotone or the device block repeats verbatim
 * across supposedly different testers"). Callers decide what "repeats across testers" means
 * across MULTIPLE blobs; this only checks what a single session can prove about itself. */
export function isPlausibleSession(session: FunnelSession): boolean {
  if (!session.device) return false;
  for (let i = 1; i < session.events.length; i++) {
    if (session.events[i].t < session.events[i - 1].t) return false;
  }
  return true;
}

/** Records one visitor session's funnel timeline and persists it into the last-`MAX_SESSIONS`
 * ring buffer. A new recorder = a new session; there is deliberately no cross-session update
 * path, matching "append, cap, never rewrite history" for the same reason `StageAggregator`
 * only ever adds to a stage's byte total. */
let nextSessionId = 0;

export class FunnelRecorder {
  private readonly session: FunnelSession;
  private readonly seenOnce = new Set<FunnelEventName>();

  constructor(
    device: string,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.session = {
      id: ++nextSessionId,
      startedAt: Date.now(),
      device,
      events: [],
    };
  }

  record(event: FunnelEventName, meta?: FunnelEvent["meta"]): void {
    if (ONCE_ONLY.has(event)) {
      if (this.seenOnce.has(event)) return;
      this.seenOnce.add(event);
    }
    if (this.session.events.length >= MAX_EVENTS_PER_SESSION) return;
    this.session.events.push({ event, t: this.now(), meta });
  }

  snapshot(): FunnelSession {
    return { ...this.session, events: [...this.session.events] };
  }

  /** Appends the current snapshot into the stored ring buffer. Idempotent-safe to call
   * repeatedly (e.g. from a live overlay poll) — each call appends the LATEST snapshot of
   * this same session, replacing its own prior entry, never a stored session belonging to an
   * earlier page load. */
  persist(storage: Pick<Storage, "getItem" | "setItem"> = localStorage): void {
    let sessions: FunnelSession[] = [];
    try {
      const raw = storage.getItem(FUNNEL_STORAGE_KEY);
      if (raw) sessions = JSON.parse(raw) as FunnelSession[];
    } catch {
      sessions = [];
    }
    const idx = sessions.findIndex((s) => s.id === this.session.id);
    const snap = this.snapshot();
    if (idx >= 0) sessions[idx] = snap;
    else sessions.push(snap);
    while (sessions.length > MAX_SESSIONS) sessions.shift();
    try {
      storage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      /* storage blocked/quota — the in-memory session (and the live overlay) still works */
    }
  }
}
