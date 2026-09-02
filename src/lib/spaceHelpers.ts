// Pure helpers ported from the prototype's DCLogic class (Space Portfolio.dc.html).
// Kept side-effect-free (except drawGlobe, which is an explicit canvas renderer) so they're
// easy to reason about and test independent of React state.
import type { CelestialEntry } from "@/data/celestial/celestial.d.ts";
import type { SpaceEngineFieldInfo } from "@/lib/space-engine.d.ts";

export function fmtDist(e: CelestialEntry): string {
  if (e.t === "planet" || e.t === "moon" || e.t === "dwarf" || e.id === "sun") {
    return "Solar System";
  }
  if (e.ly == null) return "distance —";
  const ly = e.ly;
  if (ly >= 1e9) return (ly / 1e9).toFixed(1) + " billion ly";
  if (ly >= 1e6) return (ly / 1e6).toFixed(1) + " million ly";
  if (ly >= 1000) return Math.round(ly).toLocaleString() + " ly";
  return ly + " ly";
}

const RARITY_COLORS: Record<string, string> = {
  common: "#9fa8da",
  uncommon: "#66bb6a",
  rare: "#7986cb",
  epic: "#b39ddb",
  legendary: "#ffd54f",
  field: "#78909c",
};

export function rarityColor(r: string): string {
  return RARITY_COLORS[r] || "#9fa8da";
}

export function fmtRa(ra: number): string {
  const h = Math.floor(ra / 15);
  const m = Math.floor((ra / 15 - h) * 60);
  return String(h).padStart(2, "0") + "h " + String(m).padStart(2, "0") + "m";
}

export function fmtC(v: number): string {
  if (!v || v <= 0) return "";
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "×10⁹ c";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "×10⁶ c";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "×10³ c";
  if (v >= 10) return Math.round(v) + " c";
  return v.toFixed(2) + " c";
}

// --- Class-aware collector-card / arrival-vista visual fallback (PF-11 defect P1) -----------
//
// CollectorCard.tsx and ArrivalVista.tsx each render one of a small set of visual treatments for
// a body's image panel. Before this fix both computed that choice from `!!e.img`/`!!e.fig` ALONE
// — never consulting `e.t` (the body's real class: star/galaxy/nebula/cluster/blackhole/moon/
// dwarf/...) — so any photo-less non-star (a galaxy, a nebula, a globular cluster, a black hole)
// rendered the literal sun-surface texture (`/assets/star-tex.jpg`) under a "SPECTRAL RENDER · "
// caption that was simply false for that body. Measured against the real catalog this was 74.4%
// of all bodies (docs/analysis/2026-07-29-owner-device-pass-and-defect-triage.md, Defect #6).
//
// `resolveCardVisual` is the single place that decision is made now, so the two card components
// cannot drift back out of sync with each other the way they drifted out of sync with `e.t`. It
// returns a `kind` (which JSX branch to render) and an honest `caption` in one call. New
// class-aware kinds are PURELY PROCEDURAL — CSS gradients and deterministic SVG glyphs derived
// from the body's own `c` (hex glow colour) and `id` — no new image assets, matching how `isFig`
// already renders constellation lines with zero images and how the star glow already derives its
// gradient from `c`.
export type CardVisualKind =
  | "globe" // planet/moon/dwarf WITH a real equirect surface photo -> drawGlobe canvas
  | "figure" // has a constellation figure -> SVG line diagram (figGeom)
  | "photo" // has a real image, not surface-mapped -> flat photo panel
  | "star" // no image/figure, class is (or defaults to) star -> procedural star glow
  | "nebula" // no image, class nebula -> diffuse gas-cloud gradient
  | "galaxy" // no image, class galaxy -> spiral/elliptical glow
  | "cluster" // no image, class cluster -> scattered bound-star-point glyph
  | "blackhole" // no image, class blackhole -> event-horizon ring
  | "moon" // no image, class moon -> procedural cratered sphere shading
  | "asteroid" // no image, class dwarf (minor planet) -> irregular rock silhouette
  | "generic"; // no image, unrecognised/future class -> neutral glow, honest caption

export interface CardVisual {
  kind: CardVisualKind;
  caption: string;
}

