import { test, expect } from "@playwright/test";

test.describe("Star Interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const dataPromise = page.waitForResponse(
      (r) => r.url().includes("/hero-dso/manifest.json") && r.ok(),
      { timeout: 15000 },
    );
    await page.waitForSelector("canvas");
    await dataPromise;
    await page.waitForTimeout(500);
  });

  test("starfield canvas is rendered", async ({ page }) => {
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute("aria-label", /starfield.*deep-sky/i);
  });

  test("clicking a star reveals a real DSO photo in the hero background", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("starclick", { detail: { dsoIndex: 0 } }),
      );
    });

    const dismissButton = page.getByRole("button", {
      name: /Return to starfield/i,
    });
    await expect(dismissButton).toBeVisible({ timeout: 10000 });

    const status = page.getByRole("status");
    await expect(status).toHaveText(/Showing .+ in the background\./);
  });

  test("clicking the same star again dismisses the reveal", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("starclick", { detail: { dsoIndex: 0 } }),
      );
    });

    const dismissButton = page.getByRole("button", {
      name: /Return to starfield/i,
    });
    await expect(dismissButton).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("starclick", { detail: { dsoIndex: 0 } }),
      );
    });

    await expect(dismissButton).not.toBeVisible();
  });

  test("reveal closes on close button", async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("starclick", { detail: { dsoIndex: 0 } }),
      );
    });

    const dismissButton = page.getByRole("button", {
      name: /Return to starfield/i,
    });
    await expect(dismissButton).toBeVisible({ timeout: 10000 });

    await dismissButton.click();

    await expect(dismissButton).not.toBeVisible();
  });

  test("reveal closes on Escape key", async ({ page }) => {
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("starclick", { detail: { dsoIndex: 0 } }),
      );
    });

    const dismissButton = page.getByRole("button", {
      name: /Return to starfield/i,
    });
    await expect(dismissButton).toBeVisible({ timeout: 10000 });

    await page.keyboard.press("Escape");

    await expect(dismissButton).not.toBeVisible();
  });
});
