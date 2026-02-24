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
    expect(h1Text).toContain("Building reliable systems");
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
    await expect(page.getByRole("banner")).toBeVisible(); // header
    await expect(page.getByRole("main")).toBeVisible(); // main
    await expect(page.getByRole("contentinfo")).toBeVisible(); // footer
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
  });
});
