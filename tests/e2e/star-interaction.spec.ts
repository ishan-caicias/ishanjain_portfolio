import { test, expect } from "@playwright/test";

test.describe("Star Interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const dataPromise = page.waitForResponse(
      (r) => r.url().includes("/hubble/data.json") && r.ok(),
      { timeout: 15000 },
    );
    await page.waitForSelector("canvas");
    await dataPromise;
    await page.waitForTimeout(500);
  });

  test("starfield canvas is rendered", async ({ page }) => {
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute(
      "aria-label",
      /starfield.*Hubble/i,
    );
  });

  test("star modal opens via custom event", async ({ page }) => {
    // Dispatch a starclick event programmatically
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("starclick", { detail: { hubbleIndex: 0 } }),
      );
    });

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 10000 });

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
    await expect(modal).toBeVisible({ timeout: 10000 });

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
    await expect(modal).toBeVisible({ timeout: 10000 });

    await page.keyboard.press("Escape");

    await expect(modal).not.toBeVisible();
  });
});
