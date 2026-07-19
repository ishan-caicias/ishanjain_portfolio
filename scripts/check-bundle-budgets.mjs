/* check-bundle-budgets.mjs — PF-09 B6: CI bundle-budget gate.
 *
 * Post-build guard over dist/. Budgets are gzip bytes, set from measured
 * 2026-07-19 baselines (TR-052) with ~15% headroom — they RATCHET DOWN
 * deliberately when the payload shrinks; they never creep up silently.
 *
 * What each gate actually catches:
 *  - TOTAL_JS: any large regression across the whole JS payload
 *    (both engines + app; the plan's ~900 KB engine budget is subsumed).
 *  - LARGEST_CHUNK: the true TR-027 canary — an accidental @babylonjs/core
 *    BARREL import materializes as a single ~1.1 MB chunk and trips this
 *    instantly, which no name-based attribution can promise.
 *  - WASM: the lazy Havok payload (fetched only on the Babylon path).
 *
 * Run: node scripts/check-bundle-budgets.mjs   (CI: after `npm run build`)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = join(process.cwd(), "dist", "_astro");

const BUDGETS = {
  totalJsGz: 1200 * 1024, // measured 1031 KB (2026-07-19)
  largestChunkGz: 300 * 1024, // measured ~100 KB; a barrel import ≈ 1.1 MB
  totalWasmGz: 700 * 1024, // measured 646 KB (Havok)
};

let files;
try {
  files = readdirSync(DIST);
} catch {
  console.error(
    `bundle-budget: ${DIST} not found — run \`npm run build\` first`,
  );
  process.exit(1);
}

const gz = (p) => gzipSync(readFileSync(p), { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

let totalJs = 0;
let totalWasm = 0;
let largest = { name: "-", size: 0 };

for (const f of files) {
  const p = join(DIST, f);
  if (!statSync(p).isFile()) continue;
  if (f.endsWith(".js")) {
    const s = gz(p);
    totalJs += s;
    if (s > largest.size) largest = { name: f, size: s };
  } else if (f.endsWith(".wasm")) {
    totalWasm += gz(p);
  }
}

const checks = [
  ["total JS (gz)", totalJs, BUDGETS.totalJsGz],
  [
    `largest chunk (gz) [${largest.name}]`,
    largest.size,
    BUDGETS.largestChunkGz,
  ],
  ["total WASM (gz)", totalWasm, BUDGETS.totalWasmGz],
];

let failed = false;
for (const [label, actual, budget] of checks) {
  const ok = actual <= budget;
  if (!ok) failed = true;
  console.log(
    `${ok ? "  OK  " : " FAIL "} ${label}: ${kb(actual)} / budget ${kb(budget)}`,
  );
}

if (failed) {
  console.error(
    "\nbundle-budget: over budget. If the growth is deliberate, change the " +
      "budget HERE with a comment + TR reference — never let it drift silently.",
  );
  process.exit(1);
}
console.log("\nbundle-budget: all within budget.");
