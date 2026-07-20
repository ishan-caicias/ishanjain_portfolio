/* fits-bintable.mjs — PF-10 C0: minimal FITS binary-table reader.
 *
 * The eDR3 white dwarf catalog (`resources/gaia_datasets/catalog-whitedwarfs-edr3/catalog/wd/
 * edr3/wd_edr3.fits`) is a THIRD real astronomical binary format found in this repo's local
 * datasets, distinct from both the plain-JSON packs and the VOTable BINARY2 packs
 * (`votable-binary2.mjs`) — its own `particles-wd-edr3.json` is Gaia Sky app config pointing at
 * this `.fits` file, not the records themselves, the same pattern as the VOTable packs.
 *
 * FITS structure (a real finding, confirmed by walking this file's actual bytes rather than
 * assumed from the spec): a sequence of Header/Data Units (HDUs), each header made of 80-byte
 * ASCII "cards" (`KEYWORD = value / comment`) padded to a multiple of 2880 bytes, terminated by
 * an `END` card, followed by the HDU's data (also padded to a 2880-byte boundary). This file's
 * primary HDU carries VOTable-format *metadata* as its data payload (`VOTMETA=T`, STIL/TOPCAT
 * convention) — that block must be walked past by its declared byte length, not parsed as more
 * header cards, to reach the real `XTENSION='BINTABLE'` extension HDU that holds the actual rows.
 *
 * Deliberately narrow: supports the FITS `TFORM` codes present in this repo's local datasets
 * (`A` char array, `D` double, `E` float, `J` int32, `I` int16, `K` int64) rather than the full
 * FITS type system. FITS binary data is always big-endian, per spec.
 */
import { readFileSync } from "node:fs";

const BLOCK = 2880;
const CARD = 80;

function parseCards(buf, offset) {
  const cards = [];
  let o = offset;
  for (;;) {
    const card = buf.toString("ascii", o, o + CARD);
    cards.push(card);
    o += CARD;
    if (card.trimEnd() === "END" || card.startsWith("END ")) break;
    if (cards.length > 2000) {
      throw new Error("fits-bintable: header did not terminate with END");
    }
  }
  const headerEnd = Math.ceil(o / BLOCK) * BLOCK;
  return { cards, headerEnd };
}

function cardValue(cards, keyword) {
  const card = cards.find((c) => c.slice(0, 8).trim() === keyword);
  if (!card) return null;
  const eq = card.indexOf("=");
  if (eq === -1) return null;
  let rest = card.slice(eq + 1);
  const slash = rest.indexOf(" / ");
  if (slash !== -1) rest = rest.slice(0, slash);
  rest = rest.trim();
  const strMatch = /^'(.*)'$/.exec(rest);
  if (strMatch) return strMatch[1].trimEnd();
  return Number(rest);
}

function cardsFor(cards, prefix, n) {
  return cardValue(cards, `${prefix}${n}`);
}

/** Reader signature: (buf, offset) -> [value, bytesConsumed]. FITS is big-endian. */
function readerForForm(tform) {
  const m = /^(\d*)([ADEIJKL])/.exec(tform.trim());
  if (!m) throw new Error(`fits-bintable: unparseable TFORM "${tform}"`);
  const repeat = m[1] ? Number.parseInt(m[1], 10) : 1;
  const code = m[2];
  switch (code) {
    case "A":
      return {
        bytes: repeat,
        read: (buf, o) =>
          buf
            .toString("ascii", o, o + repeat)
            .replace(/\0+$/, "")
            .trim(),
      };
    case "D":
      return { bytes: 8, read: (buf, o) => buf.readDoubleBE(o) };
    case "E":
      return { bytes: 4, read: (buf, o) => buf.readFloatBE(o) };
    case "J":
      return { bytes: 4, read: (buf, o) => buf.readInt32BE(o) };
    case "I":
      return { bytes: 2, read: (buf, o) => buf.readInt16BE(o) };
    case "K":
      return { bytes: 8, read: (buf, o) => buf.readBigInt64BE(o) };
    case "L":
      return { bytes: 1, read: (buf, o) => buf.readUInt8(o) !== 0 };
    default:
      throw new Error(`fits-bintable: unsupported TFORM code "${code}"`);
  }
}

/**
 * Read a FITS file's first BINTABLE extension into plain-object rows.
 * @param {string} path
 * @param {{ limit?: number }} [opts] cap the number of decoded rows (for sampling large files)
 * @returns {{ columns: {name: string, form: string}[], rows: Record<string, unknown>[], totalRows: number }}
 */
export function readFitsBinTable(path, opts = {}) {
  const buf = readFileSync(path);

  const primary = parseCards(buf, 0);
  const naxis1 = cardValue(primary.cards, "NAXIS1") ?? 0;
  const naxis = cardValue(primary.cards, "NAXIS") ?? 0;
  const primaryDataBytes = naxis > 0 ? naxis1 : 0;
  const primaryDataEnd =
    primary.headerEnd + Math.ceil(primaryDataBytes / BLOCK) * BLOCK;

  const ext = parseCards(buf, primaryDataEnd);
  const xtension = cardValue(ext.cards, "XTENSION");
  if (xtension !== "BINTABLE") {
    throw new Error(
      `fits-bintable: expected BINTABLE extension, found "${xtension}"`,
    );
  }
  const rowBytes = cardValue(ext.cards, "NAXIS1");
  const totalRows = cardValue(ext.cards, "NAXIS2");
  const tfields = cardValue(ext.cards, "TFIELDS");

  const columns = [];
  for (let i = 1; i <= tfields; i++) {
    columns.push({
      name: cardsFor(ext.cards, "TTYPE", i),
      form: cardsFor(ext.cards, "TFORM", i),
    });
  }
  const readers = columns.map((c) => readerForForm(c.form));
  const declaredRowBytes = readers.reduce((sum, r) => sum + r.bytes, 0);
  if (declaredRowBytes !== rowBytes) {
    throw new Error(
      `fits-bintable: column widths sum to ${declaredRowBytes}, header declares NAXIS1=${rowBytes} — TFORM parsing is wrong`,
    );
  }

  const rowLimit = opts.limit ? Math.min(opts.limit, totalRows) : totalRows;
  const rows = [];
  let base = ext.headerEnd;
  for (let r = 0; r < rowLimit; r++, base += rowBytes) {
    const row = {};
    let o = base;
    for (let c = 0; c < columns.length; c++) {
      row[columns[c].name] = readers[c].read(buf, o);
      o += readers[c].bytes;
    }
    rows.push(row);
  }
  return { columns, rows, totalRows };
}
