import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Local worker bound (TR-018): unbounded (= cores/2 = 8 here) saturates
  // SwiftShader once ~40 specs each run the full WebGL scene — random
  // timeout failures on heavy specs. 4 is stable; CI stays at 1.
  // Local workers 4 → 1 (PF-09 B6, TR-052). The suite has five GPU-heavy
  // spec files that each boot full engine scenes (168k stars + nebula
  // raymarch + GLB decode + Havok WASM) on ONE SwiftShader emulator —
  // parallel workers were time-sliced on that single GPU, producing the
  // rotating one-test-per-run timeout flake documented since TR-018 (every
  // instance passed in isolation; 2 workers still flaked). One worker makes
  // local runs deterministic AND identical to CI. Cost: ~2-3 extra minutes
  // per full run — cheaper than re-running rotating failures.
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Invoke astro's bin through node directly rather than "npm run preview":
    // spawning through the npm.cmd shim intermittently crashes on Windows with
    // STATUS_STACK_BUFFER_OVERRUN (0xC0000409) before the server starts. See
    // docs/test-reports/TR-013.md.
    command: "node ./node_modules/astro/bin/astro.mjs preview",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
