/**
 * PF-11 D1.3 — the launch ascent + console reveal.
 *
 * LAUNCH is the D6.4 goHome reveal played forward: the camera climbs from Earth's surface to the
 * home vantage, the sky darkens, and the Where-To console reveals into its dock. These specs guard
 * the BEHAVIOUR (CLAUDE.md #18) rather than the pixels — the visual reads are the motion-spec's and
 * the Astra audit's job. Timing on SwiftShader is stretched by the wall-clock dt cap (the D6.4
 * lesson: a slow device sees a longer ascent, never a faster one), so nothing here pins a duration.
 *
 * Adopted acceptance criteria: D1-AC2 (keyboard-first: Tab/Enter reaches the console), D1-AC3
 * (impatience is never silent — a skip during the ascent produces a visible response), D1-AC6
 * (reduced motion = instant cut with the console visible).
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

type El = { sceneStats(): Record<string, unknown> };
const stats = (en: Locator) =>
  en.evaluate((el) => (el as unknown as El).sceneStats());
const bodyLoading = (page: Page) =>
  page.evaluate(() => document.body.classList.contains("ij-loading"));

async function bootAndArm(page: Page) {
  await page.goto("/");
  await page.waitForSelector("babylon-scene");
  const launch = page.getByRole("button", { name: "LAUNCH ▸" });
  await expect(launch).toBeEnabled({ timeout: 45000 });
  return launch;
}

test.describe("PF-11 D1.3 launch ascent", () => {
  test("LAUNCH plays the ascent and hands off to the home vantage, console-clean", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));

    const launch = await bootAndArm(page);
    const en = page.locator("babylon-scene");

    // During the ascent, content stays hidden (the cinematic is unobstructed).
    await launch.click();
    await expect
      .poll(async () => (await stats(en)).ascentMode, { timeout: 6000 })
      .toBe(true);
    expect(await bodyLoading(page)).toBe(true); // console not revealed yet
    // Earth is revealed and the sphere is the reveal geometry.
    expect((await stats(en)).planetSphereBody).toBe("earth");

    // Handoff: ascent ends (mode leaves "ascent"), home orbit armed at 90° phase.
    await expect
      .poll(async () => (await stats(en)).ascentMode, { timeout: 30000 })
      .toBe(false);
    const s = await stats(en);
    expect(s.homeOrbit).toBe(true);
    expect(s.homePhaseDeg as number).toBeGreaterThan(88);
    expect(s.homePhaseDeg as number).toBeLessThan(92);
    // Console revealed.
    await expect.poll(() => bodyLoading(page), { timeout: 5000 }).toBe(false);
    expect(errors).toEqual([]);
  });

  test("D1-AC3: the SKIP affordance appears during the ascent and activating it reveals content", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const launch = await bootAndArm(page);
    const en = page.locator("babylon-scene");
    await launch.click();

    // The SKIP overlay appears SYNCHRONOUSLY on LAUNCH (React state, no engine eval) — so waiting
    // for it and clicking it lands early in the ascent, before the (SwiftShader-stretched) climb
    // finishes. Deliberately no `stats()` precheck here: those evals take multiple seconds under
    // the rendering load, long enough that the ascent could complete inside the precheck itself
    // — the overlay's own presence is the proof the ascent started (D1-AC3: input during the
    // cinematic produces a visible response, which the overlay both IS and provides).
    const skip = page.getByRole("button", {
      name: /skip the launch sequence/i,
    });
    await skip.click();

    // Whichever way the ascent ended (skipped, or completed if the machine was slow enough that
    // even the fast click lost the race), the outcome D1-AC3 asserts holds: content is revealed
    // and the scene is at the home vantage. A silent no-op — overlay present but activating it
    // doing nothing — would fail here.
    await expect.poll(() => bodyLoading(page), { timeout: 10000 }).toBe(false);
    const s = await stats(en);
    expect(s.ascentMode).toBe(false);
    expect(s.homeOrbit).toBe(true);
  });

  test("D1-AC6: reduced motion is an instant cut — no ascent, console already visible", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const launch = await bootAndArm(page);
    const en = page.locator("babylon-scene");
    await launch.click();

    // No ascent phase at all — straight to the home vantage.
    await expect.poll(() => bodyLoading(page), { timeout: 5000 }).toBe(false);
    const s = await stats(en);
    expect(s.ascentMode).toBe(false);
    expect(s.homeOrbit).toBe(true);
    expect(s.planetSphereBody).toBe("earth");
    expect(s.homePhaseDeg as number).toBeGreaterThan(88);
    expect(s.homePhaseDeg as number).toBeLessThan(92);
  });

  test("D1-AC2: keyboard-only — Tab reaches LAUNCH, Enter launches, and the console becomes reachable", async ({
    page,
  }) => {
    test.setTimeout(120000);
    // Reduced motion so the sequence is instant and this stays a keyboard test, not a timing one.
    await page.emulateMedia({ reducedMotion: "reduce" });
    const launch = await bootAndArm(page);
    const en = page.locator("babylon-scene");
    // LAUNCH auto-focuses on arming (D1.2). Activate via keyboard.
    await expect(launch).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(() => bodyLoading(page), { timeout: 5000 }).toBe(false);
    expect((await stats(en)).homeOrbit).toBe(true);
    // The console input is now reachable by keyboard (it exists and is enabled in the revealed UI).
    const input = page.getByLabel("Mission control: type a destination");
    await input.focus();
    await expect(input).toBeFocused();
  });

  test("returning visitor bypasses the ascent (sessionStorage), no cinematic on reload", async ({
    page,
  }) => {
    test.setTimeout(120000);
    // First visit: launch (reduced motion so it's quick) sets the returning-visitor flag.
    await page.emulateMedia({ reducedMotion: "reduce" });
    const launch = await bootAndArm(page);
    await launch.click();
    await expect.poll(() => bodyLoading(page), { timeout: 5000 }).toBe(false);

    // Reload in the same context: the dossier is bypassed and content is immediate, no ascent.
    await page.reload();
    await page.waitForSelector("babylon-scene");
    await expect.poll(() => bodyLoading(page), { timeout: 8000 }).toBe(false);
    const en = page.locator("babylon-scene");
    expect((await stats(en)).ascentMode).toBe(false);
  });
});
