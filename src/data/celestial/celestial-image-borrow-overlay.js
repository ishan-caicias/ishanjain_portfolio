/* celestial-image-borrow-overlay.js — PF-11 defect P1 (duplicate-id sub-fix).
 *
 * Several famous deep-sky objects exist TWICE in this catalog under different id namespaces —
 * once as an early hand-curated entry (celestial-catalog.js / celestial-extra.js, which HAS a
 * real photo) and again as a later mechanically-generated pack entry (celestial-clusters.js /
 * celestial-ngc2000.js / celestial-minorplanets.js, which does NOT) — because the generated packs
 * were built from independent source catalogs without deduplicating against the hand-curated set.
 * Two genuinely separate CelestialEntry objects, same real object, near-identical (ra,dec).
 *
 * This overlay finds those pairs PROGRAMMATICALLY (same class `t` + angular separation under
 * TOL_DEG) rather than hardcoding a fixed id list, per the owner's brief: real near-duplicates
 * elsewhere in these files should be caught too, but the match stays narrow enough that it can't
 * cross-pollinate unrelated objects (tight tolerance, same class required, and the candidate pool
 * is restricted to the "nameable DSO" classes below — never `star`, and never the `nbg-`/`gd1-`
 * bulk survey layers, which are synthetic/statistical populations with no hand-curated twin to
 * find).
 *
 * A REAL NEGATIVE RESULT, recorded rather than papered over: "ceres" (celestial-catalog.js, a
 * static representative position, ra 200/dec -8) and "minorplanet-ceres"
 * (celestial-minorplanets.js, a real Keplerian position for the 2026-07-20 snapshot, ra 80.4/dec
 * 21.4) are the SAME physical object but are NOT anywhere near each other in the sky — Ceres
 * orbits, so a static placeholder position and a real ephemeris position for a specific date
 * legitimately disagree by ~120°. This overlay correctly does NOT merge that pair; forcing it via
 * an id-based special case would be exactly the "cross-pollinate on identity, not position" hazard
 * the owner's brief warned against. `minorplanet-ceres` instead falls through to
 * celestial-dso4-imgmap.js's real-photo pipeline (or the class-aware procedural fallback) like its
 * sibling minor planets.
 *
 * OVERRIDE-ONLY, additive-safe: only ever SETS `img`/`crd` on an entry that already exists with
 * `img === null`; never adds, removes, or replaces an entry. Must run AFTER every base catalog
 * module (celestial-catalog.js, -extra.js, -imgmap.js, -extra2.js, -clusters.js, -ngc2000.js,
 * -minorplanets.js, ...) has populated `window.CELESTIAL` — wired into SpaceScene.tsx's own
 * `.then()` chain, after the initial `Promise.all`, for the same ordering reason
 * celestial-content-overlay.js documents at its own header (Promise.all does not order its array's
 * own module side effects relative to each other).
 */
(function () {
  "use strict";

  // Conservative: real published positions for the same object rarely disagree by more than a
  // few arcminutes across independent catalogs/epochs for non-moving deep-sky objects. 0.05° is
  // 3 arcmin — comfortably wider than catalog-to-catalog noise for the same fixed object, and
  // comfortably narrower than the separation between any two distinct real objects of the same
  // class in this catalog (checked against the shipped data: no false positive at this tolerance).
  var TOL_DEG = 0.05;

  // Only classes where this repo actually has two independent catalog layers describing the same
  // named objects (a hand-curated "greatest hits" set and a later mechanically-generated pack).
  // Deliberately excludes "star" (no generated star pack duplicates the hand-curated one) and
  // "galaxy" is included but the exclusion prefix below removes the one real bulk galaxy layer.
  var CANDIDATE_TYPES = {
    cluster: 1,
    nebula: 1,
    galaxy: 1,
    dwarf: 1,
    moon: 1,
    blackhole: 1,
  };

  // Bulk/statistical layers with no hand-curated twin — excluded by id prefix rather than relying
  // on class alone, since celestial-nbg.js is class "galaxy" and would otherwise enter the
  // candidate pool at 856 entries for no possible benefit (its objects are not individually
  // curated elsewhere in this catalog).
  var EXCLUDE_PREFIX = /^(nbg-|gd1-)/;

  function angularSepDeg(ra1, dec1, ra2, dec2) {
    var cosD = Math.cos((((dec1 + dec2) / 2) * Math.PI) / 180);
    var dRa = (ra1 - ra2) * cosD;
    var dDec = dec1 - dec2;
    return Math.sqrt(dRa * dRa + dDec * dDec);
  }

  var all = window.CELESTIAL || [];
  var candidates = all.filter(function (e) {
    return (
      CANDIDATE_TYPES[e.t] &&
      !EXCLUDE_PREFIX.test(e.id) &&
      typeof e.ra === "number" &&
      typeof e.dec === "number"
    );
  });
  var donors = candidates.filter(function (e) {
    return !!e.img;
  });
  var targets = candidates.filter(function (e) {
    return !e.img;
  });

  var borrowed = [];
  targets.forEach(function (t) {
    var best = null;
    var bestSep = TOL_DEG;
    for (var i = 0; i < donors.length; i++) {
      var d = donors[i];
      if (d.t !== t.t || d.id === t.id) continue;
      var sep = angularSepDeg(t.ra, t.dec, d.ra, d.dec);
      if (sep < bestSep) {
        bestSep = sep;
        best = d;
      }
    }
    if (best) {
      t.img = best.img;
      if (best.crd != null) t.crd = best.crd;
      borrowed.push({ from: best.id, to: t.id, sepDeg: bestSep });
    }
  });

  window.CELESTIAL_IMAGE_BORROW_COUNT = borrowed.length;
  // Kept for debugging/verification only (e.g. `window.CELESTIAL_IMAGE_BORROW_LOG` in a live
  // console) — nothing in the app reads this at runtime.
  window.CELESTIAL_IMAGE_BORROW_LOG = borrowed;
})();

export {};
