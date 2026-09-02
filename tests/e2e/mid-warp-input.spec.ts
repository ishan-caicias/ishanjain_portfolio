/**
 * PF-11 D3.3 — mid-journey input policy (owner decision, ADR-0010).
 *
 * The behaviour this replaces was a SILENT NO-OP: pressing HOME or picking a new
 * destination while a warp was in flight did nothing at all, and said nothing
 * about doing nothing. It survived unnoticed until TR-080's dead-code reset went
 * looking for why a reset never fired. The owner's ruling: HOME mid-journey is an
 * ABORT (fly home from wherever the ship is), a destination pick mid-journey
 * QUEUES a retarget that launches on arrival, last selection wins, and neither is
 * ever silent.
 *
 * These specs assert BEHAVIOUR through the real state machine (CLAUDE.md #18) —
 * where the ship ends up and which events fired — not that a flag flipped. Each
 * journey is launched AND interrupted inside ONE `page.evaluate`, driven off the
 * page's own rAF, so the interrupt lands at a known progress point: a
 * Playwright-side poll would round-trip between "we saw k=0.2" and "we called
 * goHome", and on a slow SwiftShader frame a whole journey can render in ~10
 * frames (TR-094) — the interrupt would arrive after the ship had already
 * parked, and every downstream assertion would pass for the wrong reason. Each
 * spec therefore reports the progress it interrupted at and asserts on it.
 *
 * Engine scope: the archived WebGL engine (`?engine=webgl`) keeps its silent
 * no-op by design — it is a rollback lever, not a feature target (CLAUDE.md
 * #3/#17). These specs pin the default Babylon path only, addressing
 * `babylon-scene` directly rather than the engine-agnostic selector.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

type EngineHandle = {
  sceneStats(): Record<string, unknown>;
  travelTo(id: string, quiet?: boolean): void;
  goHome(quiet?: boolean): void;
  arrivedId: string | null;
  queuedTargetId: string | null;
  cam: [number, number, number];
  warp: { mode: string; prog?: number };
};

type Captured = { type: string; detail: Record<string, unknown> };

/** Interrupted journey: far enough that the burn lasts several seconds, cheap
 * enough to render that SwiftShader is not the thing under test. All three are
 * bare stars — no planet spheres, no virtual texturing, no deep-field machinery.
 * Sirius 8.6 ly, Procyon 11.5 ly, Vega 25 ly. */
const FIRST = "sirius";
const SECOND = "procyon";
const THIRD = "vega";

/** Everything the policy is required to emit, plus the two arrival events each
 * spec uses to prove where the ship actually ended up. */
const WATCHED = [
  "cosmos:abort",
  "cosmos:retarget-queued",
  "cosmos:arrive",
  "cosmos:home",
];

const stats = (en: Locator) =>
  en.evaluate((el) => (el as unknown as EngineHandle).sceneStats());

const arrivedId = (en: Locator) =>
  en.evaluate((el) => (el as unknown as EngineHandle).arrivedId);

const queuedTargetId = (en: Locator) =>
  en.evaluate((el) => (el as unknown as EngineHandle).queuedTargetId);

async function boot(page: Page) {
  await page.goto("/");
  await page.waitForSelector("babylon-scene");
  await page.getByRole("button", { name: "SKIP INTRO" }).click();
  const en = page.locator("babylon-scene");
  await expect
    .poll(async () => (await stats(en)).starSource, { timeout: 30000 })
    .toBe("catalog");
  return en;
}

/** What the in-page driver reports back. */
type Run = {
  modeAtInterrupt: string;
  progAtInterrupt: number;
  distAtInterrupt: number;
  /** Warp mode immediately after the interrupt — "aim" proves a NEW journey
   * launched rather than the old one being mutated or the ship snapping. */
  modeAfter: string;
  queuedAfterFirstPick: string | null;
  queuedAfterSecondPick: string | null;
  queuedAfterHome: string | null;
  events: Captured[];
};

/**
 * Launch `first`, wait on the page's own rAF until the ship is genuinely
 * mid-BURN (mode "warp", k > 0.15 — the abort has to inherit a live integrated
 * camera position, which only exists once "warp" is ticking), then apply
 * `picks` in order and optionally `home`.
 *
 * The captured-event listeners are deliberately left attached when this
 * resolves: later assertions in the same spec re-read the same array through
 * `drainEvents`, so an arrival that happens after the driver returns is still
 * observed rather than missed.
 */
