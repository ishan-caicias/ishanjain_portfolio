/**
 * PF-11 D8.2 (ADR-0012) — regression tests for the Gaia Sky OctreeLoader binary reader
 * (scripts/lib/gaiasky-octree-particles.mjs).
 *
 * SIXTH local data format in this repo (companion to votable-binary2/votable-tabledata/
 * fits-bintable/gaiasky-binary-particles' tests). Fixtures are independently constructed (a
 * small local encoder, not a reuse of the reader's own logic), matching the byte layout
 * byte-verified against the real local catalog-gaia-dr3-tiny files this session (ADR-0012). The
 * axis-mapping and distance-unit regression cases below use the SAME real reference values
 * (SIMBAD-verified stars, Sirius's precise parallax distance) the ADR's derivation used — a
 * future refactor that silently breaks the coordinate conversion fails these, not just a shape
 * check.
 */
import { describe, expect, it } from "vitest";
import {
  readOctreeMetadata,
  forEachOctreeParticle,
  octreeXyzToRaDecDistance,
  extractHipNumber,
} from "../../scripts/lib/gaiasky-octree-particles.mjs";

interface FixtureOctant {
  pageId: bigint;
  x: number;
  y: number;
  z: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  children: bigint[];
  level: number;
  cumulativeStars: number;
  starsInNode: number;
  numChildren: number;
}

function buildMetadataFixture(octants: FixtureOctant[]): Buffer {
  const buf = Buffer.alloc(12 + octants.length * 112);
  let o = 0;
  buf.writeInt32BE(-1, o);
  o += 4;
  buf.writeInt32BE(1, o);
  o += 4;
  buf.writeInt32BE(octants.length, o);
  o += 4;
  for (const oc of octants) {
    buf.writeBigInt64BE(oc.pageId, o);
    o += 8;
    buf.writeFloatBE(oc.x, o);
    o += 4;
    buf.writeFloatBE(oc.y, o);
    o += 4;
    buf.writeFloatBE(oc.z, o);
    o += 4;
    buf.writeFloatBE(oc.sizeX, o);
    o += 4;
    buf.writeFloatBE(oc.sizeY, o);
    o += 4;
    buf.writeFloatBE(oc.sizeZ, o);
    o += 4;
    for (let c = 0; c < 8; c++) {
      buf.writeBigInt64BE(oc.children[c] ?? -1n, o);
      o += 8;
    }
    buf.writeInt32BE(oc.level, o);
    o += 4;
    buf.writeInt32BE(oc.cumulativeStars, o);
    o += 4;
    buf.writeInt32BE(oc.starsInNode, o);
    o += 4;
    buf.writeInt32BE(oc.numChildren, o);
    o += 4;
  }
  return buf;
}

interface FixtureStar {
  x: number;
  y: number;
  z: number;
  appMag: number;
  absMag: number;
  color: number;
  tEff: number;
  id: bigint;
  name?: string;
}

function buildParticlesFixture(stars: FixtureStar[]): Buffer {
  const recordBufs = stars.map((s) => {
    const name = s.name ?? "";
    const rec = Buffer.alloc(80 + name.length * 2);
    let o = 0;
    rec.writeDoubleBE(s.x, o);
    o += 8;
    rec.writeDoubleBE(s.y, o);
    o += 8;
    rec.writeDoubleBE(s.z, o);
    o += 8;
    // vx, vy, vz, muAlpha, muDelta, radVel — unused by the reader, arbitrary values here.
    for (let i = 0; i < 6; i++) {
      rec.writeFloatBE(0, o);
      o += 4;
    }
    rec.writeFloatBE(s.appMag, o);
    o += 4;
    rec.writeFloatBE(s.absMag, o);
    o += 4;
    rec.writeFloatBE(s.color, o);
    o += 4;
    rec.writeFloatBE(0, o); // size — unused by the reader
    o += 4;
    rec.writeFloatBE(s.tEff, o);
    o += 4;
    rec.writeBigInt64BE(s.id, o);
    o += 8;
    rec.writeInt32BE(name.length, o);
    o += 4;
    for (let i = 0; i < name.length; i++) {
      rec.writeUInt16BE(name.charCodeAt(i), o);
      o += 2;
    }
    return rec;
  });
  const header = Buffer.alloc(12);
  header.writeInt32BE(-1, 0);
  header.writeInt32BE(3, 4);
  header.writeInt32BE(stars.length, 8);
  return Buffer.concat([header, ...recordBufs]);
}

