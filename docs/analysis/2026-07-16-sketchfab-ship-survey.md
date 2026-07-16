# Sketchfab Ship Survey

## Selection Rules

The replacement ship should satisfy all of the following:

- Clear free-to-use license
- Original enough to avoid franchise or rights-conflict risk
- Reasonable render budget for desktop and mobile
- Strong silhouette and readable thruster layout
- Compatible with either:
  - the current prototype engine's simple ship treatment, or
  - a future glTF-based rendering upgrade

## Current Engine Constraint

The prototype does not currently load textured or animated 3D assets. It fetches `assets/ship.obj`, extracts face edges, normalizes the mesh, and renders a gold wireframe:

- `Interactive Outerspace Portfolio/space-engine.js`
- `Interactive Outerspace Portfolio/assets/ship.obj`

Current prototype ship asset stats:

- File size: `392,663` bytes
- Vertex lines: `2,923`
- Face lines: `2,834`

Because of that, a heavily animated Sketchfab model is not a drop-in win by itself. Legal clarity and silhouette matter more than built-in animation unless the renderer changes too.

## Recommended Shortlist

### 1. Sci-Fi Aircraft | Spaceship Fighter

Link: [Sketchfab model](https://sketchfab.com/3d-models/sci-fi-aircraft-spaceship-fighter-99c1d15965c74f3aa7b5999e2d4e42e1)

- Why it fits:
  Sleek silhouette, original look, and enough detail to feel premium without jumping into desktop-only territory.
- License:
  CC Attribution
- Performance:
  36.4k triangles, 18.2k vertices
- Source note:
  The author explicitly says the model is free to use and asks to be informed if used in projects.
- Recommendation:
  Best overall balance if the visual goal is "futuristic but still portfolio-friendly."

Source: [Sketchfab model page](https://sketchfab.com/3d-models/sci-fi-aircraft-spaceship-fighter-99c1d15965c74f3aa7b5999e2d4e42e1), revalidated on 2026-07-16.

### 2. SCIFI SpaceShip Star Gun

Link: [Sketchfab model](https://sketchfab.com/3d-models/scifi-spaceship-star-gun-c080b873732d49428244516857cd3112)

- Why it fits:
  Strong thruster read, compact geometry, and the author explicitly says it can be used for games and mobile games.
- License:
  CC Attribution
- Performance:
  13.3k triangles, 6.7k vertices
- Source note:
  The page says it uses 3 draw calls, 2 main thrusters, and mini exhaust at the back.
- Recommendation:
  Best low-risk performance pick if mobile smoothness matters more than a flashy silhouette.

Source: [Sketchfab model page](https://sketchfab.com/3d-models/scifi-spaceship-star-gun-c080b873732d49428244516857cd3112), revalidated on 2026-07-16.

### 3. SpaceShip by JazOone

Link: [Sketchfab model](https://sketchfab.com/3d-models/spaceship-6164a883f57f4f13938c3c5999bc0e1f)

- Why it fits:
  More polished and detailed than many free options while still staying inside a usable triangle range.
- Validation status:
  **Unverified — do not select yet.** The supplied Sketchfab URL could not be retrieved during the 2026-07-16 revalidation, so its license, download availability, geometry, and author claims are not treated as current facts. Recheck the model page and download package before moving it back to the shortlist.

### 4. Stylised Spaceship

Link: [Sketchfab model](https://sketchfab.com/3d-models/stylised-spaceship-e75f5c71eb684f58b483335d4e3fa06d)

- Why it fits:
  Strong silhouette and readable surfaces without needing extreme geometry density.
- License:
  CC Attribution
- Performance:
  49.9k triangles, 26.4k vertices
- Recommendation:
  Best if the site should feel more authored and less militarized.

Source: [Sketchfab model page](https://sketchfab.com/3d-models/stylised-spaceship-e75f5c71eb684f58b483335d4e3fa06d), revalidated on 2026-07-16.

### 5. Spaceship Organic

Link: [Sketchfab model](https://sketchfab.com/3d-models/spaceship-organic-685c3f04cc8d485495020a014063843a)

- Why it fits:
  Distinct non-standard silhouette and still lightweight enough for a richer render path.
- License:
  CC Attribution
- Performance:
  22.3k triangles, 15.6k vertices
- Recommendation:
  Good wildcard if the brand direction wants something less conventional and more memorable.

Source: [Sketchfab model page](https://sketchfab.com/3d-models/spaceship-organic-685c3f04cc8d485495020a014063843a), revalidated on 2026-07-16.

## Strong Candidates That Still Get Rejected

### Light Fighter Spaceship - Free -

Link: [Sketchfab model](https://sketchfab.com/3d-models/light-fighter-spaceship-free-51616ef53af84fe595c5603cd3e0f3e1)

- Problem:
  The author notes that rights belong to EVERSPACE.
- Why that matters:
  Even if the platform marks it as free, that provenance warning makes it a poor choice for a personal-brand website.

### Futuristic Transport Shuttle Animated

Link: [Sketchfab model](https://sketchfab.com/3d-models/futuristic-transport-shuttle-animated-2292ce758e114a5f87626d81404d5f44)

- Good:
  Clearly rigged and animated, 20.8k triangles
- Problem:
  CC Attribution-NonCommercial
- Why that matters:
  A portfolio can easily overlap with promotional or commercial use, so this is not clean enough.

### Star Fighter Low-Poly

Link: [Sketchfab model](https://sketchfab.com/3d-models/star-fighter-low-poly-3cfa041b19c745be9d1358a094292b31)

- Good:
  Explicit shooting animations, 36.3k triangles
- Problem:
  CC Attribution-NonCommercial
- Why that matters:
  Same portfolio licensing ambiguity as above.

### Rocket Spaceship Concept - Animated

Link: [Sketchfab model](https://sketchfab.com/3d-models/rocket-spaceship-concept-animated-5680eb9042164a3cbbf0ea00cd00275a)

- Good:
  Original design and explicit animation
- Problem:
  540k triangles, 281.6k vertices
- Why that matters:
  Too heavy for the mobile-friendly rendering target. The embedded viewer itself warns that the model is too heavy for some devices.

### spaceship animation by lilpro

Link: [Sketchfab model](https://sketchfab.com/3d-models/spaceship-animation-565539586d6743f29f0311f1df45c47d)

- Validation status:
  **Unverified — do not select yet.** The page could not be retrieved during the 2026-07-16 revalidation. Treat the historical rejection notes as leads only; reconfirm its license, package contents, and geometry before use.

## Practical Recommendation

If the replacement needs to happen soon and remain mobile-safe:

1. Pick `SCIFI SpaceShip Star Gun` for the cleanest performance profile.
2. Pick `Sci-Fi Aircraft | Spaceship Fighter` if visual quality matters more than absolute budget.

If built-in animation is mandatory, the current engine is the real blocker, not model availability. The most usable path is:

1. choose a legally clean CC BY ship first,
2. move to glTF-friendly rendering,
3. then add emissive, banking, exhaust, or skeletal animation on top.

## License Handling Note

For Creative Commons models, Sketchfab's own developer guidance says attribution should follow the asset and include the creator and source link:
[Sketchfab Download API Guidelines](https://sketchfab.com/developers/download-api/guidelines)

For CC BY 4.0 specifically, attribution also needs the license link and an indication of changes. The final chosen ship should therefore get its own credits-panel entry with the title, creator, Sketchfab source link, CC BY 4.0 link, and a note that it was converted or optimized if applicable. See [Creative Commons' CC BY 4.0 deed](https://creativecommons.org/licenses/by/4.0/).
