/* markdown-links.mjs — CommonMark link-destination extraction for the docs drift checker.
 *
 * Extracted from `scripts/check-docs-drift.mjs` (which runs its checks at module top level and
 * so cannot be imported by a test) to fix a REAL false positive and make the fix testable.
 *
 * THE BUG THIS EXISTS TO FIX. The checker's original pattern was:
 *
 *     /\[[^\]]*\]\(([^)#\s]+)(?:#[^)\s]*)?\)/g
 *
 * which cannot see CommonMark's ANGLE-BRACKET destination form, `[text](<url>)`. That form is
 * not exotic: it is the *required* syntax when a URL contains parentheses, and Prettier emits it
 * automatically. So a correct, working link —
 *
 *     [Wikimedia Commons](<https://commons.wikimedia.org/wiki/Category:Pleiades_(star_cluster)>)
 *
 * — captured as `<https://commons.wikimedia.org/wiki/Category:Pleiades_(star_cluster`, truncated
 * at the inner `)`. That string fails the `^https?:` external-link test (it starts with `<`), so
 * the checker fell through to resolving it as a RELATIVE PATH and reported a broken link. The
 * link was fine the whole time; the checker's own parser was wrong.
 *
 * Confirmed by the owner against the live page (2026-07-20): the URL resolves, and the
 * `File:Pleiades_large.jpg` image it links on to resolves as well.
 *
 * Why this matters beyond one row in one table: a checker that cries wolf trains its readers to
 * ignore it, and this one guards a documentation contract the repo treats as load-bearing. A
 * false positive in a drift checker is a defect in the drift checker.
 */

/** CommonMark inline links, both destination forms:
 *   [text](destination)        bare      — group 2
 *   [text](<destination>)      bracketed — group 1, may contain parentheses and spaces
 * An optional title (`"…"` / `'…'`) after the destination is tolerated and ignored. */
const LINK_RE =
  /\[[^\]]*\]\(\s*(?:<([^<>]*)>|([^)<>\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

/**
 * Extract every link destination in a Markdown body, angle-bracket form included.
 * Returns raw destinations, fragments still attached — callers decide what to do with them.
 * @param {string} body
 * @returns {string[]}
 */
export function extractLinkTargets(body) {
  const out = [];
  for (const m of body.matchAll(LINK_RE)) {
    const target = m[1] ?? m[2];
    if (target !== undefined && target !== "") out.push(target);
  }
  return out;
}

/** True for destinations that point outside the repo (or at a pure in-page fragment) and so
 * must never be resolved against the filesystem. */
export function isExternalTarget(target) {
  return /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target);
}

/**
 * The repo-relative path a destination refers to, or null when it is external or a pure
 * fragment. Strips any `#fragment` — inside the angle-bracket form the fragment sits inside the
 * brackets, so the original pattern's separate fragment group could not reach it either.
 * @param {string} target
 * @returns {string | null}
 */
export function repoRelativeTarget(target) {
  if (isExternalTarget(target)) return null;
  const path = target.split("#")[0];
  return path === "" ? null : path;
}
