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
    // shipped app code). The celestial-*.js/space-engine.js files are verbatim
    // ports kept byte-identical to that source - see PF-07 delivery plan
    // Phase 1 - so they're excluded from lint rather than reformatted.
    ignores: [
      "dist/",
      "node_modules/",
      ".astro/",
      ".claude/",
      "coverage/",
      "Interactive Outerspace Portfolio/",
      "gaia_datasets/",
      "src/lib/space-engine.js",
      "src/data/celestial/*.js",
    ],
  },
];
