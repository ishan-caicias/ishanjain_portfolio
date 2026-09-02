/**
 * PF-11 D6.4 — two owner-reported bugs in the Earth home-orbit reveal (post-D6.4/D1.3),
 * cross-validated against the PF-10/PF-11 work that shipped it:
 *
 * #1 "the background cannot be dragged... it keeps resetting to earth." Root cause: the
 * home-orbit's per-frame camera driver (`_tickWarp`'s `if (this._homeOrbit)` branch)
 * re-aimed the view at the planet on EVERY frame the visitor wasn't actively mid-drag —
 * including the very first frame after a drag ENDED. Releasing a drag therefore snapped
 * the view straight back to Earth on the next tick, which reads as "dragging doesn't
 * work." The camera's ORBITAL POSITION (owner requirement R16 — TR-088) was never the
 * problem; only the forced re-aim was. Fixed with `_homeLookOverridden`, latched true on
 * the first real drag since the orbit was (re)armed, permanently disabling the auto-aim
 * for the rest of that orbit — matching how free-look already behaves everywhere else in
 * this scene (drag persists after release; see the sibling "ambient idle drift" branch's
 * own stated philosophy in the same function).
 *
 * #2 "hover cards over different DSOs but the graphic is earth's surface... items behind
 * earth are still interactive." Root cause: the hover/click picker (`_pick`/`_pickField`)
 * is a screen-space nearest-projected-point search, never a real depth test — harmless
 * before D6.4, when nothing solid was ever on screen for the camera to look past. D6.4 put
 * a 26-world-unit opaque sphere at a fixed point the visitor can now freely look around,
 * and the picker kept working exactly as before, oblivious to it. Fixed with a ray/sphere
 * occlusion test (`raySphereDist`, ship-dynamics.ts) run once per pick against the same
 * cursor ray the field-star cone test already uses.
 *
 * Both bugs share a root cause worth stating plainly: D6.4 (TR-088) added a solid,
 * freely-lookable-around object to a scene whose camera-control and picking code had never
 * needed to reason about one before, and neither path was updated for it at the time —
 * confirmed absent from TR-088's own verification (no drag or occlusion assertion exists
 * anywhere in this repo before this spec).
 *
 * TEST-INSTRUMENT NOTE (cost real diagnosis time, recorded so it isn't repeated): bug #1's
 * specs drive the drag via `canvas.dispatchEvent(new PointerEvent(...))` INSIDE the page,
 * not Playwright's `page.mouse.move/down/up`. The OS-level mouse API is what
 * engine-select.spec.ts's own passing "free-look drag stays authoritative" test uses
 * successfully — but only mid-warp, while the scene is continuously animating. Against the
 * quiet, slow-revolution home-orbit IDLE state specifically, `page.mouse.move()` hung
 * indefinitely in this harness (confirmed 5+ times, including with all other background
 * processes cleared — not a load/contention artifact). A direct diagnostic proved the
 * APPLICATION code was never at fault: calling the engine's `_pick` directly returned
 * instantly and correctly, and dispatching real `PointerEvent`s straight at the canvas
 * (bypassing Playwright's synthetic OS input layer entirely) drove `_dragging`,
 * `_yaw`/`_pitch`, and `_homeLookOverridden` exactly as expected. The dispatch technique
 * below is that proven mechanism — it exercises the SAME real listener code
 * (`_bindPointer`'s pointerdown/pointermove/pointerup), just through the DOM's own event
 * dispatch instead of Playwright's CDP-level mouse simulation.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

type EngineHandle = {
  sceneStats(): Record<string, unknown>;
  travelTo(id: string, quiet?: boolean): void;
  goHome(quiet?: boolean): void;
  arrivedId: string | null;
  cam: [number, number, number];
  _yaw: number;
  _pitch: number;
  _dragging: boolean;
  _hoverId: string | null;
};

const stats = (en: Locator) =>
  en.evaluate((el) => (el as unknown as EngineHandle).sceneStats());

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

/** Travel away and `goHome()` — the only way to arm the orbit (boot alone leaves
 * `homeOrbit` false; the reveal is goHome-triggered, per earth-home.spec.ts). */
