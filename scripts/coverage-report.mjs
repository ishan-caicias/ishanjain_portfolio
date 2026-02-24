/**
 * Reads Vitest coverage output and writes a readable coverage report to project root.
 * Run after: npm run test:coverage
 * Expects: coverage/coverage-summary.json (json-summary reporter) or coverage/coverage-final.json (json reporter).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const coverageDir = path.join(rootDir, "coverage");
const summaryPath = path.join(coverageDir, "coverage-summary.json");
const finalPath = path.join(coverageDir, "coverage-final.json");
const outputPath = path.join(rootDir, "coverage-report.md");

function pct(obj) {
  if (!obj || typeof obj.pct !== "number") return null;
  return obj.pct;
}

function buildReportFromSummary(data) {
  const total = data.total;
  if (!total) return null;

  const lines = pct(total.lines);
  const statements = pct(total.statements);
  const functions = pct(total.functions);
  const branches = pct(total.branches);

  let md = `# Test Coverage Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Summary (islands + utils)\n\n`;
  md += `| Metric      | Coverage | Threshold |\n`;
  md += `|-------------|----------|----------|\n`;
  md += `| Statements  | ${statements != null ? `${statements.toFixed(1)}%` : "—"} | 80% |\n`;
  md += `| Branches    | ${branches != null ? `${branches.toFixed(1)}%` : "—"} | 80% |\n`;
  md += `| Functions   | ${functions != null ? `${functions.toFixed(1)}%` : "—"} | 80% |\n`;
  md += `| Lines       | ${lines != null ? `${lines.toFixed(1)}%` : "—"} | 80% |\n\n`;

  const files = Object.entries(data).filter(([k]) => k !== "total");
  if (files.length > 0) {
    md += `## Per file\n\n`;
    md += `| File | Statements | Branches | Functions | Lines |\n`;
    md += `|------|------------|----------|-----------|-------|\n`;
    for (const [file, cov] of files) {
      const rel = path.relative(rootDir, file).replace(/\\/g, "/");
      const s = pct(cov.statements);
      const b = pct(cov.branches);
      const f = pct(cov.functions);
      const l = pct(cov.lines);
      md += `| \`${rel}\` | ${s != null ? `${s.toFixed(1)}%` : "—"} | ${b != null ? `${b.toFixed(1)}%` : "—"} | ${f != null ? `${f.toFixed(1)}%` : "—"} | ${l != null ? `${l.toFixed(1)}%` : "—"} |\n`;
    }
  }

  md += `\n---\n*Scoped to \`src/components/islands/**\` and \`src/utils/**\`. Excluded: Starfield, AstronautMascot (no unit tests). Run \`npm run test:coverage:report\` to regenerate.*\n`;
  return md;
}

function aggregateFromFinal(data) {
  const totals = {
    statements: 0,
    coveredStatements: 0,
    functions: 0,
    coveredFunctions: 0,
    lines: 0,
    coveredLines: 0,
  };

  for (const [file, entry] of Object.entries(data)) {
    if (!entry || typeof entry !== "object") continue;
    const s = entry.s;
    const f = entry.f;
    const statementMap = entry.statementMap;
    const fnMap = entry.fnMap;

    if (typeof s === "object") {
      const stTotal = Object.keys(s).length;
      const stCovered = Object.values(s).filter(Boolean).length;
      totals.statements += stTotal;
      totals.coveredStatements += stCovered;
    }
    if (typeof f === "object" && typeof fnMap === "object") {
      const fnTotal = Object.keys(f).length;
      const fnCovered = Object.values(f).filter(Boolean).length;
      totals.functions += fnTotal;
      totals.coveredFunctions += fnCovered;
    }
    if (typeof entry.statementMap === "object" && entry.lineMap) {
      const lineMap = entry.lineMap;
      const linesSet = new Set();
      for (const st of Object.values(statementMap || {})) {
        if (st && st.start) linesSet.add(lineMap[st.start.line]);
      }
      const lineCount = linesSet.size;
      const coveredLineIds = new Set();
      for (const [id, hit] of Object.entries(s || {})) {
        if (hit && statementMap[id])
          coveredLineIds.add(lineMap[statementMap[id].start.line]);
      }
      totals.lines += lineCount;
      totals.coveredLines += coveredLineIds.size;
    }
  }

  const linesPct = totals.lines
    ? (totals.coveredLines / totals.lines) * 100
    : null;
  const stPct = totals.statements
    ? (totals.coveredStatements / totals.statements) * 100
    : null;
  const fnPct = totals.functions
    ? (totals.coveredFunctions / totals.functions) * 100
    : null;

  let md = `# Test Coverage Report\n\n`;
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `## Summary (islands + utils)\n\n`;
  md += `| Metric      | Coverage | Threshold |\n`;
  md += `|-------------|----------|----------|\n`;
  md += `| Statements  | ${stPct != null ? `${stPct.toFixed(1)}%` : "—"} | 80% |\n`;
  md += `| Branches    | — | 80% |\n`;
  md += `| Functions   | ${fnPct != null ? `${fnPct.toFixed(1)}%` : "—"} | 80% |\n`;
  md += `| Lines       | ${linesPct != null ? `${linesPct.toFixed(1)}%` : "—"} | 80% |\n\n`;
  md += `---\n*Scoped to \`src/components/islands/**\` and \`src/utils/**\`. Excluded: Starfield, AstronautMascot (no unit tests). Run \`npm run test:coverage:report\` to regenerate.*\n`;
  return md;
}

function main() {
  let data;
  let report;

  if (fs.existsSync(summaryPath)) {
    data = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    report = buildReportFromSummary(data);
  } else if (fs.existsSync(finalPath)) {
    data = JSON.parse(fs.readFileSync(finalPath, "utf8"));
    report = aggregateFromFinal(data);
  } else {
    console.error("No coverage summary found. Run: npm run test:coverage");
    process.exit(1);
  }

  if (report) {
    fs.writeFileSync(outputPath, report, "utf8");
    console.log("Wrote coverage report to coverage-report.md");
  }
}

main();
