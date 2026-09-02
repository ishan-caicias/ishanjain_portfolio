# Security

Security reviews, threat models, and hardening records for the portfolio.

| Document                                                                           | Date       | Scope                                                                                                        | Outcome                       |
| ---------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| [2026-07-13-owasp-audit-and-hardening.md](2026-07-13-owasp-audit-and-hardening.md) | 2026-07-13 | OWASP Top 10 audit of the static site + implemented hardening (CSP, security headers)                        | Passed; A05/A06 fixed; 0 CVEs |
| [2026-07-17-csp-addendum.md](2026-07-17-csp-addendum.md)                           | 2026-07-17 | CSP changes: `'wasm-unsafe-eval'` (ADR 0002), frame-ancestors meta removal, inline-style rule for components | Posture updated; TR-016       |
| [2026-07-19-csp-blob-connect-src.md](2026-07-19-csp-blob-connect-src.md)           | 2026-07-19 | `connect-src 'self' blob:` for the Babylon glTF texture path (ship track)                                    | Risk-assessed; no new origin  |

## Standing security posture

- **Dependencies:** keep `npm audit` at 0. Re-run on every dependency change.
- **CSP:** hash-based, emitted by Astro (`security.csp` in `astro.config.mjs`). No `unsafe-inline`.
  Adding an inline `<script>`/`<style>` requires a rebuild so Astro can hash it.
- **Response headers:** `public/_headers` (Netlify/Cloudflare Pages). Other hosts — see the audit's
  "Host portability note".
- **Post-deploy:** validate live headers with securityheaders.com / Mozilla Observatory.
