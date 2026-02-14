import { test, expect } from "@playwright/test";

test.describe("Star Interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for cosmic background to render
    await page.waitForSelector("[data-testid=cosmic-background] canvas");
  });

  test("cosmic background canvas is rendered", async ({ page }) => {
    const wrapper = page.locator("[data-testid=cosmic-background]");
    await expect(wrapper).toBeVisible();
    const canvas = wrapper.locator("canvas");
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute(
      "aria-label",
      /cosmic|starfield|discoverable/i,
    );
  });

  test("star modal opens via custom event", async ({ page }) => {
    // Dispatch a starclick event programmatically
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("starclick", { detail: { hubbleIndex: 0 } }),
      );
    });

    // Modal should appear
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Check content loaded
    await expect(modal).toContainText("Pillars of Creation");
  });

  test("star modal closes on close button", async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("starclick", { detail: { hubbleIndex: 0 } }),
      );
    });

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    const closeButton = page.getByLabel("Close modal");
    await closeButton.click();

    await expect(modal).not.toBeVisible();
  });

  test("star modal closes on Escape key", async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("starclick", { detail: { hubbleIndex: 0 } }),
      );
    });

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    await page.keyboard.press("Escape");

    await expect(modal).not.toBeVisible();
  });

  test("hint text is visible on landing page", async ({ page }) => {
    const hint = page.getByText(
      /Tip: Click the golden stars.*discover cosmic imagery/i,
    );
    await expect(hint).toBeVisible();
  });

  test('keyboard shortcut "G" opens star modal', async ({ page }) => {
    // Press 'g' key
    await page.keyboard.press("g");

    // Modal should appear
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Check for "Today's Discovery" badge (NASA mode)
    await expect(page.getByText("Today's Discovery")).toBeVisible();
  });

  test("both click event and keyboard shortcut work independently", async ({
    page,
  }) => {
    // Test keyboard path first
    await page.keyboard.press("g");
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Close modal
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();

    // Test click event path
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("starclick", { detail: { hubbleIndex: 0 } }),
      );
    });

    // Modal should appear again
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verify both paths successful
    expect(modal).toBeTruthy();
  });
});
