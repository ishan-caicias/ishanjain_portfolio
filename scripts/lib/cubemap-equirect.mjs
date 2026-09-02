/* cubemap-equirect.mjs — PF-10 C4 closeout: re-project a 6-face cubemap into the equirectangular
 * convention every other planetary surface map in this pipeline already uses.
 *
 * WHY THIS EXISTS. The record said "Earth has height-but-no-surface" and skipped Earth entirely.
 * That was wrong, and the reason it was wrong is worth keeping: `build-planet-textures.mjs` only
 * ever globbed `tex/base/`, and Earth's surface is the one body in the pack stored under
 * `tex/cubemap/` — six 8192x8192 faces of real visible-light imagery, plus night lights and a
 * cloud deck. Nothing about Earth was missing; the search was.
 *
 * A cubemap cannot be dropped onto Babylon's `CreateSphereVertexData` UVs, so it is resampled
 * here, once, offline, at the target tier's own resolution — never baked to a maximal equirect and
 * downscaled, which would resample twice and soften the result for nothing.
 *
 * ORIENTATION IS THE ENTIRE RISK, AND IT IS MEASURED RATHER THAN ASSUMED. A cubemap has 24
 * plausible per-face orientations and the failure mode is quiet: continents in the right places
 * but a face rotated, or the whole map mirrored, still reads as "Earth" at a glance. Guessing was
 * not an option, so the convention below is PINNED BY CORRELATION against
 * `tex/base/earth-specular-high.jpg` — an 8192x4096 EQUIRECT ocean/land mask shipped in the same
 * pack, in the same convention as every other map here. Land and ocean are unambiguous in both
 * images, so agreement between the re-projected day map and that mask is a real, quantitative
 * proof of orientation rather than an eyeball check. `scripts/validate-cubemap-orientation.mjs`
 * runs it; `tests/unit/cubemap-equirect.test.ts` pins the geometry itself.
 *
 * FACE NAMING is Gaia Sky's (and the wider skybox convention's): _rt _lf _up _dn _ft _bk, sampled
 * from INSIDE the cube looking out — which is what flips the vertical axis on the four side faces.
 */
import { join } from "node:path";
import sharp from "sharp";

/** Face suffixes in +X, -X, +Y, -Y, +Z, -Z order. */
export const FACE_ORDER = ["rt", "lf", "up", "dn", "ft", "bk"];

/** Direction (unit vector) for an equirectangular pixel centre.
 *
 * u = 0 is longitude -180°, v = 0 is the north pole — the mapping Babylon's sphere UVs produce
 * and `milky-way.ts` documents. Exported so the unit test can check it independently of any file
 * on disk. */
export function equirectDirection(u, v) {
  const lon = (u - 0.5) * 2 * Math.PI;
  const lat = (0.5 - v) * Math.PI;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.sin(lon), Math.sin(lat), cosLat * Math.cos(lon)];
}

/** Which face a direction hits, and where on that face, as (faceIndex, s, t) with s,t in [0,1].
 *
 * The per-face axis assignments are the standard inside-the-cube skybox convention. `t` is
 * derived so that +Y maps toward t = 0 (image top) on the side faces, matching how the faces are
 * authored to be viewed. */
export function directionToFace(d) {
  const [x, y, z] = d;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  let face, sc, tc, ma;
  if (ax >= ay && ax >= az) {
    ma = ax;
    if (x > 0) [face, sc, tc] = [0, -z, -y];
    else [face, sc, tc] = [1, z, -y];
  } else if (ay >= az) {
    ma = ay;
    if (y > 0) [face, sc, tc] = [2, x, z];
    else [face, sc, tc] = [3, x, -z];
  } else {
    ma = az;
    if (z > 0) [face, sc, tc] = [4, x, -y];
    else [face, sc, tc] = [5, -x, -y];
  }
  return { face, s: (sc / ma + 1) / 2, t: (tc / ma + 1) / 2 };
}

