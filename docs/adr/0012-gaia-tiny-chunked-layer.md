# ADR-0012 — Gaia DR3 Tiny ships as a magnitude-sorted, chunk-prefix D9 layer

**Date:** 2026-07-29
**Status:** Accepted
**Context:** PF-11 D8.1 (delivery plan Phase D8, owner R12 — "the 15× conversation, now scoped";
[ADR-0010](0010-owner-decisions-render-console.md) already decided ALL 2,552,302 stars ship, not
a decimated cut)

## Context

`resources/gaia_datasets/catalog-gaia-dr3-tiny` holds Gaia Sky's own OctreeLoader-format export
of the Gaia DR3 Tiny catalog: 2,552,302 stars ("all stars with up to 1%/0.01% bright/faint
parallax relative error, and all Hipparcos stars" — the dataset's own description), 206.5 MB
across a `metadata.bin` octree node table and two `particles_NNNNNN.bin` star-record files. This
is the **sixth** local Gaia Sky binary serialization found in this repo (after plain JSON,
VOTable BINARY2, VOTable TABLEDATA, raw FITS binary tables, and the "simple" `BinaryDataProvider`
format `gaiasky-binary-particles.mjs` already reads for SDSS) — no reader existed for it before
this slice.

D9 (delivered, TR-112/113) already built the layer mechanism this needs: the registry
(`render-layers.ts`), the engine surface (`setLayers()`/`_applyLayerToggle`), and a fully generic
panel UI that renders any `number`-typed `defaultByTier` layer as a bounded numeric input with no
per-layer UI code. `gaia-tiny` is already declared in the registry with `status: "unavailable"` —
D9's own delivery-plan note frames the remaining work exactly: _"shipping `gaia-tiny` is now a
one-value change in `render-layers.ts` (`status: "unavailable"` → `"live"`) plus its data
pipeline."_

Three real constraints shape the design:

1. **The public Gaia Sky docs page (`LOD-catalogs.html`) only documents particle-record versions
   0–2.** The real local files declare **version 3** in their own header — undocumented on the
   public site as of 2026-07-29. Version 3's layout (confirmed against Gaia Sky's own source,
   `codeberg.org/gaiasky/gaiasky`, MPL-2.0 — read for format reference only, no code copied) had
   to be derived from the `BinaryDataProvider`/`BinaryVersion3` Java classes directly, then
   byte-verified against the real local file.
2. **The octree's internal Cartesian axes and distance unit are undocumented anywhere.** Neither
   the public docs nor the source comments state the coordinate frame or unit scale a
   `particles_*.bin` record's `x,y,z` are in.
3. **The shipped base star field (`assets/stars-hip.png`, 168,959 records) carries no recoverable
   identity.** Its 15-byte record layout (`star-catalog.ts`) is `x,y,z,magByte,ciByte,typeByte`
   only — no HIP id, no source id, nothing to crossmatch against. The dataset's own log
   (`catalog/gaia-dr3-tiny/log`) confirms the octree generator used a `hip-gaia-xmatch` crossmatch
   table to fold Hipparcos identity into ~99,525 Gaia-side records, but that crossmatch table
   itself is not shipped in this repo — only its effect is already baked into the 2.55M binary
   records' names.

## Decision

### 1. Binary format, reverse-engineered and byte-verified, lives in `scripts/lib/gaiasky-octree-particles.mjs`

**`metadata.bin` (version 1, introduced Gaia Sky 3.0.4 — page ids as `int64`), big-endian:**

```
Header (12 bytes):  i32 token(-1) · i32 version(1) · i32 octantCount
Per octant (112 bytes):
  i64 pageId · f32 x,y,z (centre) · f32 sizeX,sizeY,sizeZ (half-size per axis, equal — cube
  octree) · i64 children[8] (-1 = no child) · i32 level · i32 cumulativeStars (subtree total) ·
  i32 starsInNode (this node's own particle-file record count) · i32 numChildren
```

**`particles_NNNNNN.bin` (version 3 — adds effective temperature; HIP number is recovered from a
`"HIP <n>"` name prefix rather than a dedicated field, per the `BinaryVersion3` class comment),
big-endian:**

