import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page loads with correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/Ishan Jain/);
  });

  test("hero section is visible", async ({ page }) => {
    const hero = page.locator("#hero");
    await expect(hero).toBeVisible();
    await expect(hero).toContainText("Building reliable systems");
  });

  test("navigation links are visible on desktop", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav).toBeVisible();

    await expect(nav.getByText("About")).toBeVisible();
    await expect(nav.getByText("Experience")).toBeVisible();
    await expect(nav.getByText("Projects")).toBeVisible();
    await expect(nav.getByText("Skills")).toBeVisible();
    await expect(nav.getByText("Contact")).toBeVisible();
  });

  test("clicking nav link scrolls to section", async ({ page }) => {
    const experienceLink = page
      .getByRole("navigation")
      .getByText("Experience");
    await experienceLink.click();

    // Wait for smooth scroll
    await page.waitForTimeout(800);

    const experienceSection = page.locator("#experience");
    await expect(experienceSection).toBeInViewport();
  });

  test("skip link works", async ({ page }) => {
    // Tab to activate skip link
    await page.keyboard.press("Tab");
    const skipLink = page.getByText("Skip to main content");
    await expect(skipLink).toBeFocused();

    await skipLink.click();
    const main = page.locator("#main-content");
    await expect(main).toBeVisible();
  });

  test("all content sections render", async ({ page }) => {
    const sections = [
      "#about",
      "#experience",
      "#achievements",
      "#projects",
      "#skills",
      "#writing",
      "#contact",
    ];

    for (const section of sections) {
      const el = page.locator(section);
      await expect(el).toBeAttached();
    }
  });

  test("credibility cards render", async ({ page }) => {
    const aboutSection = page.locator("#about");
    await expect(aboutSection).toContainText(".NET Microservices");
    await expect(aboutSection).toContainText("AWS Cloud Infrastructure");
    await expect(aboutSection).toContainText("Production Ownership");
  });

  test("experience timeline renders", async ({ page }) => {
    const experienceSection = page.locator("#experience");
    await expect(experienceSection).toContainText("Software Engineer");
    await expect(experienceSection).toContainText("Fintech Risk Platform");
  });

  test("projects section renders Project Kubera", async ({ page }) => {
    const projectsSection = page.locator("#projects");
    await expect(projectsSection).toContainText("Project Kubera");
    await expect(projectsSection).toContainText("Clean Architecture");
  });
});
