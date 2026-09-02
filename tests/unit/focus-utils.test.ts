import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  moveFocusTo,
  restoreFocusTo,
  trapFocus,
  useEscapeStack,
  type EscapeLayer,
} from "@/lib/focus-utils";

/** jsdom never computes real layout, so `offsetParent` — `trapFocus`'s own signal for "is this
 * actually visible" — is `null` for every element by default, not just hidden ones. Stubbing it
 * per-element is the standard jsdom accommodation for a visibility check like this; it isn't
 * loosening `trapFocus`'s behaviour, only giving its real "is this hidden" branch something
 * true to observe in an environment that doesn't lay pages out. */
function makeVisible(el: HTMLElement): void {
  Object.defineProperty(el, "offsetParent", {
    value: document.body,
    configurable: true,
  });
}

describe("moveFocusTo", () => {
  it("focuses a naturally-focusable element without adding tabindex", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    moveFocusTo(btn);
    expect(document.activeElement).toBe(btn);
    expect(btn.hasAttribute("tabindex")).toBe(false);
    btn.remove();
  });

  it("adds tabindex=-1 to a non-interactive container before focusing it", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    moveFocusTo(div);
    expect(document.activeElement).toBe(div);
    expect(div.getAttribute("tabindex")).toBe("-1");
    div.remove();
  });

  it("does not overwrite an existing tabindex", () => {
    const div = document.createElement("div");
    div.setAttribute("tabindex", "0");
    document.body.appendChild(div);
    moveFocusTo(div);
    expect(div.getAttribute("tabindex")).toBe("0");
    div.remove();
  });

  it("is a no-op for null", () => {
    expect(() => moveFocusTo(null)).not.toThrow();
  });

  it("is a no-op when the element is already focused", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    btn.focus();
    // Calling again must not throw or change anything observable.
    moveFocusTo(btn);
    expect(document.activeElement).toBe(btn);
    btn.remove();
  });
});

describe("restoreFocusTo", () => {
  it("restores focus to an element still attached to the document", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    const other = document.createElement("button");
    document.body.appendChild(other);
    other.focus();

    restoreFocusTo(btn);
    expect(document.activeElement).toBe(btn);
    btn.remove();
    other.remove();
  });

  it("does nothing if the element was removed from the document first", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    const other = document.createElement("button");
    document.body.appendChild(other);
    other.focus();
    btn.remove(); // detached before the restore attempt

    restoreFocusTo(btn);
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it("is a no-op for null", () => {
    expect(() => restoreFocusTo(null)).not.toThrow();
  });
});

/** PF-11 D4.1 — the shared Escape-key priority dispatcher SpaceScene uses to order
 * card → vista → suggestions → sectionOpen. */
