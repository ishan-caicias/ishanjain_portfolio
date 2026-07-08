import { test, expect } from "@playwright/test";

// Replaces the old star-interaction.spec.ts, which tested the now-unmounted
// Starfield/StarModal system (Hero.astro no longer imports either - see
// PF-07 delivery plan Phase 4/5). Covers the handoff doc's §4 testing
// checklist: scene mount, hover/travel/dossier flows, console-clean, WebGL
// fallback, and prefers-reduced-motion.

test.describe("Space Scene", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("space-engine");
  });

  test("scene mounts, streams live catalog data, console clean", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    const engine = page.locator("space-engine");
    await expect(engine).toBeAttached();
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
    await page.waitForSelector("space-engine");
    await expect(page.getByText(/ONLINE ·.*LIVE SOURCES/)).toBeVisible({
      timeout: 15000,
    });

    // Navigation must still function via the no-render fallback path
    // (space-engine.js's noGL branch of travelTo/goHome).
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
        const en = document.querySelector("space-engine") as unknown as {
          reduced?: boolean;
        } | null;
        return !!en?.reduced;
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
