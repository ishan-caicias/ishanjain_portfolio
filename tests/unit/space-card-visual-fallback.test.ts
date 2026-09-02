/**
 * PF-11 defect P1 — class-aware collector-card / arrival-vista visual fallback.
 *
 * Before this fix, `resolveCardVisual`'s two call sites (CollectorCard.tsx, ArrivalVista.tsx)
 * computed their fallback purely from `!!img`/`!!fig`, so a photo-less galaxy/nebula/cluster/
 * black hole rendered the same procedural sun-texture "star" glow under a false "SPECTRAL
 * RENDER" caption. This drives `resolveCardVisual` directly (a pure function, no DOM needed) so
 * the branch logic is asserted independent of either component's JSX — CLAUDE.md #18 ("assert
 * behaviour, not readiness") read at the unit level: the OUTPUT DECISION is the behaviour here.
 */
import { describe, expect, it } from "vitest";
import {
  resolveCardVisual,
  resolveFieldNote,
  resolveLore,
  clusterDots,
  moonCraters,
  asteroidSilhouette,
} from "@/lib/spaceHelpers";
import type { CelestialEntry } from "@/data/celestial/celestial.d.ts";

function entry(overrides: Partial<CelestialEntry>): CelestialEntry {
  return {
    id: "test-id",
    n: "Test",
    d: "Test designation",
    t: "star",
    r: "common",
    ra: 0,
    dec: 0,
    ly: 100,
    mg: "5.0",
    sp: "G2V",
    img: null,
    c: "#ffd54f",
    con: null,
    st: [],
    f: "",
    lo: null,
    ...overrides,
  };
}

describe("resolveCardVisual", () => {
  it("still resolves a photo-less star to the star glow, honest caption", () => {
    const v = resolveCardVisual(entry({ t: "star", sp: "K0 III" }));
    expect(v.kind).toBe("star");
    expect(v.caption).toContain("SPECTRAL RENDER");
    expect(v.caption).toContain("K0 III");
  });

  it("a photo-less nebula is NOT rendered as a star (the defect)", () => {
    const v = resolveCardVisual(entry({ t: "nebula", img: null }));
    expect(v.kind).toBe("nebula");
    expect(v.kind).not.toBe("star");
    expect(v.caption).not.toContain("SPECTRAL RENDER");
    expect(v.caption).toContain("NEBULA");
  });

  it("a photo-less galaxy is NOT rendered as a star", () => {
    const v = resolveCardVisual(entry({ t: "galaxy", img: null }));
    expect(v.kind).toBe("galaxy");
    expect(v.caption).toContain("GALAXY");
  });

  it("a photo-less cluster is NOT rendered as a star", () => {
    const v = resolveCardVisual(entry({ t: "cluster", img: null }));
    expect(v.kind).toBe("cluster");
    expect(v.caption).toContain("CLUSTER");
  });

  it("a photo-less black hole is NOT rendered as a star", () => {
    const v = resolveCardVisual(entry({ t: "blackhole", img: null }));
    expect(v.kind).toBe("blackhole");
    expect(v.caption).toContain("BLACK HOLE");
  });

  it("a photo-less moon (e.g. celestial-missing-moons.js) is NOT rendered as a star", () => {
    const v = resolveCardVisual(entry({ t: "moon", img: null }));
    expect(v.kind).toBe("moon");
    expect(v.caption).toContain("MOON");
  });

  it("a photo-less dwarf/minor-planet is NOT rendered as a star", () => {
    const v = resolveCardVisual(entry({ t: "dwarf", img: null }));
    expect(v.kind).toBe("asteroid");
    expect(v.caption).toContain("MINOR PLANET");
  });

  it("a moon WITH a real surface photo still resolves to the globe render", () => {
    const v = resolveCardVisual(
      entry({ t: "moon", img: "assets/planets/moon.jpg" }),
    );
    expect(v.kind).toBe("globe");
  });

  it("a dwarf WITH a real surface photo still resolves to the globe render", () => {
    const v = resolveCardVisual(
      entry({ t: "dwarf", img: "assets/planets/ceres.jpg" }),
    );
    expect(v.kind).toBe("globe");
  });

  it("a body with a constellation figure resolves to figure regardless of class", () => {
    const v = resolveCardVisual(
      entry({
        t: "constellation",
        fig: { s: [[0, 0]], l: [] },
      }),
    );
    expect(v.kind).toBe("figure");
  });

  it("a non-globe body WITH a real photo resolves to photo, credited", () => {
    const v = resolveCardVisual(
      entry({ t: "galaxy", img: "assets/dso/M31.webp", crd: "NASA / ESA" }),
    );
    expect(v.kind).toBe("photo");
    expect(v.caption).toBe("IMAGE · NASA / ESA");
  });

  it("an unrecognised class with no image is honest rather than defaulting to star", () => {
    const v = resolveCardVisual(
      entry({ t: "deepfield", img: null, fig: undefined }),
    );
    expect(v.kind).toBe("generic");
    expect(v.caption).toContain("DEEPFIELD");
    expect(v.caption).not.toContain("SPECTRAL RENDER");
  });
});

