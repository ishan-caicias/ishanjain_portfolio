/**
 * Guards the docs-drift checker's link parser against the false positive it actually produced
 * (2026-07-20): a correct Wikimedia Commons URL containing parentheses, written in CommonMark's
 * angle-bracket destination form, was reported as a broken RELATIVE link. The owner verified the
 * link resolves in a browser; the checker's regex was the thing that was wrong.
 *
 * The half of this file that matters most is the second describe block. Loosening a checker until
 * a false positive disappears is the easy failure mode, and it silently disarms the check — so
 * these tests pin that real broken links are STILL caught, in both destination forms.
 */
import { describe, expect, it } from "vitest";
import {
  extractLinkTargets,
  isExternalTarget,
  repoRelativeTarget,
} from "../../scripts/lib/markdown-links.mjs";

/** The exact table cell from docs/datasets/star_clusters_hall_of_fame.md that triggered it. */
const REAL_FALSE_POSITIVE =
  "| 1   | Pleiades | [Wikimedia Commons](<https://commons.wikimedia.org/wiki/Category:Pleiades_(star_cluster)>) |";

describe("extractLinkTargets", () => {
  it("parses the angle-bracket destination that caused the real false positive", () => {
    expect(extractLinkTargets(REAL_FALSE_POSITIVE)).toEqual([
      "https://commons.wikimedia.org/wiki/Category:Pleiades_(star_cluster)",
    ]);
  });

  it("keeps parentheses inside an angle-bracket destination instead of truncating at the first one", () => {
    // The old pattern captured "<https://…Pleiades_(star_cluster" — truncated, and starting with
    // "<", which is why it then failed the external-URL test and got resolved as a file path.
    const [target] = extractLinkTargets(REAL_FALSE_POSITIVE);
    expect(target.endsWith("(star_cluster)")).toBe(true);
    expect(target.startsWith("<")).toBe(false);
  });

  it("still parses ordinary bare destinations", () => {
    expect(
      extractLinkTargets("see [TR-074](TR-074.md) and [plan](../plan.md)"),
    ).toEqual(["TR-074.md", "../plan.md"]);
  });

  it("parses both forms in one document", () => {
    const body = "[a](x.md) then [b](<y (2).md>) then [c](https://example.com)";
    expect(extractLinkTargets(body)).toEqual([
      "x.md",
      "y (2).md",
      "https://example.com",
    ]);
  });

  it("ignores an optional link title", () => {
    expect(extractLinkTargets('[a](x.md "a title")')).toEqual(["x.md"]);
    expect(extractLinkTargets('[a](<x.md> "a title")')).toEqual(["x.md"]);
  });

  it("ignores image-style and empty destinations rather than emitting junk", () => {
    expect(extractLinkTargets("[empty]()")).toEqual([]);
    expect(extractLinkTargets("no links here at all")).toEqual([]);
  });
});

describe("the check is still armed — real broken links must NOT slip through", () => {
  it("treats a missing relative file as a repo-relative target to resolve", () => {
    expect(repoRelativeTarget("does-not-exist.md")).toBe("does-not-exist.md");
    expect(repoRelativeTarget("../nope/gone.md")).toBe("../nope/gone.md");
  });

  it("resolves angle-bracket relative links too, rather than skipping them", () => {
    // The lazy fix would be to skip anything bracketed. That would disarm the checker for every
    // relative link that happens to contain a space or parenthesis.
    const [target] = extractLinkTargets("[x](<some file (v2).md>)");
    expect(repoRelativeTarget(target)).toBe("some file (v2).md");
  });

  it("skips external and fragment-only destinations", () => {
    for (const t of [
      "https://example.com",
      "http://example.com",
      "mailto:a@b.c",
      "#a-heading",
      "//cdn.example.com/x.js",
    ]) {
      expect(isExternalTarget(t)).toBe(true);
      expect(repoRelativeTarget(t)).toBeNull();
    }
  });

  it("strips a fragment from a relative target, including inside angle brackets", () => {
    expect(repoRelativeTarget("TR-074.md#part-5")).toBe("TR-074.md");
    const [target] = extractLinkTargets("[x](<TR-074.md#part-5>)");
    expect(repoRelativeTarget(target)).toBe("TR-074.md");
  });
});
