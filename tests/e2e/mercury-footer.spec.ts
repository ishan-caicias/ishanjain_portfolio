import { test, expect } from "@playwright/test";

test.describe("Mercury surface footer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Mission Control section is below the fold initially", async ({
    page,
  }) => {
    const section = page.getByTestId("mission-control-section");
    await expect(section).toBeAttached();
    const viewportSize = page.viewportSize();
    expect(viewportSize).toBeTruthy();
    const box = await section.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y).toBeGreaterThan(viewportSize!.height * 0.8);
  });

  test("Mission Control becomes visible after scrolling down", async ({
    page,
  }) => {
    const section = page.getByTestId("mission-control-section");
    await expect(section).toBeAttached();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(section).toBeVisible();
    const heading = page.getByRole("heading", { name: "Mission Control" });
    await expect(heading).toBeVisible();
  });

  test("footer exists and is below Mission Control in document flow", async ({
    page,
  }) => {
    const footer = page.getByTestId("site-footer");
    await expect(footer).toBeAttached();
    const mercury = page.getByTestId("mercury-footer");
    await expect(mercury).toBeAttached();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const section = page.getByTestId("mission-control-section");
    const sectionBox = await section.boundingBox();
    const footerBox = await footer.boundingBox();
    const mercuryBox = await mercury.boundingBox();
    expect(sectionBox).toBeTruthy();
    expect(footerBox).toBeTruthy();
    expect(mercuryBox).toBeTruthy();
    expect(footerBox!.y).toBeGreaterThanOrEqual(sectionBox!.y + sectionBox!.height - 2);
    expect(mercuryBox!.y).toBeGreaterThanOrEqual(footerBox!.y);
  });

  test("Mercury footer is in document flow and has full width", async ({
    page,
  }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const mercury = page.getByTestId("mercury-footer");
    await expect(mercury).toBeVisible();
    const mercuryBox = await mercury.boundingBox();
    const viewportSize = page.viewportSize();
    expect(mercuryBox).toBeTruthy();
    expect(viewportSize).toBeTruthy();
    expect(Math.abs(mercuryBox!.width - viewportSize!.width)).toBeLessThanOrEqual(2);
  });
});
