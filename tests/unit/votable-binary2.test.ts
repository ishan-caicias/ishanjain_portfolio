/**
 * PF-10 C0 — regression tests for the VOTable 1.3 BINARY2 reader (scripts/lib/votable-binary2.mjs).
 *
 * This closes a real gap identified after C0 shipped: the reader was proven live against real
 * MWSC data (TR-061) but had zero committed regression coverage — a future edit to the byte
 * offsets could silently break it with no CI signal. Fixtures here are independently constructed
 * (a small local encoder, not a reuse of the reader's own logic) so this isn't just the reader
 * agreeing with itself, and are written to a real temp file rather than reading the gitignored
 * `resources/` datasets, so the suite stays CI-safe.
 *
 * Datatype coverage matches every TFORM code actually encountered in this repo's local datasets
 * across both MWSC (long, char*, char[1], float, double, short) and Hunt-Reffert 2023
 * (unsignedByte, int) — see TR-061/TR-063.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readVotableBinary2 } from "../../scripts/lib/votable-binary2.mjs";

interface FieldDef {
  name: string;
  datatype:
    "long" | "char" | "double" | "float" | "short" | "unsignedByte" | "int";
  arraysize?: string;
}
type RowValue = string | number | null | undefined;
type Row = Record<string, RowValue>;

const FIELD_BYTES: Record<string, number> = {
  long: 8,
  int: 4,
  short: 2,
  unsignedByte: 1,
  float: 4,
  double: 8,
};

function encodeFieldValue(field: FieldDef, value: RowValue): Buffer {
  if (field.datatype === "char") {
    if (field.arraysize === "*") {
      const bytes = Buffer.from(String(value), "utf8");
      const len = Buffer.alloc(4);
      len.writeInt32BE(bytes.length, 0);
      return Buffer.concat([len, bytes]);
    }
    const width = field.arraysize ? Number.parseInt(field.arraysize, 10) : 1;
    const buf = Buffer.alloc(width);
    buf.write(String(value ?? ""), 0, "utf8");
    return buf;
  }
  const buf = Buffer.alloc(FIELD_BYTES[field.datatype]);
  switch (field.datatype) {
    case "long":
      buf.writeBigInt64BE(BigInt(value ?? 0), 0);
      break;
    case "int":
      buf.writeInt32BE(Number(value ?? 0), 0);
      break;
    case "short":
      buf.writeInt16BE(Number(value ?? 0), 0);
      break;
    case "unsignedByte":
      buf.writeUInt8(Number(value ?? 0), 0);
      break;
    case "float":
      buf.writeFloatBE(Number(value ?? 0), 0);
      break;
    case "double":
      buf.writeDoubleBE(Number(value ?? 0), 0);
      break;
    default:
      throw new Error(`test fixture: unhandled datatype ${field.datatype}`);
  }
  return buf;
}

/** Independently encodes a BINARY2 stream + wrapping VOTable XML from field defs and rows
 * (each row a plain object, `null` marks a field null). Deliberately separate code from the
 * reader under test. */
function buildVotableFixture(fields: FieldDef[], rows: Row[]): string {
  const maskBytes = Math.ceil(fields.length / 8);
  const rowBufs = rows.map((row) => {
    const mask = Buffer.alloc(maskBytes);
    const valueBufs = fields.map((field, i) => {
      const value = row[field.name];
      const isNull = value === null || value === undefined;
      if (isNull) mask[i >> 3] |= 1 << (7 - (i % 8));
      return encodeFieldValue(field, isNull ? undefined : value);
    });
    return Buffer.concat([mask, ...valueBufs]);
  });
  const base64 = Buffer.concat(rowBufs).toString("base64");
  const fieldXml = fields
    .map(
      (f: FieldDef) =>
        `<FIELD datatype="${f.datatype}" name="${f.name}"${f.arraysize ? ` arraysize="${f.arraysize}"` : ""}></FIELD>`,
    )
    .join("\n");
  return `<?xml version='1.0'?>
<VOTABLE version="1.4"><RESOURCE><TABLE name="fixture" nrows="${rows.length}">
${fieldXml}
<DATA>
<BINARY2>
<STREAM encoding='base64'>
${base64}
</STREAM>
</BINARY2>
</DATA>
</TABLE></RESOURCE></VOTABLE>`;
}

