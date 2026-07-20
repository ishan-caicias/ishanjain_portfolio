/* votable-tabledata.mjs — PF-10 C1: VOTable 1.x TABLEDATA reader.
 *
 * Companion to votable-binary2.mjs. Not every local .vot pack uses BINARY2 — GD-1
 * (catalog-gd1) and NEARGALCAT (catalog-nbg) ship plain human-readable TABLEDATA
 * (<TR><TD>value</TD>...</TR> rows), a different VOTable serialization of the same FIELD-schema
 * concept. Reuses nothing from votable-binary2.mjs's byte-decoding (there are no bytes to
 * decode here — everything is already text), but keeps the same FIELD-parsing convention and
 * the same `{ fields, rows }` return shape so both readers are interchangeable to callers.
 *
 * Deliberately narrow, matching votable-binary2.mjs's own stated scope: handles char/int/short/
 * long/float/double text-cell parsing (the types actually present in this repo's local
 * TABLEDATA packs), not the full VOTable type system.
 */
import { readFileSync } from "node:fs";

function parseFields(xml) {
  const fields = [];
  const fieldTagRe = /<FIELD\b([^>]*)>/g;
  let m;
  while ((m = fieldTagRe.exec(xml))) {
    const attrs = m[1];
    const name = /name="([^"]*)"/.exec(attrs)?.[1];
    const datatype = /datatype="([^"]*)"/.exec(attrs)?.[1];
    if (!name || !datatype) {
      throw new Error(
        `votable-tabledata: FIELD missing name/datatype in: <FIELD${attrs}>`,
      );
    }
    fields.push({ name, datatype });
  }
  if (fields.length === 0) {
    throw new Error("votable-tabledata: no <FIELD> declarations found");
  }
  return fields;
}

function extractTabledataBlock(xml) {
  const m = /<TABLEDATA\b[^>]*>([\s\S]*?)<\/TABLEDATA>/.exec(xml);
  if (!m) {
    throw new Error(
      "votable-tabledata: no <TABLEDATA> block found — file may be BINARY2 serialized (use votable-binary2.mjs)",
    );
  }
  return m[1];
}

function coerceCell(raw, datatype) {
  if (raw === "") return null; // VOTable's TABLEDATA null convention: an empty <TD/>
  switch (datatype) {
    case "char":
    case "unicodeChar":
      return raw;
    case "int":
    case "short":
    case "long":
      return Number.parseInt(raw, 10);
    case "float":
    case "double":
      return Number.parseFloat(raw);
    default:
      throw new Error(
        `votable-tabledata: unsupported datatype "${datatype}" — add a case`,
      );
  }
}

/**
 * Parse a VOTable 1.x TABLEDATA file into plain-object rows keyed by FIELD name.
 * @param {string} path
 * @returns {{ fields: {name: string, datatype: string}[], rows: Record<string, unknown>[] }}
 */
export function readVotableTabledata(path) {
  const xml = readFileSync(path, "utf8");
  const fields = parseFields(xml);
  const body = extractTabledataBlock(xml);

  const rows = [];
  const trRe = /<TR>([\s\S]*?)<\/TR>/g;
  let trMatch;
  while ((trMatch = trRe.exec(body))) {
    const cells = [];
    const tdRe = /<TD>([\s\S]*?)<\/TD>/g;
    let tdMatch;
    while ((tdMatch = tdRe.exec(trMatch[1]))) {
      cells.push(tdMatch[1].trim());
    }
    if (cells.length !== fields.length) {
      throw new Error(
        `votable-tabledata: row has ${cells.length} cells, expected ${fields.length} (schema/data mismatch)`,
      );
    }
    const row = {};
    for (let i = 0; i < fields.length; i++) {
      row[fields[i].name] = coerceCell(cells[i], fields[i].datatype);
    }
    rows.push(row);
  }
  return { fields, rows };
}
