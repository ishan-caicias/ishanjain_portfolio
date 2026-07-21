/* budgets.config.mjs — the single source of truth for every shipping-weight ceiling.
 *
 * WHY THIS FILE EXISTS, AND WHY IT IS DATA RATHER THAN CODE. Until PF-10 C4 the budgets lived as
 * a `const BUDGETS = {...}` literal inside `scripts/check-bundle-budgets.mjs`, which made every
 * tuning pass a code edit in a file full of measurement logic. They are now here, alone, so that
 * adjusting a ceiling is a one-line data change with a comment next to it — which is exactly the
 * workflow the owner asked for: ship, measure on real hardware, then walk the numbers in.
 *
 * THE RULE THAT MAKES THESE MEAN ANYTHING (unchanged from the original gate, and load-bearing):
 * budgets RATCHET DOWN when the payload shrinks and are only ever raised DELIBERATELY, here, with
 * a comment and a TR reference. A budget quietly raised to make CI green is worse than no budget,
 * because it converts a real signal into a rubber stamp. If you are raising a number, the diff
 * should say why in the same commit.
 *
 * TWO FAMILIES, MEASURED DIFFERENTLY ON PURPOSE:
 *
 *   `bundle` — gzip bytes over dist/_astro. Gzip is the right unit because that is what the wire
 *   carries for JS and WASM, and because the TR-027 barrel-import canary (`largestChunkGz`) only
 *   works in gzip terms: a raw-byte gate would be swamped by ordinary source growth.
 *
 *   `assets` — RAW bytes over public/assets. Gzip is meaningless here: JPEG and PNG are already
 *   entropy-coded, so gzipping them saves ~0% while costing real CPU on every gate run. Raw bytes
 *   are also what the visitor's disk cache and Netlify's egress actually see.
 *
 * WHY THE ASSET GATE READS public/assets RATHER THAN dist/. `astro build` copies public/ into
 * dist/ verbatim, so the two are byte-identical for this purpose — but reading the source tree
 * means the asset half of the gate needs NO BUILD. That is what lets it run cheaply from the
 * `predev`/`prepreview` hooks and as a fast standalone check in CI, instead of only after a
 * multi-minute build.
 */

/** Ceilings for the JS/WASM payload, in GZIP kilobytes over `dist/_astro`. */
export const bundle = {
  /** Any large regression across the whole JS payload (both engines + app; PF-09's ~900 KB
   * engine budget is subsumed). Measured 1031 KB on 2026-07-19 (TR-052); ~15% headroom. */
  totalJsGz: 1200,

  /** The TR-027 canary, and the most important number in this file. An accidental
   * `@babylonjs/core` BARREL import materializes as a single ~1.1 MB chunk and trips this
   * instantly — which no name-based attribution could promise. Measured ~100 KB. */
  largestChunkGz: 300,

  /** The lazy Havok payload, fetched only on the Babylon path. Measured 646 KB. */
  totalWasmGz: 700,
};

/** Ceilings for `public/assets`, in RAW megabytes.
 *
 * NEW IN PF-10 C4 (2026-07-21), and it closes a real hole: `budget:check` gated JS and WASM only,
 * while `public/assets` grew to 209 MB across PF-10 — the SDSS field, the DR3 belt, the planetary
 * surface maps and 1,364 baked VT normal tiles — with nothing watching it at all. The 63 MB of VT
 * tiles the owner had to be asked about by hand would have surfaced here automatically.
 *
 * THESE START AT THE HIGH-WATER MARK, BY OWNER DIRECTION. Unlike the bundle numbers above (which
 * carry ~15% headroom off a measured baseline), the asset ceilings are set AT the largest measured
 * value to date with no slack. That is deliberate: nobody yet knows what this scene's real asset
 * weight budget should be, because it has never been measured on real hardware over a real
 * network. Pinning at the high-water mark means the gate answers the only question currently
 * answerable — "did this grow?" — loudly and with attribution, and the numbers get walked DOWN as
 * real-device data arrives (ADR-0008's post-ship measurement obligation).
 *
 * So: tripping this gate is not a failure. It is the gate doing its job. Land the growth, then
 * raise the number here in the same commit with a one-line why.
 */
