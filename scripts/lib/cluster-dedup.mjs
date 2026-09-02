/* cluster-dedup.mjs — PF-10 C1: angular/distance dedup helpers for the cluster background layer.
 *
 * Extracted from gaia-clusters-pngpack.mjs so a unit test can exercise the dedup logic directly
 * without executing that script's main() (which reads real local dataset files and writes a PNG
 * asset — not something a CI unit test should trigger).
 */

/** Great-circle angular separation, degrees. */
export function angularSepDeg(ra1, dec1, ra2, dec2) {
  const d2r = Math.PI / 180;
  const cosc =
    Math.sin(dec1 * d2r) * Math.sin(dec2 * d2r) +
    Math.cos(dec1 * d2r) * Math.cos(dec2 * d2r) * Math.cos((ra1 - ra2) * d2r);
  return (Math.acos(Math.max(-1, Math.min(1, cosc))) * 180) / Math.PI;
}

/** True when (ra, dec, distanceLy) is close enough in the sky AND in distance to one of the
 * `curated` entries ({ra, dec, ly}) to treat as the same physical cluster. When distanceLy isn't
 * finite, angular closeness alone is treated as sufficient (nothing to disagree with). */
export function isDuplicateOfCurated(
  ra,
  dec,
  distanceLy,
  curated,
  angleDeg,
  distanceFrac,
) {
  for (const c of curated) {
    if (angularSepDeg(ra, dec, c.ra, c.dec) >= angleDeg) continue;
    if (!Number.isFinite(distanceLy)) return true;
    const relDiff = Math.abs(distanceLy - c.ly) / c.ly;
    if (relDiff <= distanceFrac) return true;
  }
  return false;
}