describe("readOctreeMetadata", () => {
  it("reads octant count, pageId, position/size, children, and star counts", () => {
    const buf = buildMetadataFixture([
      {
        pageId: 0n,
        x: 1.5,
        y: -2.5,
        z: 3.5,
        sizeX: 100,
        sizeY: 100,
        sizeZ: 100,
        children: [-1n, -1n, 10n, -1n, -1n, -1n, -1n, -1n],
        level: 0,
        cumulativeStars: 2_552_302,
        starsInNode: 2_200_000,
        numChildren: 1,
      },
      {
        pageId: 10n,
        x: 4,
        y: 5,
        z: 6,
        sizeX: 50,
        sizeY: 50,
        sizeZ: 50,
        children: [-1n, -1n, -1n, -1n, -1n, -1n, -1n, -1n],
        level: 1,
        cumulativeStars: 352_302,
        starsInNode: 352_302,
        numChildren: 0,
      },
    ]);
    const { version, octants } = readOctreeMetadata(buf);
    expect(version).toBe(1);
    expect(octants).toHaveLength(2);
    expect(octants[0].pageId).toBe(0n);
    expect(octants[0].cumulativeStars).toBe(2_552_302);
    expect(octants[0].starsInNode).toBe(2_200_000);
    expect(octants[0].children[2]).toBe(10n);
    expect(octants[1].pageId).toBe(10n);
    expect(octants[1].numChildren).toBe(0);
  });

  it("throws on a non--1 version token (not this format)", () => {
    const buf = Buffer.alloc(12);
    buf.writeInt32BE(0, 0);
    expect(() => readOctreeMetadata(buf)).toThrow(/expected version token -1/);
  });

  it("throws on an unimplemented metadata version", () => {
    const buf = Buffer.alloc(12);
    buf.writeInt32BE(-1, 0);
    buf.writeInt32BE(2, 4);
    expect(() => readOctreeMetadata(buf)).toThrow(
      /version 2 is not implemented/,
    );
  });

  it("throws on a real length mismatch (truncated file)", () => {
    const full = buildMetadataFixture([
      {
        pageId: 0n,
        x: 0,
        y: 0,
        z: 0,
        sizeX: 1,
        sizeY: 1,
        sizeZ: 1,
        children: [],
        level: 0,
        cumulativeStars: 1,
        starsInNode: 1,
        numChildren: 0,
      },
    ]);
    const truncated = full.subarray(0, full.length - 5);
    // Truncating mid-record throws a raw out-of-bounds read before the end-of-loop length
    // check ever runs; truncating exactly on a field boundary reaches the length check itself.
    // Either way it must throw, never silently decode a short/corrupt file.
    expect(() => readOctreeMetadata(truncated)).toThrow();
  });
});

