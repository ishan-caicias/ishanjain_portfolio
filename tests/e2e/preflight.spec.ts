/**
 * PF-11 D1.2 — the PRE-FLIGHT · SYSTEMS CHECK dossier.
 *
 * Loading is now a real gate the visitor passes through (LAUNCH / SKIP INTRO / a
 * returning-visitor bypass) rather than something that silently finishes itself — the old
 * `body.ij-loading` auto-clear (ready && craftDone, with 2.5s/8s grace timers) is gone.
 * These specs drive that gate through the real UI (CLAUDE.md #18), not by calling engine
 * methods directly.
 */
import { test, expect } from "@playwright/test";

test.describe("PF-11 D1.2 PreFlight dossier", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");
  });

  test("renders identity + engine line immediately, arms once boot-critical stages close, and LAUNCH reveals content", async ({
    page,
  }) => {
    test.setTimeout(45000);

    // Identity is visible well before arming — the recruiter's "who is this" moment must
    // not wait on the boot-critical set. Scoped to #ij-preflight: "Ishan Jain" also
    // appears in the page footer, and Playwright's text matching is case-insensitive.
    const preflight = page.locator("#ij-preflight");
    await expect(preflight.getByText("ISHAN JAIN")).toBeVisible({
      timeout: 5000,
    });
    await expect(
      preflight.getByText("PRE-FLIGHT · SYSTEMS CHECK"),
    ).toBeVisible();

    const launchButton = page.getByRole("button", {
      name: /^LAUNCH ▸$|^ARMING…/,
    });
    await expect(launchButton).toBeVisible();
    await expect(page.locator("body")).toHaveClass(/ij-loading/);

    // Real arm: LAUNCH becomes enabled only once boot-critical stages close (state.ready).
    await expect(launchButton).toBeEnabled({ timeout: 30000 });
    await expect(launchButton).toHaveText("LAUNCH ▸");
    await expect(page.getByText("ENTER PORTFOLIO · FLIGHT MODE")).toBeVisible();

    // Focus moves to LAUNCH the moment it arms (D1.2 recommendation #7).
    await expect(launchButton).toBeFocused();

    await launchButton.click();
    // NAMED TEST CHANGE (CLAUDE.md #15), PF-11 D1.3: LAUNCH now plays the ~8s launch ascent
    // BEFORE clearing ij-loading — the console reveal waits for `cosmos:ascent-done`. The
    // animated reveal itself is covered by ascent.spec.ts; this D1.2 test still asserts the same
    // end contract (PreFlight dismisses, content reveals), just with the ascent's time budget
    // (stretched on SwiftShader by the wall-clock dt cap). The PreFlight UNMOUNT is immediate
    // (its own `launched` state), so that assertion is unchanged.
    await expect(page.locator("#ij-preflight")).toHaveCount(0); // PreFlight unmounted at once
    await expect(page.locator("body")).not.toHaveClass(/ij-loading/, {
      timeout: 30000,
    });
    await expect(
      page.getByRole("heading", { name: /Reliable systems/ }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("SKIP INTRO reveals content immediately, without waiting for arming", async ({
    page,
  }) => {
    const skip = page.getByRole("button", { name: "SKIP INTRO" });
    await expect(skip).toBeVisible({ timeout: 5000 });
    await skip.click();
    await expect(page.locator("body")).not.toHaveClass(/ij-loading/, {
      timeout: 5000,
    });
  });

  test("keyboard-only: Tab reaches LAUNCH, Enter activates it (D1-AC2's D1.2 half)", async ({
    page,
  }) => {
    test.setTimeout(45000);
    const launchButton = page.getByRole("button", { name: "LAUNCH ▸" });
    await expect(launchButton).toBeEnabled({ timeout: 30000 });
    await expect(launchButton).toBeFocused(); // arming itself moves focus here

    await page.keyboard.press("Enter");
    // NAMED TEST CHANGE (CLAUDE.md #15), PF-11 D1.3: LAUNCH plays the ascent before the reveal;
    // give the ij-loading clear the ascent's time budget. The keyboard chain itself
    // (Tab→LAUNCH→Enter) is unchanged and is what this test guards.
    await expect(page.locator("body")).not.toHaveClass(/ij-loading/, {
      timeout: 30000,
    });
  });

  test("returning visitor: sessionStorage bypass skips the dossier on the next load", async ({
    page,
  }) => {
    test.setTimeout(45000);
    const launchButton = page.getByRole("button", { name: "LAUNCH ▸" });
    await expect(launchButton).toBeEnabled({ timeout: 30000 });
    await launchButton.click();
    // NAMED TEST CHANGE (CLAUDE.md #15), PF-11 D1.3: the first LAUNCH now starts the ascent, but
    // this test only needs the returning-visitor flag SET — PreFlight writes it to sessionStorage
    // synchronously inside its own `launch()` before the ascent even begins. So we no longer wait
    // out the first launch's reveal; the reload + bypass below is the real assertion, and the
    // bypass path (ascent: false) reveals instantly regardless.
    await expect(page.locator("#ij-preflight")).toHaveCount(0); // launch registered

    // Reload in the SAME context (sessionStorage persists; a fresh context would not).
    await page.reload();
    await page.waitForSelector("babylon-scene");
    // The dossier must never even flash — the bypass fires from the initializer, not a
    // later effect, specifically to prevent a one-frame flash of PRE-FLIGHT.
    await expect(page.getByText("PRE-FLIGHT · SYSTEMS CHECK")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/ij-loading/, {
      timeout: 5000,
    });
  });

  test("mobile scroll mode never shows the dossier (instant-clear semantics preserved)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.waitForSelector("babylon-scene");
    await expect(page.getByText("PRE-FLIGHT · SYSTEMS CHECK")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/ij-loading/, {
      timeout: 5000,
    });
  });

  test("reduced motion: dossier still arms and launches, with no eased transition classes", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForSelector("babylon-scene");

    const launchButton = page.getByRole("button", { name: "LAUNCH ▸" });
    await expect(launchButton).toBeEnabled({ timeout: 30000 });
    await launchButton.click();
    await expect(page.locator("body")).not.toHaveClass(/ij-loading/);
  });

  test("D1-AC7: no LAUNCH is ever shown armed over a scene that cannot start — no-WebGL still reaches content", async ({
    page,
  }) => {
    // Same forced-fallback technique space-scene.spec.ts's "degrades to the DOM fallback"
    // test uses — createEngine throws, babylon-engine.ts's catch branch closes every
    // boot-critical stage immediately (D1.1) rather than emitting cosmos:ready.
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error - intentionally narrowing the return type to force the no-WebGL path
      HTMLCanvasElement.prototype.getContext = function (
        type: string,
        ...rest: unknown[]
      ) {
        if (type.indexOf("webgl") !== -1) return null;
        return orig.call(this, type, ...rest);
      };
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await page.goto("/");
    await page.waitForSelector("babylon-scene");

    const launchButton = page.getByRole("button", { name: "LAUNCH ▸" });
    await expect(launchButton).toBeEnabled({ timeout: 15000 });
    await launchButton.click();
    await expect(page.locator("body")).not.toHaveClass(/ij-loading/);

    // Navigation must still work with no rendering engine (the actual D1-AC7 guarantee:
    // reaching content is never blocked by a gate over a scene that cannot start).
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .locator("ul")
      .first()
      .getByRole("link", { name: "About" })
      .click();
    await expect(page.getByRole("dialog", { name: "What I Do" })).toBeVisible({
      timeout: 10000,
    });
    expect(pageErrors).toEqual([]);
  });

  test("stage checklist reflects real cosmos:stage data (not a placeholder count)", async ({
    page,
  }) => {
    // star-catalog is the one boot-critical stage with a large, human-checkable byte total
    // (D1-AC4's manual half already proved this in TR-084; here it's the visible UI text).
    await expect(page.getByText(/STAR CATALOG/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/MB|KB/).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
