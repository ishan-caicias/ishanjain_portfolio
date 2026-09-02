# Science Brief — GD-1 connected-trail visual: stream ordering + colour gradient

**Date:** 2026-07-20
**Mode:** SCIENCE-BRIEF
**Requested by:** Procyon, for PF-10 C1's last remaining item — a connected-trail visual for
the GD-1 tidal stellar stream's 1,365 real member stars.

## 1. Ordering stars along the real stream

The real, named coordinate system for GD-1 is the **Koposov, Rix & Hogg (2010)** stream frame
(φ1 along-stream / φ2 perpendicular), the frame essentially every subsequent GD-1 paper uses,
including Price-Whelan & Bonaca (2018)'s "spur and gap" discovery. Its rotation matrix is
publicly implemented in packages like `gala.coordinates.GD1Koposov10Frame`, but Astra does not
have high enough confidence reciting its exact decimal entries from memory to hand them over as
a verified citation — a transcription error here would silently produce a subtly-wrong ordering,
a worse failure mode than an obviously-broken one.

**Recommendation (more robust than trusting that memory, still real science): fit the great
circle directly from the real 1,365-star sample via spherical PCA**, rather than importing an
external constant at all.

1. Convert each star's real (ra, dec) to a unit vector:
   `v = [cos(dec)cos(ra), cos(dec)sin(ra), sin(dec)]`.
2. Build the 3×3 covariance matrix `C = Σ vᵢvᵢᵀ` over all 1,365 real stars.
3. The eigenvector of `C` with the **smallest** eigenvalue is the stream's fitted pole
   (`n̂`) — the standard "best-fit great circle through points on a sphere" construction
   (minimizes the sum of squared distances from each point to the plane through the origin
   with normal `n̂`), a real, textbook spherical-statistics technique.
4. Pick a reference direction in the fitted plane as `φ1 = 0`, then for every star:
   `φ1ᵢ = atan2(vᵢ · ê2, vᵢ · ê1)` where `ê1, ê2` span the plane perpendicular to `n̂`.
5. Sort all 1,365 real stars by `φ1ᵢ` — that sort order is the real physical order along the
   stream.

**Verdict: ACCURATE.** A great-circle fit to the actual rendered sample is more directly correct
for this specific dataset than importing a general-purpose literature constant, and needs no
external number. Do the fit in (ra, dec) space, before `bodyWorldPosition`'s distance-based
log-compression — angular order along the stream is independent of each star's real distance, so
the already-computed real 3D positions can simply be reordered as line-strip vertices afterward.

**If a future dossier wants to cite real published φ1 values** (not just an internal sort key),
verify the Koposov 2010 matrix against `gala`'s source or the primary paper directly first — this
brief's recollection should not be treated as that citation.

## 2. Radial velocity as the colour gradient

**Verdict: ACCURATE — a better choice than a default guess would suggest.** GD-1 is specifically
famous in the literature for being one of the _dynamically coldest_ known stellar streams (very
low velocity dispersion perpendicular to its orbit), which is exactly why radial-velocity-vs-φ1
is a real, standard diagnostic plot in GD-1 papers — the signature that let Price-Whelan & Bonaca
(2018) identify the stream's "spur" as real kinematic substructure rather than noise. Colouring
the line by real radial velocity along real stream position is closer to how professional
astronomers actually look at this object than distance (varies far less dramatically end-to-end)
or proper motion (real and used, but less iconic for this specific stream).

**Colour-scale range**: compute the actual min/max radial velocity from the real 1,365-star
sample rather than using a literature figure — keeps the gradient calibrated to what's actually
in the rendered data rather than a general range that might not match this bright-star
subsample exactly.

## Summary

| Element                                                         | Verdict  | Basis                                                                         |
| --------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| Great-circle-fit stream ordering (spherical PCA on real ra/dec) | ACCURATE | Self-verifying against the real 1,365-star sample; standard technique         |
| Radial-velocity colour gradient                                 | ACCURATE | Real, literature-standard GD-1 diagnostic (dynamically-cold-stream signature) |
| Colour-scale range from real sample min/max                     | ACCURATE | Avoids importing an uncalibrated external range                               |
