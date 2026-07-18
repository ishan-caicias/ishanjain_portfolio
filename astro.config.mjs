import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://ishanjain.dev",
  integrations: [react(), sitemap()],
  markdown: {
    // Astro's default Shiki highlighter emits inline styles, which its own
    // config check flags as incompatible with the hash-based CSP below. This
    // site renders NO markdown at all (no .md/.mdx under src/, no content
    // collections), so a highlighter is dead weight either way — Prism would be
    // equally unused and would additionally expect a Prism CSS theme. Turning
    // highlighting off silences the warning while keeping CSP strict (no
    // 'unsafe-inline' for styles). Revisit if markdown content is ever added:
    // then choose Prism, or hash/allow Shiki's inline styles deliberately.
    syntaxHighlight: false,
  },
  // Hash-based Content-Security-Policy (OWASP A05). Astro emits a
  // <meta http-equiv="content-security-policy"> per page, auto-hashing its own bundled/inline
  // scripts and styles (so no 'unsafe-inline' is needed). We add the remaining directives here.
  // Note: CSP is only emitted on `build`/`preview`, not `astro dev` (Vite dev server limitation).
  // frame-ancestors is not enforceable via <meta>, so anti-framing is handled by the
  // X-Frame-Options header in public/_headers.
  security: {
    csp: {
      // 'wasm-unsafe-eval' (ship-v2, ADR-0002): permits WebAssembly compilation
      // only — NOT JS eval(). Required by the meshopt decoder that decompresses
      // the craft GLB geometry. Browsers without this keyword simply keep the
      // wireframe ship (the engine's craft-error fallback).
      scriptDirective: {
        resources: ["'self'", "'wasm-unsafe-eval'"],
      },
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        // frame-ancestors deliberately absent: browsers ignore it in a <meta>
        // CSP (and log a console error for it). Anti-framing is delivered by
        // the X-Frame-Options: DENY header in public/_headers instead (TR-016).
        "upgrade-insecure-requests",
      ],
    },
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 4321,
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      // PF-09: babylon-engine.ts is a LAZY dynamic import, so Vite's dev
      // dependency optimizer only discovers its (many, deep) @babylonjs/core
      // subpath imports when ?engine=babylon is first opened. That late
      // discovery triggers a mid-session re-optimize, which 504s the in-flight
      // module graph ("Outdated Optimize Dep") and takes React's JSX dev
      // runtime with it — the whole app then fails to hydrate with
      // "_jsxDEV is not a function", on EVERY route, not just the Babylon one.
      // Excluding Babylon keeps it out of the optimizer entirely (it ships
      // clean ESM), so no re-optimize can ever be triggered. Cost: the
      // ?engine=babylon page loads more slowly in `astro dev` only —
      // production builds are bundled by Rollup and unaffected. See TR-031.
      exclude: ["@babylonjs/core"],
    },
  },
});
