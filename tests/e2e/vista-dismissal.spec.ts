/**
 * PF-11 D4.1 — arrival vista dismissal (owner R7; adopted D4-AC1/AC2/AC5/AC6).
 *
 * Before this slice the vista had no real dismiss input at all: the only thing that ever
 * closed it was a 5.5s auto-timeout, and a click meant to dismiss it could fall through
 * (the vista was `pointer-events-none`, and even its own button row sat BELOW
 * `#ij-mission-bar` in z-index — TR-086) and start an unrelated new warp. These specs drive
 * the real UI (CLAUDE.md #18) through the events `travelTo` actually dispatches, not by
 * inspecting React state directly.
 *
 * Engine scope: pinned to the default Babylon path (`?engine=babylon`) — the archived WebGL
 * engine is a rollback lever, not a feature target (CLAUDE.md #3/#17), and D4.1 only touches
 * SpaceScene's React chrome, which is shared, so one engine is sufficient evidence here.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

type EngineHandle = {
  sceneStats(): Record<string, unknown>;
  travelTo(id: string, quiet?: boolean): void;
  arrivedId: string | null;
  cam: [number, number, number];
  warp: { mode: string; prog?: number };
};

/** Sirius, 8.6 ly — a bare star (no planet sphere, no virtual texturing), same choice
 * mid-warp-input.spec.ts makes for a journey that's cheap to render but real. */
const TARGET = "sirius";

async function boot(page: Page): Promise<Locator> {
  await page.goto("/?engine=babylon");
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

/** Launches a real (non-quiet) journey to `TARGET` and waits for the arrival vista's dialog
 * to be showing — the same DOM state a visitor sees after any normal arrival. */
async function arriveAtTarget(page: Page, en: Locator): Promise<void> {
  await en.evaluate(
    (el, id) => (el as unknown as EngineHandle).travelTo(id),
    TARGET,
  );
  await expect
    .poll(
      async () =>
        en.evaluate((el) => (el as unknown as EngineHandle).arrivedId),
      { timeout: 60000 },
    )
    .toBe(TARGET);
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
}

const arrivedId = (en: Locator) =>
  en.evaluate((el) => (el as unknown as EngineHandle).arrivedId);
const warpMode = (en: Locator) =>
  en.evaluate((el) => (el as unknown as EngineHandle).warp.mode);
const cam = (en: Locator) =>
  en.evaluate((el) => (el as unknown as EngineHandle).cam);

test.describe("Arrival vista dismissal (PF-11 D4.1)", () => {
  test("click anywhere dismisses the vista; the ship stays parked (D4-AC1)", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    await arriveAtTarget(page, en);
    const camBefore = await cam(en);

    // Top-left corner of the full-screen dialog — empty backdrop, nowhere near the
    // "OPEN COLLECTOR CARD" button or the central artwork.
    await page.getByRole("dialog").click({ position: { x: 5, y: 5 } });

    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await arrivedId(en)).toBe(TARGET);
    expect(await warpMode(en)).toBe("idle");
    const camAfter = await cam(en);
    const moved = Math.hypot(
      camAfter[0] - camBefore[0],
      camAfter[1] - camBefore[1],
      camAfter[2] - camBefore[2],
    );
    expect(moved).toBeLessThan(0.01);
  });

  test("Space dismisses the vista (D4-AC1)", async ({ page }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    await arriveAtTarget(page, en);
    // Focused on mount (implementation plan D4.1) — the dialog itself, not its button.
    await expect(page.getByRole("dialog")).toBeFocused();

    await page.keyboard.press("Space");

    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await arrivedId(en)).toBe(TARGET);
  });

  test("Escape dismisses the vista (D4-AC1)", async ({ page }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    await arriveAtTarget(page, en);

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await arrivedId(en)).toBe(TARGET);
  });

  test("a double-click on the vista dismisses once and never launches a new warp (D4-AC2)", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    await arriveAtTarget(page, en);
    // Viewport centre — clear of the header, mission bar, and HUD chrome, so the second
    // click (once the vista is gone) would otherwise land squarely on the engine canvas.
    const vp = page.viewportSize()!;
    const cx = vp.width / 2;
    const cy = vp.height / 2;

    // The first click dismisses; the second (same native gesture, well inside the
    // VISTA_CLICK_SWALLOW_MS=300 window) must never reach the canvas underneath.
    await page.mouse.dblclick(cx, cy);
    await page.waitForTimeout(400); // past the swallow window

    expect(await arrivedId(en)).toBe(TARGET);
    expect(await warpMode(en)).toBe("idle");
  });

  test("no auto-timeout: the vista stays open well past the old 5.5s (D4-AC5)", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    await arriveAtTarget(page, en);

    await page.waitForTimeout(6500);

    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await arrivedId(en)).toBe(TARGET);
  });

  test("the vista is a labelled, focused dialog naming the arrived body (D4-AC6)", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    await arriveAtTarget(page, en);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAttribute("aria-label", /^Arrival: /);
    await expect(dialog).toBeFocused();
  });

  test("dismissing announces a resume-flight message for assistive tech (D4-AC6)", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    await arriveAtTarget(page, en);

    await page.keyboard.press("Escape");

    await expect(page.getByText(/^Resumed flight/)).toBeAttached();
  });
});
