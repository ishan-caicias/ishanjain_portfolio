import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://ishanjain.dev",
  integrations: [react(), sitemap()],
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
  },
});
