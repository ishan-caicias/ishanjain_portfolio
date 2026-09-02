/* gaiasky-orbit-json.mjs — PF-10 C3: streaming reader for Gaia Sky's orbital-element catalogs.
 *
 * A FIFTH local serialization, after VOTable BINARY2 (TR-061), VOTable TABLEDATA (TR-065), FITS
 * binary tables (TR-063) and Gaia Sky's own BinaryPointDataProvider format (TR-066): the asteroid
 * packs ship plain, pretty-printed JSON — but at a size where `JSON.parse` is the wrong tool.
 * `resources/gaia_datasets/catalog-asteroids-dr3/asteroids-dr3.json` is 150.7 MB of UTF-8 holding
 * 154,635 real objects; parsing it whole materializes the entire object graph at once, which is
 * exactly the allocation pattern PF-10 C0's "Honest limits" and TR-066's SDSS streaming decode
 * flagged as the thing to avoid past ~1M records-worth of data.
 *
 * This reader instead walks the byte stream, tracks brace depth (string- and escape-aware, so a
 * `{` or `"` inside an asteroid's name can never desynchronize it), and hands each top-level
 * element of the `"objects"` array to a callback as its own small parsed object. Peak retained
 * memory is one chunk plus one record, not one catalog.
 *
 * Deliberately NOT a general JSON streaming parser: it understands exactly the shape every Gaia
 * Sky `*-asteroids-*.json` / `orbits-*.json` file uses — `{ "objects": [ {...}, {...} ] }` — and
 * throws rather than guessing if that shape is absent. Narrow, verifiable, and testable off-disk
 * via `streamObjectsFromString`.
 */
import { createReadStream } from "node:fs";

/** Matches the array header this reader is specialized for. */
const OBJECTS_HEADER = /"objects"\s*:\s*\[/;

/** Incremental brace-depth scanner over a growing string buffer.
 *
 * Kept as an explicit state object rather than a closure so both the file-stream and the
 * in-memory entry points below share one implementation (and so a unit test can drive it a
 * chunk at a time, which is the only way to prove the cross-chunk cases actually work). */
function createScanner(onObject) {
  return {
    started: false,
    buf: "",
    depth: 0,
    start: -1,
    inStr: false,
    esc: false,
    scanFrom: 0,
    count: 0,
    done: false,

    /** Feed one chunk; invokes `onObject(parsed, index)` for every element completed by it. */
    push(chunk) {
      if (this.done) return;
      this.buf += chunk;
      if (!this.started) {
        const m = OBJECTS_HEADER.exec(this.buf);
        // Not found yet: the header may straddle this chunk boundary, so keep buffering.
        if (!m) return;
        this.buf = this.buf.slice(m.index + m[0].length);
        this.scanFrom = 0;
        this.started = true;
      }
      // `consumed` advances past each completed record; the buffer is compacted ONCE per chunk
      // rather than once per record — slicing per record turns this into an O(n * bufferSize)
      // copy (77 GB of memmove across the real 154,635-record file), which measurably dominates
      // the run.
      let consumed = 0;
      for (let i = this.scanFrom; i < this.buf.length; i++) {
        const ch = this.buf[i];
        if (this.inStr) {
          if (this.esc) this.esc = false;
          else if (ch === "\\") this.esc = true;
          else if (ch === '"') this.inStr = false;
          continue;
        }
        if (ch === '"') {
          this.inStr = true;
          continue;
        }
        if (ch === "{") {
          if (this.depth === 0) this.start = i;
          this.depth++;
          continue;
        }
        if (ch === "}") {
          this.depth--;
          if (this.depth === 0 && this.start >= 0) {
            onObject(
              JSON.parse(this.buf.slice(this.start, i + 1)),
              this.count++,
            );
            this.start = -1;
            consumed = i + 1;
          }
          continue;
        }
        // The `]` that closes the "objects" array at depth 0 ends the catalog. Without this the
        // scanner runs on into the wrapper object's own closing `}` and reports depth -1 —
        // a real failure the first smoke run caught, not a hypothetical.
        if (ch === "]" && this.depth === 0) {
          this.done = true;
          consumed = i + 1;
          break;
        }
      }
      this.scanFrom = this.buf.length - consumed;
      if (consumed > 0) {
        this.buf = this.buf.slice(consumed);
        if (this.start >= 0) this.start -= consumed;
      }
    },

    finish() {
      if (!this.started) {
        throw new Error(
          'gaiasky-orbit-json: no `"objects": [` array found — not a Gaia Sky object catalog',
        );
      }
      if (this.depth !== 0) {
        throw new Error(
          `gaiasky-orbit-json: truncated input — brace depth ${this.depth} at end of stream`,
        );
      }
      return this.count;
    },
  };
}

/** Stream a Gaia Sky object catalog from disk. Resolves with the number of objects emitted. */
export async function streamGaiaSkyObjects(path, onObject) {
  const scanner = createScanner(onObject);
  const rs = createReadStream(path, {
    encoding: "utf8",
    highWaterMark: 1 << 20,
  });
  for await (const chunk of rs) {
    scanner.push(chunk);
    if (scanner.done) break; // array closed; the wrapper's tail is of no interest
  }
  return scanner.finish();
}

/** In-memory counterpart — the same scanner, fed from one or more strings. Exists so unit tests
 * can prove the cross-chunk state machine (strings spanning a boundary, an object split mid-key,
 * braces inside names) without writing 150 MB fixtures to disk. */
export function streamObjectsFromString(chunks, onObject) {
  const scanner = createScanner(onObject);
  for (const c of Array.isArray(chunks) ? chunks : [chunks]) scanner.push(c);
  return scanner.finish();
}
