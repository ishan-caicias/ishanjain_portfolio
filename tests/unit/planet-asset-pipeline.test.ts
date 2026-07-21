/**
 * PF-10 C4 CLOSEOUT — the planetary asset pipeline as a contract.
 *
 * These tests exist because of a specific, recorded process failure rather than a hypothetical
 * one. C4 shipped 12 of the source pack's bodies and skipped the rest by judgement that was never
 * written down; the pipeline scripts were not registered in package.json, so regenerating the
 * assets required reading a test report to find the command; and `budget:check` did not look at
 * `public/assets` at all while it grew to 209 MB.
 *
 * Each of those is now closed by something executable, and this file is what keeps them closed:
 *
 *   - the RECKONING is data in the pipeline (`PACK_RECKONING`), asserted to account for every
 *     source file, so a skipped texture is a recorded decision rather than an omission;
 *   - `NEVER_SPHERE` is duplicated across a .mjs build script and a .ts module, so parity is
 *     asserted here — the same twin discipline CLAUDE.md #4 applies to shaders;
 *   - the cubemap re-projection's GEOMETRY is pinned independently of any file on disk.
 *
 * What these tests deliberately do NOT do is read the 272 MB source pack: it is gitignored, so CI
 * has never seen it and never will. Everything here is either pure geometry or a check against the
 * pipeline's own declarations.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GENERATED_NAME,
  NEVER_SPHERE as MJS_NEVER_SPHERE,
  PACK_RECKONING,
  PASSTHROUGH_ASSETS,
  PLANET_SOURCES,
  TIERS,
  ULTRA_SOURCES,
  plannedFiles,
} from "../../scripts/build-planet-textures.mjs";
import {
  FACE_ORDER,
  directionToFace,
  equirectDirection,
} from "../../scripts/lib/cubemap-equirect.mjs";
import { NEVER_SPHERE } from "@/lib/planet-sphere";

describe("NEVER_SPHERE parity across the .mjs/.ts boundary", () => {
  it("the build script and the renderer block exactly the same bodies", () => {
    // The owner's standing rule (2026-07-21, on Astra's advice) is enforced in two places that
    // cannot import each other: a build script decides what gets a texture, and `sphereIdFor`
    // decides what gets a sphere. The pipeline is DATA-DRIVEN — a body becomes spherical the
    // moment the manifest contains it — so a divergence here would silently sphere a potato.
    expect([...MJS_NEVER_SPHERE].sort()).toEqual([...NEVER_SPHERE].sort());
    expect(NEVER_SPHERE.has("phobos")).toBe(true);
    expect(NEVER_SPHERE.has("deimos")).toBe(true);
  });

  it("no NEVER_SPHERE body is declared in the texture pipeline", () => {
    for (const body of PLANET_SOURCES)
      expect(NEVER_SPHERE.has(body.id)).toBe(false);
  });
});

describe("the reckoning — every skipped texture is a decision, not an omission", () => {
  it("records a non-trivial REASON for every skipped file, never a bare marker", () => {
    // The failure this guards is a future maintainer silencing the pipeline's coverage check by
    // adding `"base/whatever": "skip"`. A reason short enough to be meaningless is not a reason.
    //
    // A cross-reference ("see foo") IS a legitimate reason — several files are skipped for
    // identical cause and restating it would invite the two copies to drift. But it only counts
    // when it points at an entry that carries a substantive reason of its own, so the escape
    // hatch cannot be used to hide a decision behind a chain of pointers.
    const SUBSTANTIVE = 20;
    const entries = Object.entries(PACK_RECKONING);
    for (const [file, reason] of entries) {
      expect(typeof reason, file).toBe("string");
      if (reason.length > SUBSTANTIVE) continue;
      const ref = /^see (.+)$/.exec(reason.trim())?.[1];
      expect(ref, `${file} needs a real reason, not "${reason}"`).toBeTruthy();
      const target = entries.find(
        ([f, r]) => f.endsWith(ref!) && r.length > SUBSTANTIVE,
      );
      expect(
        target,
        `${file} defers to "${ref}", which must itself carry a substantive reason`,
      ).toBeDefined();
    }
  });

  it("keeps the irregular bodies excluded for the RIGHT reason", () => {
    // If Phobos ever leaves the reckoning it must be because it was shipped, which the parity
    // test above forbids — so this pins the pairing rather than just the presence.
    for (const id of ["phobos", "deimos"]) {
      const entries = Object.entries(PACK_RECKONING).filter(([f]) =>
        f.includes(id),
      );
      expect(entries.length, `${id} must be accounted for`).toBeGreaterThan(0);
      for (const [, reason] of entries)
        expect(reason).toContain("NEVER_SPHERE");
    }
  });

  it("does not silently drop the Planck CMB and Milky Way plates", () => {
    // These are real, usable data deliberately left out of C4's scope. Recording them is the
    // whole point of the reckoning: a deferral that is written down can be revisited, and one
    // that is not simply disappears.
    expect(PACK_RECKONING["skybox/cmwb-planck-high"]).toBeDefined();
    expect(PACK_RECKONING["skybox/milkyway-ultra"]).toBeDefined();
  });
});

describe("declared outputs", () => {
  it("gives an ultra tier only to bodies with a genuinely 8192-wide source", () => {
    // Upscaling a 4096 map to 8192 would cost the bytes and deliver no extra detail, which is
    // worse than not shipping the tier at all.
    for (const body of PLANET_SOURCES) {
      const { tierNames } = plannedFiles(body);
      expect(tierNames.includes("ultra"), body.id).toBe(
        ULTRA_SOURCES.has(body.id),
      );
    }
  });

  it("keeps every tier at the 2:1 aspect an equirectangular map requires", () => {
    // A non-2:1 resize does not crop, it SHEARS — every feature slides against its own UV grid.
    for (const tier of Object.values(TIERS))
      expect(tier.width % 2, JSON.stringify(tier)).toBe(0);
  });

  it("never declares both a height map and a normal map for one body", () => {
    // Mutual exclusivity is a real property of the source pack, and the shader depends on it:
    // it gates the two against each other with a single uniform and has no precedence rule.
    for (const body of PLANET_SOURCES)
      expect(
        Boolean(body.height) && Boolean(body.normal),
        `${body.id} declares both`,
      ).toBe(false);
  });

  it("ships the three bodies the first pass skipped outright", () => {
    // dione, rhea and tethys have real surface AND real normal maps in the pack. Nothing ruled
    // them out — they were simply not in the list, which is the omission this whole file exists
    // to prevent recurring.
    for (const id of ["dione", "rhea", "tethys"]) {
      const body = PLANET_SOURCES.find((b) => b.id === id);
      expect(body, `${id} must be in the pipeline`).toBeDefined();
      expect(body!.normal, `${id} ships real relief`).toBeTruthy();
    }
  });

  it("ships Earth from the CUBEMAP, which the base-directory glob never saw", () => {
    // The record said "Earth has height-but-no-surface". The surface exists; the search did not
    // look in tex/cubemap/. Pinned so a future refactor cannot quietly drop it back to nothing.
    const earth = PLANET_SOURCES.find((b) => b.id === "earth");
    expect(earth).toBeDefined();
    expect(earth!.cubemap).toContain("earth-day-ultra");
    expect(earth!.cloud).toBeTruthy();
    expect(earth!.specular).toBeTruthy();
  });

  it("does NOT ship Earth's night lights, and records why", () => {
    // Astra's broken-physics #1. The arrival phase angle is exactly zero for every body, so the
    // night hemisphere is 100% occluded and no exposure or mask can put a city light on screen —
    // the map is real data but the VIEW would be invented, which is precisely the Venus failure
    // mode. This is the highest-value assertion in the file: the map is the most beautiful asset
    // in the pack and the pressure to ship it will recur.
    const earth = PLANET_SOURCES.find((b) => b.id === "earth")!;
    expect(
      "night" in earth,
      "night lights must not be in the pipeline — see PACK_RECKONING",
    ).toBe(false);
    const reason = PACK_RECKONING["cubemap/earth-night-ultra"];
    expect(reason).toBeDefined();
    expect(reason).toContain("BROKEN PHYSICS");
  });
});

describe("every asset the celestial catalogs reference actually exists", () => {
  // THE TEST THAT WOULD HAVE CAUGHT IT IN SECONDS. This pipeline's first orphan-pruner deleted
  // all 18 per-body dossier images the catalogs reference (`mars.jpg`, `moon-topo.jpg`, ...)
  // plus `venus-cloud.jpg`, because they live in the same directory as its own output and it
  // treated "unexpected" as "mine to delete". Nothing failed at build or typecheck; it surfaced
  // only as a 404 in a real-browser E2E, and only because that spec asserts console-cleanliness.
  //
  // The catalogs are the authority on what must exist, so ask them rather than maintaining a
  // second list that could drift.
  const catalogDir = resolve(process.cwd(), "src/data/celestial");
  const referenced = new Set<string>();
  for (const f of readdirSync(catalogDir)) {
    if (!f.endsWith(".js")) continue;
    const src = readFileSync(resolve(catalogDir, f), "utf8");
    for (const m of src.matchAll(/assets\/(planets\/[A-Za-z0-9_-]+\.jpg)/g))
      referenced.add(m[1]);
  }

  it("finds catalog image references to check (the regex has not rotted)", () => {
    expect(referenced.size).toBeGreaterThanOrEqual(18);
  });

  it("has every referenced image on disk", () => {
    const missing = [...referenced].filter(
      (p) => !existsSync(resolve(process.cwd(), "public/assets", p)),
    );
    expect(missing, `missing shipped assets: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("keeps venus-cloud.jpg, which the descent fetches by a hardcoded path", () => {
    // Not catalog-referenced — venus-descent.ts requests it directly, so the loop above cannot
    // see it. It is the file that was actually destroyed, so it gets its own assertion.
    expect(
      existsSync(
        resolve(process.cwd(), "public/assets/planets/venus-cloud.jpg"),
      ),
    ).toBe(true);
  });
});

describe("a sphered body must be REACHABLE, not merely textured", () => {
  /* Found by live validation against a real preview server, not by any test: four of the sixteen
   * bodies this pipeline builds textures for have no entry in the celestial catalog, so a visitor
   * can never travel to them and their assets can never render. 28.35 MB of them.
   *
   * The mistake is the session's own recurring one, one level up: "the source pack has imagery for
   * this body" is not the same claim as "this body exists in the scene". `sphereIdFor` correctly
   * spheres whatever the manifest contains — but the CATALOG decides where a visitor can go, and
   * nothing connected the two.
   *
   * The allowlist below is deliberately explicit rather than a soft warning: the deviation is
   * recorded and cannot grow silently, and removing a name from it requires either adding the
   * catalog entry or dropping the assets. */
  const UNREACHABLE_BY_DESIGN: Record<string, string> = {
    // Tethys, Dione and Rhea left this list on 2026-07-22 — they are real catalog entries now
    // (celestial-saturn-moons.js). Earth stays, and its reason CHANGED from "not yet done" to
    // "must not be done":
    //
    // ASTRA (2026-07-22 addendum): entering Earth is BROKEN PHYSICS, not merely awkward. The
    // catalog frame is GEOCENTRIC — verified from the data rather than from comments: every
    // ra/dec is J2000 apparent place, the Sun is itself a body at ra 250 / dec -20.5, and the
    // Moon and the minor planets carry real geocentric distances. In that frame Earth's direction
    // is 0/0 and its distance is 0 — not hard to measure, NON-EXISTENT. The engine agrees three
    // independent ways: bodyDepth(0) would put it deeper than Neptune (the `ly || 0.001`
    // fallback), sunDirectionFrom(origin) returns its own documented "arbitrary but stable"
    // fallback, and goHome already owns [0,0,0]. The simplest reason is the deepest: every RA/Dec
    // in this catalog is measured FROM Earth, so entering Earth makes the ruler one of the
    // measured things.
    earth:
      "MUST NOT be a catalog entry — the frame is geocentric, so Earth's direction is 0/0 and " +
      "its distance is 0. Its sphere belongs to goHome at the origin, where the arrival " +
      "phase-angle lock does not apply. See the Earth sphere brief, ADDENDUM 2.",
  };

  const catalogIds = (() => {
    const dir = resolve(process.cwd(), "src/data/celestial");
    const ids = new Set<string>();
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".js")) continue;
      const src = readFileSync(resolve(dir, f), "utf8");
      for (const m of src.matchAll(/["']?id["']?:\s*["']([a-z0-9-]+)["']/g))
        ids.add(m[1]);
    }
    return ids;
  })();

  it("reads a plausible number of catalog ids (the regex has not rotted)", () => {
    expect(catalogIds.size).toBeGreaterThan(100);
    expect(catalogIds.has("mars")).toBe(true);
  });

  it("every sphered body is either reachable or explicitly recorded as not", () => {
    const unreachable = PLANET_SOURCES.map((b) => b.id).filter(
      (id) => !catalogIds.has(id),
    );
    const undocumented = unreachable.filter((id) => !UNREACHABLE_BY_DESIGN[id]);
    expect(
      undocumented,
      `these bodies ship textures but cannot be travelled to, and are not recorded: ` +
        `${undocumented.join(", ")}. Add a catalog entry or drop the assets.`,
    ).toEqual([]);
  });

  it("does not carry a stale allowlist entry once a body becomes reachable", () => {
    // The allowlist is a deviation record, not a permanent exemption — if a catalog entry
    // lands, this forces the record to be cleaned up in the same change.
    for (const id of Object.keys(UNREACHABLE_BY_DESIGN))
      expect(
        catalogIds.has(id),
        `${id} is now in the catalog — remove it from UNREACHABLE_BY_DESIGN`,
      ).toBe(false);
  });
});

