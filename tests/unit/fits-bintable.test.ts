/**
 * PF-10 C0 — regression tests for the FITS binary-table reader (scripts/lib/fits-bintable.mjs).
 *
 * Same rationale as votable-binary2.test.ts: proven live against the real 40 MB white-dwarf
 * FITS file (TR-063) but had zero committed regression coverage. Fixtures are independently
 * constructed (a small local FITS encoder) and written to real temp files, so the suite doesn't
 * depend on the gitignored `resources/` datasets.
 *
 * Two fixture shapes are covered deliberately: a plain primary HDU (NAXIS=0, straightforward),
 * and the VOTMETA-carrying primary HDU shape the REAL white-dwarf file actually uses (NAXIS=1,
 * NAXIS1=<text length> — a real discovery this session, not assumed from the FITS spec) to
 * guard the exact bug class that would have made the reader silently misread the extension
 * header as more primary-header cards.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFitsBinTable } from "../../scripts/lib/fits-bintable.mjs";

const BLOCK = 2880;
const CARD = 80;

type FitsFormCode = "8A" | "K" | "D" | "E" | "I" | "L";
interface FitsField {
  name: string;
  form: FitsFormCode;
}
type FitsRow = Record<string, string | number | bigint | boolean>;

function card(text: string): string {
  return text.padEnd(CARD, " ").slice(0, CARD);
}

function padToBlock(buf: Buffer): Buffer {
  const rem = buf.length % BLOCK;
  if (rem === 0) return buf;
  return Buffer.concat([buf, Buffer.alloc(BLOCK - rem)]);
}

/** Builds a minimal valid primary HDU. `votMetaText`, when given, reproduces the real
 * white-dwarf file's shape: NAXIS=1 text data holding VOTable metadata that must be walked
 * past by byte length, not parsed as more header cards. */
function buildPrimaryHdu(votMetaText?: string): Buffer {
  const cards = [
    card("SIMPLE  =                    T / Standard FITS format"),
    card("BITPIX  =                    8 / Character data"),
  ];
  if (votMetaText != null) {
    cards.push(
      card("NAXIS   =                    1 / Text string"),
      card(
        `NAXIS1  =              ${String(votMetaText.length).padStart(8)} / Number of characters`,
      ),
    );
  } else {
    cards.push(card("NAXIS   =                    0"));
  }
  cards.push(card("EXTEND  =                    T"), card("END"));
  const headerBuf = padToBlock(Buffer.from(cards.join(""), "ascii"));
  const dataBuf =
    votMetaText != null
      ? padToBlock(Buffer.from(votMetaText, "ascii"))
      : Buffer.alloc(0);
  return Buffer.concat([headerBuf, dataBuf]);
}

const FIELDS: FitsField[] = [
  { name: "name", form: "8A" },
  { name: "source_id", form: "K" },
  { name: "ra", form: "D" },
  { name: "dec", form: "D" },
  { name: "mag", form: "E" },
  { name: "n_stars", form: "I" },
  { name: "flag", form: "L" },
];
const FIELD_BYTES: Record<FitsFormCode, number> = {
  "8A": 8,
  K: 8,
  D: 8,
  E: 4,
  I: 2,
  L: 1,
};

function encodeRow(row: FitsRow): Buffer {
  const bufs = FIELDS.map((f) => {
    const width = FIELD_BYTES[f.form];
    const buf = Buffer.alloc(width);
    const value = row[f.name];
    if (f.form.endsWith("A")) buf.write(String(value ?? ""), 0, "ascii");
    else if (f.form === "K") buf.writeBigInt64BE(BigInt(value ?? 0), 0);
    else if (f.form === "D") buf.writeDoubleBE(Number(value ?? 0), 0);
    else if (f.form === "E") buf.writeFloatBE(Number(value ?? 0), 0);
    else if (f.form === "I") buf.writeInt16BE(Number(value ?? 0), 0);
    else if (f.form === "L") buf.writeUInt8(value ? 1 : 0, 0);
    return buf;
  });
  return Buffer.concat(bufs);
}

function buildBinTableExtension(rows: FitsRow[]): Buffer {
  const rowBytes = FIELDS.reduce((sum, f) => sum + FIELD_BYTES[f.form], 0);
  const cards = [
    card("XTENSION= 'BINTABLE'           / binary table extension"),
    card("BITPIX  =                    8 / 8-bit bytes"),
    card("NAXIS   =                    2 / 2-dimensional table"),
    card(
      `NAXIS1  =              ${String(rowBytes).padStart(8)} / width of table in bytes`,
    ),
    card(
      `NAXIS2  =              ${String(rows.length).padStart(8)} / number of rows in table`,
    ),
    card("PCOUNT  =                    0"),
    card("GCOUNT  =                    1"),
    card(
      `TFIELDS =              ${String(FIELDS.length).padStart(8)} / number of columns`,
    ),
  ];
  FIELDS.forEach((f, i) => {
    cards.push(
      card(`TTYPE${i + 1}  = '${f.name.padEnd(8)}'`),
      card(`TFORM${i + 1}  = '${f.form.padEnd(8)}'`),
    );
  });
  cards.push(card("END"));
  const headerBuf = padToBlock(Buffer.from(cards.join(""), "ascii"));
  const dataBuf = padToBlock(Buffer.concat(rows.map(encodeRow)));
  return Buffer.concat([headerBuf, dataBuf]);
}

