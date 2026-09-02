/* catalog-decode.worker.ts — PF-11 D7.3: moves the SDSS DR18 galaxy field's decode + billboard
 * build off the main thread.
 *
 * WHY THIS ONE LAYER, NOT ALL THREE. SDSS is by far the largest single asset the site fetches
 * (47.1 MB, 3.64M records) — the base star catalog (168,959) and the DR3 belt (154,662) are
 * roughly 20-24x smaller and stayed on the existing synchronous path in `babylon-engine.ts`
 * (`_applyStarFieldGeometry`, `_loadAsteroidVisualLayer`). This is where the audited main-thread
 * cost actually concentrates.
 *
 * The fetch itself — with its D1.1 progress reporting into the pre-flight dossier — stays on the
 * main thread; only the CPU-bound decode moves here. The caller hands over the already-fetched
 * `Blob`; this worker decodes the image, reads pixels straight out of `getImageData` via
 * `decodeStarCatalogFromRGBA` (no intermediate stripped-RGB copy — see that function's header for
 * why that removes a whole ~47-63 MB transient buffer from the peak), builds the billboard-quad
 * geometry, and transfers the resulting typed arrays back with zero copy.
 *
 * TYPING NOTE: `self` is accessed through a local structural cast rather than TypeScript's
 * `webworker` lib. This program's tsconfig has every other module under the `dom` lib, and `dom`
 * and `webworker` cannot both be active in one compiler run (they redeclare the same globals
 * incompatibly) — the cast sidesteps that without a second tsconfig/project just for one file. */
import { decodeStarCatalogFromRGBA } from "../lib/star-catalog";
import { buildStarBillboards } from "../lib/star-field";

export interface CatalogDecodeRequest {
  id: number;
  blob: Blob;
}

export type CatalogDecodeResponse =
  | {
      id: number;
      ok: true;
      positions: Float32Array;
      meta: Float32Array;
      indices: Uint32Array;
      vertexCount: number;
      count: number;
    }
  | { id: number; ok: false; error: string };

interface DecodeWorkerScope {
  postMessage(message: CatalogDecodeResponse, transfer: Transferable[]): void;
  onmessage: ((ev: MessageEvent<CatalogDecodeRequest>) => void) | null;
}

const scope = self as unknown as DecodeWorkerScope;

scope.onmessage = async (ev) => {
  const { id, blob } = ev.data;
  try {
    const bmp = await createImageBitmap(blob);
    // Read dimensions before close() — see loadChunkRGB's identical comment in
    // babylon-engine.ts: closing an ImageBitmap zeroes width/height.
    const w = bmp.width;
    const h = bmp.height;
    const canvas = new OffscreenCanvas(w, h);
    const cx = canvas.getContext("2d");
    if (!cx) throw new Error("2d context unavailable");
    cx.drawImage(bmp, 0, 0);
    const rgba = cx.getImageData(0, 0, w, h).data;
    bmp.close?.();
    const field = decodeStarCatalogFromRGBA([{ rgba }]);
    const bb = buildStarBillboards(field);
    scope.postMessage(
      {
        id,
        ok: true,
        positions: bb.positions,
        meta: bb.meta,
        indices: bb.indices,
        vertexCount: bb.vertexCount,
        count: bb.count,
      },
      [bb.positions.buffer, bb.meta.buffer, bb.indices.buffer],
    );
  } catch (e) {
    scope.postMessage({ id, ok: false, error: String(e) }, []);
  }
};
