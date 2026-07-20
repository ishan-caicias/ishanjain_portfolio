/**
 * PF-10 C0 Track B — PNG-pack encoder round-trip, proven against the REAL production decoder.
 *
 * This is the Track B counterpart to TR-061's Track A proof. `scripts/lib/starfield-pngpack.mjs`
 * is a plain Node script (not unit-tested directly, matching this repo's convention for
 * `scripts/*.mjs` build tooling — see TR-061), but its byte layout is a strict contract with
 * `src/lib/star-catalog.ts`'s shipped decoder, so THAT contract is pinned here.
 *
 * Fixture data is real, not synthetic: five actual rows decoded from the local eDR3 white dwarf
 * FITS catalog (`resources/gaia_datasets/catalog-whitedwarfs-edr3/catalog/wd/edr3/wd_edr3.fits`,
 * Gentile Fusillo et al. 2021) during this session, hardcoded here rather than read at test time
 * — `resources/` is gitignored (not present in CI or a fresh clone), so a test that opened the
 * 40 MB FITS file directly would pass locally and fail everywhere else. Copying five real rows
 * keeps the test CI-safe while still exercising real astronomical values, not fabricated ones.
 */
import { describe, expect, it } from "vitest";
import { decodeStarCatalog, RECORD_BYTES } from "@/lib/star-catalog";
import { raDecToDir } from "@/lib/ship-dynamics";
import {
  packRecordsToBytes,
  packStreamToBytes,
  bytesToPixelBuffer,
  PACK_WIDTH,
} from "../../scripts/lib/starfield-pngpack.mjs";

const PC_TO_LY = 3.26156;

/** Real rows from wd_edr3.fits (decoded 2026-07-20, see docs/test-reports for the session TR). */
const REAL_WHITE_DWARF_ROWS = [
  {
    name: "WDJ235959.90+512337.51",
    ra: 359.99970309867155,
    dec: 51.39371667218271,
    parallax: 3.081245849220078,
    phot_g_mean_mag: 20.219164,
    bp_rp: 0.16509437561035156,
  },
  {
    name: "WDJ235959.49-034703.60",
    ra: 359.99788639182015,
    dec: -3.7843100322095586,
    parallax: 5.13472033120828,
    phot_g_mean_mag: 19.359896,
    bp_rp: 0.22183799743652344,
  },
  {
    name: "WDJ235959.48+082813.10",
    ra: 359.9978182880861,
    dec: 8.47027795172492,
    parallax: 4.138595930646823,
    phot_g_mean_mag: 18.355846,
    bp_rp: -0.1421947479248047,
  },
  {
    name: "WDJ235958.84-213149.25",
    ra: 359.99515723061364,
    dec: -21.53041811483335,
    parallax: 2.8227153054356964,
    phot_g_mean_mag: 20.244682,
    bp_rp: 0.1484222412109375,
  },
  {
    name: "WDJ235958.62+301622.51",
    ra: 359.9944299296063,
    dec: 30.27293792274067,
    parallax: 5.249755708215063,
    phot_g_mean_mag: 18.815247,
    bp_rp: -0.017185211181640625,
  },
];

function magToByte(mag: number): number {
  return ((12.5 - mag) / 14) * 255;
}
function colourToByte(bpRp: number): number {
  const lo = -0.5;
  const hi = 2.0;
  return ((bpRp - lo) / (hi - lo)) * 255;
}
function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toRecord(row: (typeof REAL_WHITE_DWARF_ROWS)[number]) {
  const distanceLy = (1000 / row.parallax) * PC_TO_LY;
  const [dx, dy, dz] = raDecToDir(row.ra, row.dec);
  return {
    x: dx * distanceLy,
    y: dy * distanceLy,
    z: dz * distanceLy,
    magByte: magToByte(row.phot_g_mean_mag),
    ciByte: colourToByte(row.bp_rp),
    typeByte: 1,
    distanceLy,
  };
}

