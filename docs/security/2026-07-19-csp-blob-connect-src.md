# CSP change: `connect-src 'self' blob:` (PF-09 B3 ship track)

**Date:** 2026-07-19
**Change:** `astro.config.mjs` CSP directive `connect-src 'self'` → `connect-src 'self' blob:`.
**Driver:** Babylon's glTF loader unpacks the craft GLB's embedded textures into `blob:` object
URLs and fetches them on the WebGPU texture path. Under the previous policy the hull loaded
geometry-less on real WebGPU hardware (WebGL2 was unaffected, so CI stayed green — caught by the
real-hardware spec, [TR-047](../test-reports/TR-047.md)).

## Risk assessment

- `blob:` URLs can be **minted only by same-origin scripts** (`URL.createObjectURL` in our own
  code or our bundled dependencies). Allowing them in `connect-src` does not permit any new
  external origin, exfiltration target, or remote fetch.
- The realistic abuse path requires an attacker to already execute script on the page — at
  which point CSP `connect-src` is not the operative control (script-src remains hash-based,
  `'self'` + `'wasm-unsafe-eval'` only, unchanged).
- Precedent: `img-src` and `worker-src` have allowed `blob:` since the OWASP hardening pass
  (2026-07-13) for the same class of same-origin object-URL use.

## Related, not a CSP change

The meshopt decoder Babylon would fetch from `cdn.babylonjs.com` is instead **self-hosted**
(`public/assets/craft/meshopt_decoder.js`, vendored verbatim from the `meshoptimizer` package) —
`script-src` stays exactly as ADR-0002 left it. See
[ADR-0005](../adr/0005-babylon-ship-mesh-track.md).

## Follow-up

`netlify.toml`'s commented-out header CSP predates this change and does not include
`connect-src blob:` — if header-based CSP is ever enabled (B6 cutover checklist), it must match
`astro.config.mjs` or the ship regresses in exactly the way TR-047 describes.
