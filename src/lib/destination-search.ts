// PF-11 D5.2 — ranked destination search over the catalog + nav stations (owner R9/R10).
// Pure module (no React, no engine access) so it unit-tests as data-in/data-out; SpaceScene.tsx
// wires it to `window.CELESTIAL` and `STATIONS`. Design: docs/implementation/PF-11-implementation-plan.md#d5--where-to-console-v2.

import type { CelestialEntry } from "@/data/celestial/celestial.d.ts";

/** Minimal station shape this module needs — avoids importing the full `Station` type (and
 * its `craft`/`ly` fields this module never reads) from the React-adjacent `space/types.ts`. */
export interface SearchStation {
  id: string;
  label: string;
  sub: string;
}

export interface SearchEntry {
  id: string;
  name: string;
  designation: string;
  type: string;
  kind: "body" | "station" | "class";
  ly: number | null;
  rarity: string;
}

export interface RankedEntry extends SearchEntry {
  rank: number;
}

export interface SearchIndex {
  entries: SearchEntry[];
}

// Rank tiers, best (lowest) to worst — exact-name > id/designation exact > name-prefix >
// word-start > substring. Stations outrank bodies/classes at an equal tier (see `search`'s
// sort) — the recruiter's actual goal, per the delivery plan.
const RANK_EXACT_NAME = 0;
const RANK_EXACT_ID = 1;
const RANK_PREFIX = 2;
const RANK_WORD_START = 3;
const RANK_SUBSTRING = 4;

/** Strips whitespace/hyphens and lowercases, so "ngc7293" and "NGC 7293" (or "ngc-7293")
 * compare equal — the id/designation secondary key the delivery plan calls for. */
function normalizeId(s: string): string {
  return s.replace(/[\s-]/g, "").toLowerCase();
}

function wordStart(haystack: string, q: string): boolean {
  if (!q) return false;
  return haystack.split(/[\s,·-]+/).some((w) => w.startsWith(q));
}

export function buildIndex(
  catalog: CelestialEntry[],
  stations: SearchStation[],
): SearchIndex {
  const entries: SearchEntry[] = [];
  for (const st of stations) {
    entries.push({
      id: st.id,
      name: st.label,
      designation: st.sub,
      type: "STATION",
      kind: "station",
      ly: null,
      rarity: "station",
    });
  }
  for (const e of catalog) {
    entries.push({
      id: e.id,
      name: e.n,
      designation: e.d,
      type: e.t,
      kind: "body",
      ly: e.ly ?? null,
      rarity: e.r,
    });
  }
  return { entries };
}

/** Appends `kind:"class"` rows to an already-built index without rebuilding it — D5.3 calls
 * this once per camera-position epoch with its curated "nearest instance" rows. Kept as a
 * separate append rather than a `buildIndex` parameter so D5.2 ships with zero D5.3 coupling. */
export function withClassEntries(
  index: SearchIndex,
  classEntries: SearchEntry[],
): SearchIndex {
  return { entries: [...index.entries, ...classEntries] };
}

function matchTier(entry: SearchEntry, q: string, qId: string): number | null {
  const name = entry.name.toLowerCase();
  const designation = entry.designation.toLowerCase();
  const normId = normalizeId(entry.id);
  const normDesignation = normalizeId(entry.designation);

  if (name === q) return RANK_EXACT_NAME;
  if (
    (qId && (normId === qId || normDesignation === qId)) ||
    designation === q
  ) {
    return RANK_EXACT_ID;
  }
  if (name.startsWith(q)) return RANK_PREFIX;
  if (wordStart(name, q) || wordStart(designation, q)) return RANK_WORD_START;
  if (
    name.includes(q) ||
    designation.includes(q) ||
    entry.type.toLowerCase().includes(q) ||
    (qId.length > 1 && (normId.includes(qId) || normDesignation.includes(qId)))
  ) {
    return RANK_SUBSTRING;
  }
  return null;
}

const KIND_WEIGHT: Record<SearchEntry["kind"], number> = {
  station: 0,
  body: 1,
  class: 1,
};

function rankAll(index: SearchIndex, query: string): RankedEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qId = normalizeId(query.trim());
  const ranked: RankedEntry[] = [];
  for (const entry of index.entries) {
    const tier = matchTier(entry, q, qId);
    if (tier == null) continue;
    ranked.push({ ...entry, rank: tier });
  }
  ranked.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return KIND_WEIGHT[a.kind] - KIND_WEIGHT[b.kind];
  });
  return ranked;
}

/** Ranked, capped matches for the suggestion list — exact-name > id/designation > prefix >
 * word-start > substring, stations outranking bodies/classes at an equal tier. */
export function search(
  index: SearchIndex,
  query: string,
  limit = 10,
): RankedEntry[] {
  return rankAll(index, query).slice(0, limit);
}

/** Uncapped match count, for the "N MATCHES · SHOWING 10" honest-truncation line — never
 * derived from a longer `search()` cap, so the UI's displayed count is never silently affected
 * by whatever limit the list itself happens to use. */
export function totalMatches(index: SearchIndex, query: string): number {
  return rankAll(index, query).length;
}

/** Both of the above from ONE ranking pass — what the UI actually wants, since it renders the
 * capped list and the uncapped count together.
 *
 * 2026-07-29 code review, finding 8: `search()` and `totalMatches()` each ran a full
 * independent `rankAll`, and SpaceScene called BOTH on every render with a live query (plus a
 * third from the funnel keystroke record). The original rationale — that the count must not be
 * derived from a capped list — is right and is preserved exactly: `total` below is the length
 * of the UNCAPPED ranking, and `results` is a slice of that same ranking. It never required a
 * second SCAN. The two single-purpose functions stay as the narrow public API. */
export function searchWithTotal(
  index: SearchIndex,
  query: string,
  limit = 10,
): { results: RankedEntry[]; total: number } {
  const ranked = rankAll(index, query);
  return { results: ranked.slice(0, limit), total: ranked.length };
}

/** Empty-query "NOTABLE DESTINATIONS" list (D5.2) — resolved from the live index rather than
 * duplicating name/type/distance text, so it can never drift from the catalog it names.
 * Curated to span station + nebula + cluster + star classes, and to include at least one
 * portfolio station per the delivery plan ("≥1 portfolio station"). */
export const FEATURED_DESTINATION_IDS: string[] = [
  "st-projects",
  "m42",
  "betelgeuse",
  "m45",
  "sirius",
  "polaris",
];

/** Resolves the six featured ids against the index. INDEX-LIFETIME work, not per-render work:
 * it builds a lookup map over every entry to answer six questions, so callers must cache the
 * result for as long as the index itself lives (2026-07-29 code review, finding 4 — SpaceScene
 * called this on every render, ~7.5×/s while idle, even with the console never focused). */
export function featuredEntries(index: SearchIndex): SearchEntry[] {
  const byId = new Map(index.entries.map((e) => [e.id, e]));
  const out: SearchEntry[] = [];
  for (const id of FEATURED_DESTINATION_IDS) {
    const e = byId.get(id);
    if (e) out.push(e);
  }
  return out;
}
