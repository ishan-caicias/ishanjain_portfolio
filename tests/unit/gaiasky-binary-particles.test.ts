/**
 * PF-10 C2 — regression tests for the Gaia Sky native binary particle reader
 * (scripts/lib/gaiasky-binary-particles.mjs).
 *
 * Companion to votable-binary2.test.ts / votable-tabledata.test.ts / fits-bintable.test.ts: a
 * FOURTH local data format, Gaia Sky's own `BinaryPointDataProvider` serialization (used by the
 * SDSS DR12/14/17/18 packs). Fixtures are independently constructed (a small local encoder, not
 * a reuse of the reader's own logic), matching the format spec confirmed against the official
 * Gaia Sky documentation and byte-verified against the real 3,637,836-row DR18 file this session.
 */
import { describe, expect, it } from "vitest";
import {
  forEachGaiaSkyParticle,
  readGaiaSkyBinaryHeader,
} from "../../scripts/lib/gaiasky-binary-particles.mjs";

interface FixtureParticle {
  id: bigint;
  name?: string;
  ra: number;
  dec: number;
  distancePc: number;
}

/** Independently encodes a simple (non-extended) Gaia Sky binary particle file. */
function buildFixture(particles: FixtureParticle[]): Buffer {
  const header = Buffer.alloc(5);
  header.writeInt32BE(particles.length, 0);
  header.writeUInt8(0, 4); // simple, not extended

  const recordBufs = particles.map((p) => {
    const name = p.name ?? "";
    const nameBuf = Buffer.alloc(name.length * 2);
    for (let i = 0; i < name.length; i++) {
      nameBuf.writeUInt16BE(name.charCodeAt(i), i * 2);
    }
    const rec = Buffer.alloc(8 + 4 + nameBuf.length + 8 + 8 + 8);
    let o = 0;
    rec.writeBigInt64BE(p.id, o);
    o += 8;
    rec.writeInt32BE(name.length, o);
    o += 4;
    nameBuf.copy(rec, o);
    o += nameBuf.length;
    rec.writeDoubleBE(p.ra, o);
    o += 8;
    rec.writeDoubleBE(p.dec, o);
    o += 8;
    rec.writeDoubleBE(p.distancePc, o);
    o += 8;
    return rec;
  });
  return Buffer.concat([header, ...recordBufs]);
}

describe("readGaiaSkyBinaryHeader", () => {
  it("reads particle count and the simple/extended flag", () => {
    const buf = buildFixture([{ id: 1n, ra: 10, dec: 20, distancePc: 100 }]);
    const header = readGaiaSkyBinaryHeader(buf);
    expect(header.count).toBe(1);
    expect(header.extended).toBe(false);
  });

  it("throws on a buffer too short to hold the 5-byte header", () => {
    expect(() => readGaiaSkyBinaryHeader(Buffer.alloc(2))).toThrow(
      /shorter than the 5-byte header/,
    );
  });

  it("throws when the extended-flag byte is neither 0 nor 1 (not this format)", () => {
    const buf = Buffer.alloc(5);
    buf.writeInt32BE(0, 0);
    buf.writeUInt8(42, 4);
    expect(() => readGaiaSkyBinaryHeader(buf)).toThrow(/expected 0 or 1/);
  });
});

describe("forEachGaiaSkyParticle", () => {
  it("streams real-shaped values (0-length name, real ra/dec/distance) without allocating objects", () => {
    const particles: FixtureParticle[] = [
      {
        id: 1237679478544072772n,
        ra: 0.0139357814023811,
        dec: 23.2244227555996,
        distancePc: 2238017488.3436103,
      },
      {
        id: 1237679502171374322n,
        ra: 0.014160911982514802,
        dec: 18.776234313459504,
        distancePc: 2176560560.65132,
      },
    ];
    const buf = buildFixture(particles);
    const seen: {
      id: bigint;
      ra: number;
      dec: number;
      distancePc: number;
      index: number;
    }[] = [];
    const header = forEachGaiaSkyParticle(
      buf,
      (id, ra, dec, distancePc, index) => {
        seen.push({ id, ra, dec, distancePc, index });
      },
    );
    expect(header.count).toBe(2);
    expect(seen).toHaveLength(2);
    expect(seen[0].id).toBe(particles[0].id);
    expect(seen[0].ra).toBeCloseTo(particles[0].ra, 10);
    expect(seen[0].dec).toBeCloseTo(particles[0].dec, 10);
    expect(seen[0].distancePc).toBeCloseTo(particles[0].distancePc, 4);
    expect(seen[1].index).toBe(1);
  });

  it("skips a non-empty name correctly (namelen * 2 UTF-16BE bytes)", () => {
    const buf = buildFixture([
      { id: 5n, name: "M31", ra: 10.68, dec: 41.27, distancePc: 778000 },
      { id: 6n, ra: 20, dec: -10, distancePc: 500 },
    ]);
    const seen: number[] = [];
    forEachGaiaSkyParticle(buf, (_id, ra) => seen.push(ra));
    expect(seen).toEqual([10.68, 20]);
  });

  it("throws on an extended-particle file rather than silently misreading it", () => {
    const buf = Buffer.alloc(5);
    buf.writeInt32BE(0, 0);
    buf.writeUInt8(1, 4); // extended = true
    expect(() => forEachGaiaSkyParticle(buf, () => {})).toThrow(
      /extended-particle records are not implemented/,
    );
  });

  it("throws a clear error on a real length mismatch (truncated file)", () => {
    const full = buildFixture([{ id: 1n, ra: 1, dec: 1, distancePc: 1 }]);
    const truncated = full.subarray(0, full.length - 3);
    expect(() => forEachGaiaSkyParticle(truncated, () => {})).toThrow();
  });
});
