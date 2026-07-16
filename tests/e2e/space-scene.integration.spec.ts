import { expect, test } from "@playwright/test";

const enabled = process.env.PUBLIC_SPACE_SCENE === "true";

test.describe("accessible constellation travel", () => {
  test.beforeEach(() => {
    test.skip(!enabled, "Run with PUBLIC_SPACE_SCENE=true.");
  });

  test("supports reduced-motion station travel and keeps credits reachable", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const station = page.getByRole("button", {
      name: "Travel to Projects station",
    });
    await expect(page.getByTestId("space-scene")).toHaveAttribute(
      "data-reduced-motion",
      "true",
    );
    await expect(station).toBeEnabled();
    await station.press("Enter");

    await expect(page.getByTestId("space-travel-status")).toHaveText(
      "Arrived at Projects.",
    );
    await expect(page.locator("#space-credits summary")).toHaveText(
      "Space credits",
    );
  });

  test("keeps semantic stations when WebGL is unavailable", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const canvasPrototype = HTMLCanvasElement.prototype as unknown as {
        getContext: (
          contextId: string,
          ...args: unknown[]
        ) => RenderingContext | null;
      };
      const originalGetContext = canvasPrototype.getContext;
      canvasPrototype.getContext = function getContext(
        contextId: string,
        ...args: unknown[]
      ) {
        if (contextId === "webgl" || contextId === "experimental-webgl") {
          return null;
        }
        return originalGetContext.call(this, contextId, ...args);
      };
    });
    await page.goto("/");

    await expect(page.getByTestId("space-scene-fallback")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Travel to Contact station" }),
    ).toBeVisible();
    await expect(page.getByTestId("starfield")).toHaveCount(0);
  });
});