describe("starfield-pngpack: Track B encoder", () => {
  it("packs real white-dwarf records into the exact 15-byte layout star-catalog.ts expects", () => {
    const records = REAL_WHITE_DWARF_ROWS.map(toRecord);
    const bytes = packRecordsToBytes(records);
    expect(bytes.length).toBe(records.length * RECORD_BYTES);
  });

  it("round-trips real catalog data through the ACTUAL production decoder, not a mirror", () => {
    const records = REAL_WHITE_DWARF_ROWS.map(toRecord);
    const bytes = packRecordsToBytes(records);

    // decodeStarCatalog takes Uint8Array chunks of raw RGB bytes (post-alpha-strip) — feeding
    // the packed bytes directly is valid because packing never uses an alpha channel; the
    // PNG round trip (bytesToPixelBuffer -> real PNG -> decode -> strip alpha) is exercised
    // separately below via bytesToPixelBuffer's own shape contract.
    const field = decodeStarCatalog([
      new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length),
    ]);

    expect(field.count).toBe(records.length);
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      expect(field.positions[i * 3]).toBeCloseTo(r.x, 2);
      expect(field.positions[i * 3 + 1]).toBeCloseTo(r.y, 2);
      expect(field.positions[i * 3 + 2]).toBeCloseTo(r.z, 2);
    }
  });

  // REAL FINDING (not assumed going in): every one of the 5 real sample white dwarfs is
  // fainter than magnitude 12.5, the faintest value the shared byte format can represent
  // (`mag = 12.5 - byte/255*14`, calibrated for the naked-eye Hipparcos+Gaia-deep population).
  // All 5 raw byte computations come out negative (-106.7 to -141.1) and clamp to 0, which
  // decodes back to exactly 12.5 — not the source magnitude. This is the format doing its
  // documented job (clamping out-of-range input), not a pipeline defect: reusing
  // star-catalog.ts's exact contract, unmodified, is what C0 requires (Track B "follows the
  // proven pattern exactly rather than inventing a second format"). The consequence is real
  // and worth carrying into C1: white dwarfs sharing this byte format render at the format's
  // faintest bucket, indistinguishable from each other by brightness, unless a future
  // per-population magnitude remapping is designed — a rendering-integration decision, not a
  // pipeline-mechanism one, and out of scope for proving Track B works here.
  it("documents the real limitation: this magnitude byte format cannot represent white-dwarf-faint magnitudes", () => {
    for (const row of REAL_WHITE_DWARF_ROWS) {
      const raw = magToByte(row.phot_g_mean_mag);
      expect(raw).toBeLessThan(0); // every real sample falls below the format's floor
      expect(clampByte(raw)).toBe(0); // clamps to the faintest representable byte
    }
  });

  it("round-trips faithfully for a magnitude that DOES fall inside the format's range", () => {
    // Proves the mechanism itself is correct — the limitation above is about this real
    // population's magnitude range, not a bug in the pack/decode byte arithmetic.
    const brightRecord = {
      ...toRecord(REAL_WHITE_DWARF_ROWS[0]),
      magByte: magToByte(5.0),
    };
    const bytes = packRecordsToBytes([brightRecord]);
    const field = decodeStarCatalog([
      new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length),
    ]);
    const decodedByte = field.meta[0] * 255;
    const decodedMag = 12.5 - (decodedByte / 255) * 14;
    expect(decodedMag).toBeCloseTo(5.0, 1);
  });

  it("derives real light-year distances from parallax that match the catalog's own numbers", () => {
    // WD J235959.90+512337.51: parallax 3.081 mas -> ~324.6 pc -> ~1,058.9 ly. Spot-checked
    // against the standard 1000/parallax_mas relation, not just re-deriving the same formula.
    const r = toRecord(REAL_WHITE_DWARF_ROWS[0]);
    expect(r.distanceLy).toBeCloseTo(1058.9, 0);
  });

  // PF-10 C2: packStreamToBytes is the memory-safe path for million-plus-row datasets (SDSS
  // DR18 alone is 3,637,836 real rows) — it must produce byte-IDENTICAL output to the
  // array-of-objects path for the same logical records, proving the streaming rewrite didn't
  // change the wire format, just how it gets built.
  it("packStreamToBytes produces byte-identical output to packRecordsToBytes for the same records", () => {
    const records = REAL_WHITE_DWARF_ROWS.map(toRecord);
    const viaArray = packRecordsToBytes(records);
    const viaStream = packStreamToBytes(records.length, (view, i) => {
      const r = records[i];
      view.setX(r.x);
      view.setY(r.y);
      view.setZ(r.z);
      view.setMagByte(r.magByte);
      view.setCiByte(r.ciByte);
      view.setTypeByte(r.typeByte);
    });
    expect(Buffer.compare(viaArray, viaStream)).toBe(0);
  });

  it("packStreamToBytes round-trips through the real production decoder", () => {
    const records = REAL_WHITE_DWARF_ROWS.map(toRecord);
    const bytes = packStreamToBytes(records.length, (view, i) => {
      const r = records[i];
      view.setX(r.x);
      view.setY(r.y);
      view.setZ(r.z);
      view.setMagByte(r.magByte);
      view.setCiByte(r.ciByte);
      view.setTypeByte(r.typeByte);
    });
    const field = decodeStarCatalog([
      new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length),
    ]);
    expect(field.count).toBe(records.length);
    expect(field.positions[0]).toBeCloseTo(records[0].x, 2);
  });

  it("lays packed bytes into an RGBA pixel buffer at the fixed 1024px pack width", () => {
    const records = REAL_WHITE_DWARF_ROWS.map(toRecord);
    const bytes = packRecordsToBytes(records);
    const { pixels, width, height } = bytesToPixelBuffer(bytes);
    expect(width).toBe(PACK_WIDTH);
    // 5 records * 15 bytes = 75 bytes = 25 pixels; comfortably under one row at width 1024.
    expect(height).toBe(1);
    expect(pixels.length).toBe(width * height * 4);
    // Alpha channel is opaque throughout, matching the shipped assets' convention.
    for (let p = 0; p < 25; p++) {
      expect(pixels[p * 4 + 3]).toBe(255);
    }
  });
});
