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
    ignores: [
      ".astro/",
      ".claude/",
      "coverage/",
      "dist/",
      "Interactive Outerspace Portfolio/",
      "node_modules/",
      "playwright-report/",
      "resources/",
      "test-results/",
      "gaia_datasets/",
      "src/lib/space-engine.js",
      "src/data/celestial/*.js",
      ".superpowers/",
    ],
  },
];
