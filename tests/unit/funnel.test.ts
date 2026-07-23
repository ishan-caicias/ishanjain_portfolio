import { describe, expect, it } from "vitest";
import {
  FunnelRecorder,
  MAX_EVENTS_PER_SESSION,
  MAX_SESSIONS,
  FUNNEL_STORAGE_KEY,
  resolveFunnelOverlay,
  firstEventTime,
  armedToPressMs,
  accidentalWarpEvents,
  zeroResultSearches,
  isPlausibleSession,
  type FunnelEvent,
  type FunnelSession,
} from "@/lib/funnel";

/** In-memory Storage stand-in — same reasoning `load-progress.test.ts` uses a fake clock:
 * deterministic, no real browser storage dependency. */
function fakeStorage(): Pick<Storage, "getItem" | "setItem"> {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("resolveFunnelOverlay", () => {
  it("URL param 1 always wins", () => {
    expect(resolveFunnelOverlay("1", null)).toBe(true);
    expect(resolveFunnelOverlay("1", "0")).toBe(true);
  });
  it("URL param 0 always wins over a stored 1", () => {
    expect(resolveFunnelOverlay("0", "1")).toBe(false);
  });
  it("falls back to the stored override when no URL param", () => {
    expect(resolveFunnelOverlay(null, "1")).toBe(true);
    expect(resolveFunnelOverlay(null, "0")).toBe(false);
  });
  it("defaults to off with nothing set", () => {
    expect(resolveFunnelOverlay(null, null)).toBe(false);
  });
  it("an unrecognized URL value falls through to stored/default rather than erroring", () => {
    expect(resolveFunnelOverlay("yes", "1")).toBe(true);
    expect(resolveFunnelOverlay("yes", null)).toBe(false);
  });
});

describe("FunnelRecorder — recording semantics", () => {
  it("dedupes one-shot gate milestones to their first occurrence", () => {
    const clock = fakeClock();
    const rec = new FunnelRecorder(
      "Windows · 1920x1080 · dpr1 · 8c",
      clock.now,
    );
    clock.advance(10);
    rec.record("launch-armed");
    clock.advance(500);
    rec.record("launch-armed"); // repeat — must be a no-op
    const events = rec.snapshot().events;
    expect(events.filter((e) => e.event === "launch-armed")).toHaveLength(1);
    expect(events[0].t).toBe(10);
  });

  it("never dedupes vista-dismissed — every dismissal is a real, separate event", () => {
    const rec = new FunnelRecorder("device");
    rec.record("vista-dismissed", { via: "timeout" });
    rec.record("vista-dismissed", { via: "open-card" });
    expect(rec.snapshot().events).toHaveLength(2);
  });

  it("never dedupes travel/arrival either — a session visits many bodies", () => {
    const rec = new FunnelRecorder("device");
    rec.record("travel", { id: "mars" });
    rec.record("arrival", { id: "mars" });
    rec.record("travel", { id: "m42" });
    rec.record("arrival", { id: "m42" });
    expect(rec.snapshot().events).toHaveLength(4);
  });

  it("caps events at MAX_EVENTS_PER_SESSION, dropping the overflow rather than growing", () => {
    const rec = new FunnelRecorder("device");
    for (let i = 0; i < MAX_EVENTS_PER_SESSION + 25; i++) {
      rec.record("vista-dismissed");
    }
    expect(rec.snapshot().events).toHaveLength(MAX_EVENTS_PER_SESSION);
  });

  it("snapshot() is a defensive copy — mutating it must not affect the recorder", () => {
    const rec = new FunnelRecorder("device");
    rec.record("dossier-visible");
    const snap = rec.snapshot();
    snap.events.push({ event: "launch-armed", t: 999 });
    expect(rec.snapshot().events).toHaveLength(1);
  });
});

describe("FunnelRecorder — persistence (ring buffer)", () => {
  it("persists a session and can be read back", () => {
    const storage = fakeStorage();
    const rec = new FunnelRecorder("device-a");
    rec.record("dossier-visible");
    rec.persist(storage);
    const sessions = JSON.parse(
      storage.getItem(FUNNEL_STORAGE_KEY)!,
    ) as FunnelSession[];
    expect(sessions).toHaveLength(1);
    expect(sessions[0].device).toBe("device-a");
    expect(sessions[0].events[0].event).toBe("dossier-visible");
  });

  it("repeated persist() calls for the SAME session update in place, not append", () => {
    const storage = fakeStorage();
    const rec = new FunnelRecorder("device-a");
    rec.record("dossier-visible");
    rec.persist(storage);
    rec.record("launch-armed");
    rec.persist(storage);
    const sessions = JSON.parse(
      storage.getItem(FUNNEL_STORAGE_KEY)!,
    ) as FunnelSession[];
    expect(sessions).toHaveLength(1);
    expect(sessions[0].events).toHaveLength(2);
  });

  it("caps the ring buffer at MAX_SESSIONS, dropping the oldest first", () => {
    const storage = fakeStorage();
    for (let i = 0; i < MAX_SESSIONS + 3; i++) {
      const rec = new FunnelRecorder(`device-${i}`);
      rec.record("dossier-visible");
      rec.persist(storage);
    }
    const sessions = JSON.parse(
      storage.getItem(FUNNEL_STORAGE_KEY)!,
    ) as FunnelSession[];
    expect(sessions).toHaveLength(MAX_SESSIONS);
    // the oldest three (device-0..2) must have been evicted
    expect(sessions[0].device).toBe(`device-3`);
    expect(sessions[sessions.length - 1].device).toBe(
      `device-${MAX_SESSIONS + 2}`,
    );
  });

  it("never throws when storage is unavailable (private mode/quota)", () => {
    const rec = new FunnelRecorder("device");
    rec.record("dossier-visible");
    const throwingStorage: Pick<Storage, "getItem" | "setItem"> = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => rec.persist(throwingStorage)).not.toThrow();
  });
});

