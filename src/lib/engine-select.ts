/* engine-select.ts — PF-09 B0: which renderer to mount (dual-engine seam).
 *
 * The Babylon migration runs both engines behind one switch (see
 * docs/delivery-plan/PF-09-babylon-havok-realism.md). Resolution order mirrors
 * craft-tier.ts:
 *   1. URL param  ?engine=webgl|babylon  — always wins; ?engine=webgl is the
 *                                          ARCHIVED legacy engine (kept fully
 *                                          functional for one release — the
 *                                          cutover's rollback lever)
 *   2. Stored override                   — future user selector (parity hook)
 *   3. Default 'babylon'                 — CUT OVER 2026-07-19 per ADR-0006
 *                                          (owner decision; §B3 dispositioned
 *                                          Option A, device rows accepted as
 *                                          post-flip validation).
 *
 * Pure policy (unit-tested); the browser reads live in SpaceScene.
 */

export type EngineKind = "webgl" | "babylon";

export const ENGINE_STORAGE_KEY = "ij-engine";

/** Parse a candidate engine value; anything unrecognized reads as null. */
export function parseEngineValue(raw: string | null): EngineKind | null {
  return raw === "webgl" || raw === "babylon" ? raw : null;
}

/** Resolve the engine for a page load: URL param → stored override → default. */
export function resolveEngine(
  urlParam: string | null,
  stored: EngineKind | null = null,
): EngineKind {
  return parseEngineValue(urlParam) ?? stored ?? "babylon";
}
