import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shipRenderer = vi.hoisted(() => ({
  dispose: vi.fn(),
  failures: [] as Array<((error: Error) => void) | undefined>,
  mount: vi.fn(),
  successes: [] as Array<(() => void) | undefined>,
}));

vi.mock("@/components/islands/Starfield", () => ({
  default: () => <canvas data-testid="starfield" />,
}));

vi.mock("@/components/islands/space/ShipRenderer", () => ({
  ShipRenderer: class {
    constructor(onFailure?: (error: Error) => void, onReady?: () => void) {
      shipRenderer.failures.push(onFailure);
      shipRenderer.successes.push(onReady);
    }

    mount = shipRenderer.mount;
    dispose = shipRenderer.dispose;
  },
}));

import SpaceScene from "@/components/islands/SpaceScene";

describe("SpaceScene", () => {
  beforeEach(() => {
    shipRenderer.dispose.mockClear();
    shipRenderer.mount.mockClear();
    shipRenderer.failures.length = 0;
    shipRenderer.successes.length = 0;
  });

  afterEach(cleanup);

  it("layers the interactive starfield below the ship-only renderer", () => {
    render(<SpaceScene />);

    expect(screen.getByTestId("space-scene")).toBeInTheDocument();
    expect(screen.getByTestId("starfield")).toBeInTheDocument();
    expect(shipRenderer.mount).toHaveBeenCalledWith(expect.any(HTMLElement));
  });

  it("disposes the ship renderer when the scene unmounts", () => {
    const { unmount } = render(<SpaceScene />);

    unmount();

    expect(shipRenderer.dispose).toHaveBeenCalledOnce();
  });

  it("reports a non-crashing failed ship renderer status", () => {
    render(<SpaceScene />);

    act(() => shipRenderer.failures.at(-1)?.(new Error("WebGL unavailable")));

    expect(screen.getByTestId("space-scene")).toHaveAttribute(
      "data-ship-status",
      "failed",
    );
  });

  it("reports ready only after the ship renderer loads the GLB", () => {
    render(<SpaceScene />);

    expect(screen.getByTestId("space-scene")).toHaveAttribute(
      "data-ship-status",
      "loading",
    );
    act(() => shipRenderer.successes.at(-1)?.());

    expect(screen.getByTestId("space-scene")).toHaveAttribute(
      "data-ship-status",
      "ready",
    );
  });

  it("updates validated warp events and removes the listener on unmount", () => {
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<SpaceScene />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("cosmos:warp", { detail: { phase: "warp", t: 1 } }),
      );
    });
    expect(screen.getByTestId("space-scene")).toHaveAttribute(
      "data-warp-phase",
      "warp",
    );

    unmount();
    window.dispatchEvent(
      new CustomEvent("cosmos:warp", { detail: { phase: "idle", t: 2 } }),
    );

    expect(removeEventListener).toHaveBeenCalledWith(
      "cosmos:warp",
      expect.any(Function),
    );
  });
});
