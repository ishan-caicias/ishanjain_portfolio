import { describe, expect, it } from "vitest";
import { moveFocusTo, restoreFocusTo } from "@/lib/focus-utils";

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