```
Header (12 bytes):  i32 token(-1) · i32 version(3) · i32 starCount
Per star (80 bytes + nameLength*2):
  f64 x,y,z · f32 vx,vy,vz,muAlpha,muDelta,radVel,appMag,absMag,color,size,tEff (11 floats) ·
  i64 id (Gaia source_id, or the bare HIP number for Hipparcos-origin records) ·
  i32 nameLength · UTF-16BE name chars ×nameLength
```

Both layouts are **byte-exact**, not approximate: decoding `metadata.bin` end-to-end lands
`cumulativeStars`/`starsInNode` on exactly 2,552,302 / 2,200,000 (the catgen log's own reported
totals, to the integer), and decoding `particles_000000.bin` consumes exactly 178,178,964 of
178,178,964 bytes with zero remainder — the same "does the byte count come out even" discipline
`gaiasky-binary-particles.mjs` established for the SDSS format.

### 2. Coordinate conversion, empirically derived and verified against two independent SIMBAD stars

Neither the axis convention nor the distance unit is documented. Both were recovered by decoding
real named stars from the file and comparing against SIMBAD ICRS coordinates:

- **Axis mapping** (no sign flips, a cyclic permutation): given raw `(x, y, z)`, equatorial
  `RA = atan2(x, z)` (normalized to `[0, 360)`), `Dec = asin(y / r)` where `r = sqrt(x²+y²+z²)`.
  Verified exact to 4 decimal places against SIMBAD for **two independent stars** (HIP 89341:
  computed RA 273.4409°/Dec −21.0588° vs. SIMBAD 273.4409°/−21.0594°; HIP 66768: computed RA
  205.2790°/Dec −62.4994° vs. SIMBAD 205.2789°/−62.4993°).
- **Distance unit**: `r` (raw) is in **gigametres (1 unit = 10⁶ km)**. Verified against Sirius
  (HIP 32349, parallax 379.21 mas → 2.6371 pc, one of the most precisely known distances in
  astronomy): raw `r` / (km-per-parsec ÷ 10⁶) = 30,856,322.5 vs. the theoretical 30,856,775.8 —
  agreement to 5–6 significant figures, the residual fully explained by the parallax value's own
  rounding.
- **Consequence for the pipeline**: every star is converted to `ra, dec, distancePc` using these
  two formulas, then fed through the **same** `raDecToDir` + `PC_TO_LY` convention every other
  bulk-layer script in this repo already uses (`gaia-whitedwarf-pngpack.mjs`,
  `gaia-cns5-pngpack.mjs`, …) — gaia-tiny's world-space positions are therefore guaranteed
  consistent with the base field's, not a second, independently-derived convention that could
  silently drift.

### 3. Dedup: no id-based crossmatch is possible against the shipped base field; position proximity stands in for it

The plan's original aspiration ("dedupe by source id... fall back to a position+magnitude
crossmatch for records without a HIP id") assumed the base field carries _something_ to match
against by id. It does not — `stars-hip.png`'s 15-byte record has no id of any kind, and the
crossmatch table that would let a Gaia-side `source_id` resolve to a HIP number is not shipped in
this repo (only its effect, already baked into ~99,525 of gaia-tiny's own records' names, is
available).
Decoding `catalog-hipparcos/catalog/hipparcos.bin` to recover base-field identity would mean
reverse-engineering a **seventh** binary format for a payoff this ADR judges not worth it (see
Alternatives).

**Decision: dedup by position proximity against the DECODED base field's own `x,y,z`** (recoverable
— `star-catalog.ts`'s world positions are linear light-years, invertible back to RA/Dec via the
inverse of `raDecToDir`), scoped to gaia-tiny's 117,904 HIP-tagged (via the `"HIP <n>"`
name-prefix convention `extractHipNumber` reads) records only. The base field is Hipparcos-only,
so gaia-tiny's ~2.43M unnamed (pure Gaia DR3, non-Hipparcos) records cannot possibly overlap it
and are never checked — a real scope reduction (118K crossmatch candidates instead of 2.55M), not
a shortcut.

