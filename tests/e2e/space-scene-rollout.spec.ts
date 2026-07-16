import { expect, test } from "@playwright/test";

const spaceSceneEnabled = process.env.PUBLIC_SPACE_SCENE !== "false";

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
});
