/**
 * PF-07 ship-v2 P1 — unit tests for the craft GLB parser against the real
 * committed assets. The GL half (CraftShip.upload/draw) is browser-only and is
 * exercised by tests/e2e/craft-ship.spec.ts; this file covers the pure parse
 * half: container parsing, meshopt decode, attribute extraction, material role
 * resolution, and the unit-box model matrix (wireframe parity).
 *
 * LFS-pointer-aware, like tests/unit/craft-assets.test.ts.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCraftGlb } from "@/lib/craft-loader";

const CRAFT_DIR = resolve(__dirname, "../../public/assets/craft");
const GL_SHORT = 5122;
const GL_UNSIGNED_SHORT = 5123;
const GL_BYTE = 5120;

function readAsset(name: string) {
  const buf = readFileSync(resolve(CRAFT_DIR, name));
  const isLfsPointer = buf
    .subarray(0, 30)
    .toString("utf8")
    .startsWith("version https://git-lfs");
  const bytes = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
  return { bytes, isLfsPointer };
}

const twoK = readAsset("sci-fi-fighter-2k.glb");
const oneK = readAsset("sci-fi-fighter-1k.glb");
const skip = twoK.isLfsPointer || oneK.isLfsPointer;
if (skip) {
  console.warn("[craft-loader] GLBs are LFS pointers — parser tests skipped.");
}

describe("parseCraftGlb", () => {
  it("rejects non-GLB input", async () => {
    await expect(parseCraftGlb(new ArrayBuffer(64))).rejects.toThrow(
      /not a GLB/,
    );
  });

  it.skipIf(skip)("decodes the 2k tier to the pinned mesh shape", async () => {
    const parsed = await parseCraftGlb(twoK.bytes);
    expect(parsed.vertexCount).toBe(31015);
    expect(parsed.indexCount).toBe(109080);
    expect(parsed.indexComponentType).toBe(GL_UNSIGNED_SHORT);
    // decoded index bytes: count × 2 (u16)
    expect(parsed.indices.byteLength).toBe(109080 * 2);

    const a = parsed.attributes;
    expect([
      a.position.componentType,
      a.position.size,
      a.position.normalized,
    ]).toEqual([GL_SHORT, 3, true]);
    expect([a.normal.componentType, a.normal.size]).toEqual([GL_BYTE, 3]);
    expect([a.tangent.componentType, a.tangent.size]).toEqual([GL_BYTE, 4]);
    expect([a.uv.componentType, a.uv.size]).toEqual([GL_UNSIGNED_SHORT, 2]);
    // each decoded attribute buffer holds exactly vertexCount elements at its stride
    for (const attr of [a.position, a.normal, a.tangent, a.uv]) {
      expect(attr.data.byteLength).toBe(parsed.vertexCount * attr.byteStride);
    }
  });

  it.skipIf(skip)(
    "resolves all four material texture roles to WebP images",
    async () => {
      const parsed = await parseCraftGlb(twoK.bytes);
      expect(parsed.images).toHaveLength(4);
      for (const img of parsed.images) expect(img.mime).toBe("image/webp");
      const { baseColor, emissive, normal, occlusionMR } = parsed.roles;
      // base/emissive/normal are distinct images; occlusion shares the MR texture
      expect(new Set([baseColor, emissive, normal]).size).toBe(3);
      expect(parsed.images[occlusionMR]).toBeDefined();
      for (const img of parsed.images) {
        // real WebP payload: RIFF....WEBP container magic
        expect(img.bytes.subarray(0, 4)).toEqual(
          new Uint8Array([0x52, 0x49, 0x46, 0x46]),
        );
      }
    },
  );

  it.skipIf(skip)(
    "model matrix maps the mesh into the wireframe-parity unit box",
    async () => {
      const parsed = await parseCraftGlb(twoK.bytes);
      const m = parsed.model;
      expect(m).toHaveLength(16);
      for (const v of m) expect(Number.isFinite(v)).toBe(true);

      // Independent re-check: run every decoded position through the matrix and
      // confirm the result is centered in a unit box (max half-extent 0.5).
      const pos = parsed.attributes.position;
      const dv = new DataView(
        pos.data.buffer,
        pos.data.byteOffset,
        pos.data.byteLength,
      );
      let maxAbs = 0;
      const mn = [Infinity, Infinity, Infinity];
      const mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < parsed.vertexCount; i++) {
        const base = i * pos.byteStride;
        const x = Math.max(dv.getInt16(base, true) / 32767, -1);
        const y = Math.max(dv.getInt16(base + 2, true) / 32767, -1);
        const z = Math.max(dv.getInt16(base + 4, true) / 32767, -1);
        const out = [
          m[0] * x + m[4] * y + m[8] * z + m[12],
          m[1] * x + m[5] * y + m[9] * z + m[13],
          m[2] * x + m[6] * y + m[10] * z + m[14],
        ];
        for (let k = 0; k < 3; k++) {
          mn[k] = Math.min(mn[k], out[k]);
          mx[k] = Math.max(mx[k], out[k]);
          maxAbs = Math.max(maxAbs, Math.abs(out[k]));
        }
      }
      expect(maxAbs).toBeLessThanOrEqual(0.5 + 1e-4);
      // longest axis spans the full unit box, and the mesh is centered on it
      const spans = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
      expect(Math.max(...spans)).toBeCloseTo(1.0, 3);
    },
  );

  it.skipIf(skip)("decodes the simplified 1k tier", async () => {
    const parsed = await parseCraftGlb(oneK.bytes);
    expect(parsed.vertexCount).toBe(18600);
    expect(parsed.images).toHaveLength(4);
  });
});
