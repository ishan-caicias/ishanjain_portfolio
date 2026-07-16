import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = resolve(
  projectRoot,
  "resources/spaceship/sci-fi_aircraft__spaceship_fighter.glb",
);
const cli = resolve(projectRoot, "node_modules/@gltf-transform/cli/bin/cli.js");
const outputDirectory = resolve(projectRoot, "public/space/ships");
const legacyOutput = resolve(
  outputDirectory,
  "sci-fi-aircraft-spaceship-fighter.glb",
);
const qualityArgumentIndex = process.argv.indexOf("--quality");
const requestedQuality =
  qualityArgumentIndex === -1
    ? undefined
    : process.argv[qualityArgumentIndex + 1];

if (
  qualityArgumentIndex !== -1 &&
  !["low", "high"].includes(requestedQuality)
) {
  throw new Error("Use --quality low or --quality high.");
}

const qualities = requestedQuality ? [requestedQuality] : ["low", "high"];
const qualitySettings = {
  low: { suffix: "1k", textureSize: "1024", maximumBytes: 2 * 1024 * 1024 },
  high: { suffix: "2k", textureSize: "2048", maximumBytes: 3 * 1024 * 1024 },
};

mkdirSync(outputDirectory, { recursive: true });

for (const quality of qualities) {
  const settings = qualitySettings[quality];
  const output = resolve(
    outputDirectory,
    `sci-fi-aircraft-spaceship-fighter-${settings.suffix}.glb`,
  );

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
      settings.textureSize,
      "--compress",
      "meshopt",
    ],
    { stdio: "inherit" },
  );

  const outputBytes = statSync(output).size;
  console.log(
    `Optimized ${quality} ship: ${(outputBytes / 1024 / 1024).toFixed(2)} MiB`,
  );

  if (outputBytes > settings.maximumBytes) {
    throw new Error(
      `Optimized ${quality} ship is ${(outputBytes / 1024 / 1024).toFixed(2)} MiB; it must not exceed ${(settings.maximumBytes / 1024 / 1024).toFixed(0)} MiB.`,
    );
  }
}

const lowOutput = resolve(
  outputDirectory,
  "sci-fi-aircraft-spaceship-fighter-1k.glb",
);
const highOutput = resolve(
  outputDirectory,
  "sci-fi-aircraft-spaceship-fighter-2k.glb",
);

if (
  existsSync(lowOutput) &&
  existsSync(highOutput) &&
  existsSync(legacyOutput)
) {
  rmSync(legacyOutput);
}