const FIELDS: FieldDef[] = [
  { name: "id", datatype: "long" },
  { name: "name", datatype: "char", arraysize: "*" },
  { name: "type", datatype: "char", arraysize: "1" },
  { name: "ra", datatype: "double" },
  { name: "dec", datatype: "float" },
  { name: "n_stars", datatype: "short" },
  { name: "flag", datatype: "unsignedByte" },
  { name: "recno", datatype: "int" },
];

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "votable-binary2-test-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeFixture(fields: FieldDef[], rows: Row[]): string {
  const path = join(dir, "fixture.vot");
  writeFileSync(path, buildVotableFixture(fields, rows));
  return path;
}

describe("readVotableBinary2", () => {
  it("parses FIELD declarations (name, datatype, arraysize) for every supported datatype", () => {
    const path = writeFixture(FIELDS, [
      {
        id: 1,
        name: "Berkeley_58",
        type: "n",
        ra: 0.0675,
        dec: 60.933,
        n_stars: 16,
        flag: 1,
        recno: 1,
      },
    ]);
    const { fields } = readVotableBinary2(path);
    expect(fields.map((f) => f.name)).toEqual(FIELDS.map((f) => f.name));
    expect(fields.map((f) => f.datatype)).toEqual(
      FIELDS.map((f) => f.datatype),
    );
  });

  it("round-trips real-shaped values across every supported datatype", () => {
    const row = {
      id: 42,
      name: "NGC_2632",
      type: "o",
      ra: 130.095,
      dec: 19.69,
      n_stars: 24,
      flag: 255,
      recno: 7,
    };
    const path = writeFixture(FIELDS, [row]);
    const { rows } = readVotableBinary2(path);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(BigInt(42));
    expect(rows[0].name).toBe("NGC_2632");
    expect(rows[0].type).toBe("o");
    expect(rows[0].ra).toBeCloseTo(130.095, 10);
    expect(rows[0].dec).toBeCloseTo(19.69, 4); // float precision
    expect(rows[0].n_stars).toBe(24);
    expect(rows[0].flag).toBe(255);
    expect(rows[0].recno).toBe(7);
  });

  it("decodes multiple rows in order", () => {
    const path = writeFixture(FIELDS, [
      {
        id: 1,
        name: "A",
        type: "o",
        ra: 1,
        dec: 1,
        n_stars: 1,
        flag: 0,
        recno: 1,
      },
      {
        id: 2,
        name: "B",
        type: "g",
        ra: 2,
        dec: 2,
        n_stars: 2,
        flag: 1,
        recno: 2,
      },
      {
        id: 3,
        name: "C",
        type: "r",
        ra: 3,
        dec: 3,
        n_stars: 3,
        flag: 2,
        recno: 3,
      },
    ]);
    const { rows } = readVotableBinary2(path);
    expect(rows.map((r) => r.name)).toEqual(["A", "B", "C"]);
    expect(rows.map((r) => r.type)).toEqual(["o", "g", "r"]);
  });

  it("marks a null-bitmask field as null, matching the real MWSC row-0 shape (type field null)", () => {
    // The real Berkeley_58 (MWSC row 0, see TR-061) has type=null — this is the exact real
    // shape that motivated the null-bitmask path, reproduced as a fixture rather than reading
    // the gitignored .vot file.
    const path = writeFixture(FIELDS, [
      {
        id: 1,
        name: "Berkeley_58",
        type: null,
        ra: 0.0675,
        dec: 60.933,
        n_stars: 16,
        flag: 0,
        recno: 1,
      },
    ]);
    const { rows } = readVotableBinary2(path);
    expect(rows[0].type).toBeNull();
    expect(rows[0].name).toBe("Berkeley_58"); // non-null fields in the same row unaffected
  });

  it("throws a clear error when no FIELD declarations are present", () => {
    const path = join(dir, "no-fields.vot");
    writeFileSync(
      path,
      `<VOTABLE><RESOURCE><TABLE><DATA><BINARY2><STREAM encoding='base64'></STREAM></BINARY2></DATA></TABLE></RESOURCE></VOTABLE>`,
    );
    expect(() => readVotableBinary2(path)).toThrow(/no <FIELD>/);
  });

  it("throws a clear error when the file has no BINARY2 base64 stream", () => {
    const path = join(dir, "no-stream.vot");
    writeFileSync(
      path,
      `<VOTABLE><RESOURCE><TABLE><FIELD datatype="long" name="id"></FIELD></TABLE></RESOURCE></VOTABLE>`,
    );
    expect(() => readVotableBinary2(path)).toThrow(/no base64 <STREAM>/);
  });
});