const CLASS_VISUAL: Record<string, { kind: CardVisualKind; caption: string }> =
  {
    nebula: { kind: "nebula", caption: "PROCEDURAL RENDER · NEBULA CLASS" },
    galaxy: { kind: "galaxy", caption: "PROCEDURAL RENDER · GALAXY CLASS" },
    cluster: { kind: "cluster", caption: "PROCEDURAL RENDER · CLUSTER CLASS" },
    blackhole: {
      kind: "blackhole",
      caption: "PROCEDURAL RENDER · BLACK HOLE CLASS",
    },
    moon: { kind: "moon", caption: "PROCEDURAL RENDER · MOON CLASS" },
    dwarf: {
      kind: "asteroid",
      caption: "PROCEDURAL RENDER · MINOR PLANET CLASS",
    },
  };

export function resolveCardVisual(e: CelestialEntry): CardVisual {
  const isGlobe =
    (e.t === "planet" || e.t === "moon" || e.t === "dwarf") && !!e.img;
  if (isGlobe)
    return { kind: "globe", caption: "SURFACE MAP · NASA / GAIA SKY" };
  if (e.fig) return { kind: "figure", caption: "FIGURE · HIPPARCOS POSITIONS" };
  if (e.img)
    return {
      kind: "photo",
      caption: "IMAGE · " + (e.crd || "NASA / ESA ARCHIVES"),
    };
  const cls = CLASS_VISUAL[e.t];
  if (cls) return cls;
  if (e.t === "star")
    return { kind: "star", caption: "SPECTRAL RENDER · " + (e.sp || "") };
  // Unrecognised class with no image/figure (e.g. a future body type) — still honest about what
  // it is rather than silently reusing the star caption for a non-star.
  return {
    kind: "generic",
    caption: "PROCEDURAL RENDER · " + e.t.toUpperCase(),
  };
}

/** Internal authoring marker for catalog entries with no content pass yet (TR-061's honesty
 * convention: an explicit `[[TODO: ...]]` placeholder rather than invented flavour text). Several
 * bulk-generated catalog files (celestial-nbg.js, celestial-gd1.js, celestial-ngc2000.js,
 * celestial-clusters.js) ship entries whose `f` is literally this marker, in a few slightly
 * different wordings — never intended to reach a visitor as-is. */
