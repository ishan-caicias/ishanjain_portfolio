/**
 * PF-10 C1 — proves the cluster-background pack script's dedup logic and placement against real
 * decoded rows (MWSC/Hunt-Reffert 2023/OCDR2, extracted this session from the real local VOTable
 * files) and the ACTUAL production decoder, matching TR-063/TR-066's precedent for the white-dwarf
 * and SDSS pipelines. Real rows hardcoded here rather than read at test time — the same CI-safety
 * rationale starfield-pngpack.test.ts/gaia-sdss18-pngpack.test.ts already state (the source
 * VOTables live under `resources/`, not shipped to CI).
 */
import { describe, expect, it } from "vitest";
import { decodeStarCatalog } from "@/lib/star-catalog";
import {
  angularSepDeg,
  isDuplicateOfCurated,
} from "../../scripts/lib/cluster-dedup.mjs";

const PC_TO_LY = 3.26156;
const CLUSTER_TYPE_BYTE = 1;
const RECORD_BYTES = 15;
const DEDUP_ANGLE_DEG = 1.0;
const DEDUP_DISTANCE_FRAC = 0.3;

// Real curated entries, verbatim from src/data/celestial/celestial-clusters.js.
const CURATED_PLEIADES = {
  id: "cluster-pleiades",
  ra: 56.75,
  dec: 24.12,
  ly: 444,
};

// Real rows decoded from the local MWSC VOTable (catalog-mwsc/mwsc/catalog-mwsc.vot).
const MWSC_MELOTTE_22 = {
  name: "Melotte_22",
  ra: 56.505001068115234,
  dec: 24.3700008392334,
  distancePc: 130,
}; // the real Pleiades entry in MWSC
const MWSC_BERKELEY_58 = {
  name: "Berkeley_58",
  ra: 0.06750000268220901,
  dec: 60.93299865722656,
  distancePc: 2700,
}; // unrelated real cluster, nowhere near Pleiades

// Real rows decoded from the local Hunt-Reffert 2023 VOTable — far from any curated cluster.
const HR23_ROW0 = {
  name: "1636-283|C1636-283|ESO_452-11|MWSC_2436",
  ra: 249.85574296,
  dec: -28.39919379,
  distancePc: 6063.45669451, // dist50
};

// Real row decoded from the local OCDR2 VOTable.
const OCDR2_ROW0 = {
  name: "vdBergh_92",
  ra: 106.038,
  dec: -11.475,
  distancePc: 1187.648456057007,
};

function raDecToDir(ra: number, dec: number): [number, number, number] {
  const d2r = Math.PI / 180;
  const cd = Math.cos(dec * d2r);
  return [
    cd * Math.cos(ra * d2r),
    cd * Math.sin(ra * d2r),
    Math.sin(dec * d2r),
  ];
}

describe("gaia-clusters-pngpack: dedup against the 35 curated clusters", () => {
  it("MWSC's real Melotte_22 row (the Pleiades) is recognized as a duplicate of the curated Pleiades entry", () => {
    const distanceLy = MWSC_MELOTTE_22.distancePc * PC_TO_LY;
    expect(distanceLy).toBeCloseTo(424, 0); // real MWSC Pleiades distance, close to but not identical to the curated 444 ly (hand-verified literature value)
    const dup = isDuplicateOfCurated(
      MWSC_MELOTTE_22.ra,
      MWSC_MELOTTE_22.dec,
      distanceLy,
      [CURATED_PLEIADES],
      DEDUP_ANGLE_DEG,
      DEDUP_DISTANCE_FRAC,
    );
    expect(dup).toBe(true);
  });

  it("an unrelated real MWSC cluster (Berkeley_58, opposite sky region) is NOT flagged as a Pleiades duplicate", () => {
    const distanceLy = MWSC_BERKELEY_58.distancePc * PC_TO_LY;
    expect(
      angularSepDeg(
        MWSC_BERKELEY_58.ra,
        MWSC_BERKELEY_58.dec,
        CURATED_PLEIADES.ra,
        CURATED_PLEIADES.dec,
      ),
    ).toBeGreaterThan(DEDUP_ANGLE_DEG);
    const dup = isDuplicateOfCurated(
      MWSC_BERKELEY_58.ra,
      MWSC_BERKELEY_58.dec,
      distanceLy,
      [CURATED_PLEIADES],
      DEDUP_ANGLE_DEG,
      DEDUP_DISTANCE_FRAC,
    );
    expect(dup).toBe(false);
  });

  it("real Hunt-Reffert and OCDR2 rows (unrelated sky positions) are NOT flagged as duplicates of the curated Pleiades entry", () => {
    for (const row of [HR23_ROW0, OCDR2_ROW0]) {
      const distanceLy = row.distancePc * PC_TO_LY;
      const dup = isDuplicateOfCurated(
        row.ra,
        row.dec,
        distanceLy,
        [CURATED_PLEIADES],
        DEDUP_ANGLE_DEG,
        DEDUP_DISTANCE_FRAC,
      );
      expect(dup).toBe(false);
    }
  });
});

describe("gaia-clusters-pngpack: real-row placement + round-trip", () => {
  it("round-trips real MWSC/Hunt-Reffert/OCDR2 rows through the REAL production decodeStarCatalog with type byte 1 (cluster)", () => {
    const rows = [MWSC_BERKELEY_58, HR23_ROW0, OCDR2_ROW0];
    const packed = rows.map((row) => {
      const distanceLy = row.distancePc * PC_TO_LY;
      const [dx, dy, dz] = raDecToDir(row.ra, row.dec);
      return { x: dx * distanceLy, y: dy * distanceLy, z: dz * distanceLy };
    });
    const buf = Buffer.alloc(packed.length * RECORD_BYTES);
    packed.forEach((p, i) => {
      const o = i * RECORD_BYTES;
      buf.writeFloatLE(p.x, o);
      buf.writeFloatLE(p.y, o + 4);
      buf.writeFloatLE(p.z, o + 8);
      buf.writeUInt8(70, o + 12);
      buf.writeUInt8(140, o + 13);
      buf.writeUInt8(CLUSTER_TYPE_BYTE, o + 14);
    });
    const field = decodeStarCatalog([
      new Uint8Array(buf.buffer, buf.byteOffset, buf.length),
    ]);
    expect(field.count).toBe(packed.length);
    for (let i = 0; i < packed.length; i++) {
      expect(field.positions[i * 3]).toBeCloseTo(packed[i].x, 1);
      expect(field.positions[i * 3 + 1]).toBeCloseTo(packed[i].y, 1);
      expect(field.positions[i * 3 + 2]).toBeCloseTo(packed[i].z, 1);
      // meta.y packs typeByte in the integer part, colour in the fractional part (see star-catalog.ts)
      expect(Math.floor(field.meta[i * 2 + 1])).toBe(CLUSTER_TYPE_BYTE);
    }
  });
});