describe("the pipeline never deletes", () => {
  // REGRESSION, and an expensive one. The first version of this pipeline's orphan-pruner removed
  // every unexpected .jpg in the output directory, which silently destroyed 19 real shipped
  // assets — the 18 catalog dossier images and venus-cloud.jpg, the latter untracked by git and
  // therefore unrecoverable from it. The real-GPU E2E caught it as a 404 on the next run.
  //
  // The deletion was then narrowed to files matching GENERATED_NAME, which would have been safe,
  // and finally REMOVED ENTIRELY on the owner's call (2026-07-21) for a better reason than
  // safety: the approved design said "no orphans — fails loud on drift", and "fails loud" is a
  // report, not an rm. The destructive step was never requested.
  it("has no delete capability in its source at all", () => {
    const src = readFileSync(
      resolve(process.cwd(), "scripts/build-planet-textures.mjs"),
      "utf8",
    );
    // The strongest form of this assertion: not "deletes carefully" but "cannot delete".
    for (const call of ["rmSync", "unlinkSync", "rmdirSync", "rm("])
      expect(src.includes(call), `${call} must not appear`).toBe(false);
  });

  it("recognises only <body>-<map>-<tier>.jpg as its own output", () => {
    for (const name of [
      "mars-surface-ultra.jpg",
      "earth-cloud-high.jpg",
      "tethys-normal-base.jpg",
    ])
      expect(GENERATED_NAME.test(name), name).toBe(true);

    // The one that was destroyed, plus other shapes a human might legitimately place here.
    for (const name of [
      "venus-cloud.jpg",
      "manifest.json",
      "some-hand-made-overlay.jpg",
      "mars-surface.jpg",
      "mars-surface-mega.jpg",
    ])
      expect(GENERATED_NAME.test(name), name).toBe(false);
  });

  it("declares venus-cloud.jpg as a passthrough asset so it is protected AND reproducible", () => {
    const venus = PASSTHROUGH_ASSETS.find((a) => a.out === "venus-cloud.jpg");
    expect(venus, "venus-cloud.jpg must be declared").toBeDefined();
    // It comes from a DIFFERENT source pack than the reckoning enumerates, which is exactly why
    // nothing had ever accounted for it.
    expect(venus!.src).toContain("default-data");
    expect(venus!.src).not.toContain("hi-res-textures");
    expect(venus!.note.length).toBeGreaterThan(20);
  });
});

