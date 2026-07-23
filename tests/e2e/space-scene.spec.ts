// UN-PINNED 2026-07-20 (GAP-19, TR-060): tested the default engine before
// the B6 cutover, pinned to ?engine=webgl at the cutover as a temporary
// archival guard. GAP-06 through GAP-16 are all now resolved on Babylon
// (TR-058/059), so this spec tests the default (Babylon) engine again.
// Two things needed real fixes, not just a selector swap, to make that true:
//   1. The "WebGL fallback" test needs babylon-engine.ts's travelTo/goHome to
//      actually complete a journey with no engine at all (no render loop to
//      tick a real warp state machine forward) — added a noGL-equivalent
//      instant-arrival fast path this session (see travelTo's `!this._engine`
//      branch), mirroring space-engine.js's own `noGL` branch exactly.
//   2. The reduced-motion test reads the engine's reduced-motion flag by
//      name — space-engine.js exposes it as `.reduced`; babylon-engine.ts's
//      equivalent is the private field `._reduced` (still readable at
//      runtime; TS privacy is compile-time only, same pattern this suite
//      already uses elsewhere for private-field reads).
import { test, expect } from "@playwright/test";

// Replaces the old star-interaction.spec.ts, which tested the now-unmounted
// Starfield/StarModal system (Hero.astro no longer imports either - see
// PF-07 delivery plan Phase 4/5). Covers the handoff doc's §4 testing
// checklist: scene mount, hover/travel/dossier flows, console-clean, WebGL
// fallback, and prefers-reduced-motion.

test.describe("Space Scene", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");
  });

  test("scene mounts, streams live catalog data, console clean", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    const engine = page.locator("babylon-scene");
    await expect(engine).toBeAttached();
    // GAP-10: babylon-engine.ts now sets the same aria-label text on the
    // host element the archived engine sets on itself.
    await expect(engine).toHaveAttribute(
      "aria-label",
      /Interactive star chart/i,
    );
    await expect(page.getByText(/ONLINE ·.*LIVE SOURCES/)).toBeVisible({
      timeout: 15000,
    });

    expect(errors).toEqual([]);
  });

  test("travel mode is the default nav experience", async ({ page }) => {
    await expect(page.locator("body")).toHaveClass(/ij-travel/);
    await expect(page.locator("#about")).toBeHidden();
    await expect(page.locator("footer")).toBeHidden();
  });

  test("clicking a header nav link warps to that station and opens its dossier", async ({
    page,
  }) => {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .locator("ul")
      .first()
      .getByRole("link", { name: "About" })
      .click();

    const dialog = page.getByRole("dialog", { name: "What I Do" });
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog).toContainText("Architecting .NET Microservices");
  });

  test("dossier closes on close button", async ({ page }) => {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .locator("ul")
      .first()
      .getByRole("link", { name: "About" })
      .click();

    const dialog = page.getByRole("dialog", { name: "What I Do" });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    await page.getByLabel("Close section").click();
    await expect(dialog).not.toBeVisible();
  });

  test("dossier closes on Escape key", async ({ page }) => {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .locator("ul")
      .first()
      .getByRole("link", { name: "About" })
      .click();

    const dialog = page.getByRole("dialog", { name: "What I Do" });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("RNG mission control button travels somewhere", async ({ page }) => {
    // PF-11 D1.2 named test change (CLAUDE.md #15): the mission control bar (and its RNG
    // button) is hidden under body.ij-loading until a real visitor action, same as the
    // hero copy — dismiss the PRE-FLIGHT gate first, as a real visitor would before ever
    // seeing this button. Assertion below unchanged.
    await page.getByRole("button", { name: "SKIP INTRO" }).click();
    await page.getByRole("button", { name: "RNG" }).click();

    // A random body was targeted - the HUD status line moves off its idle
    // "STATION-KEEPING" state as the engine starts aiming/warping.
    await expect(page.getByText("STATION-KEEPING")).toHaveCount(0, {
      timeout: 10000,
    });
  });

  test("travel/scroll mode toggle switches to classic view", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /CLASSIC VIEW/ }).click();

    await expect(page.locator("body")).not.toHaveClass(/ij-travel/);
    await expect(page.locator("footer")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /TRAVEL MODE/ }),
    ).toBeVisible();
  });
});

