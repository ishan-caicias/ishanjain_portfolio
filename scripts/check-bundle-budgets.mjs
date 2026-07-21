/* check-bundle-budgets.mjs — PF-09 B6 / PF-10 C4: the shipping-weight gate.
 *
 * Every ceiling this script enforces lives in `budgets.config.mjs`, not here. This file is the
 * MEASUREMENT; that file is the POLICY. Adjusting a budget must never mean editing measurement
 * logic, because that is how a tuning pass turns into a behaviour change nobody reviewed.
 *
 * WHAT EACH GATE ACTUALLY CATCHES:
 *
 *   bundle.totalJsGz     any large regression across the whole JS payload (both engines + app).
 *   bundle.largestChunkGz the true TR-027 canary — an accidental @babylonjs/core BARREL import
 *                        materializes as a single ~1.1 MB chunk and trips this instantly, which
 *                        no name-based attribution could promise.
 *   bundle.totalWasmGz   the lazy Havok payload (fetched only on the Babylon path).
 *   assets.*             NEW in PF-10 C4. public/assets grew to 209 MB across PF-10 with nothing
 *                        watching it — the gate was JS/WASM-only. Raw bytes, per-group attributed.
 *
 * TWO SCOPES, BECAUSE THEY HAVE DIFFERENT PREREQUISITES:
 *   --bundle-only   needs a built dist/. This is the post-build CI gate.
 *   --assets-only   needs nothing but the repo. Cheap enough for the predev/prepreview hooks.
 *   (no flag)       both — the full local gate.
 *
 * Run: node scripts/check-bundle-budgets.mjs [--bundle-only|--assets-only]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { bundle as BUNDLE, assets as ASSETS } from "../budgets.config.mjs";

const DIST = join(process.cwd(), "dist", "_astro");
const ASSET_ROOT = join(process.cwd(), "public", "assets");

const KB = 1024;
const MB = 1024 * 1024;

const argv = process.argv.slice(2);
const bundleOnly = argv.includes("--bundle-only");
const assetsOnly = argv.includes("--assets-only");
const runBundle = !assetsOnly;
const runAssets = !bundleOnly;

const gz = (p) => gzipSync(readFileSync(p), { level: 9 }).length;
const fmtKB = (n) => `${(n / KB).toFixed(1)} KB`;
const fmtMB = (n) => `${(n / MB).toFixed(2)} MB`;

/** [label, actualBytes, budgetBytes, formatter] */
const checks = [];

/* ---------- bundle: gzip bytes over dist/_astro -------------------------- */

if (runBundle) {
  let files;
  try {
    files = readdirSync(DIST);
  } catch {
    console.error(
      `bundle-budget: ${DIST} not found — run \`npm run build\` first ` +
        `(or pass --assets-only to check assets without a build)`,
    );
    process.exit(1);
  }

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

  checks.push(
    ["total JS (gz)", totalJs, BUNDLE.totalJsGz * KB, fmtKB],
    [
      `largest chunk (gz) [${largest.name}]`,
      largest.size,
      BUNDLE.largestChunkGz * KB,
      fmtKB,
    ],
    ["total WASM (gz)", totalWasm, BUNDLE.totalWasmGz * KB, fmtKB],
  );
}

/* ---------- assets: RAW bytes over public/assets -------------------------- */

/* Raw, not gzip: JPEG and PNG are already entropy-coded, so gzipping ~2,600 asset files would
 * burn real CPU on every gate run to discover they are ~0% smaller. Raw bytes are also what the
 * visitor's disk cache and the CDN's egress actually see. Reading public/ rather than dist/ is
 * what makes this half build-free — `astro build` copies public/ verbatim, so they are identical
 * for this measurement. */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push({ path: p, size: st.size });
  }
  return out;
}

if (runAssets) {
  let entries;
  try {
    entries = readdirSync(ASSET_ROOT);
  } catch {
    console.error(`asset-budget: ${ASSET_ROOT} not found`);
    process.exit(1);
  }

  // Loose files at the root are their own group so they are attributable too — that is where the
  // bulk PNG-packed catalogs live (sdss18, whitedwarfs, asteroids-dr3, stars-hip).
  const groups = new Map();
  let total = 0;
  let biggest = { path: "-", size: 0 };

  const record = (group, files) => {
    const sum = files.reduce((a, f) => a + f.size, 0);
    groups.set(group, (groups.get(group) ?? 0) + sum);
    total += sum;
    for (const f of files) if (f.size > biggest.size) biggest = f;
  };

  const rootFiles = [];
  for (const name of entries) {
    const p = join(ASSET_ROOT, name);
    if (statSync(p).isDirectory()) record(name, walk(p));
    else rootFiles.push({ path: p, size: statSync(p).size });
  }
  record("(root)", rootFiles);

  checks.push(["assets total (raw)", total, ASSETS.totalMB * MB, fmtMB]);
  checks.push([
    `largest asset (raw) [${biggest.path.split(/[\\/]/).pop()}]`,
    biggest.size,
    ASSETS.perFileMB * MB,
    fmtMB,
  ]);

  // Budgeted groups first, in config order, so the report reads the same way every run. An
  // UNBUDGETED group is reported but not failed — it still counts toward the total, and silently
  // ignoring it would hide a new asset directory entirely.
  for (const [name, budgetMB] of Object.entries(ASSETS.groupsMB)) {
    checks.push([
      `  assets/${name}`,
      groups.get(name) ?? 0,
      budgetMB * MB,
      fmtMB,
    ]);
  }
  for (const [name, size] of groups) {
    if (name in ASSETS.groupsMB) continue;
    console.log(
      ` INFO  assets/${name}: ${fmtMB(size)} (unbudgeted — add it to ` +
        `budgets.config.mjs groupsMB to gate it)`,
    );
  }
}

/* ---------- report -------------------------------------------------------- */

let failed = false;
for (const [label, actual, budget, fmt] of checks) {
  const ok = actual <= budget;
  if (!ok) failed = true;
  console.log(
    `${ok ? "  OK  " : " FAIL "} ${label}: ${fmt(actual)} / budget ${fmt(budget)}`,
  );
}

if (failed) {
  console.error(
    "\nbudget: over budget. If the growth is DELIBERATE, raise the number in " +
      "budgets.config.mjs with a comment + TR reference in the same commit — " +
      "never let it drift silently, and never raise it just to make CI green.",
  );
  process.exit(1);
}
console.log("\nbudget: all within budget.");
