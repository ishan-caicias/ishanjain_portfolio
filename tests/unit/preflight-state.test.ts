import { describe, expect, it } from "vitest";
import type { StageProgress } from "@/lib/load-progress";
import {
  BOOT_CRITICAL_ORDER,
  derivePreflightPhase,
  fmtBytes,
  stageRowView,
  STAGE_STALL_MS,
  stalledBootCriticalStages,
} from "@/lib/preflight-state";

function stage(over: Partial<StageProgress> = {}): StageProgress {
  return {
    stage: "star-catalog",
    loadedBytes: 0,
    totalBytes: null,
    done: false,
    bootCritical: true,
    ...over,
  };
}

describe("fmtBytes", () => {
  it("formats bytes, KB, and MB in the mono-voice style", () => {
    expect(fmtBytes(0)).toBe("0 B");
    expect(fmtBytes(512)).toBe("512 B");
    expect(fmtBytes(1536)).toBe("2 KB"); // rounds
    expect(fmtBytes(2_018_454)).toBe("1.92 MB");
  });
});

describe("stageRowView", () => {
  it("shows PENDING for a stage that hasn't started at all", () => {
    const row = stageRowView("sdss-field", undefined);
    expect(row).toMatchObject({
      started: false,
      done: false,
      pct: 0,
      statusText: "PENDING",
    });
  });

  it("treats zero-byte checkpoint stages (engine-init/first-frame) as status words, not byte lines", () => {
    const pending = stageRowView(
      "engine-init",
      stage({
        stage: "engine-init",
        loadedBytes: 0,
        totalBytes: 0,
        done: false,
      }),
    );
    expect(pending.statusText).toBe("CHECKING…");

    const done = stageRowView(
      "first-frame",
      stage({
        stage: "first-frame",
        loadedBytes: 0,
        totalBytes: 0,
        done: true,
      }),
    );
    expect(done.statusText).toBe("✓ ONLINE");
    expect(done.done).toBe(true);
  });

  it("boot-critical byte-bearing stages show loaded/total, then a checkmarked total when done", () => {
    const inFlight = stageRowView(
      "star-catalog",
      stage({ loadedBytes: 1_000_000, totalBytes: 2_891_934, done: false }),
    );
    expect(inFlight.statusText).toBe("977 KB / 2.76 MB");
    expect(inFlight.pct).toBe(35);

    const done = stageRowView(
      "star-catalog",
      stage({ loadedBytes: 2_891_934, totalBytes: 2_891_934, done: true }),
    );
    expect(done.statusText).toBe("2.76 MB ✓");
    expect(done.pct).toBe(100);
  });

  it("boot-critical stages fall back to a bare loaded-bytes line when the total isn't known yet", () => {
    const row = stageRowView(
      "atlas-map",
      stage({
        stage: "atlas-map",
        loadedBytes: 4096,
        totalBytes: null,
        done: false,
      }),
    );
    expect(row.statusText).toBe("4 KB");
    expect(row.pct).toBe(0); // no total yet — never fabricate a percentage
  });

  it("background (non-boot-critical) stages read STREAMING IN BACKGROUND while in flight", () => {
    const row = stageRowView(
      "sdss-field",
      stage({
        stage: "sdss-field",
        bootCritical: false,
        loadedBytes: 1_000_000,
        totalBytes: 47_125_068,
        done: false,
      }),
    );
    expect(row.statusText).toBe("STREAMING IN BACKGROUND");
    expect(row.bootCritical).toBe(false);
    expect(row.started).toBe(true);
  });

  it("background stages still show a real completed byte total once done", () => {
    const row = stageRowView(
      "sdss-field",
      stage({
        stage: "sdss-field",
        bootCritical: false,
        loadedBytes: 47_125_068,
        totalBytes: 47_125_068,
        done: true,
      }),
    );
    expect(row.statusText).toBe("44.94 MB ✓");
  });
});

describe("stalledBootCriticalStages", () => {
  it("flags a boot-critical stage whose last event is older than the stall threshold", () => {
    const now = 100_000;
    const lastEventAt = new Map([
      ["star-catalog", now - STAGE_STALL_MS - 1],
      ["atlas-map", now - 500], // recent — not stalled
    ]);
    const stalled = stalledBootCriticalStages(
      lastEventAt as ReadonlyMap<"star-catalog" | "atlas-map", number>,
      new Set(),
      now - 20_000,
      now,
    );
    expect(stalled).toContain("star-catalog");
    expect(stalled).not.toContain("atlas-map");
  });

  it("never flags a stage that has already closed, regardless of how stale its last event is", () => {
    const now = 100_000;
    const lastEventAt = new Map([
      ["star-catalog", now - STAGE_STALL_MS - 5000],
    ]);
    const stalled = stalledBootCriticalStages(
      lastEventAt as ReadonlyMap<"star-catalog", number>,
      new Set(["star-catalog"]),
      now - 30_000,
      now,
    );
    expect(stalled).not.toContain("star-catalog");
  });

  it("a stage that never even started falls back to bootStartedAt, so total silence also degrades", () => {
    const now = 50_000;
    // engine-init never fired a single event — bootStartedAt is the only clock available.
    const stalled = stalledBootCriticalStages(
      new Map(),
      new Set(),
      now - STAGE_STALL_MS - 1,
      now,
    );
    expect(stalled).toEqual(BOOT_CRITICAL_ORDER); // every boot-critical stage is silent
  });

  it("only ever returns boot-critical stages, never background ones", () => {
    const now = 100_000;
    const stalled = stalledBootCriticalStages(
      new Map(),
      new Set(),
      now - 50_000,
      now,
    );
    for (const s of stalled) expect(BOOT_CRITICAL_ORDER).toContain(s);
  });
});

describe("derivePreflightPhase", () => {
  it("is hidden outside travel mode regardless of every other input", () => {
    expect(
      derivePreflightPhase({
        isTravel: false,
        launched: false,
        armed: true,
        anyStalled: true,
      }),
    ).toBe("hidden");
  });

  it("launched wins over every other state once set", () => {
    expect(
      derivePreflightPhase({
        isTravel: true,
        launched: true,
        armed: false,
        anyStalled: true,
      }),
    ).toBe("launched");
  });

  it("stalled beats armed — a stall found late still takes priority", () => {
    expect(
      derivePreflightPhase({
        isTravel: true,
        launched: false,
        armed: true,
        anyStalled: true,
      }),
    ).toBe("stalled");
  });

  it("progresses loading -> armed as the only remaining inputs change", () => {
    expect(
      derivePreflightPhase({
        isTravel: true,
        launched: false,
        armed: false,
        anyStalled: false,
      }),
    ).toBe("loading");
    expect(
      derivePreflightPhase({
        isTravel: true,
        launched: false,
        armed: true,
        anyStalled: false,
      }),
    ).toBe("armed");
  });
});
