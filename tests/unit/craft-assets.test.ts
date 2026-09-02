/**
 * PF-07 ship-v2 P0 — integrity tests for the committed craft runtime GLBs.
 *
 * Validates the outputs of scripts/build-craft-assets.mjs against the delivery
 * plan's budgets and the P1 loader contract (mesh shape, texture format, and
 * the exact extension set the in-engine loader will implement).
 *
 * LFS awareness: on checkouts without materialized LFS content (e.g. CI, which
 * checks out without `lfs: true`), the .glb files are LFS pointer stubs. Binary
 * assertions are skipped there — mirroring how the existing image assets behave
 * on CI — and run fully on any dev machine with LFS.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CRAFT_DIR = resolve(__dirname, "../../public/assets/craft");
const MiB = 1024 * 1024;

const TIERS = [
  { name: "1k", budgetBytes: 0.6 * MiB, vertices: 18600 },
  { name: "2k", budgetBytes: 1.2 * MiB, vertices: 31015 },
] as const;

/** Extensions the P1 in-engine loader commits to supporting — no more, no less. */
const LOADER_CONTRACT_EXTENSIONS = [
  "EXT_meshopt_compression",
  "EXT_texture_webp",
  "KHR_mesh_quantization",
];

const LFS_POINTER_PREFIX = "version https://git-lfs.github.com/spec/v1";

function readAsset(fileName: string) {
  const path = resolve(CRAFT_DIR, fileName);
  const buf = readFileSync(path);
  const isLfsPointer = buf
    .subarray(0, LFS_POINTER_PREFIX.length)
    .toString("utf8")
    .startsWith(LFS_POINTER_PREFIX);
  return { buf, isLfsPointer };
}

function parseGlbJson(buf: Buffer) {
  const jsonLength = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));
}

describe.each(TIERS)("craft asset sci-fi-fighter-$name.glb", (tier) => {
  const fileName = `sci-fi-fighter-${tier.name}.glb`;

  it("exists on disk", () => {
    expect(existsSync(resolve(CRAFT_DIR, fileName))).toBe(true);
  });

  const { buf, isLfsPointer } = readAsset(fileName);
  if (isLfsPointer) {
    console.warn(
      `[craft-assets] ${fileName} is an LFS pointer — binary checks skipped.`,
    );
  }

  it.skipIf(isLfsPointer)("is a valid GLB v2 container", () => {
    expect(buf.subarray(0, 4).toString("ascii")).toBe("glTF");
    expect(buf.readUInt32LE(4)).toBe(2);
    expect(buf.readUInt32LE(8)).toBe(buf.length);
  });

  it.skipIf(isLfsPointer)(
    `is within the ${tier.budgetBytes / MiB} MiB budget`,
    () => {
      expect(buf.length).toBeLessThanOrEqual(tier.budgetBytes);
    },
  );

  it.skipIf(isLfsPointer)("matches the P1 loader contract", () => {
    const json = parseGlbJson(buf);
    expect(json.meshes).toHaveLength(1);
    expect(json.meshes[0].primitives).toHaveLength(1);
    expect(json.materials).toHaveLength(1);
    expect(json.animations ?? []).toHaveLength(0);

    const positionAccessor =
      json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
    expect(positionAccessor.count).toBe(tier.vertices);

    for (const image of json.images) {
      expect(image.mimeType).toBe("image/webp");
    }
    expect([...(json.extensionsUsed ?? [])].sort()).toEqual(
      LOADER_CONTRACT_EXTENSIONS,
    );
  });
});

describe("craft asset attribution", () => {
  it("ships the CC-BY-4.0 license alongside the assets", () => {
    const license = readFileSync(resolve(CRAFT_DIR, "LICENSE.txt"), "utf8");
    expect(license).toContain("Sci-Fi Aircraft | Spaceship Fighter");
    expect(license).toContain("valterjherson1");
    expect(license).toContain("CC-BY-4.0");
    expect(license).toContain(
      "https://sketchfab.com/3d-models/sci-fi-aircraft-spaceship-fighter-99c1d15965c74f3aa7b5999e2d4e42e1",
    );
  });
});
