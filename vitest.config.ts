import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@components": resolve(__dirname, "src/components"),
      "@layouts": resolve(__dirname, "src/layouts"),
      "@content": resolve(__dirname, "src/content"),
      "@utils": resolve(__dirname, "src/utils"),
      "@types": resolve(__dirname, "src/types"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["tests/unit/setup.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      include: ["src/components/islands/**/*.{ts,tsx}", "src/utils/**/*.ts"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/node_modules/**",
        "src/components/islands/Starfield.tsx",
        "src/components/islands/AstronautMascot.tsx",
      ],
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
