# CSP Addendum — 2026-07-17

Two changes to the Content-Security-Policy posture established in
[2026-07-13-owasp-audit-and-hardening.md](2026-07-13-owasp-audit-and-hardening.md):

| Change                                                 | Reason                                                                                                                  | Posture impact                                                                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `script-src` gains `'wasm-unsafe-eval'`                | The ship-v2 meshopt decoder compiles a WASM module ([ADR 0002](../adr/0002-in-engine-glb-ship-renderer.md), Decision 3) | Permits WebAssembly compilation from same-origin scripts only; JS `eval()` remains blocked. Browsers without the keyword degrade to the wireframe ship. |
| `frame-ancestors 'none'` removed from the `<meta>` CSP | Browsers ignore it in `<meta>` delivery and log a console error ([TR-016](../test-reports/TR-016.md))                   | None — anti-framing is and was enforced by `X-Frame-Options: DENY` in `public/_headers`.                                                                |

Also fixed under the same audit trail (TR-016): the hash-based CSP had been silently blocking
`AstronautMascot`'s SSR'd inline styles since 2026-07-13 — a reminder that **style attributes
and non-Astro `<style>` elements are incompatible with this CSP by design**. Components must
use stylesheet classes plus post-hydration style-property writes. The strict page-load console
spec (`tests/e2e/page-load-console.spec.ts`) now fails the build if a violation returns.