const FIELD_NOTE_TODO_RE = /^\s*\[\[TODO:/i;

/** Field note to show for a body, or `null` to omit the section entirely. Bulk-authored entries
 * with no content pass yet carry the honest internal `[[TODO: ...]]` marker described above —
 * showing that raw string to a visitor was never the intent, and per TR-061's own convention this
 * must NOT be papered over with invented flavour text, so the only honest fix is to not show a
 * field note at all until one is actually authored. */
export function resolveFieldNote(e: CelestialEntry): string | null {
  if (!e.f || FIELD_NOTE_TODO_RE.test(e.f)) return null;
  return e.f;
}

/** `e.lo` (sky-lore `[culture, text]` tuples), with the same `[[TODO: ...]]` authoring marker
 * filtered out — `celestial-clusters.js` ships some entries as `[["", "[[TODO: ...]]"]]` rather
 * than `null`, which without this would render an empty-culture lore card showing the raw marker
 * text (the same defect `resolveFieldNote` fixes for `e.f`, one field over). */
export function resolveLore(e: CelestialEntry): [string, string][] {
  return (e.lo || []).filter(([, text]) => !FIELD_NOTE_TODO_RE.test(text));
}

/** Deterministic small PRNG (mulberry32) seeded from a body id via an FNV-1a hash, so the
 * procedural glyphs below (cluster scatter, moon craters, asteroid silhouette) are stable across
 * re-renders and identical between CollectorCard and ArrivalVista for the same body, rather than
 * reshuffling on every paint. Not cryptographic — just a cheap, well-distributed hash-to-PRNG. */
function seededRandom(id: string, salt: number): () => number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DotGlyph {
  x: number;
  y: number;
  r: number;
}

/** Scattered bound-point glyph for the "cluster" fallback — denser toward the centre (sqrt of a
 * uniform draw) so it reads as gravitationally bound rather than uniform noise. Coordinates sit
 * in the same 400x300 space `figGeom` already uses for the constellation-figure SVG, so both
 * card components can drop it into an identical `viewBox="0 0 400 300"` `<svg>`. */
export function clusterDots(e: CelestialEntry, count = 26): DotGlyph[] {
  const rnd = seededRandom(e.id, 0x1);
  const out: DotGlyph[] = [];
  for (let i = 0; i < count; i++) {
    const ang = rnd() * Math.PI * 2;
    const rad = Math.sqrt(rnd()) * 130;
    out.push({
      x: 200 + Math.cos(ang) * rad,
      y: 150 + Math.sin(ang) * rad * 0.75,
      r: 1.1 + rnd() * 2.2,
    });
  }
  return out;
}

/** Crater-pockmark glyph for the "moon" fallback (a real moon with real physical stats but no
 * surface photo — e.g. celestial-missing-moons.js's Mimas/Iapetus/Phobos/Triton/Charon). Same
 * 400x300 space as `clusterDots`, tighter radius so it reads as a disc's relief, not a scatter. */
export function moonCraters(e: CelestialEntry, count = 9): DotGlyph[] {
  const rnd = seededRandom(e.id, 0x2);
  const out: DotGlyph[] = [];
  for (let i = 0; i < count; i++) {
    const ang = rnd() * Math.PI * 2;
    const rad = Math.sqrt(rnd()) * 78;
    out.push({
      x: 200 + Math.cos(ang) * rad,
      y: 150 + Math.sin(ang) * rad,
      r: 3 + rnd() * 7,
    });
  }
  return out;
}

/** Irregular lumpy-silhouette polygon (as an SVG `points` string) for the "asteroid" fallback —
 * jittered radius around a circle, standing in for the small, non-spherical minor planets that
 * ship with real orbital/physical data but no imagery (celestial-minorplanets.js). Same 400x300
 * space as the other glyphs above. */
export function asteroidSilhouette(e: CelestialEntry, points = 12): string {
  const rnd = seededRandom(e.id, 0x3);
  const cx = 200;
  const cy = 150;
  const baseR = 95;
  const pts: string[] = [];
  for (let i = 0; i < points; i++) {
    const ang = (i / points) * Math.PI * 2;
    const r = baseR * (0.72 + rnd() * 0.34);
    pts.push(
      `${(cx + Math.cos(ang) * r).toFixed(1)},${(cy + Math.sin(ang) * r * 0.72).toFixed(1)}`,
    );
  }
  return pts.join(" ");
}

/** Diffuse, irregular gas-cloud gradient for the "nebula" fallback — three overlapping soft
 * radial blobs at `c`, rather than one centred glow, so it doesn't read as just a blurry star. */
export function nebulaGradient(c: string): string {
  return [
    `radial-gradient(circle at 34% 38%, ${c}77 0%, ${c}3d 26%, transparent 55%)`,
    `radial-gradient(circle at 66% 62%, ${c}66 0%, ${c}2e 30%, transparent 60%)`,
    `radial-gradient(circle at 50% 50%, ${c}33 0%, transparent 70%)`,
  ].join(", ");
}

/** Flattened, bright-cored elliptical glow for the "galaxy" fallback — an edge-on disc silhouette
 * rather than the nebula's diffuse blobs or the star's round core. */
export function galaxyGradient(c: string): string {
  return [
    `radial-gradient(ellipse 62% 20% at 50% 50%, #fff 0%, ${c} 14%, ${c}cc 30%, ${c}44 52%, transparent 74%)`,
    `radial-gradient(ellipse 90% 34% at 50% 50%, ${c}22 0%, transparent 70%)`,
  ].join(", ");
}

/** Dark core + thin bright accretion ring + faint halo for the "blackhole" fallback — the inverse
 * of every other class here (light comes from a ring around darkness, not a glowing centre). */
export function blackholeGradient(c: string): string {
  return [
    `radial-gradient(circle at 50% 50%, #000 0%, #000 29%, ${c}33 30.5%, ${c}ee 32.5%, ${c}33 34.5%, transparent 46%)`,
    `radial-gradient(circle at 50% 50%, transparent 55%, ${c}22 78%, transparent 100%)`,
  ].join(", ");
}

/** Base sphere shading for the "moon" fallback, under the `moonCraters` glyph — an off-centre
 * highlight and a dark limb, evoking a lit sphere without an actual surface photo. */
export function moonGradient(c: string): string {
  return `radial-gradient(circle at 36% 32%, ${c} 0%, ${c}cc 40%, ${c}66 72%, #05081a 100%)`;
}

export interface FigGeom {
  figStars: { x: string; y: string; r: number }[];
  figLines: { x1: string; y1: string; x2: string; y2: string }[];
}

export function figGeom(e: CelestialEntry): FigGeom {
  const fig = e.fig!;
  const ras = fig.s.map((q) => q[0]);
  const decs = fig.s.map((q) => q[1]);
  const mnR = Math.min(...ras);
  const mxR = Math.max(...ras);
  const mnD = Math.min(...decs);
  const mxD = Math.max(...decs);
  const cosD = Math.cos((((mnD + mxD) / 2) * Math.PI) / 180);
  const spanR = Math.max(0.001, (mxR - mnR) * cosD);
  const spanD = Math.max(0.001, mxD - mnD);
  const scale = Math.min(320 / spanR, 220 / spanD);
  const pts = fig.s.map((q) => ({
    x: 200 - (q[0] - (mnR + mxR) / 2) * cosD * scale,
    y: 150 - (q[1] - (mnD + mxD) / 2) * scale,
  }));
  return {
    figStars: pts.map((pt, i) => ({
      x: pt.x.toFixed(1),
      y: pt.y.toFixed(1),
      r: i === 0 ? 4 : 2.5,
    })),
    figLines: fig.l.map(([a, b]) => ({
      x1: pts[a].x.toFixed(1),
      y1: pts[a].y.toFixed(1),
      x2: pts[b].x.toFixed(1),
      y2: pts[b].y.toFixed(1),
    })),
  };
}

// Typed deep-layer populations (byte 15 of the packed record) - see DATA.md.
// PF-11 D5.3: exported so the search console's class rows ("A WHITE DWARF · NEAREST
// INSTANCE") share these exact labels rather than duplicating them.
export const FIELD_TYPES: Record<
  number,
  { n: string; d: string; sp: string; c: string; f: string; cat: string }
> = {
  1: {
    n: "OC ",
    d: "Open cluster · Hunt-Reffert DR3 / MWSC / OCDR2",
    sp: "Open cluster",
    c: "#ffcc80",
    f: "A gravitationally bound family of stars — one of 8,076 real clusters rendered from Gaia DR3 and MWSC catalogs.",
    cat: "Open cluster catalogs",
  },
  2: {
    n: "WD ",
    d: "White dwarf · Gentile Fusillo et al. eDR3",
    sp: "White dwarf",
    c: "#b3e5fc",
    f: "A dead star's collapsed core, Earth-sized but half a solar mass — one of 9,000 nearest white dwarfs from Gaia eDR3.",
    cat: "eDR3 white dwarf catalog",
  },
  3: {
    n: "SDSS ",
    d: "Galaxy · Sloan Digital Sky Survey DR12",
    sp: "Galaxy",
    c: "#f8bbd0",
    f: "An entire galaxy, reduced to one point of light — sampled from 327,835 SDSS DR12 galaxies with real comoving distances.",
    cat: "SDSS DR12",
  },
  4: {
    n: "GD-1 ",
    d: "Stellar stream member · GD-1",
    sp: "Stream star",
    c: "#80deea",
    f: "A star torn from a shredded globular cluster — the GD-1 stream stretches 30° across the northern sky, all 1,365 members here are real.",
    cat: "GD-1 stream",
  },
  5: {
    n: "EXO ",
    d: "Planet host · NASA Exoplanet Archive",
    sp: "Exoplanet host",
    c: "#ffe082",
    f: "This star has at least one known planet — one of 4,134 systems rendered from the NASA Exoplanet Archive.",
    cat: "NASA Exoplanet Archive",
  },
  6: {
    n: "AST ",
    d: "Asteroid · Gaia DR3 (NEA / Trojan)",
    sp: "Asteroid",
    c: "#bcaaa4",
    f: "A Gaia DR3 asteroid — its sky position is computed from real orbital elements for today's date.",
    cat: "DR3 asteroid catalogs",
  },
  7: {
    n: "OORT ",
    d: "Oort cloud particle · simulation",
    sp: "Comet nucleus",
    c: "#b0bec5",
    f: "A sentinel of the deep freeze — the Oort cloud model places trillions of icy bodies up to a light-year from the Sun.",
    cat: "Oort cloud particle set",
  },
};

const SPECTRAL_COLORS: Record<string, string> = {
  "O/B V": "#bcd4ff",
  "A V": "#dbe9ff",
  "F V": "#fff8e7",
  "G V": "#ffe082",
  "K V": "#ffcc80",
  "M V": "#ff8a65",
};

function spectralClassFor(colorIndex: number): string {
  if (colorIndex < 22) return "O/B V";
  if (colorIndex < 60) return "A V";
  if (colorIndex < 105) return "F V";
  if (colorIndex < 150) return "G V";
  if (colorIndex < 200) return "K V";
  return "M V";
}

/**
 * Synthesizes a collector-card entry for one of the ~200k uncurated field stars/deep-layer
 * objects (id "fs-N"), which aren't in the hand-curated CELESTIAL catalog.
 */
export function entryForFieldStar(
  id: string,
  index: number,
  fi: SpaceEngineFieldInfo,
): CelestialEntry {
  const pad = String(index).padStart(6, "0");
  const tp = FIELD_TYPES[fi.type];
  if (tp) {
    return {
      id,
      n: tp.n + pad,
      d: tp.d,
      t: "star",
      r: "field",
      ra: fi.ra,
      dec: fi.dec,
      ly: fi.ly,
      mg: fi.mg.toFixed(2),
      sp: tp.sp,
      img: null,
      c: tp.c,
      con: "—",
      st: [
        [
          "Distance",
          fi.ly > 1e6
            ? (fi.ly / 1e6).toFixed(1) + " million ly"
            : Math.round(fi.ly).toLocaleString() + " ly",
          Math.min(1, fi.ly / 9000),
        ],
        ["Source", tp.cat, 0.6],
        ["Class", tp.sp, 0.5],
      ],
      f: tp.f,
      lo: null,
    };
  }
  const sp = spectralClassFor(fi.ci);
  return {
    id,
    n: "HIP-field " + pad,
    d: "Hipparcos source · van Leeuwen 2007",
    t: "star",
    r: "field",
    ra: fi.ra,
    dec: fi.dec,
    ly: fi.ly,
    mg: fi.mg.toFixed(2),
    sp,
    img: null,
    c: SPECTRAL_COLORS[sp],
    con: "—",
    st: [
      [
        "Distance",
        Math.round(fi.ly).toLocaleString() + " ly",
        Math.min(1, fi.ly / 9000),
      ],
      ["Apparent mag", fi.mg.toFixed(2), Math.max(0.05, (7 - fi.mg) / 7)],
      ["Spectral est.", sp, 0.5],
      ["Catalog", "Hipparcos new reduction", 0.5],
    ],
    f: "One of 117,955 real Hipparcos stars in the field layer — every point of light in this sky answers when you reach for it.",
    lo: null,
  };
}

/**
 * Hand-rolled equirectangular-to-sphere texture mapper (ray-marched, Lambertian shading +
 * limb darkening) - renders entry.img onto a canvas as a lit globe. Ported verbatim from
 * the prototype's _drawGlobe; not rewritten with a WebGL/Three.js approach to keep this a
 * faithful port rather than a redesign.
 */
export function drawGlobe(
  canvas: (HTMLCanvasElement & { _drawnFor?: string }) | null,
  entry: CelestialEntry,
): void {
  if (!canvas || canvas._drawnFor === entry.id || !entry.img) return;
  canvas._drawnFor = entry.id;
  const img = new Image();
  img.onload = () => {
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const src = document.createElement("canvas");
    src.width = img.width;
    src.height = img.height;
    const sctx = src.getContext("2d");
    if (!sctx) return;
    sctx.drawImage(img, 0, 0);
    const sd = sctx.getImageData(0, 0, img.width, img.height).data;
    const R = Math.min(W, H) * 0.4;
    const cx = W / 2;
    const cy = H / 2 + 6;
    const out = ctx.createImageData(W, H);
    const od = out.data;
    const lx = -0.45;
    const lyt = -0.35;
    const lz = 0.82;
    const rot = 1.2;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const nx = (px - cx) / R;
        const ny = (py - cy) / R;
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        const lat = Math.asin(-ny);
        const lon = Math.atan2(nx, nz) + rot;
        const u = Math.floor(
          ((((lon / (Math.PI * 2)) % 1) + 1) % 1) * img.width,
        );
        let v = Math.floor((0.5 - lat / Math.PI) * img.height);
        v = Math.max(0, Math.min(img.height - 1, v));
        const si = (v * img.width + u) * 4;
        let shade = Math.max(0, nx * lx + ny * lyt + nz * lz);
        shade = 0.16 + 0.88 * shade;
        shade *= 0.55 + 0.45 * nz;
        const oi = (py * W + px) * 4;
        od[oi] = sd[si] * shade;
        od[oi + 1] = sd[si + 1] * shade;
        od[oi + 2] = sd[si + 2] * shade;
        const edge = Math.min(1, (1 - d2) * 14);
        od[oi + 3] = 255 * edge;
      }
    }
    ctx.putImageData(out, 0, 0);
  };
  img.src = entry.img;
}
