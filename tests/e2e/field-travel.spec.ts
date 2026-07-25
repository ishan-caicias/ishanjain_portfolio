/**
 * PF-11 D4.2 — field-object travel parity on the default engine (owner R7; adopted D4-AC4).
 *
 * The defect this closes: Babylon's `travelTo` had no `fs-` branch, so the ~168,883 hoverable
 * field/deep-layer objects (base HIP field + PF-10's WD/SDSS/OC/GD-1/EXO/AST/OORT layers)
 * showed a `CLICK TO TRAVEL ▸` tooltip and then **silently did nothing** when clicked. Their
 * synthesized collector cards (`entryForFieldStar`) were dead code on the shipping engine —
 * this is the owner-perceived "babylon doesn't show the card" seam (R7).
 *
 * D4-AC4's wording is the contract these specs assert: "the tooltip CTA and the click outcome
 * must never disagree — a no-op with that CTA shown is a defect, not a gap." So they drive the
 * REAL hover→click path (CLAUDE.md #18) rather than calling `travelTo` directly, which would
 * prove only that a method exists and would have passed just as happily before this slice for
 * the tooltip half.
 *
 * Engine scope: pinned to the default Babylon path. The archived WebGL engine ALREADY has this
 * branch (space-engine.js:1482-1497) — it is the source this slice ports from — so there is
 * nothing to guard there (CLAUDE.md #3/#17).
 *
 * TEST-INSTRUMENT NOTE: pointer interaction goes through `canvas.dispatchEvent(new
 * PointerEvent(...))`, not `page.mouse`. TR-097 diagnosed `page.mouse.move()` hanging
 * indefinitely against a QUIET, IDLE scene specifically (the repo's one precedent using
 * `page.mouse` for pointer work only ever does so mid-warp, while frames render continuously).
 * The scene here is parked and idle at the moment of the hover — the exact failing state.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

type EngineHandle = {
  sceneStats(): Record<string, unknown>;
  aimAt(bodyId: string): boolean;
  fieldInfo(
    i: number,
  ): { ly: number; ra: number; dec: number; type: number } | null;
  travelTo(id: string, quiet?: boolean): void;
  arrivedId: string | null;
  warp: { mode: string };
  bodies: { e: { id: string }; dir: [number, number, number] }[];
  stations: { e: { id: string }; dir: [number, number, number] }[];
  _field: { positions: Float32Array; count: number } | null;
  _hoverId: string | null;
};

/** `?testhooks` enables `aimAt` (the hook is self-gated — see babylon-engine.ts). */
async function boot(page: Page): Promise<Locator> {
  await page.goto("/?engine=babylon&testhooks");
  await page.waitForSelector("babylon-scene", { timeout: 15000 });
  await page.getByRole("button", { name: "SKIP INTRO" }).click();
  const en = page.locator("babylon-scene");
  await expect
    .poll(
      async () =>
        (
          (await en.evaluate((el) =>
            (el as unknown as EngineHandle).sceneStats(),
          )) as Record<string, unknown>
        ).starSource,
      { timeout: 30000 },
    )
    .toBe("catalog");
  return en;
}

/**
 * Aims at field star `index`, hovers the viewport centre, and (optionally) clicks — ALL INSIDE
 * ONE `page.evaluate`, driven off the page's own rAF. Returns the id that was actually hovered
 * at the moment of the click.
 *
 * The single-evaluate design is required, not tidiness (same reasoning TR-095 recorded for the
 * mid-warp interrupts). Three real, pre-existing behaviours all move the camera or the pick
 * state between round trips, and a Playwright-side hover→assert→click sequence loses the target
 * in the gap — the first draft of this spec did exactly that and the click landed on nothing:
 *
 *  - `aimAt` only writes `_yaw`/`_pitch`; the camera's real orientation follows on the next
 *    render tick, so a pick issued immediately after aiming still ray-casts the OLD direction
 *    (hence the rAF waits below);
 *  - the idle scene DRIFTS (`IDLE_DRIFT_RATE`) and, at the home vantage, the D6.4 home-orbit
 *    auto-aim actively pulls the camera back toward Earth — seconds spent on an intervening
 *    Playwright locator assertion are seconds of the target sliding out of the 0.6° cone;
 *  - the O(starCount) cone test is THROTTLED to every other pick (`_fp`), so a single
 *    `pointermove` can legitimately return the held previous value rather than a fresh result.
 *
 * A real visitor never hits any of this: a moving mouse produces a dense stream of
 * `pointermove`s and the click follows within milliseconds. Two moves + rAF settling is the
 * faithful synthetic equivalent, not a workaround for a product defect.
 */
