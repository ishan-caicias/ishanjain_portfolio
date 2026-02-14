import { test, expect } from "@playwright/test";

test.describe("Cosmic background", () => {
  test("renders without console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");

    // Wait for canvas
    await page.waitForSelector("[data-testid=cosmic-background] canvas", {
      timeout: 10000,
    });

    // Wait for WebGL context to initialize (check for gl canvas)
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector("[data-testid=cosmic-background] canvas") as HTMLCanvasElement;
        return canvas && canvas.getContext("webgl2") !== null;
      },
      { timeout: 10000 }
    );

    // Small settle time for any async initialization
    await page.waitForTimeout(100);

    // Now check errors (cosmic scene is fully initialized)
    expect(errors.filter((e) => !e.includes("ResizeObserver"))).toEqual([]);
  });

  test("clicking interactive object dispatches event and sets __LAST_COSMIC_SELECT__", async ({
    page,
  }) => {
    await page.goto("/?cosmic-debug=1");
    const canvas = page.locator("[data-testid=cosmic-background] canvas");
    await canvas.waitFor({ state: "visible", timeout: 10000 });

    // Wait for cosmic initialization
    await page.waitForFunction(
      () =>
        (window as any).__COSMIC_CAMERA_READY__ === true &&
        (window as any).__COSMIC_LAYER_READY__ === true,
      { timeout: 10000 }
    );

    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    // Click the canvas center
    await page.mouse.click(centerX, centerY);

    // Wait for __LAST_COSMIC_SELECT__ to be set
    await page.waitForFunction(
      () => (window as any).__LAST_COSMIC_SELECT__ != null,
      { timeout: 2000 }
    );

    const detail = await page.evaluate(() => {
      return (window as any).__LAST_COSMIC_SELECT__;
    });

    // Verify details
    expect(detail).toBeDefined();
    expect(detail.id).toBe("cosmic-test-center");
    expect(detail.kind).toBe("star");
    expect(Array.isArray(detail.position)).toBe(true);
    expect(typeof detail.screen?.x).toBe("number");
    expect(typeof detail.timestamp).toBe("number");
  });
});
