/**
 * PF-11 D4.3 — collector card polish: focus trap, hover hygiene, style-dot accessibility
 * (owner R8's audit, closing the delivery plan's audited baseline items (c) stale hover
 * under the card modal and the missing focus trap the `aria-modal` attribute already
 * implied but never enforced).
 *
 * These drive the real UI (CLAUDE.md #18) through the vista → "OPEN COLLECTOR CARD ▸" path
 * rather than opening the card via a test hook, since the two card-open sites are exactly
 * where D4.3's hover-clearing lives.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

type EngineHandle = {
  sceneStats(): Record<string, unknown>;
  travelTo(id: string, quiet?: boolean): void;
  arrivedId: string | null;
  aimAt(bodyId: string): boolean;
  _hoverId: string | null;
};

/** Sirius, 8.6 ly — a bare star, same cheap-to-render choice vista-dismissal.spec.ts makes. */
const TARGET = "sirius";

/** `?testhooks` enables `aimAt` (self-gated, see babylon-engine.ts) — used only by the hover
 * test below, which needs to re-center the camera precisely on the parked body rather than
 * assume arrival leaves it at exact viewport-center (it doesn't: idle drift and the
 * approach-vector geometry can leave it a few degrees off, enough that the first draft of
 * that test hovered a background SDSS galaxy instead of Sirius). Harmless for every other
 * test in this file, which never calls `aimAt`. */
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

/** Travels to `TARGET`, waits for the arrival vista, and opens the collector card via its
 * real button — the path D4.3's hover-clearing actually lives on. */
