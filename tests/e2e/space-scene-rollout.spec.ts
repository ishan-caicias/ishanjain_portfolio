import { expect, test } from "@playwright/test";

const spaceSceneEnabled = process.env.PUBLIC_SPACE_SCENE === "true";

test.describe("Space scene rollout", () => {
  test("keeps the proven starfield active while the space scene is disabled", async ({
    page,
  }) => {
    test.skip(
      spaceSceneEnabled,
      "This assertion covers only the rollback path.",
    );

    await page.goto("/");

    await expect(page.locator("#hero")).toHaveAttribute(
      "data-space-scene",
      "false",
    );
    await expect(page.locator("[data-testid='starfield']")).toBeVisible();
    await expect(page.locator("[data-testid='space-scene']")).toHaveCount(0);
  });

  test("uses the high asset when high quality is saved before navigation", async ({
    page,
  }) => {
    test.skip(
      !spaceSceneEnabled,
      "Run this assertion with PUBLIC_SPACE_SCENE=true.",
    );

    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await page.addInitScript(() => {
      window.localStorage.setItem("ship-quality-preference", "high");
    });

    await page.goto("/");

    await expect(page.locator("#hero")).toHaveAttribute(
      "data-space-scene",
      "true",
    );
    await expect(page.locator("[data-testid='space-scene']")).toBeVisible();
    await expect(page.locator("[data-testid='starfield']")).toBeVisible();
    await expect(page.locator("[data-testid='space-scene']")).toHaveAttribute(
      "data-ship-status",
      "ready",
    );
    await expect(page.locator("[data-testid='space-scene']")).toHaveAttribute(
      "data-ship-quality",
      "high",
    );
    expect(pageErrors).toEqual([]);
  });

  test("uses the low asset when data saver is saved before navigation", async ({
    page,
  }) => {
    test.skip(
      !spaceSceneEnabled,
      "Run this assertion with PUBLIC_SPACE_SCENE=true.",
    );

    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await page.addInitScript(() => {
      window.localStorage.setItem("ship-quality-preference", "data-saver");
    });

    await page.goto("/");

    await expect(page.locator("[data-testid='space-scene']")).toHaveAttribute(
      "data-ship-status",
      "ready",
    );
    await expect(page.locator("[data-testid='space-scene']")).toHaveAttribute(
      "data-ship-quality",
      "low",
    );
    expect(pageErrors).toEqual([]);
  });
});