function driveInterrupt(
  en: Locator,
  opts: { first: string; picks?: string[]; home?: boolean },
): Promise<Run> {
  return en.evaluate(
    async (
      el,
      o: { first: string; picks: string[]; home: boolean; watched: string[] },
    ) => {
      const eng = el as unknown as EngineHandle;
      const w = window as unknown as { __ijD33?: Captured[] };
      w.__ijD33 = [];
      const handler = (e: Event) =>
        w.__ijD33!.push({
          type: e.type,
          detail: ((e as CustomEvent).detail ?? {}) as Record<string, unknown>,
        });
      for (const t of o.watched) window.addEventListener(t, handler);
      const frame = () =>
        new Promise((r) => requestAnimationFrame(() => r(null)));

      eng.travelTo(o.first);
      const deadline = performance.now() + 25000;
      while (performance.now() < deadline) {
        if (eng.warp.mode === "warp" && (eng.warp.prog ?? 0) > 0.15) break;
        await frame();
      }
      const modeAtInterrupt = eng.warp.mode;
      const progAtInterrupt = eng.warp.prog ?? 0;
      const distAtInterrupt = Math.hypot(eng.cam[0], eng.cam[1], eng.cam[2]);

      let queuedAfterFirstPick: string | null = null;
      let queuedAfterSecondPick: string | null = null;
      if (o.picks[0]) {
        eng.travelTo(o.picks[0]);
        queuedAfterFirstPick = eng.queuedTargetId;
      }
      if (o.picks[1]) {
        eng.travelTo(o.picks[1]);
        queuedAfterSecondPick = eng.queuedTargetId;
      }
      let queuedAfterHome: string | null = null;
      if (o.home) {
        eng.goHome();
        queuedAfterHome = eng.queuedTargetId;
      }

      return {
        modeAtInterrupt,
        progAtInterrupt,
        distAtInterrupt,
        modeAfter: eng.warp.mode,
        queuedAfterFirstPick,
        queuedAfterSecondPick,
        queuedAfterHome,
        events: [...w.__ijD33!],
      };
    },
    {
      first: opts.first,
      picks: opts.picks ?? [],
      home: !!opts.home,
      watched: WATCHED,
    },
  );
}

/** Re-read the captured events; the page-side listeners stay attached for the
 * whole spec, so this sees everything that fired after the driver returned. */
const drainEvents = (en: Locator): Promise<Captured[]> =>
  en.evaluate(
    () => (window as unknown as { __ijD33?: Captured[] }).__ijD33 ?? [],
  );

/** Asserts the interrupt genuinely landed mid-burn on a moving ship — without
 * this every downstream assertion could pass against an already-parked ship. */
function expectInterruptedMidBurn(run: Run) {
  expect(run.modeAtInterrupt, "interrupt landed during the burn").toBe("warp");
  expect(run.progAtInterrupt).toBeGreaterThan(0.15);
  expect(run.progAtInterrupt).toBeLessThan(1);
  // The ship had actually travelled: the abort's whole premise is that it
  // launches from a position no journey ever starts at.
  expect(run.distAtInterrupt, "ship had left home").toBeGreaterThan(1);
}

