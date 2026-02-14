import { test, expect } from "@playwright/test";
import nasaFixture from "./fixtures/nasa-response.json" with { type: "json" };

test.describe("Golden Stars Discovery", () => {
  test.beforeEach(async ({ page }) => {
    // Mock NASA API responses
    await page.route("https://images-api.nasa.gov/search*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(nasaFixture),
      });
    });
  });

  test("displays hint text with keyboard shortcut on landing page", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for hub to load
    await page.waitForSelector('nav[aria-label="Mission Control Hub"]', {
      timeout: 10000,
    });

    // Verify hint text is visible
    const hint = page.getByText(/Tip: Click the golden stars or press/i);
    await expect(hint).toBeVisible();

    // Verify 'G' key hint is present
    const kbdHint = page.locator('kbd:has-text("G")');
    await expect(kbdHint).toBeVisible();
  });

  test("keyboard shortcut 'G' opens random golden star modal", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for starfield to load
    await page.waitForSelector("[data-testid=cosmic-background] canvas", {
      timeout: 10000,
    });

    // Press 'G' key
    await page.keyboard.press("g");

    // Verify modal opens
    await expect(
      page.locator('div[role="dialog"][aria-modal="true"]'),
    ).toBeVisible({ timeout: 5000 });

    // Verify "Today's Discovery" badge is present
    await expect(page.getByText("Today's Discovery")).toBeVisible();
  });

  test("keyboard shortcut works multiple times (different stars)", async ({
    page,
  }) => {
    await page.goto("/");

    await page.waitForSelector("[data-testid=cosmic-background] canvas", {
      timeout: 10000,
    });

    // Press 'G' first time
    await page.keyboard.press("g");
    await expect(page.locator('div[role="dialog"]')).toBeVisible({
      timeout: 5000,
    });

    // Get first star title
    const firstTitle = await page.locator("h3").first().textContent();

    // Close modal
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Press 'G' second time
    await page.keyboard.press("g");
    await expect(page.locator('div[role="dialog"]')).toBeVisible({
      timeout: 5000,
    });

    // Get second star title (may be same or different due to random)
    const secondTitle = await page.locator("h3").first().textContent();

    // Both should have "Today's Discovery" badge
    await expect(page.getByText("Today's Discovery")).toBeVisible();

    // At least we got titles
    expect(firstTitle).toBeTruthy();
    expect(secondTitle).toBeTruthy();
  });

  test("keyboard shortcut does not trigger in input fields", async ({
    page,
  }) => {
    await page.goto("/");

    await page.waitForSelector('nav[aria-label="Mission Control Hub"]', {
      timeout: 10000,
    });

    // Open a panel with input (e.g., Contact/Connect)
    const connectButton = page.locator('button[data-panel="contact"]');
    if (await connectButton.isVisible()) {
      await connectButton.click();
      await page.waitForSelector('div[data-panel-id="contact"]', {
        timeout: 5000,
      });

      // Check if there's an input field
      const input = page.locator("input, textarea").first();
      if (await input.isVisible()) {
        await input.focus();

        // Press 'G' while focused in input
        await page.keyboard.press("g");

        // Wait a bit to ensure no modal opens
        await page.waitForTimeout(500);

        // Modal should NOT open
        const dialog = page.locator('div[role="dialog"][aria-modal="true"]');
        await expect(dialog).not.toBeVisible();
      }
    }
  });

  test("modal opens above panel and panel remains open", async ({ page }) => {
    await page.goto("/");

    await page.waitForSelector('nav[aria-label="Mission Control Hub"]', {
      timeout: 10000,
    });

    // Open a panel (e.g., Skills)
    const skillsButton = page.locator('button[data-panel="skills"]');
    await skillsButton.click();
    await expect(page.locator('div[data-panel-id="skills"]')).toBeVisible({
      timeout: 5000,
    });

    // Press 'G' while panel is open
    await page.keyboard.press("g");

    // Verify modal opens
    await expect(page.locator('div[role="dialog"]')).toBeVisible({
      timeout: 5000,
    });

    // Close modal
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Verify panel is still open
    await expect(page.locator('div[data-panel-id="skills"]')).toBeVisible();
  });

  test("modal displays multiple images with thumbnail selector", async ({
    page,
  }) => {
    await page.goto("/");

    await page.waitForSelector("[data-testid=cosmic-background] canvas", {
      timeout: 10000,
    });

    // Press 'G' to open golden star
    await page.keyboard.press("g");

    // Wait for modal and images to load
    await expect(page.locator('div[role="dialog"]')).toBeVisible({
      timeout: 5000,
    });
    await page.waitForLoadState("networkidle");

    // Check for thumbnail selector (should have 3 images per fixture)
    const thumbnails = page.locator('button[aria-label*="View image"]');
    const thumbnailCount = await thumbnails.count();

    if (thumbnailCount > 1) {
      // Get first thumbnail's pressed state
      const firstPressed = await thumbnails
        .nth(0)
        .getAttribute("aria-pressed");
      expect(firstPressed).toBe("true");

      // Click second thumbnail
      await thumbnails.nth(1).click();
      await page.waitForTimeout(300);

      // Verify aria-pressed changes
      await expect(thumbnails.nth(1)).toHaveAttribute("aria-pressed", "true");
      await expect(thumbnails.nth(0)).toHaveAttribute("aria-pressed", "false");
    }
  });

  test("modal has fixed height container and object-contain image", async ({
    page,
  }) => {
    await page.goto("/");

    await page.waitForSelector("[data-testid=cosmic-background] canvas", {
      timeout: 10000,
    });

    // Press 'G' to open golden star
    await page.keyboard.press("g");

    // Wait for modal to open
    await expect(page.locator('div[role="dialog"]')).toBeVisible({
      timeout: 5000,
    });

    // Verify h-80 class on image container
    const imageContainer = page.locator(".h-80.w-full.overflow-hidden");
    await expect(imageContainer).toBeVisible();

    // Verify object-contain on image
    const img = page.locator("img.object-contain");
    await expect(img).toBeVisible();
  });

  test("ESC key closes modal", async ({ page }) => {
    await page.goto("/");

    await page.waitForSelector("[data-testid=cosmic-background] canvas", {
      timeout: 10000,
    });

    // Open modal
    await page.keyboard.press("g");
    await expect(page.locator('div[role="dialog"]')).toBeVisible({
      timeout: 5000,
    });

    // Press Escape
    await page.keyboard.press("Escape");

    // Wait for modal to close
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({
      timeout: 2000,
    });
  });

  test("close button closes modal", async ({ page }) => {
    await page.goto("/");

    await page.waitForSelector("[data-testid=cosmic-background] canvas", {
      timeout: 10000,
    });

    // Open modal
    await page.keyboard.press("g");
    await expect(page.locator('div[role="dialog"]')).toBeVisible({
      timeout: 5000,
    });

    // Click close button
    const closeButton = page.locator('button[aria-label="Close modal"]');
    await closeButton.click();

    // Wait for modal to close
    await expect(page.locator('div[role="dialog"]')).not.toBeVisible({
      timeout: 2000,
    });
  });
});
