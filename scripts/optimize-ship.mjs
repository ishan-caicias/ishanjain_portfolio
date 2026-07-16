import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = resolve(
  projectRoot,
  "resources/spaceship/sci-fi_aircraft__spaceship_fighter.glb",
);
const output = resolve(
  projectRoot,
  "public/space/ships/sci-fi-aircraft-spaceship-fighter.glb",
);
const cli = resolve(projectRoot, "node_modules/@gltf-transform/cli/bin/cli.js");
const maximumBytes = 2 * 1024 * 1024;

mkdirSync(dirname(output), { recursive: true });
execFileSync(
  process.execPath,
  [
    cli,
    "optimize",
    input,
    output,
    "--texture-compress",
    "webp",
    "--texture-size",
    "1024",
    "--compress",
    "meshopt",
  ],
  { stdio: "inherit" },
);

const outputBytes = statSync(output).size;
console.log(`Optimized ship: ${(outputBytes / 1024 / 1024).toFixed(2)} MiB`);

if (outputBytes > maximumBytes) {
  throw new Error(
    `Optimized ship is ${(outputBytes / 1024 / 1024).toFixed(2)} MiB; it must not exceed 2 MiB. Reduce texture resolution once and rerun this script.`,
  );
}
