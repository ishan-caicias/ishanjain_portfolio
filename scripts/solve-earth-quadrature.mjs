// PF-11 D1.3 closeout — Earth α=90 photometry solver (Astra + Procyon).
// Integrates the SHIPPED planet-sphere shader math over the visible disc at
// α=0 and α=90 and reports the phase ratio R = flux(90)/flux(0), against the
// measured target Φ_E(90) = 0.236 (Mallama et al. 2017 phase polynomial:
// Δm = -1.060e-3·α + 2.054e-4·α², at α=90 → 1.568 mag → 0.236).
// Then solves the single cloud-term deficit constant d in
//   cloudRefl *= 1 - d * min(α/90, 1)
// such that R(d) = 0.236, preserving the α=0 budget exactly (factor 1 at α=0).
//
// Shader constants, verbatim from src/lib/planet-sphere.ts:
const RAYLEIGH_TAU = [0.0491, 0.0973, 0.2211];
const AEROSOL_TAU = 0.08;
const OCEAN_SIGMA2 = 0.03884;
const OCEAN_F0 = 0.02101;
const CLOUD_L = 0.9;
const EARTH_ALBEDO = 0.213; // clear-sky surface base, Lambert (L=0)
const CLOUD_FRAC = 0.2428; // shipped cloud map's solid-angle-weighted mean alpha
const OCEAN_FRAC = 0.71; // ocean fraction of the clear-sky part (glint mask)

// Fibonacci sphere sampling; view along +z, sun at angle alpha from view.
function fluxAtAlpha(alphaDeg, cloudDeficit) {
  const a = (alphaDeg * Math.PI) / 180;
  const sun = [Math.sin(a), 0, Math.cos(a)];
  const view = [0, 0, 1];
  const N = 400000;
  let flux = [0, 0, 0];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const z = 1 - (2 * i + 1) / N;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const th = ga * i;
    const n = [r * Math.cos(th), r * Math.sin(th), z];
    const mu = n[2]; // dot(n, view)
    if (mu <= 0) continue; // back hemisphere invisible
    const mu0 = Math.max(n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2], 0);
    if (mu0 <= 0) continue; // night side contributes ~nothing (ambient excluded)

    // Surface: pure Lambert (uLunarL = 0), base albedo 0.213.
    const surfI = EARTH_ALBEDO * mu0;

    // Ocean glint (Cox-Munk Torrance-Sparrow, shader-exact incl. clamps).
    const H = [sun[0] + view[0], sun[1] + view[1], sun[2] + view[2]];
    const hl = Math.hypot(...H);
    const Hn = [H[0] / hl, H[1] / hl, H[2] / hl];
    const cosTh = Math.max(n[0] * Hn[0] + n[1] * Hn[1] + n[2] * Hn[2], 1e-4);
    const cos2Th = cosTh * cosTh;
    const tan2 = (1 - cos2Th) / cos2Th;
    const slopeP =
      Math.exp(-tan2 / OCEAN_SIGMA2) /
      (Math.PI * OCEAN_SIGMA2 * cos2Th * cos2Th);
    const cosI = Math.max(
      Hn[0] * view[0] + Hn[1] * view[1] + Hn[2] * view[2],
      0,
    );
    const fres = OCEAN_F0 + (1 - OCEAN_F0) * Math.pow(1 - cosI, 5);
    const glint = (OCEAN_FRAC * fres * slopeP) / (4 * Math.max(mu0 * mu, 0.02));
    const glintI = glint * Math.PI * mu0;

    // Rayleigh + aerosol single scattering (shader-exact incl. clamps).
    const cosT = -(sun[0] * view[0] + sun[1] * view[1] + sun[2] * view[2]);
    const phaseR = 0.75 * (1 + cosT * cosT);
    const airDenom = 4 * Math.max(mu * mu0, 0.05);
    const air = RAYLEIGH_TAU.map(
      (t) => (t * phaseR + AEROSOL_TAU * 0.3) / airDenom,
    );
    const airI = air.map((v) => v * mu0);

    // Cloud slab: L = 0.9 Lunar-Lambert form, white, times the deficit factor.
    const deficit = 1 - cloudDeficit * Math.min(alphaDeg / 90, 1);
    const cloudRefl =
      ((2 * CLOUD_L * mu0) / Math.max(mu0 + mu, 1e-4) + (1 - CLOUD_L) * mu0) *
      deficit;

    // Per-pixel mix by cloud fraction (budget convention: binary-ish map).
    for (let c = 0; c < 3; c++) {
      const clear = surfI + glintI + airI[c];
      const I = (1 - CLOUD_FRAC) * clear + CLOUD_FRAC * cloudRefl;
      flux[c] += I * mu; // projected-area weighting
    }
  }
  return flux;
}

const lum = (f) => 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];

const f0 = fluxAtAlpha(0, 0);
const f90 = fluxAtAlpha(90, 0);
const R0 = lum(f90) / lum(f0);
console.log("Shipped shader phase ratio R = flux(90)/flux(0):", R0.toFixed(4));
console.log("Measured target Φ_E(90) (Mallama 2017):", 0.236);
console.log("Over-brightness factor at quadrature:", (R0 / 0.236).toFixed(3));

// Solve d by bisection so R(d) = 0.236.
let lo = 0,
  hi = 1;
for (let it = 0; it < 40; it++) {
  const mid = (lo + hi) / 2;
  const r = lum(fluxAtAlpha(90, mid)) / lum(f0);
  if (r > 0.236) lo = mid;
  else hi = mid;
}
const d = (lo + hi) / 2;
console.log("Solved CLOUD deficit d (cloudRefl *= 1 - d*α/90):", d.toFixed(4));
const rCheck = lum(fluxAtAlpha(90, d)) / lum(f0);
console.log("Check R(d):", rCheck.toFixed(4));

// Also report: surface-only and cloud-only phase ratios for the doc.
function fluxOnly(alphaDeg, which, deficit = 0) {
  const a = (alphaDeg * Math.PI) / 180;
  const sun = [Math.sin(a), 0, Math.cos(a)]; // view is fixed at +z
  const N = 200000;
  let flux = 0;
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const z = 1 - (2 * i + 1) / N;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const th = ga * i;
    const n = [r * Math.cos(th), r * Math.sin(th), z];
    const mu = n[2];
    if (mu <= 0) continue;
    const mu0 = Math.max(n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2], 0);
    if (mu0 <= 0) continue;
    let I = 0;
    if (which === "surface")
      I = mu0; // Lambert
    else {
      const df = 1 - deficit * Math.min(alphaDeg / 90, 1);
      I =
        ((2 * CLOUD_L * mu0) / Math.max(mu0 + mu, 1e-4) + (1 - CLOUD_L) * mu0) *
        df;
    }
    flux += I * mu;
  }
  return flux;
}
console.log(
  "Surface (Lambert) Φ(90):",
  (fluxOnly(90, "surface") / fluxOnly(0, "surface")).toFixed(4),
  "(analytic 0.3183)",
);
console.log(
  "Cloud slab (L=0.9) Φ(90), no deficit:",
  (fluxOnly(90, "cloud") / fluxOnly(0, "cloud")).toFixed(4),
);
console.log(
  "Cloud slab Φ(90) with solved deficit:",
  (fluxOnly(90, "cloud", d) / fluxOnly(0, "cloud")).toFixed(4),
);