test.describe("Space Scene - WebGL fallback", () => {
  test("degrades to the DOM fallback without WebGL, navigation still works", async ({
    page,
  }) => {
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

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForSelector("babylon-scene");
    await expect(page.getByText(/ONLINE ·.*LIVE SOURCES/)).toBeVisible({
      timeout: 15000,
    });

    // Navigation must still function via the no-render fallback path
    // (babylon-engine.ts's `!this._engine` branch of travelTo/goHome, added
    // this session to close this exact gap — see this file's header).
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .locator("ul")
      .first()
      .getByRole("link", { name: "About" })
      .click();
    await expect(page.getByRole("dialog", { name: "What I Do" })).toBeVisible({
      timeout: 10000,
    });

    expect(errors).toEqual([]);
  });
});

test.describe("Space Scene - mobile responsive", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("mobile defaults to scroll mode, not travel", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");

    await expect(page.locator("body")).not.toHaveClass(/ij-travel/);
    await expect(page.locator("#about")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });

  test("HUD readouts are hidden on mobile regardless of mode", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");

    await expect(page.getByText(/GAIA DR3/)).toBeHidden();
    await expect(page.getByText(/^BEARING$/)).toBeHidden();
  });

  test("mission control bar is hidden in mobile scroll mode, shown after switching to travel", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");

    const missionControl = page.getByLabel(
      "Mission control: type a destination",
    );
    await expect(missionControl).toBeHidden();

    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("menuitem", { name: /TRAVEL MODE/ }).click();

    await expect(page.locator("body")).toHaveClass(/ij-travel/);
    await expect(missionControl).toBeVisible();
  });

  test("mobile menu: mode toggle switches modes and closes the menu", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");

    const menuButton = page.getByRole("button", { name: "Open menu" });
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("menuitem", { name: /TRAVEL MODE/ }).click();

    await expect(page.locator("body")).toHaveClass(/ij-travel/);
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");

    // Reopen - label should now offer switching back
    await menuButton.click();
    await expect(
      page.getByRole("menuitem", { name: /CLASSIC VIEW/ }),
    ).toBeVisible();
  });

  test("mobile menu: Data & Licenses opens the credits dialog and closes the menu", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");

    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("menuitem", { name: /DATA & LICENSES/ }).click();

    await expect(
      page.getByRole("dialog", { name: "Data Sources & Licenses" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: "Open menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("mobile menu closes on Escape", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");

    const menuButton = page.getByRole("button", { name: "Open menu" });
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  test("mobile menu nav link still navigates (scroll mode) and closes the menu", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");

    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("menuitem", { name: "Contact" }).click();

    await expect(page.locator("#contact")).toBeInViewport({ timeout: 5000 });
    await expect(
      page.getByRole("button", { name: "Open menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("Space Scene - reduced motion", () => {
  test("engine and DC-layer animations respect prefers-reduced-motion", async ({
    page,
  }) => {
    // Emulate explicitly before navigation - the `reducedMotion` context/test.use
    // option doesn't reliably apply before the first navigation in this setup,
    // but an explicit emulateMedia() call does.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForFunction(
      () => {
        // babylon-engine.ts's reduced-motion flag is the private field
        // `_reduced` (space-engine.js exposes the public `.reduced`) — still
        // readable at runtime, TS privacy is compile-time only.
        const en = document.querySelector("babylon-scene") as unknown as {
          _reduced?: boolean;
        } | null;
        return !!en?._reduced;
      },
      { timeout: 15000 },
    );

    // Opening a dossier exercises the DC-layer's ij-cardin keyframe -
    // global.css's blanket prefers-reduced-motion rule should clamp it.
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .locator("ul")
      .first()
      .getByRole("link", { name: "About" })
      .click();
    const dialog = page.getByRole("dialog", { name: "What I Do" });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const animationDurationSeconds = await dialog.evaluate((el) =>
      parseFloat(getComputedStyle(el).animationDuration),
    );
    // global.css's blanket prefers-reduced-motion rule clamps to 0.01ms (1e-5s)
    expect(animationDurationSeconds).toBeCloseTo(0.00001, 5);
  });
});
