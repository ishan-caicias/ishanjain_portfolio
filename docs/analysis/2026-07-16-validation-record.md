# Space Scene Analysis Validation Record

**Validation date:** 2026-07-16  
**Scope:** the four documents in `docs/analysis/`, the checked-in app, the prototype, the listed Sketchfab assets, and package-registry metadata.

## Method

- Repository findings were checked against the current working tree, `package.json`, `package-lock.json`, and the named source files.
- Package metadata was checked with `npm view` on 2026-07-16.
- Model license, geometry, and author statements were checked on the linked Sketchfab model pages. A page that could not be retrieved is marked **unverified**, not inferred from the earlier survey.

## Confirmed repository findings

| Finding                                                                                              | Evidence                                                                                                                 | Result    |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------- |
| The production Astro site still uses the Starfield / StarModal interaction model.                    | `src/components/sections/Hero.astro`, `src/components/islands/Starfield.tsx`, and `src/components/islands/StarModal.tsx` | Confirmed |
| The travel experience remains in the prototype.                                                      | `Interactive Outerspace Portfolio/space-engine.js` and `Space Portfolio.dc.html`                                         | Confirmed |
| The prototype ship is parsed from `assets/ship.obj` and drawn as a wireframe with point-sprite glow. | `space-engine.js` fetch and `_drawShip()` implementation                                                                 | Confirmed |
| The ship placement is clip-space and scroll-state driven.                                            | `_drawShip()` uses NDC placement and `window.scrollY`                                                                    | Confirmed |
| The key fixed-screen layers include station markers, warp UI, arrival vista, and section overlays.   | `Space Portfolio.dc.html`                                                                                                | Confirmed |
| The OBJ has 2,923 vertex lines and 2,834 face lines.                                                 | `assets/ship.obj`                                                                                                        | Confirmed |

## Corrected package baseline

| Package           | Requested in `package.json` | Resolved in `package-lock.json` |
| ----------------- | --------------------------- | ------------------------------- |
| Astro             | `^5.2.0`                    | `5.17.1`                        |
| React / React DOM | `^19.0.0`                   | `19.2.4`                        |
| Motion            | `^11.15.0`                  | `11.18.2`                       |
| TypeScript        | `^5.7.0`                    | `5.9.3`                         |
| typescript-eslint | `^8.20.0`                   | `8.54.0`                        |
| @astrojs/check    | `^0.9.0`                    | `0.9.6`                         |

The earlier claim that the repository was already on Astro 7 and TypeScript 6 was false. Registry checks also show that the latest available majors are not a patch-level upgrade path from this baseline; they are intentionally excluded from the scene-delivery scope.

## Third-party model validation

| Model                                                                                                                                      | Status     | Revalidated facts                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------ |
| [Sci-Fi Aircraft \| Spaceship Fighter](https://sketchfab.com/3d-models/sci-fi-aircraft-spaceship-fighter-99c1d15965c74f3aa7b5999e2d4e42e1) | Confirmed  | CC BY; 36.4k triangles; 18.2k vertices                                                     |
| [SCIFI SpaceShip Star Gun](https://sketchfab.com/3d-models/scifi-spaceship-star-gun-c080b873732d49428244516857cd3112)                      | Confirmed  | CC BY; 13.3k triangles; 6.7k vertices; 3 draw calls stated by the author                   |
| SpaceShip by JazOone                                                                                                                       | Unverified | Page could not be retrieved; do not select without a fresh page and download-package check |
| [Stylised Spaceship](https://sketchfab.com/3d-models/stylised-spaceship-e75f5c71eb684f58b483335d4e3fa06d)                                  | Confirmed  | CC BY; 49.9k triangles; 26.4k vertices                                                     |
| [Spaceship Organic](https://sketchfab.com/3d-models/spaceship-organic-685c3f04cc8d485495020a014063843a)                                    | Confirmed  | CC BY; 22.3k triangles; 15.6k vertices                                                     |
| spaceship animation by lilpro                                                                                                              | Unverified | Page could not be retrieved; do not select without a fresh check                           |

The rejection evidence for the Everspace-derived, CC BY-NC, and 540k-triangle entries was also confirmed from their respective current pages.

## Runtime texture policy

The original 4K texture source remains only in the ignored `resources/` conversion input. The runtime GLB deliberately ships one quality tier: four 1024×1024 WebP textures. This avoids the substantially higher decoded GPU/VRAM allocation of a 4K texture set and keeps the scene within the mobile-browser performance budget. The application must not add a 4K runtime asset or capability-based texture selection in this delivery; an adaptive high-quality tier needs separately budgeted scope, measurements, and acceptance criteria.

## Implications

1. The realism diagnosis remains sound: spatial integration and flight staging are the dominant gaps, not framework age.
2. A full framework migration is not justified for a ship replacement. A ship-focused glTF proof of concept is the appropriate technical decision gate.
3. The selected delivery asset is `Sci-Fi Aircraft | Spaceship Fighter` by `valterjherson1`. Its supplied GLB is the browser-oriented source input; Phase 1 will produce and measure a separately optimized GLB before it is added to the runtime payload.
4. Before publishing any CC BY model, include title, author, source URL, CC BY 4.0 URL, and an indication of any conversion or optimization. [Sketchfab's guidance](https://sketchfab.com/developers/download-api/guidelines) requires author and source attribution; [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) specifies the attribution, license-link, and change-indication obligations.