async function armHomeOrbit(en: Locator) {
  await en.evaluate((el) => (el as unknown as EngineHandle).travelTo("moon"));
  await expect
    .poll(
      async () =>
        en.evaluate((el) => (el as unknown as EngineHandle).arrivedId),
      { timeout: 45000 },
    )
    .toBe("moon");
  await en.evaluate((el) => (el as unknown as EngineHandle).goHome());
  await expect
    .poll(async () => (await stats(en)).homeOrbit, { timeout: 45000 })
    .toBe(true);
}

type DragResult = {
  before: { yaw: number; pitch: number };
  duringDragging: boolean;
  during: { yaw: number; pitch: number };
  afterDragging: boolean;
};

/** Hovers the canvas at its centre + an offset via genuine `PointerEvent` dispatch (no
 * drag — `_dragStart` stays null, so `_pick`'s plain hover path runs) and returns the
 * resulting `_hoverId`. Same rationale as `dragOnCanvas` for not using `page.mouse`. */
function hoverOnCanvas(
  en: Locator,
  dx: number,
  dy: number,
): Promise<string | null> {
  return en.evaluate(
    (el, [ddx, ddy]) => {
      const eng = el as unknown as EngineHandle;
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: rect.left + rect.width / 2 + ddx,
          clientY: rect.top + rect.height / 2 + ddy,
          pointerId: 1,
          bubbles: true,
        }),
      );
      return eng._hoverId;
    },
    [dx, dy] as const,
  );
}

/** Fires a real click (pointerdown immediately followed by pointerup at the same point,
 * matching `_click`'s own `dragMoved < 6 && dt < 600` threshold) via genuine `PointerEvent`
 * dispatch. Same rationale as `dragOnCanvas`. */
function clickOnCanvas(en: Locator): Promise<void> {
  return en.evaluate((_el) => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: cx,
        clientY: cy,
        pointerId: 1,
        bubbles: true,
      }),
    );
    canvas.dispatchEvent(
      new PointerEvent("pointerup", {
        clientX: cx,
        clientY: cy,
        pointerId: 1,
        bubbles: true,
      }),
    );
  });
}

/** Drives a real drag through the canvas's own `_bindPointer` listeners via genuine
 * `PointerEvent` dispatch — see the file header for why this replaces Playwright's
 * `page.mouse` API for this specific (idle, home-orbit) scene state. */
function dragOnCanvas(
  en: Locator,
  dx: number,
  dy: number,
): Promise<DragResult> {
  return en.evaluate(
    (el, [ddx, ddy]) => {
      const eng = el as unknown as EngineHandle;
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const before = { yaw: eng._yaw, pitch: eng._pitch };

      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          clientX: cx,
          clientY: cy,
          pointerId: 1,
          bubbles: true,
        }),
      );
      const duringDragging = eng._dragging;

      canvas.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: cx + ddx,
          clientY: cy + ddy,
          pointerId: 1,
          bubbles: true,
        }),
      );
      const during = { yaw: eng._yaw, pitch: eng._pitch };

      canvas.dispatchEvent(
        new PointerEvent("pointerup", {
          clientX: cx + ddx,
          clientY: cy + ddy,
          pointerId: 1,
          bubbles: true,
        }),
      );
      const afterDragging = eng._dragging;

      return { before, duringDragging, during, afterDragging };
    },
    [dx, dy] as const,
  );
}

