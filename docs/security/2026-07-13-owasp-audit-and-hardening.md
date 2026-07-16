# OWASP Audit & Hardening — 2026-07-13

**Author:** Orion (security-and-privacy-engineer lens)
**Scope:** `ishanjain-portfolio` — a statically-generated Astro site (`output: "static"`) with
React islands and a client-side WebGL engine. No backend, no authentication, no database, no
user input, no server-side request handling.
**Verification:** [TR-010](../test-reports/TR-010.md) · **Decisions:** [ADR-0001](../adr/0001-dependency-and-framework-upgrade.md)

## Threat model in one line

Because the site is fully static with no server logic and no user-supplied data, the realistic
attack surface is narrow: (1) shipping a client with a known-vulnerable dependency, (2) missing
browser-enforced hardening (headers/CSP), and (3) client-side injection via unsafe DOM sinks.
Server-side categories (injection into a DB, broken auth, SSRF from our own code, access control)
are not applicable to the deployed artefact.

## Findings against the OWASP Top 10 (2021)

| #   | Category                         | Status       | Evidence / Action                                                                                                                                                                                                                       |
| --- | -------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | Broken Access Control            | N/A          | No auth, no protected resources, no server. Anti-framing added via `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` (clickjacking).                                                                                               |
| A02 | Cryptographic Failures           | Pass         | No secrets in the repo (only the public `import.meta.env.SITE`). HTTPS enforced via HSTS header + CSP `upgrade-insecure-requests`.                                                                                                      |
| A03 | Injection (XSS)                  | Pass         | Codebase grep found **no** `set:html`, `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `eval`, `new Function`, or `document.write`. No user input is rendered. CSP added as defence-in-depth.                                      |
| A04 | Insecure Design                  | Pass         | Static-first, zero-JS-by-default islands architecture minimises attack surface by design.                                                                                                                                               |
| A05 | Security Misconfiguration        | **Fixed**    | Was: no security response headers, no CSP. Now: hash-based CSP (`security.csp`) + `public/_headers`. See "Implemented changes".                                                                                                         |
| A06 | Vulnerable & Outdated Components | **Fixed**    | Was: 29 advisories (2 critical, 13 high). Now: **0** (`npm audit`). See TR-010.                                                                                                                                                         |
| A07 | Identification & Auth Failures   | N/A          | No authentication in scope.                                                                                                                                                                                                             |
| A08 | Software & Data Integrity        | Pass         | All scripts/styles are first-party, same-origin, and bundled by Astro; the CSP restricts `script-src`/`style-src` to `'self'` + build-time hashes (no `unsafe-inline`, no third-party origins). No external CDN scripts to require SRI. |
| A09 | Logging & Monitoring Failures    | N/A (static) | No server logs to secure. Client console verified error-free.                                                                                                                                                                           |
| A10 | SSRF                             | N/A          | No server-side fetching in the deployed artefact. (The Astro host-header SSRF **advisory** in the toolchain was cleared by the Astro 7 upgrade — A06.)                                                                                  |

## Additional client-side checks (beyond the Top 10 headers)

| Check                 | Result                                                                                                                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reverse tabnabbing    | All `target="_blank"` links carry `rel="noopener noreferrer"` (Contact, Projects, MissionControl, SectionOverlay). No change needed.                                                                                                    |
| Secret exposure       | No API keys/tokens/passwords/bearer strings in `src`.                                                                                                                                                                                   |
| Runtime DOM injection | `space-engine.js` injected one inline `<style>` (focus outline) — relocated to `global.css` so the CSP needs no `unsafe-inline` (see below). The DOM fallback uses CSSOM property assignment (`el.style.x`), which CSP does not govern. |

## Implemented changes

### 1. Content-Security-Policy (hash-based, via Astro `security.csp`)

`astro.config.mjs` now enables Astro 7's native CSP. Astro emits a per-page
`<meta http-equiv="content-security-policy">` and **auto-computes SHA-256 hashes** for its own
bundled and inline scripts/styles, so `script-src`/`style-src` are locked to `'self'` + those
hashes with **no `'unsafe-inline'`**. The remaining directives are configured explicitly:

```
default-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self';
worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self';
form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;
script-src 'self' <hashes>; style-src 'self' <hashes>;
```

- `img-src ... data: blob:` and `worker-src ... blob:` accommodate the WebGL engine's textures.
- `connect-src 'self'` — the engine streams its star catalogs from same-origin JSON only.
- CSP is emitted on `build`/`preview` only (not `astro dev`) — a documented Astro/Vite limitation.

### 2. Runtime `<style>` injection removed (CSP prerequisite)

`space-engine.js` (`_bindKeys`) previously did `document.createElement("style")` +
`head.appendChild` to set the `<space-engine>` focus outline. A hash-based CSP cannot hash a
style element created at runtime, so this was moved verbatim (same colour `#7986cb`, same
`-3px` offset) into `src/styles/global.css` as `space-engine:focus-visible`. Behaviour is
identical; the CSP no longer needs to relax `style-src`.

### 3. Security response headers (`public/_headers`)

Delivered for hosts that read `_headers` (Netlify, Cloudflare Pages). Copied verbatim into
`dist/` at build:

| Header                         | Value                                                                              | Purpose                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `X-Content-Type-Options`       | `nosniff`                                                                          | Stop MIME sniffing                                                        |
| `X-Frame-Options`              | `DENY`                                                                             | Clickjacking (works everywhere; `frame-ancestors` is ignored in `<meta>`) |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`                                                  | Limit referrer leakage                                                    |
| `Strict-Transport-Security`    | `max-age=63072000; includeSubDomains; preload`                                     | Force HTTPS                                                               |
| `Permissions-Policy`           | `geolocation=(), camera=(), microphone=(), payment=(), usb=(), browsing-topics=()` | Disable unused/privacy-invasive features                                  |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                                                      | Cross-origin isolation                                                    |
| `Cross-Origin-Resource-Policy` | `same-origin`                                                                      | Limit cross-origin embedding of resources                                 |

CSP is intentionally **not** duplicated in `_headers` — the Astro `<meta>` policy is the single
source of truth, avoiding two conflicting policies whose intersection could break the page.

## Host portability note

`_headers` covers Netlify and Cloudflare Pages. For other hosts:

- **Vercel** — translate the table above into `vercel.json` `"headers"`.
- **GitHub Pages** — cannot set custom response headers. The `<meta>` CSP still applies, but
  `nosniff`, HSTS, `X-Frame-Options`, and `Permissions-Policy` will be absent. Prefer a host that
  supports custom headers for full coverage.

## Residual risk & follow-ups

- **`script-src`/`style-src` include a small set of build-time hashes.** These regenerate on every
  build; no action needed, but note that adding a new inline `<script>`/`<style>` requires a
  rebuild for its hash to be admitted.
- **Post-deploy validation:** after the next deploy, confirm the live headers with
  [securityheaders.com](https://securityheaders.com) and Mozilla Observatory, and confirm no CSP
  violations appear in the production console (the CSP could be tightened further to
  `report-uri`/`report-to` if a collector is ever added).
- **TS 7 adoption** is deferred (ADR-0001) — unrelated to security posture.
