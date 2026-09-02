# Validation Checklist — Ship-v2 Release (P5)

Pre-merge state verified 2026-07-18 ([TR-020](../test-reports/TR-020.md)); the Post-deploy
section is to be executed after the first production deploy.

## Verified pre-merge

- [x] Full suite green: **47/47 unit · 44/44 E2E** · build exit 0 · ESLint/Prettier/astro check clean
- [x] Shell payload (document + scripts + styles + fonts): **0.997 MiB** — within the 10 MiB
      hero budget; craft GLB is a separate lazy fetch (1K **0.412 MiB** / 2K **1.019 MiB**)
- [x] `npm audit`: **0 vulnerabilities**
- [x] Default-on rollout: auto tier policy E2E-proven (2K desktop / 1K narrow); `?craft=off`
      and the quality selector restore the wireframe
- [x] CC-BY-4.0 attribution: credits panel row (title, author, source, license, changes note) +
      `public/assets/craft/LICENSE.txt` served alongside the assets
- [x] Failure fallbacks: craft error → wireframe; no-WebGL → DOM fallback (both E2E)
- [x] Owner visual sign-off: received 2026-07-17 ("looks good") + 2.5× center-stage revision
      applied and re-captured
- [x] Rollback documented: [runbook](../runbooks/2026-07-18-craft-rollback.md)

## Post-deploy (first production deploy after merge)

- [ ] **GLB is binary, not an LFS pointer:**
      `curl -s https://ishanjain.dev/assets/craft/sci-fi-fighter-2k.glb | head -c4` → must be
      `glTF` (not `vers`). If pointer: Netlify is not materializing LFS — see TR-014 notes.
- [ ] Craft reaches `ready` on the production URL (DevTools:
      `document.querySelector("space-engine").dataset.craftState`)
- [ ] Zero console errors on production load (mirrors `page-load-console.spec.ts`)
- [ ] Fonts render (Inter/Space Grotesk — first deploy where they ever work, TR-016)
- [ ] **Real-device performance:** mid-tier Android + iPhone Safari — smooth travel, no
      thermal/jank complaints; the SwiftShader frame-time probe (115.9 ms EMA) is a software
      rasterizer artifact and NOT a real-device signal (TR-020)
- [ ] CI stays green on the PR (LFS pointer-skip mode is expected and documented)

## Standing decisions carried forward

- CI checks out without `lfs: true` (bandwidth quota trade-off) — binary asset integrity is
  validated on dev machines; revisit only if a pointer-corruption incident ever occurs.
- Quality-selector discoverability outside Data & Licenses — future UX call.
