import { test, expect } from "@playwright/test";

test.describe("Spaceship orchestrator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?ship-debug=1");
  });

  test("ship state transitions idle -> opening -> open when clicking debug Projects", async ({
    page,
  }) => {
    const shipState = page.getByTestId("ship-state");
    const debugUI = page.getByTestId("ship-debug-ui");

    await expect(debugUI).toBeVisible();
    await expect(shipState).toHaveText("idle");

    await page.getByTestId("debug-section-projects").click();

    await expect(shipState).toHaveText("opening", { timeout: 500 });
    await expect(shipState).toHaveText("open", { timeout: 3000 });
  });

  test("closeSection resets ship state", async ({ page }) => {
    const shipState = page.getByTestId("ship-state");
    await page.getByTestId("ship-debug-ui").waitFor({ state: "visible" });

    await page.getByTestId("debug-section-projects").click();
    await expect(shipState).toHaveText("open", { timeout: 3000 });

    await page.getByTestId("debug-close").click();
    await expect(shipState).toHaveText("closing", { timeout: 500 });
    await expect(shipState).toHaveText("idle", { timeout: 3000 });
  });

  test("no console errors on page load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/?ship-debug=1");
    await page.getByTestId("ship-debug-ui").waitFor({ state: "visible" }).catch(() => {});
    expect(errors).toEqual([]);
  });

  test("doors-mounted is absent on normal load (no ship-debug)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("doors-mounted")).not.toBeAttached();
  });
});