function aimHoverClick(
  en: Locator,
  index: number,
  opts: { click: boolean },
): Promise<{ aimed: boolean; hovered: string | null }> {
  return en.evaluate(
    async (el, [i, doClick]) => {
      const eng = el as unknown as EngineHandle;
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const frame = () =>
        new Promise<void>((r) => requestAnimationFrame(() => r()));

      const aimed = eng.aimAt("fs-" + i);
      if (!aimed) return { aimed: false, hovered: null };
      // Let the render loop apply the new yaw/pitch to the actual camera.
      await frame();
      await frame();

      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const move = (dy: number) =>
        canvas.dispatchEvent(
          new PointerEvent("pointermove", {
            clientX: cx,
            clientY: cy + dy,
            pointerId: 1,
            bubbles: true,
          }),
        );
      // Two moves at (effectively) the same point: the second is guaranteed to fall on the
      // non-throttled parity whichever way `_fp` happened to be sitting. The 1px offset keeps
      // the second event from being a no-op identical coordinate.
      move(1);
      move(0);

      const hovered = eng._hoverId;
      if (doClick && hovered) {
        for (const type of ["pointerdown", "pointerup"]) {
          canvas.dispatchEvent(
            new PointerEvent(type, {
              clientX: cx,
              clientY: cy,
              pointerId: 1,
              bubbles: true,
            }),
          );
        }
      }
      return { aimed: true, hovered };
    },
    [index, opts.click] as const,
  );
}

const arrivedId = (en: Locator) =>
  en.evaluate((el) => (el as unknown as EngineHandle).arrivedId);
const warpMode = (en: Locator) =>
  en.evaluate((el) => (el as unknown as EngineHandle).warp.mode);

/**
 * Picks a field index that is angularly CLEAR of every catalog body and station.
 *
 * This is not test-fudging — it is required by the product behaviour under test. `_pick` tries a
 * 34px screen-space body pick FIRST and only falls back to the field cone test, which is correct
 * (a curated body must win over an anonymous field star behind it). A hardcoded index therefore
 * proves nothing about field travel if that star happens to sit near a catalog body: the first
 * draft of this spec used index 5000 and hovered `ngc752` instead, which would have made the
 * whole spec assert catalog-body travel while claiming to assert field travel.
 *
 * Selection is deterministic (a fixed stride scan, first candidate clearing the threshold), so
 * this does not become a hidden retry loop over a real defect.
 */
async function clearFieldIndex(en: Locator): Promise<number> {
  const index = await en.evaluate((el) => {
    const eng = el as unknown as EngineHandle;
    const f = eng._field;
    if (!f) return -1;
    const obstacles = [...eng.bodies, ...eng.stations].map((b) => b.dir);
    // ~3° — comfortably wider than the 34px body-pick radius at this FOV, so the body path
    // cannot claim the cursor, while still far tighter than any real sky gap.
    const MIN_COS = Math.cos((3 * Math.PI) / 180);
    for (let i = 1000; i < f.count; i += 977) {
      const x = f.positions[i * 3],
        y = f.positions[i * 3 + 1],
        z = f.positions[i * 3 + 2];
      const L = Math.hypot(x, y, z) || 1;
      const ux = x / L,
        uy = y / L,
        uz = z / L;
      let clear = true;
      for (const d of obstacles) {
        if (ux * d[0] + uy * d[1] + uz * d[2] > MIN_COS) {
          clear = false;
          break;
        }
      }
      if (clear) return i;
    }
    return -1;
  });
  expect(
    index,
    "a field star clear of all catalog bodies should exist",
  ).toBeGreaterThan(0);
  return index;
}

