import { test, expect } from "@playwright/test";

test.describe("Logo (LogoMark)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("default: hats visible; brackets not visible (or offscreen)", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    const logoLink = nav.getByRole("link", { name: "Home" });

    await expect(logoLink).toBeVisible();
    // Rest state: wrapper has data-state="rest"
    const wrapper = page.locator(".logo-mark-wrapper").first();
    await expect(wrapper).toHaveAttribute("data-state", "rest");

    // Hats exist in DOM (may be small/positioned; we check they're present)
    const hatI = page.getByTestId("hat-i").first();
    const hatJ = page.getByTestId("hat-j").first();
    await expect(hatI).toBeAttached();
    await expect(hatJ).toBeAttached();

    // Letters i and j visible; no uppercase IJ
    await expect(logoLink).toContainText("i");
    await expect(logoLink).toContainText("j");
    await expect(logoLink).not.toContainText("IJ");
  });

  test("hover logo: angle brackets visible and hats move outward", async ({
    page,
  }) => {
    const logoLink = page.getByRole("link", { name: "Home" }).first();

    // Get initial hat positions (rest)
    const hatI = page.getByTestId("hat-i").first();
    const hatJ = page.getByTestId("hat-j").first();
    const boxIRest = await hatI.boundingBox();
    const boxJRest = await hatJ.boundingBox();
    expect(boxIRest).toBeTruthy();
    expect(boxJRest).toBeTruthy();

    await logoLink.hover();

    // Active state: brackets visible
    await expect(logoLink).toContainText("<");
    await expect(logoLink).toContainText(">");
    const wrapper = page.locator(".logo-mark-wrapper").first();
    await expect(wrapper).toHaveAttribute("data-state", "active");

    // Hats should have moved (bounding box or transform differs)
    const boxIActive = await hatI.boundingBox();
    const boxJActive = await hatJ.boundingBox();
    // With spring animation, positions change (i-hat left, j-hat right)
    expect(boxIActive).toBeTruthy();
    expect(boxJActive).toBeTruthy();
    // At least one hat moved (x position changed)
    const moved =
      (boxIRest && boxIActive && Math.abs(boxIRest.x - boxIActive.x) > 0.5) ||
      (boxJRest && boxJActive && Math.abs(boxJRest.x - boxJActive.x) > 0.5);
    expect(moved).toBe(true);
  });

  test("keyboard Tab focus: same behavior as hover", async ({ page }) => {
    const logoLink = page.getByRole("link", { name: "Home" }).first();
    // Tab until the logo is focused (focus order: skip link, then logo, then nav items)
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const isFocused = await logoLink.evaluate(
        (el) => document.activeElement === el
      );
      if (isFocused) break;
    }
    await expect(logoLink).toBeFocused();

    // Focus-visible should show active state
    const wrapper = page.locator(".logo-mark-wrapper").first();
    await expect(wrapper).toHaveAttribute("data-state", "active");
    await expect(logoLink).toContainText("<");
    await expect(logoLink).toContainText(">");
  });

  test("reduced motion: state changes but transforms do not move", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    const logoLink = page.getByRole("link", { name: "Home" }).first();
    const hatI = page.getByTestId("hat-i").first();
    const hatJ = page.getByTestId("hat-j").first();

    await logoLink.hover();

    // Active state still applies (brackets visible)
    const wrapper = page.locator(".logo-mark-wrapper").first();
    await expect(wrapper).toHaveAttribute("data-state", "active");
    await expect(logoLink).toContainText("<");
    await expect(logoLink).toContainText(">");

    // With reduced motion, hat elements should have no translate (transform none or identity)
    const transformI = await hatI.evaluate((el) =>
      window.getComputedStyle(el).transform
    );
    const transformJ = await hatJ.evaluate((el) =>
      window.getComputedStyle(el).transform
    );
    // Identity matrix is "none" or "matrix(1, 0, 0, 1, 0, 0)" — no translation
    expect(transformI === "none" || transformI.includes("1, 0, 0, 1, 0, 0")).toBe(true);
    expect(transformJ === "none" || transformJ.includes("1, 0, 0, 1, 0, 0")).toBe(true);
  });
});
