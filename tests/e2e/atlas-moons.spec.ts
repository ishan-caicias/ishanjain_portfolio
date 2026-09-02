// PF-11 D6.6 — atlas cells for Tethys/Dione/Rhea (D6.6a) + Jupiter moon rank-honest offsets
// (D6.6b). `isPhotoEligible` (celestial-bodies.ts) requires BOTH `img` AND an atlas-map entry;
// these three shipped `img` since TR-079 but had no atlas cell, so their flat photographic
// billboard silently fell back to a plain point at range. patch-atlas.mjs closes that.
import { test, expect } from "@playwright/test";

test.describe("Atlas moon cells + Jupiter moon ranks (PF-11 D6.6)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?engine=babylon");
    await page.waitForSelector("babylon-scene", { timeout: 15000 });
  });

  test("Tethys/Dione/Rhea are now counted as photo-eligible bodies", async ({
    page,
  }) => {
    const en = page.locator("babylon-scene");
    await expect
      .poll(
        async () =>
          en.evaluate(
            (el) =>
              (
                el as HTMLElement & {
                  sceneStats(): { photoBodyCount: number };
                }
              ).sceneStats().photoBodyCount,
          ),
        { timeout: 20000 },
      )
      // 267 pre-D6.6 (per the HUD's own "(267 PHOTO)" readout) + 3 new atlas cells.
      .toBe(270);
  });

  test("travelling to Tethys renders console-clean with the new atlas cell active", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    const en = page.locator("babylon-scene");
    await en.evaluate((el) =>
      (el as HTMLElement & { travelTo(id: string): void }).travelTo("tethys"),
    );
    await expect
      .poll(
        async () =>
          en.evaluate(
            (el) =>
              (el as HTMLElement & { arrivedId: string | null }).arrivedId,
          ),
        { timeout: 30000 },
      )
      .toBe("tethys");

    expect(errors).toEqual([]);
  });

  test("Io ranks closer to Jupiter than Europa (real orbital-radius order), Ganymede/Callisto unaffected", async ({
    page,
  }) => {
    const D2R = Math.PI / 180;
    const bodies = await page.evaluate(() => {
      const cat = (
        window as unknown as {
          CELESTIAL: { id: string; ra: number; dec: number }[];
        }
      ).CELESTIAL;
      const byId = new Map(cat.map((e) => [e.id, e]));
      return {
        jupiter: byId.get("jupiter"),
        io: byId.get("io"),
        europa: byId.get("europa"),
        ganymede: byId.get("ganymede"),
        callisto: byId.get("callisto"),
      };
    });
    const offset = (body: { ra: number; dec: number }) => {
      const cosDec = Math.cos(bodies.jupiter!.dec * D2R);
      const dRa = (body.ra - bodies.jupiter!.ra) * cosDec;
      const dDec = body.dec - bodies.jupiter!.dec;
      return Math.hypot(dRa, dDec);
    };
    const ioOffset = offset(bodies.io!);
    const europaOffset = offset(bodies.europa!);
    const ganymedeOffset = offset(bodies.ganymede!);
    const callistoOffset = offset(bodies.callisto!);
    expect(ioOffset).toBeLessThan(europaOffset);
    expect(europaOffset).toBeLessThan(ganymedeOffset);
    expect(ganymedeOffset).toBeLessThan(callistoOffset);
  });
});
