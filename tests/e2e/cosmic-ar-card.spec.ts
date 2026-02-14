import { test, expect } from "@playwright/test";

test.describe("Cosmic AR Card Overlay", () => {
  test("shows AR card when clicking cosmic object, closes on outside click", async ({
    page,
  }) => {
    await page.goto("/?cosmic-debug=1");

    // Wait for canvas to be visible
    const canvas = page.locator("[data-testid=cosmic-background] canvas");
    await canvas.waitFor({ state: "visible", timeout: 10000 });

    // Wait for cosmic initialization
    await page.waitForFunction(
      () =>
        (window as any).__COSMIC_CAMERA_READY__ === true &&
        (window as any).__COSMIC_LAYER_READY__ === true,
      { timeout: 10000 }
    );

    // Click canvas center to select test object
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    await page.mouse.click(centerX, centerY);

    // Wait for AR card to appear
    const arCard = page.locator("[data-testid=cosmic-ar-card]");
    await expect(arCard).toBeVisible({ timeout: 2000 });

    // Assert card contains kind/title text (should show "Star" for test-center object)
    await expect(arCard).toContainText("Star");

    // Assert card contains stats
    await expect(arCard).toContainText("Brightness");
    await expect(arCard).toContainText("Distance");
    await expect(arCard).toContainText("Class");
    await expect(arCard).toContainText("Drift Vector");

    // Check if (10, 10) is safe to click (not on canvas)
    const canvasRect = await page.evaluate(() => {
      const canvas = document.querySelector("[data-testid=cosmic-background] canvas") as HTMLCanvasElement;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    });

    // Click outside (use close button if canvas covers (10,10), otherwise click there)
    if (canvasRect && canvasRect.left <= 10 && canvasRect.top <= 10 &&
        canvasRect.right >= 10 && canvasRect.bottom >= 10) {
      // Canvas covers (10,10), use close button
      const closeButton = page.locator("[aria-label='Close details']");
      await closeButton.click();
    } else {
      // Safe to click at (10, 10)
      await page.mouse.click(10, 10);
    }

    // Verify card closes
    await expect(arCard).toHaveCount(0, { timeout: 3000 });
  });

  test("AR card reopens on second click and closes with Escape key", async ({
    page,
  }) => {
    await page.goto("/?cosmic-debug=1");

    // Wait for canvas and cosmic initialization
    const canvas = page.locator("[data-testid=cosmic-background] canvas");
    await canvas.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(
      () =>
        (window as any).__COSMIC_CAMERA_READY__ === true &&
        (window as any).__COSMIC_LAYER_READY__ === true,
      { timeout: 10000 }
    );

    // Click canvas center
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    await page.mouse.click(centerX, centerY);

    // Wait for AR card to appear
    const arCard = page.locator("[data-testid=cosmic-ar-card]");
    await expect(arCard).toBeVisible({ timeout: 2000 });

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(arCard).toHaveCount(0, { timeout: 2000 });

    // Click again to reopen
    await page.mouse.click(centerX, centerY);
    await expect(arCard).toBeVisible({ timeout: 2000 });
  });

  test("AR card toggles when clicking the same object twice", async ({
    page,
  }) => {
    await page.goto("/?cosmic-debug=1");

    // Wait for canvas and cosmic initialization
    const canvas = page.locator("[data-testid=cosmic-background] canvas");
    await canvas.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(
      () =>
        (window as any).__COSMIC_CAMERA_READY__ === true &&
        (window as any).__COSMIC_LAYER_READY__ === true,
      { timeout: 10000 }
    );

    // Click canvas center
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    await page.mouse.click(centerX, centerY);

    // Wait for AR card to appear
    const arCard = page.locator("[data-testid=cosmic-ar-card]");
    await expect(arCard).toBeVisible({ timeout: 2000 });

    // Click same position again (same object) - should toggle closed
    await page.mouse.click(centerX, centerY);

    // Card should be removed from DOM
    await expect(arCard).toHaveCount(0, { timeout: 3000 });

    // Click again - should toggle back open
    await page.mouse.click(centerX, centerY);
    await expect(arCard).toBeVisible({ timeout: 2000 });
  });

  test("AR card shows short ID in header", async ({ page }) => {
    await page.goto("/?cosmic-debug=1");

    // Wait for canvas and cosmic initialization
    const canvas = page.locator("[data-testid=cosmic-background] canvas");
    await canvas.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(
      () =>
        (window as any).__COSMIC_CAMERA_READY__ === true &&
        (window as any).__COSMIC_LAYER_READY__ === true,
      { timeout: 10000 }
    );

    // Click canvas center
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    await page.mouse.click(centerX, centerY);

    // Wait for AR card to appear
    const arCard = page.locator("[data-testid=cosmic-ar-card]");
    await expect(arCard).toBeVisible({ timeout: 2000 });

    // Assert card shows short ID (cosmic-test-center -> CENTER)
    await expect(arCard).toContainText("CENTER");
  });

  test("AR card position stays within viewport bounds", async ({ page }) => {
    await page.goto("/?cosmic-debug=1");

    // Wait for canvas and cosmic initialization
    const canvas = page.locator("[data-testid=cosmic-background] canvas");
    await canvas.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(
      () =>
        (window as any).__COSMIC_CAMERA_READY__ === true &&
        (window as any).__COSMIC_LAYER_READY__ === true,
      { timeout: 10000 }
    );

    // Click near top-right corner (should trigger clamping)
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const nearEdgeX = box!.x + box!.width - 10;
    const nearEdgeY = box!.y + 10;

    await page.mouse.click(nearEdgeX, nearEdgeY);

    // Wait for AR card to appear
    const arCard = page.locator("[data-testid=cosmic-ar-card]");
    await expect(arCard).toBeVisible({ timeout: 2000 });

    // Get card bounding box
    const cardBox = await arCard.boundingBox();
    expect(cardBox).toBeTruthy();

    // Assert card is fully within viewport (with 16px padding)
    const padding = 16;
    expect(cardBox!.x).toBeGreaterThanOrEqual(padding);
    expect(cardBox!.y).toBeGreaterThanOrEqual(padding);
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width - padding
    );
    expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height - padding
    );
  });
});
