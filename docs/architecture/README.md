# Architecture

System and solution architecture for the space portfolio. Design decisions that
shape the codebase live here; the visual diagrams that illustrate them are in
[`diagrams/`](diagrams/).

| Document                                                                               | Scope                                                                                             |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [overview.md](overview.md)                                                             | Astro islands architecture, domain-driven `src/` layout, component boundaries, WebGL space-engine |
| [graphics-physics-engine-evaluation](2026-07-18-graphics-physics-engine-evaluation.md) | 2026-07-18 evaluation: Babylon+Havok vs Three+Rapier; Godot/PlayCanvas ruled out; spike framing   |

## Diagrams (`diagrams/`)

Mermaid (`.mmd`) sources — render with any Mermaid-compatible viewer.

| Diagram                                           | Illustrates                            |
| ------------------------------------------------- | -------------------------------------- |
| [sitemap.mmd](diagrams/sitemap.mmd)               | Page → section route map               |
| [component-flow.mmd](diagrams/component-flow.mmd) | Component interaction / hydration flow |
| [ci-pipeline.mmd](diagrams/ci-pipeline.mmd)       | CI pipeline (GitHub Actions) stages    |