test.describe("PF-11 D3.3 mid-journey input", () => {
  test("HOME mid-warp ABORTS the journey and flies home from where the ship is", async ({
    page,
  }) => {
    test.setTimeout(150000);
    const en = await boot(page);

    const run = await driveInterrupt(en, { first: FIRST, home: true });
    expectInterruptedMidBurn(run);
    // A fresh home-bound journey, not a cut and not a mutated old one.
    expect(run.modeAfter).toBe("aim");

    const abort = run.events.find((e) => e.type === "cosmos:abort");
    expect(
      abort,
      "cosmos:abort fired — the abort is never silent",
    ).toBeTruthy();
    expect(abort!.detail.toHome).toBe(true);
    expect(abort!.detail.abandonedId).toBe(FIRST);

    await expect
      .poll(async () => (await stats(en)).homeOrbit, { timeout: 60000 })
      .toBe(true);
    expect(await arrivedId(en)).toBeNull();

    // The abandoned destination is never arrived at — the abort abandons the
    // journey rather than completing it quietly first.
    const events = await drainEvents(en);
    expect(
      events.filter((e) => e.type === "cosmos:arrive").map((e) => e.detail.id),
    ).not.toContain(FIRST);
    expect(events.some((e) => e.type === "cosmos:home")).toBe(true);
  });

  test("a destination picked mid-warp QUEUES and launches on arrival", async ({
    page,
  }) => {
    test.setTimeout(180000);
    const en = await boot(page);

    const run = await driveInterrupt(en, { first: FIRST, picks: [SECOND] });
    expectInterruptedMidBurn(run);
    // The pick is remembered AND announced — the two halves of "never silent".
    expect(run.queuedAfterFirstPick).toBe(SECOND);
    const queued = run.events.find((e) => e.type === "cosmos:retarget-queued");
    expect(queued, "cosmos:retarget-queued fired").toBeTruthy();
    expect(queued!.detail.id).toBe(SECOND);
    // A queue is not an abort: the interrupted journey keeps flying.
    expect(run.modeAfter).toBe("warp");

    // Only the FINAL destination is polled from state. The interrupted journey's
    // own arrival is asserted from the captured EVENT below, never from a poll:
    // the queue drains one task after arrival, so `arrivedId === FIRST` can be
    // true for a few milliseconds and a ~100 ms poll would miss it. Polling for
    // a transient is how a spec becomes a coin flip.
    await expect.poll(() => arrivedId(en), { timeout: 90000 }).toBe(SECOND);
    // The queue drains exactly once.
    expect(await queuedTargetId(en)).toBeNull();

    const events = await drainEvents(en);
    const arrivals = events
      .filter((e) => e.type === "cosmos:arrive")
      .map((e) => e.detail.id);
    expect(arrivals).toEqual([FIRST, SECOND]);
  });

  test("last selection wins — a second mid-warp pick replaces the first", async ({
    page,
  }) => {
    test.setTimeout(180000);
    const en = await boot(page);

    const run = await driveInterrupt(en, {
      first: FIRST,
      picks: [SECOND, THIRD],
    });
    expectInterruptedMidBurn(run);
    expect(run.queuedAfterFirstPick).toBe(SECOND);
    expect(run.queuedAfterSecondPick).toBe(THIRD);

    await expect.poll(() => arrivedId(en), { timeout: 90000 }).toBe(THIRD);
    expect(await queuedTargetId(en)).toBeNull();

    // The replaced pick was never flown to: the arrival sequence is the
    // interrupted journey then the LAST selection, with nothing in between.
    const events = await drainEvents(en);
    const arrivals = events
      .filter((e) => e.type === "cosmos:arrive")
      .map((e) => e.detail.id);
    expect(arrivals).toEqual([FIRST, THIRD]);
    // Both picks were announced, though — a discarded queue still gave feedback
    // at the moment it was made.
    expect(
      events
        .filter((e) => e.type === "cosmos:retarget-queued")
        .map((e) => e.detail.id),
    ).toEqual([SECOND, THIRD]);
  });

  test("HOME mid-warp discards a queued retarget instead of inheriting it", async ({
    page,
  }) => {
    test.setTimeout(150000);
    const en = await boot(page);

    const run = await driveInterrupt(en, {
      first: FIRST,
      picks: [SECOND],
      home: true,
    });
    expectInterruptedMidBurn(run);
    expect(run.queuedAfterFirstPick).toBe(SECOND);
    expect(run.queuedAfterHome).toBeNull(); // cleared, not inherited

    await expect
      .poll(async () => (await stats(en)).homeOrbit, { timeout: 60000 })
      .toBe(true);
    // Settle well past the arrival tick — a queue that survived the abort would
    // drain here, on the home arrival, and launch a journey to SECOND.
    await page.waitForTimeout(2500);
    expect(await arrivedId(en)).toBeNull();
    expect(await queuedTargetId(en)).toBeNull();
    const arrivals = (await drainEvents(en))
      .filter((e) => e.type === "cosmos:arrive")
      .map((e) => e.detail.id);
    expect(arrivals).toEqual([]);
  });
});

