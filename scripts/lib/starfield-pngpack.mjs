/* starfield-pngpack.mjs — PF-10 C0 Track B: generic PNG-pack encoder.
 *
 * Produces PNG assets in the EXACT byte layout `src/lib/star-catalog.ts` already decodes in
 * production (`RECORD_BYTES = 15`, little-endian: f32 x, f32 y, f32 z, u8 magnitude byte,
 * u8 colour index, u8 object type) — this is not a new format, it is the same one the shipped
 * 168,959-record star field (`assets/stars-hip.png` / `assets/deep.png`) already uses, reused
 * for any future bulk dataset that needs the background-layer track (white dwarfs, SDSS
 * galaxies, ...) rather than the curated-JSON track.
 *
 * Layout convention, reverse-engineered from the shipped assets (not assumed): width is fixed
 * at 1024 px; height is the smallest value that fits every record's bytes into RGB triples
 * (alpha channel unused/opaque). Confirmed against both shipped files:
 *   stars-hip.png  1024x576  117,964 records * 15 bytes = 1,769,460 bytes (12 bytes padding)
 *   deep.png       1024x249   50,995 records * 15 bytes =   764,925 bytes ( 3 bytes padding)
 */
import sharp from "sharp";

export const RECORD_BYTES = 15;
export const PACK_WIDTH = 1024;

/** @typedef {{x: number, y: number, z: number, magByte: number, ciByte: number, typeByte: number}} PackRecord */

/** Pack records into the raw byte buffer star-catalog.ts's decoder expects (pre-PNG). */
export function packRecordsToBytes(records) {
  const buf = Buffer.alloc(records.length * RECORD_BYTES);
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const o = i * RECORD_BYTES;
    buf.writeFloatLE(r.x, o);
    buf.writeFloatLE(r.y, o + 4);
    buf.writeFloatLE(r.z, o + 8);
    buf.writeUInt8(clampByte(r.magByte), o + 12);
    buf.writeUInt8(clampByte(r.ciByte), o + 13);
    buf.writeUInt8(clampByte(r.typeByte), o + 14);
  }
  return buf;
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Lay a packed byte buffer into an RGBA pixel buffer, width fixed at PACK_WIDTH, height the
 * minimum that fits. Alpha is opaque (255) throughout — the decoder strips it. */
export function bytesToPixelBuffer(bytes) {
  const pixelsNeeded = Math.ceil(bytes.length / 3);
  const height = Math.ceil(pixelsNeeded / PACK_WIDTH);
  const pixels = Buffer.alloc(PACK_WIDTH * height * 4, 0);
  for (let p = 0; p < pixelsNeeded; p++) {
    const srcOff = p * 3;
    const dstOff = p * 4;
    pixels[dstOff] = bytes[srcOff] ?? 0;
    pixels[dstOff + 1] = bytes[srcOff + 1] ?? 0;
    pixels[dstOff + 2] = bytes[srcOff + 2] ?? 0;
    pixels[dstOff + 3] = 255;
  }
  return { pixels, width: PACK_WIDTH, height };
}

/** Encode records straight to a PNG file, matching the shipped asset format exactly. */
export async function writeRecordsAsPng(records, outPath) {
  const bytes = packRecordsToBytes(records);
  const { pixels, width, height } = bytesToPixelBuffer(bytes);
  await sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outPath);
  return {
    width,
    height,
    recordCount: records.length,
    byteCount: bytes.length,
  };
}

/**
 * PF-10 C2: streaming variant of packRecordsToBytes — writes directly into one preallocated
 * output Buffer via a per-record callback, never materializing a `{x,y,z,magByte,ciByte,
 * typeByte}` object for any record. `writeRecordsAsPng`'s array-of-objects API is fine at
 * cluster/CNS5/Oort scale (thousands to tens of thousands of records) but is the wrong tool
 * past roughly a million: SDSS DR18 alone is 3,637,836 real rows, and an object per row is
 * exactly the allocation pattern PF-10 C0's "Honest limits" flagged as needing a streaming
 * decode instead. `fillRecord(view, index)` must call the same `.x`/`.y`/`.z`/`.magByte`/
 * `.ciByte`/`.typeByte` setters `view` exposes, one record at a time.
 * @param {number} count
 * @param {(view: {setX:(n:number)=>void,setY:(n:number)=>void,setZ:(n:number)=>void,setMagByte:(n:number)=>void,setCiByte:(n:number)=>void,setTypeByte:(n:number)=>void}, index: number) => void} fillRecord
 */
export function packStreamToBytes(count, fillRecord) {
  const buf = Buffer.alloc(count * RECORD_BYTES);
  const view = {
    _o: 0,
    setX(n) {
      buf.writeFloatLE(n, this._o);
    },
    setY(n) {
      buf.writeFloatLE(n, this._o + 4);
    },
    setZ(n) {
      buf.writeFloatLE(n, this._o + 8);
    },
    setMagByte(n) {
      buf.writeUInt8(clampByte(n), this._o + 12);
    },
    setCiByte(n) {
      buf.writeUInt8(clampByte(n), this._o + 13);
    },
    setTypeByte(n) {
      buf.writeUInt8(clampByte(n), this._o + 14);
    },
  };
  for (let i = 0; i < count; i++) {
    view._o = i * RECORD_BYTES;
    fillRecord(view, i);
  }
  return buf;
}

/** Streaming counterpart to writeRecordsAsPng — same output format, no per-record object. */
export async function writeStreamAsPng(count, fillRecord, outPath) {
  const bytes = packStreamToBytes(count, fillRecord);
  const { pixels, width, height } = bytesToPixelBuffer(bytes);
  await sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outPath);
  return { width, height, recordCount: count, byteCount: bytes.length };
}

/** Read a packed PNG back into raw RGB bytes (alpha stripped) — the same shape
 * `decodeStarCatalog(chunks: Uint8Array[])` expects per chunk. Node-side mirror of the
 * browser's fetch -> ImageBitmap -> canvas -> RGB decode path in babylon-engine.ts. */
export async function readPngAsRgbBytes(path) {
  const { data, info } = await sharp(path)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const totalPixels = info.width * info.height;
  const rgb = new Uint8Array(totalPixels * 3);
  const stride = info.channels;
  for (let p = 0; p < totalPixels; p++) {
    rgb[p * 3] = data[p * stride];
    rgb[p * 3 + 1] = data[p * stride + 1];
    rgb[p * 3 + 2] = data[p * stride + 2];
  }
  return rgb;
}