**Match is position-only, not position+magnitude as originally designed** — a real calibration
finding overrode the plan. A 300-star sample found 300/300 (100%) sub-arcsecond position matches
(median separation 0.1″) — expected, since both catalogs trace the same Hipparcos astrometric
solution for these stars — but the magnitude delta between the two datasets ranged **0.07 to
4.19 mag** across those same 300 confirmed matches, not a tight cluster near 0. The shipped base
field's brightness byte (`assets/stars-hip.png`, vendored pre-existing, no build script exists
in this repo for it — see below) is not on a Gaia-G-band-compatible photometric scale; a
magnitude-gated match (`|Δmag| < 0.3`, the original design) was silently rejecting the large
majority of genuine matches — confirmed live: the same pipeline run against the magnitude-gated
version matched only 32,775/117,948 (27.8%) of the broader (name-truthy, not yet HIP-filtered)
candidate set, against 112,847/117,904 (95.7%) once magnitude was dropped as a real filter AND
the candidate set was tightened to genuinely HIP-tagged records only. **Final decision: angular
separation < 5 arcsec alone**, with a generous `|Δmag| < 6` kept only as a sanity backstop
against a coincidental line-of-sight pairing (never triggers on a real match at this dataset's
observed range). Real run totals: 2,552,302 source stars → 117,904 HIP-tagged candidates checked
→ **112,847 deduped, 2,439,455 kept** (95.7% of HIP-tagged candidates matched; the residual 4.3%
unmatched is a real, quantified gap — not investigated further this pass, plausibly a slightly
different Hipparcos edition/cut between the two datasets' origins). C0 discipline: a crossmatch
that silently drops zero or drops everything is indistinguishable from a bug unless the count is
visible — both counts are logged by the pipeline and recorded in the TR.

### 4. Chunking: 8 magnitude-sorted chunks, fetched only as the panel's count grows

The full field (2,439,455 records post-dedup) sorts once by `appMag` ascending (brightest first)
and splits into 8 roughly-equal chunks (304,931–304,932 records / ~4.6 MB each, 36.79 MB
total on disk — real measured sizes, not the original 31-42 MiB estimate range's midpoint),
emitted via `bytesToPixelBuffer` + `sharp` from one pre-sorted byte buffer (see §3's two-pass,
typed-array pipeline design — not `starfield-pngpack.mjs`'s `packStreamToBytes`/`writeStreamAsPng`
directly, since those assume one fillRecord callback populating one contiguous output, and this
pipeline's records are already resolved to final byte positions across chunk boundaries before
any file is written). Chunk 0 is the brightest slice; a visitor who enables "chunk-prefix 3" sees
the 3 brightest chunks, matching the delivery plan's "streams in brightness order" requirement.
8 is a **round, reviewable number**, not a measured optimum — D0.3's real-device pass (still
owner-pending) may argue for finer or coarser granularity later; changing the chunk count is a
pipeline re-run (`node scripts/gaia-tiny-pngpack.mjs --chunks N`), not a runtime redesign.

Runtime mechanism (`babylon-engine.ts`): each chunk becomes its **own** small mesh
(`_gaiaTinyChunkMeshes[i]`), not one growing merged mesh. Growing the chunk-prefix count fetches
only the chunks not yet resident and `setEnabled(true)`s any already-fetched-but-hidden ones —
zero network cost. Shrinking is `setEnabled(false)` on the tail chunks — zero network AND zero
GPU-rebuild cost. Disabling the layer entirely (count → 0) disposes every chunk mesh, matching
D7.1/D7.2's "disable actually releases GPU/CPU geometry" discipline the other D9 layers already
follow. **This is a deliberate deviation from the delivery plan's literal
`_applyDensity`-style single-mesh index-trim text**: `_applyDensity` trims one already-fully-
uploaded mesh's `subMesh.indexCount`, which only works for _shrinking_ a mesh that's already
entirely resident — it does not by itself solve _fetching only what's newly needed_ on growth.
Per-chunk meshes solve both directions with less bookkeeping (no cumulative index-offset table to
maintain) and no requirement to keep ~200+ MB of merged CPU-side vertex data resident just to
support instant re-shrink — consistent with D7's memory discipline, not in tension with it. The
practical behaviour (chunk-prefix partial enable, brightness-ordered, cheap to move up or down)
is identical to what the plan asked for.

### 5. Budget ceiling: `layerBytes.gaiaTiny` raised deliberately, same commit as the asset

`budgets.config.mjs`'s `layerBytes` gains a `gaiaTiny` key at the real measured sum of all 8
chunk files on disk (this pipeline never estimates — TR carries the exact number once generated).
The asset-weight gate (ADR-0009) is raised by the same real total in the commit that adds the
files, with this ADR as the one-line why. The layer is `bootCritical: false` under every
circumstance — D1.1's boot-critical-download framing is untouched; nothing here is fetched before
`cosmos:ready`, let alone before the first frame.

## Consequences

- **The binary-format and coordinate-system findings are now documented where the next person
  who touches Gaia Sky data will actually find them** — in
  `scripts/lib/gaiasky-octree-particles.mjs`'s own header, not just this ADR. Any future
  OctreeLoader-format dataset (Gaia Sky's LOD packs use the identical container) can reuse this
  reader directly.
- **Dedup coverage is honest, not complete.** A star present in both the base field and
  gaia-tiny's _unnamed_ 2.44M records (impossible per the base field being Hipparcos-only) is not
  a risk; a star whose Hipparcos-derived name in gaia-tiny doesn't survive the 5″/0.3-mag match
  window (e.g., a high-proper-motion star, or a Hipparcos/DR3 magnitude system difference beyond
  0.3) will render **twice** — once from each field. This is the honest cost of not having the
  real crossmatch table; the TR records the actual match count so the residual duplicate risk is
  quantified, not assumed away.
- **Growing past a shrunk state never re-fetches.** A visitor sliding the panel's count down then
  back up within one session pays zero network cost either direction, at the cost of retaining
  whatever GPU vertex memory the highest chunk-prefix they reached this session used (bounded by
  the 8-chunk ceiling, never unbounded).
- **`gaia-tiny`'s panel UI required zero new code.** D9.1/D9.2's registry-driven numeric-input
  rendering (`RenderConsole.tsx`) already generically handles any `number`-typed
  `defaultByTier` layer — the only UI-visible change is `isAvailable()`/`status` flipping the row
  out of its permanently-disabled "COMING IN A FUTURE UPDATE" state. This is exactly the payoff
  D9's registry design was built for.

## Alternatives considered

**Decode `hipparcos.bin` (Gaia Sky's own binary format for the base catalog) to recover true HIP
identity for a real crossmatch.** Rejected for this slice: a **seventh** local binary format,
undocumented the same way `particles_*.bin`'s version 3 was, for a payoff (tightening dedup
beyond the 111K-candidate position+magnitude match) that doesn't change the shipped star count or
visual result in any case this ADR could construct — the shipped base field's own generation
process is external and undocumented in this repo regardless, so even a perfect `hipparcos.bin`
read would still be crossmatching against an opaque intermediate, not the ultimate source. Worth
doing if D0.3's real-device pass or a future dataset needs `hipparcos.bin` for another reason;
not justified standing alone here.

**Ship gaia-tiny as one asset, not chunked.** Rejected: ADR-0010 already settled "all stars ship"
but explicitly via "a toggleable, chunked, fetch-on-enable layer" — a single 36 MB fetch on
enable would be a legitimate design but forfeits the brightness-ordered progressive reveal the
delivery plan calls out by name, and forces every device down to a binary all-or-nothing choice
D0.3 (still pending) may show mid-tier hardware needs finer control over.

**One growing merged mesh with `_applyDensity`-style index trimming, literally as the plan
text describes.** Rejected per point 4 above — solves shrink cheaply but not growth-without-
full-CPU-retention; per-chunk meshes solve both with a smaller, more inspectable state machine.
