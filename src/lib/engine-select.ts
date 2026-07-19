/* engine-select.ts — PF-09 B0: which renderer to mount (dual-engine seam).
 *
 * The Babylon migration runs both engines behind one switch (see
 * docs/delivery-plan/PF-09-babylon-havok-realism.md). Resolution order mirrors
 * craft-tier.ts:
 *   1. URL param  ?engine=webgl|babylon  — dev/preview, always wins
 *   2. Stored override                   — future user selector (parity hook)
 *   3. Default 'webgl'                   — stays default until ADR-0006 (the
 *                                          B6 cutover, currently PROPOSED/
 *                                          gated) is accepted; the flip is
 *                                          this one default value.
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
  return parseEngineValue(urlParam) ?? stored ?? "webgl";
}
