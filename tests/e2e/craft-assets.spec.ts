/**
 * PF-07 ship-v2 P0 — E2E: craft runtime GLBs are actually served by the site.
 *
 * Guards against the assets being dropped from the build output (Astro copies
 * public/ into dist/). Skips binary content checks when the server is serving
 * LFS pointer stubs (CI checks out without materialized LFS, matching how the
 * existing image assets behave there).
 */
import { expect, test } from "@playwright/test";

const MiB = 1024 * 1024;
const TIERS = [
  { name: "1k", budgetBytes: 0.6 * MiB },
  { name: "2k", budgetBytes: 1.2 * MiB },
];

const LFS_POINTER_PREFIX = "version https://git-lfs.github.com/spec/v1";

for (const tier of TIERS) {
  test(`serves /assets/craft/sci-fi-fighter-${tier.name}.glb`, async ({
    request,
  }) => {
    const response = await request.get(
      `/assets/craft/sci-fi-fighter-${tier.name}.glb`,
    );
    expect(response.status()).toBe(200);

    const body = await response.body();
    test.skip(
      body
        .subarray(0, LFS_POINTER_PREFIX.length)
        .toString("utf8")
        .startsWith(LFS_POINTER_PREFIX),
      "LFS content not materialized on this checkout — binary checks skipped",
    );

    expect(body.subarray(0, 4).toString("ascii")).toBe("glTF");
    expect(body.length).toBeLessThanOrEqual(tier.budgetBytes);
  });
}

test("serves the CC-BY-4.0 attribution alongside the assets", async ({
  request,
}) => {
  const response = await request.get("/assets/craft/LICENSE.txt");
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain("valterjherson1");
});