export const assets = {
  /** Everything under public/assets, recursively.
   *
   * RAISED 208.92 -> 255.26 MB, 2026-07-21 (TR-079), and the raise is the deliberate kind this
   * file's header describes rather than a green-the-CI edit. Cause, in full: completing the
   * hi-res texture pack added 3 bodies that had been skipped outright (dione, rhea, tethys),
   * 9 real normal maps for bodies that had been rendering as smooth spheres, and Earth — whose
   * surface turned out to exist as a cubemap the pipeline's `tex/base/` glob never looked at.
   *
   * The gate caught this addition on its very first run, which is the intended behaviour and
   * the reason it exists: the 63 MB of VT tiles the owner previously had to be asked about by
   * hand would have surfaced the same way.
   *
   * KNOWN SLACK, recorded rather than trimmed (see TR-079): 6.58 MB of `-base` (2048) tier maps
   * are shipped but NEVER FETCHED — `babylon-engine.ts` reads only `.high` and `.ultra`. The
   * tier is kept because C4.3's tier/budget gating is precisely the work that will consume it,
   * and deleting it now would mean rebaking it then. It is 2.6% of the total; the real levers
   * are `ultra` (70.1 MB) and the VT pyramid (62.9 MB), both of which want real-device
   * measurement before anyone trims them.
   *
   * RATCHETED DOWN 255.5 -> 254.5 in the same session, which is the other half of the rule
   * working: Astra's Earth brief established that the night-lights map cannot produce a single
   * visible pixel at this scene's zero arrival phase, so it was dropped and the ceiling followed
   * the payload down rather than being left as slack.
   *
   * THEN CORRECTED 254.5 -> 256.5, and the reason is worth keeping rather than smoothing into the
   * line above: 254.5 was measured against a DAMAGED directory. This pipeline's first
   * orphan-pruner had deleted 19 real assets it did not own — the 18 per-body dossier images the
   * celestial catalogs reference, plus venus-cloud.jpg — and the "high-water mark" was taken
   * while they were missing. Restoring them added back 1.77 MB and the gate immediately failed
   * again, which is the third time in one session it has done its job: a measurement is only as
   * trustworthy as the state it was taken in. */
  totalMB: 256.5,

  /** The largest single file. Attribution, not a second total: a 45 MB asset appearing where the
   * previous maximum was 8 MB is a different kind of event from the total drifting up by 45 MB
   * across a thousand tiles, and the two want different conversations. Currently `sdss18.png` at
   * 44.94 MB (C2's full 3,637,862-record galaxy field). */
  perFileMB: 45.0,

  /** Per-directory ceilings, so a regression is attributable to a feature rather than to
   * "assets". A group absent from this map is unbudgeted and only counts toward `totalMB`;
   * loose files directly under public/assets are grouped as `(root)`.
   *
   * High-water marks measured 2026-07-21. `planets` dominates and is the one to watch: it holds
   * C4's surface/height tiers AND the C4.2 VT normal-tile pyramid, whose level 4 alone is ~50 MB.
   *
   * Values are the measured maximum rounded UP to the nearest 0.1 MB — enough to absorb
   * byte-level encoder noise between `sharp`/mozjpeg versions, not enough to hide a real
   * addition. */
  groupsMB: {
    // RAISED 122.0 -> 169.5, 2026-07-21 (TR-079) — the pack completion above, plus the 1.77 MB
    // of restored assets described in `totalMB`. Breakdown, so a future trim has somewhere to
    // start: base 6.6 / high 28.6 / ultra 69.1 / VT tiles 62.9 / catalog dossier images 1.8.
    planets: 169.5,
    "(root)": 59.7,
    dso3: 15.0,
    dso2: 7.2,
    dso: 3.9,
    craft: 1.5,
  },
};

export default { bundle, assets };
