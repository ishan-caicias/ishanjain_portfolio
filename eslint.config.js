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
    // shipped app code). The celestial data files are verbatim ports kept
    // byte-identical to that source - see PF-07 delivery plan Phase 1.
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
      "**/Interactive Outerspace Portfolio/",
      "**/gaia_datasets/",
      "src/data/celestial/*.js",
    ],
  },
];