test.describe("PF-11 D6.4 bug #1 — free-look drag no longer resets to Earth", () => {
  test("releasing a drag does NOT snap the view back to the planet", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const en = await boot(page);
    await armHomeOrbit(en);

    // Regression guard: before any drag, the auto-aim driver is still active.
    expect((await stats(en)).homeLookOverridden).toBe(false);

    const drag = await dragOnCanvas(en, 260, -90);
    expect(drag.duringDragging).toBe(true);
    expect(drag.afterDragging).toBe(false);
    // The drag actually moved the look direction away from wherever it started.
    expect(
      Math.abs(drag.during.yaw - drag.before.yaw) +
        Math.abs(drag.during.pitch - drag.before.pitch),
    ).toBeGreaterThan(0.05);

    // THE bug: give the render loop several frames to run post-release, then confirm
    // the view stayed where the drag left it rather than snapping back to face Earth.
    await page.waitForTimeout(600);
    const after = await en.evaluate((el) => {
      const eng = el as unknown as EngineHandle;
      return { yaw: eng._yaw, pitch: eng._pitch };
    });
    expect(after.yaw).toBeCloseTo(drag.during.yaw, 3);
    expect(after.pitch).toBeCloseTo(drag.during.pitch, 3);
    expect((await stats(en)).homeLookOverridden).toBe(true);

    // The fix does not disable R16: the ship's ORBITAL POSITION keeps advancing
    // regardless of where the visitor is looking.
    const phaseAfterRelease = (await stats(en)).homeOrbitPhaseDeg as number;
    await page.waitForTimeout(1500);
    const phaseLater = (await stats(en)).homeOrbitPhaseDeg as number;
    expect(phaseLater).toBeGreaterThan(phaseAfterRelease);
    // ...and the look direction is STILL untouched by that ongoing orbital motion.
    const stillHeld = await en.evaluate((el) => {
      const eng = el as unknown as EngineHandle;
      return { yaw: eng._yaw, pitch: eng._pitch };
    });
    expect(stillHeld.yaw).toBeCloseTo(drag.during.yaw, 3);
    expect(stillHeld.pitch).toBeCloseTo(drag.during.pitch, 3);
  });

  test("a fresh home arrival re-arms the auto-aim (the override does not leak across orbits)", async ({
    page,
  }) => {
    test.setTimeout(150000);
    const en = await boot(page);
    await armHomeOrbit(en);

    const drag = await dragOnCanvas(en, 200, 40);
    expect(drag.duringDragging).toBe(true);
    expect((await stats(en)).homeLookOverridden).toBe(true);

    // Leave home and come back — a NEW orbit, which must start with the auto-aim active
    // again (an old drag doesn't disable it forever).
    await en.evaluate((el) => (el as unknown as EngineHandle).travelTo("mars"));
    await expect
      .poll(
        async () =>
          en.evaluate((el) => (el as unknown as EngineHandle).arrivedId),
        { timeout: 45000 },
      )
      .toBe("mars");
    await en.evaluate((el) => (el as unknown as EngineHandle).goHome());
    await expect
      .poll(async () => (await stats(en)).homeOrbit, { timeout: 45000 })
      .toBe(true);
    expect((await stats(en)).homeLookOverridden).toBe(false);
  });
});

test.describe("PF-11 D6.4 bug #2 — the planet sphere occludes picking", () => {
  test("hovering the rendered Earth disc never yields a hover id (nothing behind it leaks through)", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const en = await boot(page);
    await armHomeOrbit(en);

    // The default (undragged) home-orbit aim points exactly at the sphere's centre by
    // construction (`_pitch`/`_yaw` are computed FROM the camera-to-origin direction) —
    // so viewport centre is guaranteed to land on Earth's rendered disc without needing
    // to reconstruct camera/FOV geometry by hand.
    expect((await stats(en)).homeLookOverridden).toBe(false);
    expect((await stats(en)).planetSphereVisible).toBe(true);

    const hoverAtCentre = await hoverOnCanvas(en, 0, 0);
    expect(hoverAtCentre).toBeNull();

    // A few nearby points still safely inside the disc (the sphere subtends a wide angle
    // from home-orbit distance) — the bug specifically manifested as OTHER DSOs' hover
    // cards appearing here, not just at the exact pixel centre.
    for (const [dx, dy] of [
      [40, 0],
      [-40, 0],
      [0, 40],
      [0, -40],
    ]) {
      const hover = await hoverOnCanvas(en, dx, dy);
      expect(hover, `hover at offset (${dx}, ${dy})`).toBeNull();
    }
  });

  test("clicking the rendered Earth disc never travels to a body behind it", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const en = await boot(page);
    await armHomeOrbit(en);

    const arrivedBefore = await en.evaluate(
      (el) => (el as unknown as EngineHandle).arrivedId,
    );
    await clickOnCanvas(en);
    // A real click-through would start a warp; give it a moment to prove it does NOT.
    await page.waitForTimeout(500);
    const modeAfter = await en.evaluate(
      (el) => (el as unknown as { warp: { mode: string } }).warp.mode,
    );
    expect(modeAfter).toBe("idle");
    expect(
      await en.evaluate((el) => (el as unknown as EngineHandle).arrivedId),
    ).toBe(arrivedBefore); // unchanged — Earth itself is not a travel target either
  });
});