describe("derived flags", () => {
  const ev = (
    event: FunnelEvent["event"],
    t: number,
    meta?: FunnelEvent["meta"],
  ): FunnelEvent => ({ event, t, meta });

  it("firstEventTime finds the first matching entry", () => {
    const events = [
      ev("travel", 10, { id: "a" }),
      ev("travel", 20, { id: "b" }),
    ];
    expect(firstEventTime(events, "travel")).toBe(10);
    expect(firstEventTime(events, "arrival")).toBeNull();
  });

  it("armedToPressMs computes the gap when both milestones are present", () => {
    const events = [ev("launch-armed", 1000), ev("launch-pressed", 1450)];
    expect(armedToPressMs(events)).toBe(450);
  });

  it("armedToPressMs is null when either milestone is missing", () => {
    expect(armedToPressMs([ev("launch-armed", 1000)])).toBeNull();
    expect(armedToPressMs([])).toBeNull();
  });

  it("accidentalWarpEvents flags a travel within 1s of a dismissal", () => {
    const events = [
      ev("vista-dismissed", 5000, { via: "timeout" }),
      ev("travel", 5300, { id: "mars" }),
    ];
    expect(accidentalWarpEvents(events)).toHaveLength(1);
  });

  it("accidentalWarpEvents ignores a travel well after a dismissal", () => {
    const events = [
      ev("vista-dismissed", 5000, { via: "timeout" }),
      ev("travel", 9000, { id: "mars" }),
    ];
    expect(accidentalWarpEvents(events)).toHaveLength(0);
  });

  it("accidentalWarpEvents checks EVERY dismissal, not only the first", () => {
    const events = [
      ev("vista-dismissed", 1000),
      ev("travel", 9000, { id: "x" }), // far — not accidental
      ev("vista-dismissed", 20000),
      ev("travel", 20200, { id: "y" }), // near — accidental
    ];
    expect(accidentalWarpEvents(events)).toHaveLength(1);
  });

  it("zeroResultSearches returns distinct zero-result queries in first-seen order", () => {
    const events = [
      ev("search-keystroke", 1, { query: "xyzzy", resultCount: 0 }),
      ev("search-keystroke", 2, { query: "mars", resultCount: 3 }),
      ev("search-keystroke", 3, { query: "xyzzy", resultCount: 0 }), // repeat query
      ev("search-keystroke", 4, { query: "qqq", resultCount: 0 }),
    ];
    expect(zeroResultSearches(events)).toEqual(["xyzzy", "qqq"]);
  });
});

describe("isPlausibleSession", () => {
  it("accepts a session with a device block and monotone timestamps", () => {
    const session: FunnelSession = {
      id: 1,
      startedAt: 0,
      device: "Windows · 1920x1080 · dpr1 · 8c",
      events: [
        { event: "dossier-visible", t: 0 },
        { event: "launch-armed", t: 500 },
      ],
    };
    expect(isPlausibleSession(session)).toBe(true);
  });

  it("rejects a session with an empty device block", () => {
    expect(
      isPlausibleSession({ id: 1, startedAt: 0, device: "", events: [] }),
    ).toBe(false);
  });

  it("rejects non-monotone timestamps", () => {
    const session: FunnelSession = {
      id: 1,
      startedAt: 0,
      device: "device",
      events: [
        { event: "launch-armed", t: 500 },
        { event: "launch-pressed", t: 200 },
      ],
    };
    expect(isPlausibleSession(session)).toBe(false);
  });
});
