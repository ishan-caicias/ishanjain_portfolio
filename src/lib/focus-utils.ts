/* focus-utils.ts — PF-11 D1.2/D4.1/D4.3 shared focus-management helper.
 *
 * Created here because D1.2 lands first; D4.1/D4.3 reuse these same functions rather than
 * growing their own copies (delivery plan: "shared focus utility, built in D4.3 — if D1
 * lands first, create it here"). The flows this repo needs: "move focus onto a surface that
 * just became relevant," "give focus back to whatever had it before," "exactly one layer
 * consumes an Escape press" (D4.1), and (D4.3) "keep Tab inside a real modal that has page
 * content behind it." PreFlight (a full-page gate) and ArrivalVista (click-anywhere-to-dismiss,
 * D4.1) still don't need `trapFocus` — there's nothing behind either of them to tab into.
 * CollectorCard is the first consumer that does: it floats over a live, still-interactive
 * scene, and without a trap Tab walks straight out of the dialog into the mission bar/header
 * behind it.
 */

import { useEffect, useRef } from "react";

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

/** Native tab stops — buttons, links, and other elements a real Tab press would reach.
 * `[tabindex]:not([tabindex="-1"])` deliberately excludes the container itself (typically
 * given `tabindex="-1"` by `moveFocusTo` so it can receive the INITIAL programmatic focus on
 * open, without becoming a second stop in the Tab cycle). */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps Tab/Shift+Tab cycling within `container`'s own focusable descendants — call from an
 * `onKeyDown` handler on a real modal's root (one whose content sits over a still-interactive
 * page, unlike PreFlight or ArrivalVista — see the file header). A no-op for any key other
 * than Tab, and a no-op if the container has no focusable descendants at all (nothing to trap
 * into, so nothing to do). Elements hidden via `display:none` are skipped
 * (`offsetParent === null`) — a disabled/hidden control should not become a dead tab stop.
 *
 * This does not itself move focus INTO the container on open, nor restore it on close —
 * that's `moveFocusTo`/`restoreFocusTo`'s job, called once from the consumer's mount/unmount
 * effect. `trapFocus` only ever fires from a real Tab keypress while the container already
 * has focus somewhere inside it. */
export function trapFocus(
  container: HTMLElement,
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">,
): void {
  if (event.key !== "Tab") return;
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.offsetParent !== null);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last || !container.contains(active)) {
    event.preventDefault();
    first.focus();
  }
}

/** One entry in the Escape-key priority stack `useEscapeStack` dispatches through. */
export interface EscapeLayer {
  /** Whether this layer is currently showing, and so eligible to consume the next Escape. */
  active: boolean;
  /** Called when this is the topmost active layer and Escape was pressed. Must close ONLY
   * this layer — never reach into a layer below it. */
  onEscape: () => void;
}

/** Global Escape-key dispatcher for the app's stacked overlays (PF-11 D4.1). Exactly one
 * layer closes per press — the first `active` entry in `layers`, which callers order
 * topmost/most-recently-opened first — never all of them at once, which is what a single
 * flat `if (e.key === "Escape") closeEverything()` handler does, and which reads as a bug
 * the instant two surfaces are open together (e.g. dismissing a card also blows away the
 * section behind it). `layers` is read through a ref updated on every render so the
 * listener — attached once — never goes stale without needing `active`/`onEscape` identity
 * to stay stable across renders. */
export function useEscapeStack(layers: readonly EscapeLayer[]): void {
  const layersRef = useRef(layers);
  layersRef.current = layers;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const top = layersRef.current.find((l) => l.active);
      if (!top) return;
      e.preventDefault();
      top.onEscape();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
