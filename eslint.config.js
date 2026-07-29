import eslintPluginAstro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default [
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // "Interactive Outerspace Portfolio/" and "gaia_datasets/" are untracked
    // reference material (PF-07 prototype source + raw dataset pipeline, not
    // shipped app code). The celestial data files are hand-curated data ported
    // from that source - see PF-07 delivery plan Phase 1. (They were described
    // here as "kept byte-identical" until 2026-07-29; PF-11 D6.6b corrected
    // Io/Europa's RA/Dec, so that is now a strong default rather than an
    // invariant - CLAUDE.md non-negotiable #22 carries the full rule.)
    // space-engine.js was formerly in this list; the ship-v2 plan (ADR-0002)
    // deliberately forks it from the prototype, so it is linted like any other
    // source file since 2026-07-17.
    // These two use a "**/" prefix because ESLint flat-config ignores are
    // anchored to the config directory, unlike the gitignore-style patterns in
    // .gitignore/.prettierignore that match at any depth. Without it, moving
    // the folders (e.g. under resources/) silently un-ignores them.
    ignores: [
      "dist/",
      "node_modules/",
      ".astro/",
      ".claude/",
      "coverage/",
      // Playwright's generated output. Both are already declared generated in
      // .gitignore; without matching entries here, a local E2E run with the
      // default `html` reporter drops ~2,900 lint errors of Playwright's own
      // bundled trace-viewer assets into the tree and BLOCKS `npm run build`
      // (which is lint && check && astro build). Found during PF-11 D3.2.
      "playwright-report/",
      "test-results/",
      "**/Interactive Outerspace Portfolio/",
      "**/gaia_datasets/",
      "src/data/celestial/*.js",
    ],
  },
];
