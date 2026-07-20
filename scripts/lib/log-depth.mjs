/* log-depth.mjs — PF-10 C2: log-scaled world-depth helpers, ported from ship-dynamics.ts.
 *
 * Duplicated deliberately, not imported — matching the established convention in this repo's
 * build scripts (gaia-whitedwarf-pngpack.mjs's header states the same rationale: build scripts
 * stay outside the live-engine-adjacent module graph rather than importing across it). Kept as
 * its own small `scripts/lib/` module (rather than inlined in gaia-sdss18-pngpack.mjs) so a unit
 * test can cross-check both functions against the real `src/lib/ship-dynamics.ts` exports
 * value-for-value, instead of trusting the copy by inspection.
 */

/** MUST stay numerically identical to ship-dynamics.ts's bodyDepth() — pinned by a cross-check
 * unit test (tests/unit/log-depth.test.ts). */
export function bodyDepth(ly) {
  return 150 + 128 * Math.log10((ly || 0.001) + 1.5);
}

/** MUST stay numerically identical to ship-dynamics.ts's raDecToDir() — same guarantee. */
export function raDecToDir(ra, dec) {
  const d2r = Math.PI / 180;
  const cd = Math.cos(dec * d2r);
  return [
    cd * Math.cos(ra * d2r),
    cd * Math.sin(ra * d2r),
    Math.sin(dec * d2r),
  ];
}
