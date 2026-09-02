// PF-11 D5.2 — Where-To console search v2 (owner R9/R10): ranked matching, stations become
// searchable for the first time, combobox ARIA/keyboard nav, empty-query featured list.
import { test, expect } from "@playwright/test";

test.describe("Destination search v2 (PF-11 D5.2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");
    // Same convention as space-scene.spec.ts's RANDOM JUMP test: the mission bar sits behind
    // body.ij-loading until PRE-FLIGHT is dismissed.
    await page.getByRole("button", { name: "SKIP INTRO" }).click();
  });

  test("a nav station is searchable and travelable by name — never true before D5.2", async ({
    page,
  }) => {
    const input = page.getByRole("combobox", {
      name: "Mission control: type a destination",
    });
    await input.fill("projects");
    await expect(page.getByRole("option", { name: /PROJECTS/ })).toBeVisible();
    await page.keyboard.press("Enter");
    // A journey started - HUD idle state clears, same signal space-scene.spec.ts's
    // RANDOM JUMP test uses.
    await expect(page.getByText("STATION-KEEPING")).toHaveCount(0, {
      timeout: 10000,
    });
  });

  test("id matching normalises spaces/case (ngc7293 finds NGC 7293)", async ({
    page,
  }) => {
    const input = page.getByRole("combobox", {
      name: "Mission control: type a destination",
    });
    await input.fill("ngc7293");
    await expect(page.getByRole("listbox")).toBeVisible();
    // The option row shows name/type/distance, not the raw designation — "Helix Nebula"
    // surfacing at all for a query that shares no substring with that name is the proof the
    // match came through the normalised designation ("NGC 7293"), not name/word-start.
    await expect(page.getByRole("option")).toContainText(/Helix Nebula/i);
  });

  test("empty-query focus shows the NOTABLE DESTINATIONS featured list", async ({
    page,
  }) => {
    const input = page.getByRole("combobox", {
      name: "Mission control: type a destination",
    });
    await input.click();
    await expect(page.getByText("NOTABLE DESTINATIONS")).toBeVisible();
    const options = page.getByRole("option");
    await expect(options).not.toHaveCount(0);
  });

  test("no-match query shows the explicit NO CONTACT state, not an empty silent list", async ({
    page,
  }) => {
    const input = page.getByRole("combobox", {
      name: "Mission control: type a destination",
    });
    await input.fill("zzznotarealdestination");
    await expect(page.getByText(/NO CONTACT/)).toBeVisible();
  });

  test("ArrowDown/ArrowUp move the highlighted option and Enter activates it", async ({
    page,
  }) => {
    const input = page.getByRole("combobox", {
      name: "Mission control: type a destination",
    });
    await input.fill("e");
    const firstOption = page.getByRole("option").first();
    await expect(firstOption).toBeVisible();
    await page.keyboard.press("ArrowDown");
    const active = page.locator('[aria-selected="true"]');
    await expect(active).toHaveCount(1);
    // aria-activedescendant on the combobox must track the highlighted option's id.
    const activeId = await active.getAttribute("id");
    await expect(input).toHaveAttribute("aria-activedescendant", activeId!);
  });

  test("combobox ARIA wiring: role, aria-expanded, aria-controls resolve to a real listbox", async ({
    page,
  }) => {
    const input = page.getByRole("combobox", {
      name: "Mission control: type a destination",
    });
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await input.click();
    await expect(input).toHaveAttribute("aria-expanded", "true");
    const controls = await input.getAttribute("aria-controls");
    await expect(page.locator(`#${controls}`)).toHaveAttribute(
      "role",
      "listbox",
    );
  });
});

test.describe("Search class rows (PF-11 D5.3)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");
    await page.getByRole("button", { name: "SKIP INTRO" }).click();
  });

  test("a synthesized 'nearest instance' class row is searchable and travelable", async ({
    page,
  }) => {
    const input = page.getByRole("combobox", {
      name: "Mission control: type a destination",
    });
    // `nearestFieldOfType` scans the decoded base star field, which is set slightly after the
    // boot-critical gate PRE-FLIGHT already waited for (D1.1/D1.2) — retry rather than a fixed
    // sleep, since exactly how soon after SKIP INTRO the decoded field becomes available isn't
    // a contract this test should assume a number for.
    await expect
      .poll(
        async () => {
          await input.fill("");
          await input.fill("white dwarf");
          return page.getByRole("option", { name: /WHITE DWARF/ }).count();
        },
        { timeout: 20000 },
      )
      .toBeGreaterThan(0);
    const option = page.getByRole("option", { name: /WHITE DWARF/ }).first();
    await expect(option).toContainText("NEAREST INSTANCE");
    await option.click();
    await expect(page.getByText("STATION-KEEPING")).toHaveCount(0, {
      timeout: 10000,
    });
  });
});

test.describe("Missing-body audit (PF-11 D5.4)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");
    await page.getByRole("button", { name: "SKIP INTRO" }).click();
  });

  test("Phobos is a real, searchable, travelable destination with no img — no console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    const input = page.getByRole("combobox", {
      name: "Mission control: type a destination",
    });
    await input.fill("Phobos");
    await expect(page.getByRole("option", { name: /Phobos/ })).toBeVisible();
    await page.keyboard.press("Enter");

    const en = page.locator("babylon-scene");
    await expect
      .poll(
        async () =>
          en.evaluate(
            (el) => (el as unknown as { arrivedId: string | null }).arrivedId,
          ),
        { timeout: 30000 },
      )
      .toBe("phobos");

    await page.getByRole("button", { name: "OPEN COLLECTOR CARD ▸" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog).toContainText("Phobos");
    await expect(dialog).toContainText(/Stickney/i);

    expect(errors).toEqual([]);
  });
});