describe("useEscapeStack", () => {
  const escape = () =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

  it("dispatches to the first active layer only, in priority order", () => {
    const calls: string[] = [];
    const layers: EscapeLayer[] = [
      { active: false, onEscape: () => calls.push("card") },
      { active: true, onEscape: () => calls.push("vista") },
      { active: true, onEscape: () => calls.push("suggestions") },
    ];
    renderHook(() => useEscapeStack(layers));

    escape();

    expect(calls).toEqual(["vista"]);
  });

  it("ignores keys other than Escape", () => {
    const calls: string[] = [];
    renderHook(() =>
      useEscapeStack([{ active: true, onEscape: () => calls.push("hit") }]),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(calls).toEqual([]);
  });

  it("does nothing when no layer is active", () => {
    const calls: string[] = [];
    renderHook(() =>
      useEscapeStack([{ active: false, onEscape: () => calls.push("hit") }]),
    );

    escape();

    expect(calls).toEqual([]);
  });

  it("reads the latest layers on every press without re-attaching its listener", () => {
    const calls: string[] = [];
    const { rerender } = renderHook(
      ({ layers }: { layers: EscapeLayer[] }) => useEscapeStack(layers),
      {
        initialProps: {
          layers: [
            { active: false, onEscape: () => calls.push("first") },
          ] as EscapeLayer[],
        },
      },
    );

    rerender({
      layers: [{ active: true, onEscape: () => calls.push("second") }],
    });
    escape();

    expect(calls).toEqual(["second"]);
  });

  it("removes its listener on unmount", () => {
    const calls: string[] = [];
    const { unmount } = renderHook(() =>
      useEscapeStack([{ active: true, onEscape: () => calls.push("hit") }]),
    );

    unmount();
    escape();

    expect(calls).toEqual([]);
  });
});

/** PF-11 D4.3 — the real focus trap CollectorCard is the first consumer of. */
describe("trapFocus", () => {
  function buildContainer(buttonCount: number): {
    container: HTMLDivElement;
    buttons: HTMLButtonElement[];
  } {
    const container = document.createElement("div");
    const buttons = Array.from({ length: buttonCount }, (_, i) => {
      const b = document.createElement("button");
      b.textContent = `btn-${i}`;
      makeVisible(b);
      container.appendChild(b);
      return b;
    });
    document.body.appendChild(container);
    return { container, buttons };
  }

  function tabEvent(shiftKey: boolean) {
    let prevented = false;
    return {
      event: {
        key: "Tab",
        shiftKey,
        preventDefault: () => {
          prevented = true;
        },
      },
      wasPrevented: () => prevented,
    };
  }

  it("ignores any key other than Tab", () => {
    const { container, buttons } = buildContainer(2);
    buttons[1].focus();
    trapFocus(container, {
      key: "Enter",
      shiftKey: false,
      preventDefault: () => {},
    });
    expect(document.activeElement).toBe(buttons[1]);
    container.remove();
  });

  it("is a no-op when the container has no focusable descendants", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const { event, wasPrevented } = tabEvent(false);
    expect(() => trapFocus(container, event)).not.toThrow();
    expect(wasPrevented()).toBe(false);
    container.remove();
  });

  it("wraps Tab from the last focusable element back to the first", () => {
    const { container, buttons } = buildContainer(3);
    buttons[2].focus(); // last
    const { event, wasPrevented } = tabEvent(false);
    trapFocus(container, event);
    expect(wasPrevented()).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
    container.remove();
  });

  it("wraps Shift+Tab from the first focusable element back to the last", () => {
    const { container, buttons } = buildContainer(3);
    buttons[0].focus(); // first
    const { event, wasPrevented } = tabEvent(true);
    trapFocus(container, event);
    expect(wasPrevented()).toBe(true);
    expect(document.activeElement).toBe(buttons[2]);
    container.remove();
  });

  it("lets Tab move normally between interior elements (no wrap, no preventDefault)", () => {
    const { container, buttons } = buildContainer(3);
    buttons[0].focus(); // first, but Tab (not Shift+Tab) — not the wrap case
    const { event, wasPrevented } = tabEvent(false);
    trapFocus(container, event);
    expect(wasPrevented()).toBe(false);
    // trapFocus doesn't move focus itself for the non-wrap case — the browser's native Tab
    // handling does, since preventDefault was never called.
    expect(document.activeElement).toBe(buttons[0]);
    container.remove();
  });

  it("redirects focus INTO the container if it somehow landed outside it", () => {
    const { container, buttons } = buildContainer(2);
    const outside = document.createElement("button");
    makeVisible(outside);
    document.body.appendChild(outside);
    outside.focus();

    const { event, wasPrevented } = tabEvent(false);
    trapFocus(container, event);
    expect(wasPrevented()).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);

    outside.remove();
    container.remove();
  });

  it("skips a hidden (offsetParent === null) descendant entirely", () => {
    const { container, buttons } = buildContainer(3);
    // Middle button stays hidden (never made visible) — the trap's first/last should treat
    // it as absent, not as a real tab stop a keyboard user could land on.
    Object.defineProperty(buttons[1], "offsetParent", {
      value: null,
      configurable: true,
    });
    buttons[2].focus(); // last VISIBLE element
    const { event, wasPrevented } = tabEvent(false);
    trapFocus(container, event);
    expect(wasPrevented()).toBe(true);
    expect(document.activeElement).toBe(buttons[0]); // wraps to the first visible one
    container.remove();
  });
});