describe("procedural glyph helpers are deterministic per body id", () => {
  it("clusterDots returns the same scatter for the same id, different for a different id", () => {
    const a = clusterDots(entry({ id: "cluster-a" }));
    const a2 = clusterDots(entry({ id: "cluster-a" }));
    const b = clusterDots(entry({ id: "cluster-b" }));
    expect(a).toEqual(a2);
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("moonCraters returns the same scatter for the same id", () => {
    const a = moonCraters(entry({ id: "mimas" }));
    const a2 = moonCraters(entry({ id: "mimas" }));
    expect(a).toEqual(a2);
  });

  it("asteroidSilhouette returns the same polygon points for the same id", () => {
    const a = asteroidSilhouette(entry({ id: "minorplanet-vesta" }));
    const a2 = asteroidSilhouette(entry({ id: "minorplanet-vesta" }));
    expect(a).toBe(a2);
    expect(a.split(" ").length).toBeGreaterThan(3);
  });
});

/**
 * Incidental defect found 2026-09-02 during a PF-11 manual regression pass: bulk-generated
 * catalog entries (celestial-nbg.js, celestial-gd1.js, celestial-ngc2000.js, celestial-clusters.js)
 * that have not had a content pass yet carry an internal `[[TODO: content pass ...]]` authoring
 * marker as `e.f` — several slightly different wordings — which CollectorCard rendered verbatim
 * to visitors. `celestial-clusters.js` also ships some entries with the same marker inside `e.lo`
 * (`[["", "[[TODO: ...]]"]]`) rather than `lo: null`. Per TR-061's honesty convention (no invented
 * flavour text), the fix is to omit the section, not to fabricate a replacement sentence.
 */
describe("resolveFieldNote / resolveLore — TODO-marker filtering", () => {
  it("passes through a real, authored field note unchanged", () => {
    expect(
      resolveFieldNote(entry({ f: "A real fact about this object." })),
    ).toBe("A real fact about this object.");
  });

  it("omits the field note for every real marker wording found in the catalog", () => {
    const wordings = [
      "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
      "[[TODO: content pass — PF-10 C1 bulk dataset, no per-object dossier authored]]",
      "[[TODO: content pass — PF-10 C1 NGC2000 billboard tier, no per-object dossier authored]]",
      "[[TODO: some future wording nobody has written yet]]",
    ];
    for (const f of wordings) {
      expect(resolveFieldNote(entry({ f }))).toBeNull();
    }
  });

  it("omits the field note for an empty string too (not just the TODO marker)", () => {
    expect(resolveFieldNote(entry({ f: "" }))).toBeNull();
  });

  it("resolveLore passes real lore through and drops TODO-marker entries", () => {
    const e = entry({
      lo: [
        ["Egyptian", "Ra sailed the sky in a solar barque."],
        [
          "",
          "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
        ],
      ],
    });
    expect(resolveLore(e)).toEqual([
      ["Egyptian", "Ra sailed the sky in a solar barque."],
    ]);
  });

  it("resolveLore returns an empty array for lo: null", () => {
    expect(resolveLore(entry({ lo: null }))).toEqual([]);
  });
});