async function openCollectorCard(page: Page, en: Locator): Promise<void> {
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
  await page.getByRole("button", { name: "OPEN COLLECTOR CARD ▸" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
}

test.describe("Collector card polish (PF-11 D4.3)", () => {
  test("the card is a real modal: focused on open, and closing never leaves focus orphaned", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    const openButton = page.getByRole("button", {
      name: "OPEN COLLECTOR CARD ▸",
    });

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
    await openButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });
    // Focused on mount — the standard modal-dialog pattern, same as ArrivalVista (D4.1).
    await expect(dialog).toBeFocused();

    await page.getByLabel("Close card").click();
    await expect(dialog).toBeHidden();
    // NOT "focus returns to openButton" — clicking OPEN COLLECTOR CARD focuses that button
    // AND unmounts it in the same action (opening the card also dismisses the vista it lived
    // on), so by the time CollectorCard's mount effect captures "what had focus," it's already
    // capturing an element that's about to be removed from the DOM. `restoreFocusTo`'s
    // `isConnected` guard correctly no-ops for a detached element (focus-utils.test.ts covers
    // that guard directly) — the real contract under test here is that closing the card never
    // leaves focus stuck inside the now-hidden dialog or on a dead reference; the browser's
    // own removal-of-focused-element fallback (document.body) is the honest outcome.
    await expect(openButton).toHaveCount(0); // confirms the "detached trigger" premise itself
    const activeTag = await page.evaluate(
      () => document.activeElement?.tagName,
    );
    expect(activeTag).toBe("BODY");
  });

  test("aria-labelledby resolves to the body's own name heading", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    await openCollectorCard(page, en);

    const dialog = page.getByRole("dialog");
    // Playwright's accessible-name computation follows aria-labelledby itself — if the id
    // reference were stale or missing, this resolves to "" instead of the body's name.
    await expect(dialog).toHaveAccessibleName(/Sirius/i);
  });

  test("Tab cycles within the card and never escapes to the page behind it", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    await openCollectorCard(page, en);

    const closeBtn = page.getByLabel("Close card");
    const holoDot = page.getByLabel("Holo card style");
    const dossierDot = page.getByLabel("Dossier card style");
    const plateDot = page.getByLabel("Plate card style");
    const returnHome = page.getByRole("button", { name: "◂ RETURN HOME" });

    // Mount focus is the dialog root itself; the FIRST Tab is native browser behaviour
    // (the trap only has to act at the wrap boundaries) and lands on the close button.
    await page.keyboard.press("Tab");
    await expect(closeBtn).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(holoDot).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dossierDot).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(plateDot).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(returnHome).toBeFocused();

    // The wrap: one more Tab from the LAST control must land back on the FIRST, not escape
    // to the mission bar / header behind the card.
    await page.keyboard.press("Tab");
    await expect(closeBtn).toBeFocused();

    // And the reverse wrap.
    await page.keyboard.press("Shift+Tab");
    await expect(returnHome).toBeFocused();
  });

  test("style dots: correct aria-pressed state and a real 24px hit target (WCAG 2.5.8)", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    await openCollectorCard(page, en);

    const holoDot = page.getByLabel("Holo card style");
    const dossierDot = page.getByLabel("Dossier card style");

    // Card opens in "holo" by default (SpaceScene's styleOverride || "holo").
    await expect(holoDot).toHaveAttribute("aria-pressed", "true");
    await expect(dossierDot).toHaveAttribute("aria-pressed", "false");

    await dossierDot.click();
    await expect(dossierDot).toHaveAttribute("aria-pressed", "true");
    await expect(holoDot).toHaveAttribute("aria-pressed", "false");

    const box = await dossierDot.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
  });

  test("the hover tooltip never shows while the card is open, even if the pointer moves over the canvas (D4-AC3)", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
    await openCollectorCard(page, en);

    // Try to provoke a hover: dispatch real pointer movement at the canvas underneath the
    // card's backdrop. The backdrop blocks it from ever reaching the engine's own picker, but
    // this is the render-time gate's real backstop — even if `state.hover` were somehow still
    // set, HoverTooltip must not render while cardId is set.
    await en.evaluate(() => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          pointerId: 1,
          bubbles: true,
        }),
      );
    });
    await page.waitForTimeout(300);

    await expect(page.getByText("CLICK TO TRAVEL ▸")).toHaveCount(0);
    await expect(page.getByText("OPEN COLLECTOR CARD ▸")).toHaveCount(0);
  });

  test("hovering the parked body shows the renamed CTA, not the old DOSSIER wording", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
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
    // Dismiss the vista (D4.1) so the parked body is hoverable again, without opening the card.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    // Re-aim at Sirius explicitly rather than assuming arrival left it at exact
    // viewport-center: it doesn't, reliably enough — idle drift plus the ARRIVE_STANDOFF
    // approach geometry left it a few degrees off in practice, and the first draft of this
    // test hovered a background SDSS galaxy (NGC 2146) instead. Same `aimAt` + settle-frame
    // technique as field-travel.spec.ts (D4.2), which hit the identical class of problem.
    expect(
      await en.evaluate(
        (el, id) => (el as unknown as EngineHandle).aimAt(id),
        TARGET,
      ),
    ).toBe(true);
    await en.evaluate(() =>
      new Promise<void>((r) => requestAnimationFrame(() => r())).then(
        () => new Promise<void>((r) => requestAnimationFrame(() => r())),
      ),
    );

    // Retry loop, not a single dispatch: field-travel.spec.ts (D4.2) found `_pick`'s
    // O(starCount) field fallback throttled to every other pick attempt (`_fp % 2 === 0`),
    // so one `pointermove` can legitimately land on the held-over throttled tick and report
    // nothing new. A real moving mouse produces a dense event stream; two dispatches at a
    // 1px offset is the faithful synthetic equivalent, not a workaround for a defect.
    let hoveredId: string | null = null;
    for (let attempt = 0; attempt < 12 && hoveredId === null; attempt++) {
      hoveredId = await en.evaluate((el) => {
        const canvas = document.querySelector("canvas") as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        for (const dy of [0, 1]) {
          canvas.dispatchEvent(
            new PointerEvent("pointermove", {
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2 + dy,
              pointerId: 1,
              bubbles: true,
            }),
          );
        }
        return (el as unknown as EngineHandle)._hoverId;
      });
      if (hoveredId === null) await page.waitForTimeout(120);
    }
    expect(hoveredId, "the parked body itself should be what's hovered").toBe(
      TARGET,
    );

    await expect(
      page.getByText("ON STATION · OPEN COLLECTOR CARD ▸"),
    ).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/OPEN DOSSIER/)).toHaveCount(0);
  });

  test("arrival itself aims the camera at the parked body — no aimAt needed (TR-102)", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const en = await boot(page);
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
    // Dismiss the vista (D4.1) so the parked body is hoverable, without opening the card.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    // THE ASSERTION THIS TEST EXISTS FOR: no `aimAt` call, no settle-frame wait for a
    // testhook re-aim — this is the real arrival path exactly as a visitor experiences it.
    // Before TR-102's fix, orientation at arrival came from the chase-look (travel)
    // direction, not the direction from the standoff point to the body, so the body could
    // land off-center or fully out of frame; the sibling test above worked around exactly
    // this with an explicit `aimAt`. Same retry-loop technique (throttled `_fp` pick), no
    // aimAt in the loop.
    let hoveredId: string | null = null;
    for (let attempt = 0; attempt < 12 && hoveredId === null; attempt++) {
      hoveredId = await en.evaluate((el) => {
        const canvas = document.querySelector("canvas") as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        for (const dy of [0, 1]) {
          canvas.dispatchEvent(
            new PointerEvent("pointermove", {
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2 + dy,
              pointerId: 1,
              bubbles: true,
            }),
          );
        }
        return (el as unknown as EngineHandle)._hoverId;
      });
      if (hoveredId === null) await page.waitForTimeout(120);
    }
    expect(
      hoveredId,
      "arrival alone (no aimAt) should center the parked body at viewport center",
    ).toBe(TARGET);
  });
});