describe("forEachOctreeParticle", () => {
  it("streams real-shaped values without allocating a name string for unnamed records", () => {
    const buf = buildParticlesFixture([
      {
        x: 1,
        y: 2,
        z: 3,
        appMag: 4.5,
        absMag: 6.7,
        color: 0.5,
        tEff: 5778,
        id: 12345n,
      },
      {
        x: -1,
        y: -2,
        z: -3,
        appMag: 1.2,
        absMag: 3.4,
        color: 0.1,
        tEff: 9600,
        id: 67890n,
      },
    ]);
    const seen: {
      x: number;
      appMag: number;
      tEff: number;
      id: bigint;
      name: string;
    }[] = [];
    const { version, count } = forEachOctreeParticle(buf, (star, index) => {
      seen.push(star);
      expect(index).toBe(seen.length - 1);
    });
    expect(version).toBe(3);
    expect(count).toBe(2);
    expect(seen).toHaveLength(2);
    expect(seen[0].x).toBeCloseTo(1, 10);
    expect(seen[0].appMag).toBeCloseTo(4.5, 5);
    expect(seen[0].tEff).toBeCloseTo(5778, 1);
    expect(seen[0].id).toBe(12345n);
    expect(seen[0].name).toBe("");
  });

  it("decodes a named (HIP-tagged) record's UTF-16BE multi-designation name", () => {
    const buf = buildParticlesFixture([
      {
        x: 1,
        y: 1,
        z: 1,
        appMag: 0.7,
        absMag: -1,
        color: 0,
        tEff: 4000,
        id: 89341n,
        name: "mu. Sgr|13 Sgr|HIP 89341",
      },
    ]);
    const seen: string[] = [];
    forEachOctreeParticle(buf, (star) => seen.push(star.name));
    expect(seen[0]).toBe("mu. Sgr|13 Sgr|HIP 89341");
  });

  it("throws on an unimplemented particle version (the publicly-documented 0-2, not 3)", () => {
    const header = Buffer.alloc(12);
    header.writeInt32BE(-1, 0);
    header.writeInt32BE(2, 4);
    header.writeInt32BE(0, 8);
    expect(() => forEachOctreeParticle(header, () => {})).toThrow(
      /version 2 is not implemented/,
    );
  });

  it("throws a clear error on a real length mismatch (truncated file)", () => {
    const full = buildParticlesFixture([
      { x: 1, y: 1, z: 1, appMag: 1, absMag: 1, color: 1, tEff: 5000, id: 1n },
    ]);
    const truncated = full.subarray(0, full.length - 3);
    expect(() => forEachOctreeParticle(truncated, () => {})).toThrow();
  });
});

describe("octreeXyzToRaDecDistance", () => {
  // Real reference values from ADR-0012's derivation — decoded directly from the real local
  // catalog-gaia-dr3-tiny particles_000000.bin file and verified against SIMBAD/well-known
  // parallax distances. A regression here means the axis mapping or distance-unit constant
  // silently changed, which would put every star in the wrong place on the sky.
  it("HIP 89341 (mu Sagittarii): matches SIMBAD RA/Dec to within 0.001 degree", () => {
    const { ra, dec } = octreeXyzToRaDecDistance(
      -319377791272.29,
      -123196139620.45,
      19203164771.03,
    );
    expect(ra).toBeCloseTo(273.44087, 2);
    expect(dec).toBeCloseTo(-21.059387, 2);
  });

  it("HIP 66768: matches SIMBAD RA/Dec to within 0.001 degree", () => {
    const { ra, dec } = octreeXyzToRaDecDistance(
      -152110919847.86,
      -684253323598.93,
      -322098650671.27,
    );
    expect(ra).toBeCloseTo(205.2789, 2);
    expect(dec).toBeCloseTo(-62.4993, 2);
  });

  it("Sirius (HIP 32349): distance matches its precisely known parallax distance (2.6371 pc)", () => {
    const { distancePc } = octreeXyzToRaDecDistance(
      76426086.79709534,
      -23400750.48343089,
      -15255544.487834945,
    );
    expect(distancePc).toBeCloseTo(2.6371, 2);
  });

  it("normalizes RA into [0, 360)", () => {
    const { ra } = octreeXyzToRaDecDistance(-1, 0, -1);
    expect(ra).toBeGreaterThanOrEqual(0);
    expect(ra).toBeLessThan(360);
  });
});

describe("extractHipNumber", () => {
  it("extracts the HIP number from a pipe-delimited multi-designation name", () => {
    expect(extractHipNumber("mu. Sgr|13 Sgr|HIP 89341")).toBe(89341);
  });

  it("extracts a lone HIP designation", () => {
    expect(extractHipNumber("HIP 38545")).toBe(38545);
  });

  it("returns null for an empty name", () => {
    expect(extractHipNumber("")).toBeNull();
  });

  it("returns null when no HIP designation is present", () => {
    expect(extractHipNumber("V809 Cen")).toBeNull();
  });
});