test.describe("Field-object travel parity (PF-11 D4.2)", () => {
  test("hovering a field object shows CLICK TO TRAVEL, and clicking it actually warps (D4-AC4)", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const en = await boot(page);
    const index = await clearFieldIndex(en);

    // CTA half of the contract — hover only, then read the real tooltip the visitor sees.
    const hover = await aimHoverClick(en, index, { click: false });
    expect(hover.aimed, "?testhooks should be on for aimAt").toBe(true);
    expect(
      hover.hovered,
      "a field object should be hoverable at the aimed centre",
    ).toMatch(/^fs-\d+$/);
    await expect(page.getByText("CLICK TO TRAVEL ▸")).toBeVisible({
      timeout: 5000,
    });

    // Outcome half — re-aim (the idle drift moved the camera while the assertion above ran)
    // and click in one go. Before this slice `travelTo` returned at its `if (!b) return` and
    // the scene stayed idle forever; this is the assertion that fails on the old code.
    const clicked = await aimHoverClick(en, index, { click: true });
    expect(clicked.hovered).toMatch(/^fs-\d+$/);

    await expect.poll(() => warpMode(en), { timeout: 8000 }).not.toBe("idle");

    // ...and completes at the object the tooltip named, with the full arrival UI.
    await expect
      .poll(() => arrivedId(en), { timeout: 90000 })
      .toBe(clicked.hovered);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("dialog")).toHaveAttribute(
      "aria-label",
      /^Arrival: /,
    );
  });

  test("the arrival vista leads to a real collector card for a field object (D4-AC4)", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const en = await boot(page);

    const clicked = await aimHoverClick(en, await clearFieldIndex(en), {
      click: true,
    });
    expect(clicked.hovered).toMatch(/^fs-\d+$/);
    await expect
      .poll(() => arrivedId(en), { timeout: 90000 })
      .toBe(clicked.hovered);

    // This is `entryForFieldStar` running on the default engine — the synthesized card that
    // was unreachable dead code before D4.2, since nothing could ever arrive at an `fs-` id.
    await page.getByRole("button", { name: "OPEN COLLECTOR CARD ▸" }).click();
    const card = page.getByRole("dialog");
    await expect(card).toBeVisible();
    await expect(card).toContainText(/COLLECTOR CARD|DOSSIER|PLATE/);
  });

  test("a log-depth object's journey uses fieldInfo's distance, not the legacy L*3.9 (no tooltip/card disagreement)", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const en = await boot(page);

    // PF-10's bonus layers (white dwarfs, Oort, CNS5, clusters) merge into `_field`
    // ASYNCHRONOUSLY, well after `starSource === "catalog"` — they are explicitly not
    // boot-critical. Waiting for that merge is what makes a log-depth (type > 0) record exist
    // at all; the first draft of this test scanned too early, found none, and SKIPPED ITSELF,
    // silently asserting nothing. Same wait the merge's own spec uses (engine-select.spec.ts).
    const BASE_FIELD_COUNT = 168_959;
    await expect
      .poll(
        async () =>
          (
            (await en.evaluate((el) =>
              (el as unknown as EngineHandle).sceneStats(),
            )) as { starCount: number }
          ).starCount,
        { timeout: 45000 },
      )
      .toBeGreaterThan(BASE_FIELD_COUNT);

    // Forward scan for the first typed record. NOT a tail scan: an earlier draft assumed the
    // typed layers sit at the end because the bonus chunks are appended there, scanned the last
    // 200k, and found nothing. A histogram probe of the live field showed why — every type
    // (1 OC … 7 OORT) actually lives in the deep-layer band just past the Hipparcos records
    // (~118,000 of 555,825), and the appended tail is type 0. Measured, not assumed.
    const sample = await en.evaluate((el) => {
      const eng = el as unknown as EngineHandle;
      const count = eng._field?.count ?? 0;
      for (let i = 0; i < count; i++) {
        const fi = eng.fieldInfo(i);
        if (fi && fi.type > 0) return { index: i, ly: fi.ly, type: fi.type };
      }
      return null;
    });
    expect(
      sample,
      "a log-depth (type>0) bonus-layer record should exist once the merge lands",
    ).not.toBeNull();

    // THE ASSERTION THIS SPEC EXISTS FOR. `warp.lyTotal` is the distance the journey was
    // actually planned with — it drives `warpDurationForLy`, `localFieldVisibility` (D2.2's
    // extragalactic collapse) and `_farDestLy` (the impostor's size). The implementation plan
    // prescribed synthesizing it as the legacy `L*3.9`; for these log-depth records that
    // disagrees with `fieldInfo` — the exact source the hover tooltip and the collector card
    // both read — by orders of magnitude. Equality here is what makes the journey, the tooltip
    // and the card describe the same object.
    await en.evaluate(
      (el, i) => (el as unknown as EngineHandle).travelTo("fs-" + i),
      sample!.index,
    );
    const lyTotal = await en.evaluate(
      (el) => (el as unknown as { warp: { lyTotal?: number } }).warp.lyTotal,
    );
    expect(lyTotal).toBeCloseTo(sample!.ly, 6);

    // And the legacy formula really would have differed here — otherwise the assertion above
    // would pass for both conventions and prove nothing.
    const legacyLy = await en.evaluate((el, i) => {
      const f = (el as unknown as EngineHandle)._field!;
      const L = Math.hypot(
        f.positions[i * 3],
        f.positions[i * 3 + 1],
        f.positions[i * 3 + 2],
      );
      return L * 3.9;
    }, sample!.index);
    expect(Math.abs(legacyLy - sample!.ly)).toBeGreaterThan(1);
  });

  test("HUD flags an extragalactic field arrival, not just extragalactic catalog bodies (TR-100)", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const en = await boot(page);

    // Wait for the async bonus-layer merge — same reasoning as the log-depth test above: only
    // after this merge does a real SDSS-scale (ly in the hundreds of millions+) record exist.
    const BASE_FIELD_COUNT = 168_959;
    await expect
      .poll(
        async () =>
          (
            (await en.evaluate((el) =>
              (el as unknown as EngineHandle).sceneStats(),
            )) as { starCount: number }
          ).starCount,
        { timeout: 45000 },
      )
      .toBeGreaterThan(BASE_FIELD_COUNT);

    // ship-dynamics.ts's EXTRAGALACTIC_LY threshold, inlined (E2E specs don't import src runtime
    // values). Find one field record clearly past it (SDSS-scale) and one clearly under it (a
    // base Hipparcos field star), by forward scan — same pattern as `clearFieldIndex` above.
    const EXTRAGALACTIC_LY = 1_000_000;
    const { farIndex, nearIndex } = await en.evaluate((el, threshold) => {
      const eng = el as unknown as EngineHandle;
      const count = eng._field?.count ?? 0;
      let far = -1;
      let near = -1;
      for (let i = 0; i < count && (far < 0 || near < 0); i++) {
        const fi = eng.fieldInfo(i);
        if (!fi) continue;
        if (far < 0 && fi.ly >= threshold) far = i;
        if (near < 0 && fi.ly < threshold) near = i;
      }
      return { farIndex: far, nearIndex: near };
    }, EXTRAGALACTIC_LY);
    expect(
      farIndex,
      "an extragalactic-scale (SDSS) field record should exist once the merge lands",
    ).toBeGreaterThanOrEqual(0);
    expect(
      nearIndex,
      "a near field record should exist",
    ).toBeGreaterThanOrEqual(0);

    // Near arrival first — the HUD line must NOT show. This is the control: without it, a
    // permanently-visible line (or a mistranslated selector) would pass the assertion below for
    // the wrong reason.
    await en.evaluate(
      (el, i) => (el as unknown as EngineHandle).travelTo("fs-" + i),
      nearIndex,
    );
    await expect
      .poll(() => arrivedId(en), { timeout: 90000 })
      .toBe("fs-" + nearIndex);
    await expect(page.getByText("MILKY WAY ASTERN")).toHaveCount(0);

    // Far (extragalactic) arrival — the HUD line MUST show. Before the TR-100 fix, `isFarField`
    // looked the arrived id up in `window.CELESTIAL` only; field ids (`fs-N`) are synthesized
    // from the engine's live `fieldInfo()` and never written there, so this stayed hidden no
    // matter how far the field object actually was.
    await en.evaluate(
      (el, i) => (el as unknown as EngineHandle).travelTo("fs-" + i),
      farIndex,
    );
    await expect
      .poll(() => arrivedId(en), { timeout: 90000 })
      .toBe("fs-" + farIndex);
    await expect(page.getByText("MILKY WAY ASTERN")).toBeVisible({
      timeout: 10000,
    });
  });

  test("an out-of-range or malformed field id is still a safe no-op", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    const before = await arrivedId(en);

    for (const id of ["fs-99999999", "fs-abc", "fs-", "fs--1"]) {
      await en.evaluate(
        (el, bad) => (el as unknown as EngineHandle).travelTo(bad),
        id,
      );
    }
    await page.waitForTimeout(400);

    expect(await warpMode(en)).toBe("idle");
    expect(await arrivedId(en)).toBe(before);
  });
});