/** Re-project a cubemap into an equirectangular RGB buffer.
 *
 * `prefix` is the path stem shared by the six faces, e.g.
 * `resources/.../cubemap/earth-day-ultra/earth-day` -> `${prefix}_rt.jpg` and friends.
 *
 * THE FACES ARE PRE-REDUCED BEFORE SAMPLING, and this is a correction to this module's own first
 * draft rather than an optimisation. Each cube face spans exactly 90° of azimuth, so it lands on
 * `width / 4` pixels of the equirect — an 8192-px face feeding an 8192-wide equirect is a **4x
 * downscale**. Bilinear taps 2x2 of that 4x4 footprint, which does not filter it, it ALIASES it:
 * coastlines, the highest-contrast edges in the image and precisely where the eye goes, would
 * shimmer with sampling artefacts. The first draft did exactly this. Correcting it moved the 8192
 * Earth from 1.88 MB to 1.77 MB — a 6% DROP, which is the direction that confirms the diagnosis:
 * the extra bytes were encoding aliasing noise. (Byte count alone is not evidence of correctness
 * either way, and is recorded here only as the sign check it is; the orientation and geometry
 * proofs are `validate-cubemap-orientation.mjs` and the unit tests.)
 *
 * So each face is first reduced by `sharp` (a real Lanczos kernel) to `width / 2`, then sampled
 * bilinearly at roughly 2:1. `width / 2` rather than the naive `width / 4` because the gnomonic
 * cube-to-sphere mapping is NOT uniform: angular density at a face centre is exactly 2x that at
 * its edge (d/dt of atan(t) is 1 at t=0 and 1/2 at t=1), so reducing to the naive size would
 * correctly filter the centre while softening the edges — where four faces meet and any softness
 * shows as a seam.
 */
export async function cubemapToEquirect(prefix, width, height) {
  // See the header: half the equirect width per face, which is 2x the naive 90°-of-360° figure,
  // to hold detail at the face edges where the gnomonic mapping is least dense.
  const faceTarget = Math.max(64, Math.round(width / 2));
  const faces = [];
  for (const suffix of FACE_ORDER) {
    const src = sharp(`${prefix}_${suffix}.jpg`).removeAlpha();
    const meta = await src.metadata();
    const { data, info } = await (
      meta.width > faceTarget
        ? src.resize(faceTarget, faceTarget, {
            fit: "fill",
            kernel: "lanczos3",
          })
        : src
    )
      .raw()
      .toBuffer({ resolveWithObject: true });
    faces.push({ data, size: info.width, channels: info.channels });
  }

  const out = Buffer.alloc(width * height * 3);
  for (let py = 0; py < height; py++) {
    const v = (py + 0.5) / height;
    for (let px = 0; px < width; px++) {
      const u = (px + 0.5) / width;
      const { face, s, t } = directionToFace(equirectDirection(u, v));
      const f = faces[face];
      const n = f.size;
      // Bilinear, clamped at the face edge. Neighbouring faces are not consulted: the seam error
      // is at most half a texel of a 8192-wide face, which is ~0.02° of arc.
      const fx = Math.min(n - 1, Math.max(0, s * n - 0.5));
      const fy = Math.min(n - 1, Math.max(0, t * n - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(n - 1, x0 + 1);
      const y1 = Math.min(n - 1, y0 + 1);
      const wx = fx - x0;
      const wy = fy - y0;
      const c = f.channels;
      const o = (py * width + px) * 3;
      for (let ch = 0; ch < 3; ch++) {
        const p00 = f.data[(y0 * n + x0) * c + ch];
        const p10 = f.data[(y0 * n + x1) * c + ch];
        const p01 = f.data[(y1 * n + x0) * c + ch];
        const p11 = f.data[(y1 * n + x1) * c + ch];
        out[o + ch] =
          (p00 * (1 - wx) + p10 * wx) * (1 - wy) +
          (p01 * (1 - wx) + p11 * wx) * wy;
      }
    }
  }
  return { data: out, width, height };
}

/** Resolve a cubemap prefix from a directory that follows the pack's `<dir>/<stem>_<face>.jpg`
 * layout, where the stem is the directory name minus its tier suffix. Kept here so the pipeline
 * and the validator agree on it. */
export function prefixFor(root, dirName, stem) {
  return join(root, dirName, stem);
}
