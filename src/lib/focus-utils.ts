/* focus-utils.ts — PF-11 D1.2/D4.3 shared focus-management helper.
 *
 * Created here because D1.2 lands first; D4.3's collector card reuses these same two
 * functions rather than growing its own copy (delivery plan: "shared focus utility, built
 * in D4.3 — if D1 lands first, create it here"). Deliberately small: both flows this repo
 * needs right now are "move focus onto a surface that just became relevant" and "give focus
 * back to whatever had it before" — nothing here is a full focus-trap library, and neither
 * consumer needs one (PreFlight is a full-page gate, not a modal with content behind it to
 * trap away from).
 */

/** Moves focus to `el`, tolerating elements that don't normally take focus by adding
 * `tabindex="-1"` — the standard pattern for focusing a non-interactive container (e.g.
 * landing focus on the Where-To console's wrapper, not its input, so a touch visitor
 * doesn't get the virtual keyboard popped by an auto-focused text field). Tries a plain
 * `focus()` first and only adds `tabindex` if that didn't take — a naturally-focusable
 * element (a button, a link) is left exactly as it was, and an element that already
 * carries its own `tabindex` is never overwritten. A no-op if `el` is null/already
 * focused, so callers don't need to guard first. */
export function moveFocusTo(el: HTMLElement | null): void {
  if (!el || document.activeElement === el) return;
  el.focus({ preventScroll: true });
  if (document.activeElement !== el) {
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }
}

/** Restores focus to `el` — the counterpart to `moveFocusTo` for "give focus back to what
 * had it" flows. Checks `isConnected` because the element a caller captured a reference to
 * may have been removed from the document by the time the restore runs (e.g. a surface that
 * unmounts on the same state change that triggers the restore). */
export function restoreFocusTo(el: HTMLElement | null): void {
  if (!el || !el.isConnected) return;
  el.focus({ preventScroll: true });
}
