/**
 * PF-10 C1 — regression tests for the VOTable 1.x TABLEDATA reader (scripts/lib/votable-tabledata.mjs).
 *
 * Companion to votable-binary2.test.ts: GD-1 (catalog-gd1) and NEARGALCAT (catalog-nbg) ship
 * plain-text TABLEDATA rather than BINARY2, discovered while extending PF-10 C1 past the
 * cluster catalogs — a real format difference between local packs, not an assumption. Fixtures
 * are independently constructed (hand-written XML strings), not a reuse of the reader's own
 * logic, and never touch the gitignored `resources/` datasets.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readVotableTabledata } from "../../scripts/lib/votable-tabledata.mjs";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "votable-tabledata-test-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeFixture(xml: string): string {
  const path = join(dir, "fixture.vot");
  writeFileSync(path, xml);
  return path;
}

const GD1_SHAPED_FIXTURE = `<?xml version='1.0'?>
<VOTABLE version="1.4"><RESOURCE><TABLE name="main" nrows="2">
<FIELD datatype="double" name="ra" unit="deg"><DESCRIPTION>Right ascension</DESCRIPTION></FIELD>
<FIELD datatype="double" name="dec" unit="deg"><DESCRIPTION>Declination</DESCRIPTION></FIELD>
<FIELD datatype="double" name="distance" unit="pc"><DESCRIPTION>Distance</DESCRIPTION></FIELD>
<FIELD datatype="double" name="phot_g_mean_mag" unit="mag"><DESCRIPTION>G magnitude</DESCRIPTION></FIELD>
<DATA>
<TABLEDATA>
  <TR>
    <TD>178.462158</TD>
    <TD>53.793951</TD>
    <TD>8559.613497</TD>
    <TD>16.234</TD>
  </TR>
  <TR>
    <TD>179.1</TD>
    <TD>54.0</TD>
    <TD></TD>
    <TD>17.5</TD>
  </TR>
</TABLEDATA>
</DATA>
</TABLE></RESOURCE></VOTABLE>`;

describe("readVotableTabledata", () => {
  it("parses FIELD declarations (name, datatype)", () => {
    const path = writeFixture(GD1_SHAPED_FIXTURE);
    const { fields } = readVotableTabledata(path);
    expect(fields.map((f) => f.name)).toEqual([
      "ra",
      "dec",
      "distance",
      "phot_g_mean_mag",
    ]);
    expect(fields.every((f) => f.datatype === "double")).toBe(true);
  });

  it("round-trips real-shaped double values across multiple rows", () => {
    const path = writeFixture(GD1_SHAPED_FIXTURE);
    const { rows } = readVotableTabledata(path);
    expect(rows).toHaveLength(2);
    expect(rows[0].ra).toBeCloseTo(178.462158, 6);
    expect(rows[0].dec).toBeCloseTo(53.793951, 6);
    expect(rows[0].distance).toBeCloseTo(8559.613497, 6);
    expect(rows[0].phot_g_mean_mag).toBeCloseTo(16.234, 6);
    expect(rows[1].ra).toBeCloseTo(179.1, 6);
  });

  it("treats an empty <TD/> cell as null (a real GD-1 missing-distance row shape)", () => {
    const path = writeFixture(GD1_SHAPED_FIXTURE);
    const { rows } = readVotableTabledata(path);
    expect(rows[1].distance).toBeNull();
  });

  it("parses char and int cell types (the NEARGALCAT column shape)", () => {
    const xml = `<VOTABLE><RESOURCE><TABLE nrows="1">
<FIELD arraysize="*" datatype="char" name="name"></FIELD>
<FIELD datatype="double" name="ra"></FIELD>
<FIELD datatype="int" name="radial_velocity"></FIELD>
<DATA><TABLEDATA>
  <TR><TD>NGC 224</TD><TD>10.68</TD><TD>-301</TD></TR>
</TABLEDATA></DATA>
</TABLE></RESOURCE></VOTABLE>`;
    const path = writeFixture(xml);
    const { rows } = readVotableTabledata(path);
    expect(rows[0].name).toBe("NGC 224");
    expect(rows[0].ra).toBeCloseTo(10.68, 6);
    expect(rows[0].radial_velocity).toBe(-301);
  });

  it("throws a clear error when no FIELD declarations are present", () => {
    const path = writeFixture(
      `<VOTABLE><RESOURCE><TABLE><DATA><TABLEDATA></TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>`,
    );
    expect(() => readVotableTabledata(path)).toThrow(/no <FIELD>/);
  });

  it("throws a clear error when the file has no TABLEDATA block (e.g. a BINARY2 file)", () => {
    const path = writeFixture(
      `<VOTABLE><RESOURCE><TABLE><FIELD datatype="double" name="ra"></FIELD><DATA><BINARY2><STREAM encoding='base64'></STREAM></BINARY2></DATA></TABLE></RESOURCE></VOTABLE>`,
    );
    expect(() => readVotableTabledata(path)).toThrow(/no <TABLEDATA>/);
  });

  it("throws a clear error on a row/schema cell-count mismatch", () => {
    const path = writeFixture(
      `<VOTABLE><RESOURCE><TABLE><FIELD datatype="double" name="ra"></FIELD><FIELD datatype="double" name="dec"></FIELD><DATA><TABLEDATA><TR><TD>1.0</TD></TR></TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>`,
    );
    expect(() => readVotableTabledata(path)).toThrow(
      /row has 1 cells, expected 2/,
    );
  });
});