function buildFitsFixture(
  rows: FitsRow[],
  { withVotMeta = false }: { withVotMeta?: boolean } = {},
): Buffer {
  const primary = buildPrimaryHdu(
    withVotMeta ? "<VOTABLE><!-- fixture metadata --></VOTABLE>" : undefined,
  );
  const ext = buildBinTableExtension(rows);
  return Buffer.concat([primary, ext]);
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fits-bintable-test-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeFixture(
  rows: FitsRow[],
  opts?: { withVotMeta?: boolean },
): string {
  const path = join(dir, "fixture.fits");
  writeFileSync(path, buildFitsFixture(rows, opts));
  return path;
}

const REAL_SHAPED_ROW: FitsRow = {
  name: "WDJ2359",
  source_id: 1944058569339736192n,
  ra: 359.9997,
  dec: 51.3937,
  mag: 20.219164,
  n_stars: 5,
  flag: true,
};

describe("readFitsBinTable", () => {
  it("parses TTYPE/TFORM column declarations from a plain (NAXIS=0) primary HDU", () => {
    const path = writeFixture([REAL_SHAPED_ROW]);
    const { columns, totalRows } = readFitsBinTable(path);
    expect(columns.map((c) => c.name)).toEqual(FIELDS.map((f) => f.name));
    expect(columns.map((c) => c.form)).toEqual(FIELDS.map((f) => f.form));
    expect(totalRows).toBe(1);
  });

  it("parses the extension correctly when the primary HDU carries VOTMETA text data — the real white-dwarf-file shape", () => {
    // This is the exact structure that made naively reading 80-byte cards immediately after
    // the primary header fail on the real file: the VOTable text must be skipped by its
    // declared NAXIS1 byte length, not walked as more header cards.
    const path = writeFixture([REAL_SHAPED_ROW], { withVotMeta: true });
    const { columns, rows } = readFitsBinTable(path);
    expect(columns.map((c) => c.name)).toEqual(FIELDS.map((f) => f.name));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("WDJ2359");
  });

  it("decodes real-shaped values across every TFORM code used in this repo's local datasets", () => {
    const path = writeFixture([REAL_SHAPED_ROW]);
    const { rows } = readFitsBinTable(path);
    expect(rows[0].source_id).toBe(1944058569339736192n);
    expect(rows[0].ra).toBeCloseTo(359.9997, 10);
    expect(rows[0].dec).toBeCloseTo(51.3937, 10);
    expect(rows[0].mag).toBeCloseTo(20.219164, 4); // float precision
    expect(rows[0].n_stars).toBe(5);
    expect(rows[0].flag).toBe(true);
  });

  it("decodes multiple rows in order", () => {
    const rows = [
      { ...REAL_SHAPED_ROW, name: "A", n_stars: 1 },
      { ...REAL_SHAPED_ROW, name: "B", n_stars: 2 },
      { ...REAL_SHAPED_ROW, name: "C", n_stars: 3 },
    ];
    const path = writeFixture(rows);
    const { rows: decoded } = readFitsBinTable(path);
    expect(decoded.map((r) => r.name)).toEqual(["A", "B", "C"]);
    expect(decoded.map((r) => r.n_stars)).toEqual([1, 2, 3]);
  });

  it("respects the limit option without decoding the whole file", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      ...REAL_SHAPED_ROW,
      name: `R${i}`,
    }));
    const path = writeFixture(rows);
    const { rows: decoded, totalRows } = readFitsBinTable(path, { limit: 3 });
    expect(decoded).toHaveLength(3);
    expect(totalRows).toBe(10); // declared total is still reported even when sampling
  });

  it("throws when the extension is not a BINTABLE", () => {
    const primary = buildPrimaryHdu();
    const badExt = padToBlock(
      Buffer.from(
        [card("XTENSION= 'IMAGE   '"), card("END")].join(""),
        "ascii",
      ),
    );
    const path = join(dir, "not-bintable.fits");
    writeFileSync(path, Buffer.concat([primary, badExt]));
    expect(() => readFitsBinTable(path)).toThrow(/expected BINTABLE/);
  });
});
