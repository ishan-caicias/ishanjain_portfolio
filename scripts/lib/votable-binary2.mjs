/* votable-binary2.mjs — PF-10 C0: minimal VOTable 1.3 BINARY2 reader.
 *
 * The Gaia Sky cluster/star-catalog packs under resources/gaia_datasets/ ship their real
 * per-object data as CDS/VizieR-exported .vot files using BINARY2 serialization (base64 STREAM),
 * not the human-readable TABLEDATA form — the packs' own particles-*.json files are just
 * Gaia Sky app config pointing at the .vot, not the records themselves. This module reads just
 * enough of the VOTable 1.3 spec to decode those files: FIELD declarations for schema, then the
 * BINARY2 stream (per-row null bitmask + big-endian primitives).
 *
 * Deliberately narrow: handles the datatypes actually present in this repo's local datasets
 * (long, int, short, float, double, char, char*) rather than the full VOTable type system.
 * Extend the DATATYPE_READERS table if a new dataset needs a type not listed here — do not
 * silently guess a width for an unknown type.
 */
import { readFileSync } from "node:fs";

/** @typedef {{ name: string, datatype: string, arraysize: string | null }} VotField */

function parseFields(xml) {
  const fields = [];
  const fieldTagRe = /<FIELD\b([^>]*)>/g;
  let m;
  while ((m = fieldTagRe.exec(xml))) {
    const attrs = m[1];
    const name = /name="([^"]*)"/.exec(attrs)?.[1];
    const datatype = /datatype="([^"]*)"/.exec(attrs)?.[1];
    const arraysize = /arraysize="([^"]*)"/.exec(attrs)?.[1] ?? null;
    if (!name || !datatype) {
      throw new Error(
        `votable-binary2: FIELD missing name/datatype in: <FIELD${attrs}>`,
      );
    }
    fields.push({ name, datatype, arraysize });
  }
  if (fields.length === 0) {
    throw new Error("votable-binary2: no <FIELD> declarations found");
  }
  return fields;
}

function extractStreamBase64(xml) {
  const m = /<STREAM\b[^>]*encoding='base64'[^>]*>([\s\S]*?)<\/STREAM>/.exec(
    xml,
  );
  if (!m) {
    throw new Error(
      "votable-binary2: no base64 <STREAM> found — file may not be BINARY2 serialized",
    );
  }
  return m[1].replace(/\s+/g, "");
}

/** Reader signature: (buf, offset) -> [value, bytesConsumed] */
const DATATYPE_READERS = {
  long: (buf, o) => [buf.readBigInt64BE(o), 8],
  int: (buf, o) => [buf.readInt32BE(o), 4],
  short: (buf, o) => [buf.readInt16BE(o), 2],
  unsignedByte: (buf, o) => [buf.readUInt8(o), 1],
  float: (buf, o) => [buf.readFloatBE(o), 4],
  double: (buf, o) => [buf.readDoubleBE(o), 8],
};

function readField(field, buf, offset) {
  if (field.datatype === "char") {
    if (field.arraysize === "*") {
      const len = buf.readInt32BE(offset);
      const value = buf.toString("utf8", offset + 4, offset + 4 + len);
      return [value, 4 + len];
    }
    const len = field.arraysize ? Number.parseInt(field.arraysize, 10) : 1;
    const value = buf
      .toString("utf8", offset, offset + len)
      .replace(/\0+$/, "");
    return [value, len];
  }
  const reader = DATATYPE_READERS[field.datatype];
  if (!reader) {
    throw new Error(
      `votable-binary2: unsupported datatype "${field.datatype}" — add a reader`,
    );
  }
  return reader(buf, offset);
}

/**
 * Parse a CDS/VizieR BINARY2 .vot file into plain-object rows keyed by FIELD name.
 * @param {string} path
 * @returns {{ fields: VotField[], rows: Record<string, unknown>[] }}
 */
export function readVotableBinary2(path) {
  const xml = readFileSync(path, "utf8");
  const fields = parseFields(xml);
  const buf = Buffer.from(extractStreamBase64(xml), "base64");
  const maskBytes = Math.ceil(fields.length / 8);

  const rows = [];
  let offset = 0;
  while (offset < buf.length) {
    const maskStart = offset;
    offset += maskBytes;
    const row = {};
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const byte = buf[maskStart + (i >> 3)];
      const isNull = ((byte >> (7 - (i % 8))) & 1) === 1;
      const [rawValue, size] = readField(field, buf, offset);
      offset += size;
      row[field.name] = isNull ? null : rawValue;
    }
    rows.push(row);
  }
  return { fields, rows };
}
