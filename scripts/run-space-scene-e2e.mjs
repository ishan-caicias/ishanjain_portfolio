import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const playwrightCli = fileURLToPath(
  new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
);
const child = spawn(
  process.execPath,
  [playwrightCli, "test", "tests/e2e/space-scene.spec.ts"],
  {
    env: {
      ...process.env,
      PLAYWRIGHT_SPACE_SCENE_GATE: "true",
      PUBLIC_SPACE_SCENE: "true",
    },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  throw error;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