describe("cubemap -> equirect geometry (pure, no files touched)", () => {
  it("orders the faces +X -X +Y -Y +Z -Z", () => {
    expect(FACE_ORDER).toEqual(["rt", "lf", "up", "dn", "ft", "bk"]);
  });

  it("maps the equirect corners and centre to the directions they must have", () => {
    // v = 0 is the north pole and v = 1 the south — the mapping Babylon's sphere UVs produce.
    const [, topY] = equirectDirection(0.5, 0.0);
    const [, botY] = equirectDirection(0.5, 1.0);
    expect(topY).toBeCloseTo(1, 6);
    expect(botY).toBeCloseTo(-1, 6);
    // u = 0.5 is longitude 0, looking down +Z.
    const [x, y, z] = equirectDirection(0.5, 0.5);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(1, 6);
  });

  it("sends each axis to its own face, at that face's centre", () => {
    const cases: [number[], number][] = [
      [[1, 0, 0], 0],
      [[-1, 0, 0], 1],
      [[0, 1, 0], 2],
      [[0, -1, 0], 3],
      [[0, 0, 1], 4],
      [[0, 0, -1], 5],
    ];
    for (const [dir, face] of cases) {
      const hit = directionToFace(dir);
      expect(hit.face, dir.join(",")).toBe(face);
      // An axis direction hits the exact centre of its face; anything else means the
      // per-face axis assignment is rotated.
      expect(hit.s).toBeCloseTo(0.5, 6);
      expect(hit.t).toBeCloseTo(0.5, 6);
    }
  });

  it("keeps every sample inside its face, over the whole sphere", () => {
    // The real failure mode of a wrong major-axis test is an s or t just outside [0,1], which
    // clamps to a face edge and smears one row of texels around a whole meridian.
    for (let i = 0; i < 64; i++)
      for (let j = 0; j < 32; j++) {
        const hit = directionToFace(
          equirectDirection((i + 0.5) / 64, (j + 0.5) / 32),
        );
        expect(hit.s).toBeGreaterThanOrEqual(0);
        expect(hit.s).toBeLessThanOrEqual(1);
        expect(hit.t).toBeGreaterThanOrEqual(0);
        expect(hit.t).toBeLessThanOrEqual(1);
        expect(Number.isFinite(hit.s) && Number.isFinite(hit.t)).toBe(true);
      }
  });

  it("is continuous across a face boundary", () => {
    // Two directions a hair apart either side of the +Z/+X seam must land a hair apart on their
    // respective faces — a mirrored face shows up here as a jump from ~1 to ~0.
    const eps = 1e-4;
    const a = directionToFace([Math.SQRT1_2 - eps, 0, Math.SQRT1_2 + eps]);
    const b = directionToFace([Math.SQRT1_2 + eps, 0, Math.SQRT1_2 - eps]);
    expect(a.face).toBe(4);
    expect(b.face).toBe(0);
    // Leaving +Z at its right edge must enter +X at its left edge.
    expect(a.s).toBeGreaterThan(0.99);
    expect(b.s).toBeLessThan(0.01);
  });
});
