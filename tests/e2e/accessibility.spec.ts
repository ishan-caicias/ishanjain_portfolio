import { test, expect } from "@playwright/test";
import { injectAxe, getViolations } from "axe-playwright";

test.describe("Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await injectAxe(page);
  });

  test("should not have automatically detectable accessibility issues", async ({
    page,
  }) => {
    const violations = await getViolations(page, undefined, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });

    // Filter out minor/incomplete results for CI reliability
    const serious = violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    expect(serious).toEqual([]);
  });

  test("page has correct heading hierarchy", async ({ page }) => {
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);

    const h1Text = await page.locator("h1").textContent();
    expect(h1Text).toContain("Reliable systems");
  });

  test("all images have alt text", async ({ page }) => {
    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      const ariaHidden = await img.getAttribute("aria-hidden");
      // Image should have alt text or be marked as decorative
      expect(alt !== null || ariaHidden === "true").toBeTruthy();
    }
  });

  test("interactive elements are keyboard accessible", async ({ page }) => {
    // Tab through navigation links
    await page.keyboard.press("Tab"); // Skip link
    await page.keyboard.press("Tab"); // Logo

    const logo = page.getByLabel("Ishan Jain — back to top");
    await expect(logo).toBeFocused();

    // Continue tabbing through nav items
    await page.keyboard.press("Tab"); // About
    await page.keyboard.press("Tab"); // Experience
    await page.keyboard.press("Tab"); // Projects
    await page.keyboard.press("Tab"); // Skills
    await page.keyboard.press("Tab"); // Contact
  });

  test("semantic landmarks are present", async ({ page }) => {
    // The footer is hidden by design while the space scene's travel mode is
    // active (default) - switch to classic view to check the full landmark
    // set the way a scroll-mode visitor sees it. See PF-07 delivery plan
    // Phase 4/5.
    await page.getByRole("button", { name: /CLASSIC VIEW/ }).click();

    await expect(page.getByRole("banner")).toBeVisible(); // header
    await expect(page.getByRole("main")).toBeVisible(); // main
    await expect(page.getByRole("contentinfo")).toBeVisible(); // footer
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
  });
});

test.describe("Accessibility — Babylon path (PF-09 B6 re-audit)", () => {
  // The cutover candidate must clear the same bar as the shipping engine.
  // The scene chrome is shared React either way, but the audit must run
  // against the page AS THE BABYLON PATH RENDERS IT — canvas swap included.
  test.beforeEach(async ({ page }) => {
    await page.goto("/?engine=babylon");
    await page.waitForSelector("babylon-scene", { timeout: 15000 });
    await injectAxe(page);
  });

  test("no serious/critical axe violations on the Babylon path", async ({
    page,
  }) => {
    const violations = await getViolations(page, undefined, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
    const serious = violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious).toEqual([]);
  });

  test("scene chrome stays keyboard-operable on the Babylon path", async ({
    page,
  }) => {
    // TR-107 (declared test change, CLAUDE.md #15): dismiss the PRE-FLIGHT gate first, as a
    // real visitor would before ever reaching the mission bar — PF-11 D1.2 put #ij-mission-bar
    // (the WHERE-TO input and RANDOM JUMP button below) behind body.ij-loading
    // (opacity:0; pointer-events:none) until a real visitor action; every other Babylon E2E
    // test that touches this bar already does this (see engine-select.spec.ts's "RNG mission
    // control button" test). Without it this test also races PreFlight's own arming effect
    // (moveFocusTo in PreFlight.tsx, fired when the scene's `armed` flips true), which steals
    // focus to the LAUNCH button mid-test if boot completes during the assertion window —
    // observed directly as the 2026-07-28 full-suite failure (isolated reruns passed 3/3).
    await page.getByRole("button", { name: "SKIP INTRO" }).click();
    // The travel input and mission controls must be reachable and usable by
    // keyboard exactly as on the default engine.
    const whereTo = page.getByRole("combobox").or(page.getByRole("textbox"));
    await whereTo.first().focus();
    await expect(whereTo.first()).toBeFocused();
    // PF-11 D5.1 (ADR-0010): RNG renamed to RANDOM JUMP ▸ (aria-label "Jump to a random
    // destination"), named test change.
    const rng = page.getByRole("button", {
      name: "Jump to a random destination",
    });
    await rng.focus();
    await expect(rng).toBeFocused();
    // classic-view toggle remains operable too
    const classic = page.getByRole("button", { name: /CLASSIC VIEW/ });
    await classic.focus();
    await expect(classic).toBeFocused();
  });
});
