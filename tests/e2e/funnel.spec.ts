/**
 * PF-11 D1.4 — first-party funnel instrumentation (`?funnel=1`, UX research plan §3).
 *
 * The recorder always runs (same convention as `window.__ijPerf()` — E2E tests the
 * programmatic surface, not the visible overlay's DOM, per this repo's established pattern
 * for debug hatches); only the visible overlay is gated behind the URL param / stored
 * override. These specs drive milestones through the real UI (CLAUDE.md #18), never by
 * calling funnel.ts directly.
 */
import { expect, test, type Page } from "@playwright/test";
import type { FunnelSession } from "@/lib/funnel";

const readFunnel = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __ijFunnel?: () => FunnelSession }).__ijFunnel?.(),
  );

test.describe("PF-11 D1.4 funnel instrumentation", () => {
  test("?funnel=1 renders the overlay; without the param it stays absent", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");
    await expect(page.locator("#ij-funnel")).toHaveCount(0);

    await page.goto("/?funnel=1");
    await page.waitForSelector("babylon-scene");
    await expect(page.getByText("FUNNEL · DIAGNOSTICS")).toBeVisible({
      timeout: 5000,
    });
  });

  test("recording always runs regardless of the overlay flag — window.__ijFunnel() is populated with no ?funnel param", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");
    await expect(page.locator("#ij-funnel")).toHaveCount(0); // overlay stays off

    await page.getByRole("button", { name: "SKIP INTRO" }).click();

    await expect
      .poll(async () => (await readFunnel(page))?.events.map((e) => e.event))
      .toContain("launch-pressed");
  });

  test("?funnel=0 explicitly overrides a previously-stored on preference", async ({
    page,
  }) => {
    await page.goto("/?funnel=1");
    await page.waitForSelector("babylon-scene");
    await expect(page.getByText("FUNNEL · DIAGNOSTICS")).toBeVisible({
      timeout: 5000,
    });

    // Plain reload, no param: the stored override from the previous load keeps it on
    // (URL → stored → default resolution order, same as ?engine=).
    await page.goto("/");
    await page.waitForSelector("babylon-scene");
    await expect(page.getByText("FUNNEL · DIAGNOSTICS")).toBeVisible({
      timeout: 5000,
    });

    // An explicit ?funnel=0 wins over that stored preference.
    await page.goto("/?funnel=0");
    await page.waitForSelector("babylon-scene");
    await expect(page.locator("#ij-funnel")).toHaveCount(0);
  });

  test("the real PreFlight gate records dossier-visible, launch-armed, and launch-pressed in order", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await page.waitForSelector("babylon-scene");

    const launchButton = page.getByRole("button", { name: "LAUNCH ▸" });
    await expect(launchButton).toBeEnabled({ timeout: 30000 });
    await launchButton.click();

    const events = (await readFunnel(page))?.events ?? [];
    const order = events.map((e) => e.event);
    const iArmed = order.indexOf("launch-armed");
    const iPressed = order.indexOf("launch-pressed");
    expect(order).toContain("dossier-visible");
    expect(iArmed).toBeGreaterThanOrEqual(0);
    expect(iPressed).toBeGreaterThan(iArmed);
  });

  test("RNG travel records a travel/arrival pair, and dismissing the vista via OPEN COLLECTOR CARD records vista-dismissed", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/?engine=babylon");
    await page.waitForSelector("babylon-scene", { timeout: 15000 });

    const readStats = () =>
      page
        .locator("babylon-scene")
        .evaluate((el) =>
          (
            el as HTMLElement & { sceneStats(): Record<string, unknown> }
          ).sceneStats(),
        );
    await expect
      .poll(async () => (await readStats()).starSource, { timeout: 20000 })
      .toBe("catalog");

    await page.getByRole("button", { name: "SKIP INTRO" }).click();
    // PF-11 D5.1 (ADR-0010) named test change: RNG → RANDOM JUMP ▸ (aria-label "Jump to a
    // random destination").
    await page
      .getByRole("button", { name: "Jump to a random destination" })
      .click();

    // Click OPEN COLLECTOR CARD the moment it appears — the vista's own 5.5s auto-timeout
    // (today's ONLY other dismissal path, pending D4.1) is a real race here: waiting on
    // separate polls for "travel"/"arrival" first left enough wall-clock for the timeout to
    // dismiss the vista before this click ever landed, recording "timeout" instead of the
    // path under test.
    const openCard = page.getByRole("button", {
      name: "OPEN COLLECTOR CARD ▸",
    });
    await expect(openCard).toBeVisible({ timeout: 15000 });
    // A pre-existing z-index overlap this test is the first to exercise: #ij-mission-bar
    // (z-62) visually overlaps ArrivalVista's button row (z-61) at the bottom of the
    // viewport, so a real coordinate-based click here — even with force: true, which only
    // skips Playwright's OWN actionability check, not the browser's real hit-testing — lands
    // on the WHERE-TO input instead of this button. Dispatching the click directly on the
    // element sidesteps the coordinate hit-test and still exercises the real onClick handler.
    // Out of scope for D1.4 (belongs to D4.1's vista-dismissal work, which replaces this
    // whole interaction); flagged in the slice TR rather than silently worked around.
    await openCard.evaluate((el) => (el as HTMLElement).click());

    const events = (await readFunnel(page))?.events ?? [];
    expect(events.map((e) => e.event)).toEqual(
      expect.arrayContaining(["travel", "arrival"]),
    );
    const dismissed = events.find(
      (e) => e.event === "vista-dismissed" && e.meta?.via === "open-card",
    );
    expect(dismissed).toBeDefined();
  });

  test("search: a keystroke records the query and result count; Enter records search-travel", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector("babylon-scene");
    await page.getByRole("button", { name: "SKIP INTRO" }).click();

    const input = page.getByLabel("Mission control: type a destination");
    await input.fill("mars");

    await expect
      .poll(async () => {
        const events = (await readFunnel(page))?.events ?? [];
        return events.find((e) => e.event === "search-keystroke")?.meta?.query;
      })
      .toBe("mars");

    await page.keyboard.press("Enter");

    await expect
      .poll(async () => (await readFunnel(page))?.events.map((e) => e.event))
      .toContain("search-travel");
  });

  test("COPY DIAGNOSTICS writes a valid JSON blob (funnel timeline + perf snapshot) to the clipboard", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/?funnel=1");
    await page.waitForSelector("babylon-scene");
    await page.getByRole("button", { name: "SKIP INTRO" }).click();

    await page.getByRole("button", { name: "COPY DIAGNOSTICS" }).click();
    await expect(page.getByText("COPIED ✓")).toBeVisible({ timeout: 3000 });

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    const blob = JSON.parse(clip) as {
      funnel: FunnelSession;
      perf: { engine: string } | null;
    };
    expect(blob.funnel.events.length).toBeGreaterThan(0);
    expect(blob.perf?.engine).toBeTruthy();
  });
});
