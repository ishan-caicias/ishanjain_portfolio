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
        "frame-ancestors 'none'",
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