/**
 * PF-11 D3.3 HUD/console strings (Sonnet 5 follow-up pass, same slice's remaining scope).
 * TR-095 shipped the engine state machine with the acknowledgement events firing into a
 * void — nothing rendered them. These specs drive the SAME engine-level interrupt as above
 * (still off the page's own rAF, still reporting `progAtInterrupt` first — TR-094's
 * SwiftShader timing lesson applies regardless of what's being asserted afterward) and then
 * check the REAL rendered DOM: `window.dispatchEvent` is how the engine's `emit()` reaches
 * React (babylon-engine.ts's `emit` targets `window`, and SpaceScene's cosmos:* wiring
 * listens there too — so an interrupt driven directly on the engine element is exactly as
 * visible to the mounted React tree as one driven by a real click). This is "drive the real
 * UI" only half-satisfied (CLAUDE.md #18): the interrupt itself is programmatic for
 * determinism, but its effect is read from genuine rendered text, not from engine state.
 */
test.describe("PF-11 D3.3 mid-journey input — HUD/console strings", () => {
  test("a queued retarget shows RETARGET QUEUED in both the warp overlay and the mission console, and both clear on drain", async ({
    page,
  }) => {
    test.setTimeout(180000);
    const en = await boot(page);

    const run = await driveInterrupt(en, { first: FIRST, picks: [SECOND] });
    expectInterruptedMidBurn(run);
    expect(run.queuedAfterFirstPick).toBe(SECOND);

    // The persistent warp-overlay badge (`queuedName` prop) — identified by test id rather
    // than text, because the transient acknowledgement banner ALSO renders the identical
    // "RETARGET QUEUED · Procyon" string for the first ~2.2s (SpaceScene.tsx's
    // NAV_NOTICE_MS) and a bare text locator is ambiguous between the two while both are
    // live (Playwright's strict mode correctly refuses to guess which one is meant).
    await expect(page.getByTestId("queued-badge")).toHaveText(
      "RETARGET QUEUED · Procyon",
    );
    // The mission console's own label swaps to reflect it (a minimal touch — the full
    // D5.2 combobox rewrite owns richer mid-warp console state; this is the string-level
    // acknowledgement TR-095 deferred to this pass).
    await expect(
      page.locator("#ij-mission-bar").getByText("QUEUED ▸ PROCYON"),
    ).toBeVisible();

    await expect.poll(() => arrivedId(en), { timeout: 90000 }).toBe(SECOND);
    // Drained: both badges gone, and the console label is back to its resting string.
    await expect(page.getByTestId("queued-badge")).toHaveCount(0);
    await expect(
      page.locator("#ij-mission-bar").getByText("WHERE TO ▸"),
    ).toBeVisible();
  });

  test("HOME mid-warp shows the ABORTING acknowledgement and the console returns to WHERE TO", async ({
    page,
  }) => {
    test.setTimeout(150000);
    const en = await boot(page);

    const run = await driveInterrupt(en, { first: FIRST, home: true });
    expectInterruptedMidBurn(run);
    expect(run.modeAfter).toBe("aim");

    // The transient banner. Checked promptly — it self-clears after ~2.2s (SpaceScene.tsx's
    // NAV_NOTICE_MS), so this assertion has to win that race, not just eventually be true.
    await expect(page.getByTestId("nav-notice")).toHaveText(
      "ABORTING · RETURNING HOME",
      { timeout: 1500 },
    );
    // An abort never queues (D3.3's "discards, does not inherit" rule) — the console must
    // show its resting label throughout, never a stale QUEUED from the abandoned journey.
    await expect(
      page.locator("#ij-mission-bar").getByText("WHERE TO ▸"),
    ).toBeVisible();

    await expect
      .poll(async () => (await stats(en)).homeOrbit, { timeout: 60000 })
      .toBe(true);
    // The one-shot banner is gone well after arrival; the ongoing warp readout (destName
    // "Sol · Home", "returning to origin") was always the thing carrying the information
    // past the banner's own lifetime, and by the time the ship is in orbit `state.warp`
    // itself has cleared too.
    await expect(page.getByTestId("nav-notice")).toHaveCount(0);
  });
  test("the abort control is not painted over by the warp letterbox (owner-reported P0, 2026-07-29)", async ({
    page,
  }) => {
    test.setTimeout(60000);
    // THE DEFECT THIS PINS: `◂ RETURN HOME` IS the mid-warp abort (ADR-0010), and it was
    // rendered, enabled and clickable throughout every flight — while the WarpOverlay's bottom
    // letterbox (64px of opaque #05081a at z-70) painted over the entire button row of a bar
    // docked at bottom-8/z-62. Abort worked; it was invisible in the one state it exists for.
    //
    // The assertion is GEOMETRIC, deliberately. A hit-test cannot see this: the overlay is
    // `pointer-events-none`, so `elementFromPoint` skips it and every click landed on the
    // button exactly as intended — and Playwright's own `toBeVisible()` checks CSS/box
    // visibility, not occlusion by a higher-z sibling. Both would pass against the bug. That is
    // why nine specs in this file and ten in render-console.spec.ts all missed it.
    //
    // Measured INSIDE one page.evaluate off the page's own rAF, for this file's own documented
    // reason (see the header): a Playwright-side poll-then-query round-trip loses the race —
    // on SwiftShader a whole journey can render in ~10 frames, the overlay unmounts, and
    // `boundingBox()` then waits forever on an element that is legitimately gone.
    const en = await boot(page);

    const geom = await en.evaluate(
      (el, id) =>
        new Promise<{
          barTop: number;
          barBottom: number;
          btnBottom: number;
          lbTop: number;
          readoutBottom: number | null;
          mode: string;
        } | null>((resolve) => {
          const eng = el as unknown as EngineHandle;
          eng.travelTo(id);
          const deadline = performance.now() + 20000;
          let settledAt = 0;
          const tick = () => {
            const bar = document.querySelector("#ij-mission-bar");
            const btn = document.querySelector(
              'button[aria-label="Return home to Earth orbit"]',
            );
            const lb = document.querySelector(
              '[data-testid="warp-letterbox-bottom"]',
            );
            // TWO gates, both learned from this spec's own failed drafts:
            //  1. WARP CHROME live, not just the engine's mode. `cosmos:warp` -> React is
            //     throttled to 10 Hz (PF-11 D7.4), so on the engine's first non-idle frame
            //     `body.ij-warping` is not set and the console is still in its at-home dock —
            //     measuring there asserts the invariant against a layout this rule doesn't own.
            //  2. The `bottom` TRANSITION SETTLED. `#ij-mission-bar` carries
            //     `transition: bottom 0.6s ease`, so the console is mid-flight to its docked
            //     position for the first 600ms. A draft that measured immediately passed
            //     against the UNFIXED build too — i.e. it was vacuous — because the bar had not
            //     yet animated DOWN into the letterbox. Verified by negative control: with the
            //     fix reverted to the old `bottom: 2rem`, an unsettled read still passed; a
            //     settled read fails, which is what makes this guard real.
            const warping = document.body.classList.contains("ij-warping");
            if (warping && settledAt === 0) settledAt = performance.now() + 750;
            if (
              eng.warp.mode !== "idle" &&
              warping &&
              settledAt !== 0 &&
              performance.now() >= settledAt &&
              bar &&
              btn &&
              lb
            ) {
              const b = bar.getBoundingClientRect();
              const bt = btn.getBoundingClientRect();
              const l = lb.getBoundingClientRect();
              // The ongoing warp readout, to prove the console was not simply shoved up into it.
              const ro = document.querySelector('[data-testid="warp-readout"]');
              resolve({
                barTop: b.top,
                barBottom: b.bottom,
                btnBottom: bt.bottom,
                lbTop: l.top,
                readoutBottom: ro ? ro.getBoundingClientRect().bottom : null,
                mode: eng.warp.mode,
              });
              return;
            }
            if (performance.now() > deadline) {
              resolve(null);
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      THIRD,
    );

    expect(geom, "captured a frame with the warp overlay live").not.toBeNull();
    const g = geom!;

    // The console's LOWEST pixel must sit above the letterbox's TOP edge. Asserting the whole
    // bar (not just the button) is strictly stronger — the button is inset within it.
    expect(
      g.barBottom,
      `the mission console's bottom edge (${g.barBottom}) overlaps the warp letterbox's top edge (${g.lbTop}) at warp mode "${g.mode}" — the only mid-flight abort control is painted over`,
    ).toBeLessThanOrEqual(g.lbTop);
    expect(g.btnBottom).toBeLessThanOrEqual(g.lbTop);

    // ...and the console must not have been lifted INTO the warp readout to achieve it.
    expect(
      g.readoutBottom,
      "the warp readout must be present to prove the console was not lifted into it",
    ).not.toBeNull();
    expect(
      g.readoutBottom!,
      `the warp readout's bottom edge (${g.readoutBottom}) collides with the lifted console's top edge (${g.barTop}) — clearing the letterbox must not just move the collision somewhere else`,
    ).toBeLessThanOrEqual(g.barTop);
  });
});
