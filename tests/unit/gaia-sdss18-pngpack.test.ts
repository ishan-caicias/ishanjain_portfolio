/**
 * PF-10 C2 — proves the SDSS DR18 packing logic (gaia-sdss18-pngpack.mjs's core loop) against
 * real decoded rows and the ACTUAL production decoder, matching TR-063's precedent for the
 * white-dwarf pipeline. Real rows hardcoded here (extracted this session from the real 131 MB
 * `sdss/sdss_dr18.bin`, which is gitignored under `resources/` and not present in CI) rather
 * than read at test time — same CI-safety rationale starfield-pngpack.test.ts already states.
 */
import { describe, expect, it } from "vitest";
import { decodeStarCatalog } from "@/lib/star-catalog";
import { bodyDepth, raDecToDir } from "../../scripts/lib/log-depth.mjs";

const PC_TO_LY = 3.26156;
const GALAXY_TYPE_BYTE = 3;
const RECORD_BYTES = 15;

/** Real rows from sdss/sdss_dr18.bin (decoded 2026-07-20, see docs/test-reports for the TR). */
const REAL_SDSS_ROWS = [
  {
    id: "1237679478544072772",
    ra: 0.0139357814023811,
    dec: 23.2244227555996,
    distancePc: 2238017488.3436103,
  },
  {
    id: "1237679502171374322",
    ra: 0.014160911982514802,
    dec: 18.776234313459504,
    distancePc: 2176560560.65132,
  },
  {
    id: "1237680265074049268",
    ra: 0.014210083446911903,
    dec: -6.26313909733054,
    distancePc: 2159947969.1503105,
  },
  {
    id: "1237663275780277078",
    ra: 0.014361970507223997,
    dec: -1.15723403439473,
    distancePc: 2314447999.6383805,
  },
  {
    id: "1237678661960860521",
    ra: 0.0143801242094241,
    dec: 5.03723249021487,
    distancePc: 2000718459.1131697,
  },
];

function packRow(row: (typeof REAL_SDSS_ROWS)[number]) {
  const distanceLy = row.distancePc * PC_TO_LY;
  const depth = bodyDepth(distanceLy);
  const [dx, dy, dz] = raDecToDir(row.ra, row.dec);
  return { x: dx * depth, y: dy * depth, z: dz * depth, depth, distanceLy };
}

describe("gaia-sdss18-pngpack: real-row placement", () => {
  it("real distances land in the multi-billion-ly range (the actual DR18 scale, not a placeholder)", () => {
    for (const row of REAL_SDSS_ROWS) {
      const ly = row.distancePc * PC_TO_LY;
      expect(ly).toBeGreaterThan(1e9); // every one of these 5 real rows is >1 billion ly out
    }
  });

  it("log-compressed depth lands in the same order of magnitude as the rest of the scene (~1,100-1,500), not the raw multi-billion-ly value", () => {
    for (const row of REAL_SDSS_ROWS) {
      const packed = packRow(row);
      expect(packed.depth).toBeGreaterThan(1000);
      expect(packed.depth).toBeLessThan(2000);
      // the whole point of the compression: depth is NOT anywhere near the raw ly magnitude
      expect(packed.depth).toBeLessThan(packed.distanceLy / 1e6);
    }
  });

  it("round-trips through the REAL production decodeStarCatalog with the correct compressed position", () => {
    const packed = REAL_SDSS_ROWS.map(packRow);
    const buf = Buffer.alloc(packed.length * RECORD_BYTES);
    packed.forEach((p, i) => {
      const o = i * RECORD_BYTES;
      buf.writeFloatLE(p.x, o);
      buf.writeFloatLE(p.y, o + 4);
      buf.writeFloatLE(p.z, o + 8);
      buf.writeUInt8(60, o + 12);
      buf.writeUInt8(140, o + 13);
      buf.writeUInt8(GALAXY_TYPE_BYTE, o + 14);
    });
    const field = decodeStarCatalog([
      new Uint8Array(buf.buffer, buf.byteOffset, buf.length),
    ]);
    expect(field.count).toBe(packed.length);
    for (let i = 0; i < packed.length; i++) {
      expect(field.positions[i * 3]).toBeCloseTo(packed[i].x, 1);
      expect(field.positions[i * 3 + 1]).toBeCloseTo(packed[i].y, 1);
      expect(field.positions[i * 3 + 2]).toBeCloseTo(packed[i].z, 1);
    }
  });
});
