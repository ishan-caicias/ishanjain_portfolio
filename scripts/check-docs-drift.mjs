#!/usr/bin/env node
/**
 * check-docs-drift.mjs — mechanical guard against the documentation drift that
 * forced the 2026-07-19 cutover gap analysis.
 *
 * It deliberately checks only things that are DECIDABLE from the repo. Prose
 * accuracy is not automatable; index consistency, link validity and
 * engine-default contradictions are. Every check below corresponds to a real
 * drift instance found in that audit.
 *
 * Historical records (ADRs, TRs, analyses, timesheets, checklists) are dated
 * statements of what was believed at the time and are EXEMPT from current-state
 * checks — superseding them in place would break the repo's correction
 * convention. See CLAUDE.md "Documentation contract".
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import {
  extractLinkTargets,
  repoRelativeTarget,
} from "./lib/markdown-links.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const problems = [];
const fail = (file, msg) => problems.push({ file, msg });

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const walk = (dir, out = []) => {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else if (e.name.endsWith(".md")) out.push(rel);
  }
  return out;
};

/* ---------------------------------------------------------------- check 1
 * The shipping engine default is a single fact with one source of truth.
 * Docs describing CURRENT state must not name the other engine as default.
 */
const engineSrc = read("src/lib/engine-select.ts");
const defaultEngine = engineSrc.match(/\?\?\s*stored\s*\?\?\s*"(\w+)"/)?.[1];
if (!defaultEngine) {
  fail(
    "src/lib/engine-select.ts",
    "could not parse the default engine literal — check 1 cannot run (update this script if resolveEngine was refactored)",
  );
} else {
  const other = defaultEngine === "babylon" ? "webgl" : "babylon";
  // Only current-state docs; historical records are exempt by design.
  const currentStateDocs = ["README.md", "docs/architecture/overview.md"];
  const claimsOtherIsDefault = new RegExp(
    `(${other}[^.\\n]{0,60}(shipping default|is the default)|(shipping default|is the default)[^.\\n]{0,60}${other})`,
    "i",
  );
  for (const f of currentStateDocs) {
    const body = read(f);
    if (claimsOtherIsDefault.test(body))
      fail(
        f,
        `describes "${other}" as the default, but src/lib/engine-select.ts defaults to "${defaultEngine}"`,
      );
    if (!new RegExp(defaultEngine, "i").test(body))
      fail(f, `never mentions the actual default engine "${defaultEngine}"`);
  }
}

/* ---------------------------------------------------------------- check 2
 * An ADR's Status header and its index row must agree. The gap analysis found
 * docs/adr/README.md saying "Proposed — gated" about an ADR reading "ACCEPTED".
 */
const adrIndex = read("docs/adr/README.md");
for (const f of readdirSync(join(ROOT, "docs/adr")).filter((n) =>
  /^\d{4}-.*\.md$/.test(n),
)) {
  const num = f.slice(0, 4);
  const status = read(`docs/adr/${f}`).match(
    /\*\*Status:\*\*\s*\**\s*(\w+)/i,
  )?.[1];
  if (!status) {
    fail(`docs/adr/${f}`, "no `**Status:**` header found");
    continue;
  }
  const row = adrIndex.split("\n").find((l) => l.includes(`(${f})`));
  if (!row) {
    fail("docs/adr/README.md", `no index row for ADR ${num}`);
    continue;
  }
  const rowStatus = row.split("|").pop().trim() || row;
  const s = status.toLowerCase();
  const r = rowStatus.toLowerCase();
  const known = ["accepted", "proposed", "superseded", "rejected"];
  if (known.includes(s) && !r.includes(s))
    fail(
      "docs/adr/README.md",
      `ADR ${num} row says "${rowStatus.slice(0, 48)}" but the ADR's Status is "${status}"`,
    );
}

/* ---------------------------------------------------------------- check 3
 * Every TR on disk has an index row, and every indexed TR exists.
 */
const trIndex = read("docs/test-reports/README.md");
const trFiles = readdirSync(join(ROOT, "docs/test-reports")).filter((n) =>
  /^TR-\d{3}\.md$/.test(n),
);
for (const f of trFiles)
  if (!trIndex.includes(`(${f})`))
    fail("docs/test-reports/README.md", `no index row for ${f}`);
for (const m of trIndex.matchAll(/\((TR-\d{3}\.md)\)/g))
  if (!trFiles.includes(m[1]))
    fail(
      "docs/test-reports/README.md",
      `indexes ${m[1]}, which does not exist`,
    );

/* ---------------------------------------------------------------- check 4
 * Relative markdown links must resolve — in CURRENT-STATE docs only.
 *
 * Dated records (TRs, ADRs, analyses, timesheets, checklists, incidents) are
 * exempt: they are immutable statements of what was believed at the time, and
 * several legitimately reference artefacts that were planned but never landed.
 * Repointing those links would rewrite history, which this repo forbids.
 * Index files (README.md) are current-state wherever they live.
 */
const HISTORICAL = [
  "docs/test-reports/",
  "docs/adr/",
  "docs/analysis/",
  "docs/timesheeting/",
  "docs/validation-checklist/",
  "docs/incidents/",
  "docs/checkpoint/",
  "docs/llm/",
];
const isCurrentState = (f) =>
  f.endsWith("README.md") || !HISTORICAL.some((h) => f.startsWith(h));

for (const f of ["README.md", ...walk("docs")].filter(isCurrentState)) {
  const body = read(f);
  // Link parsing lives in scripts/lib/markdown-links.mjs so it can be unit-tested — the
  // pattern that used to be inline here reported a real, correct Wikimedia link as broken
  // because it could not parse CommonMark's angle-bracket destination form. See that module.
  for (const raw of extractLinkTargets(body)) {
    const target = repoRelativeTarget(raw);
    if (target === null) continue;
    const abs = resolve(ROOT, dirname(f), decodeURIComponent(target));
    if (!existsSync(abs)) fail(f, `broken relative link → ${target}`);
  }
}

/* ---------------------------------------------------------------- check 5
 * The architecture doc must describe both engines. This is the exact drift
 * that made the architecture page describe an engine that no longer runs.
 */
const arch = read("docs/architecture/overview.md");
for (const token of ["babylon-scene", "space-engine", "engine-select"])
  if (!arch.includes(token))
    fail(
      "docs/architecture/overview.md",
      `does not mention "${token}" — the dual-engine seam must stay documented`,
    );

/* ---------------------------------------------------------------- report */
if (problems.length) {
  console.error(`\n✖ docs drift: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ${p.file}\n    ${p.msg}\n`);
  console.error(
    "These are mechanical checks only — a clean run does NOT mean the prose is accurate.\n",
  );
  process.exit(1);
}
console.log("✔ docs drift checks passed");
