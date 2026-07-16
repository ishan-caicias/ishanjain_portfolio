import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shipRenderer = vi.hoisted(() => ({
  assets: [] as Array<{ quality: string; url: string }>,
  dispose: vi.fn(),
  failures: [] as Array<((error: Error) => void) | undefined>,
  mount: vi.fn(),
  successes: [] as Array<
    ((asset: { quality: string; url: string }) => void) | undefined
  >,
}));
const detection = vi.hoisted(() => ({ detectShipQuality: vi.fn() }));

vi.mock("@/components/islands/Starfield", () => ({
  default: () => <canvas data-testid="starfield" />,
}));

vi.mock("@/components/islands/space/ShipRenderer", () => ({
  ShipRenderer: class {
    constructor(
      asset: { quality: string; url: string },
      onFailure?: (error: Error) => void,
      onReady?: (asset: { quality: string; url: string }) => void,
    ) {
      shipRenderer.assets.push(asset);
      shipRenderer.failures.push(onFailure);
      shipRenderer.successes.push(onReady);
    }

    mount = shipRenderer.mount;
    dispose = shipRenderer.dispose;
  },
}));

vi.mock("@/components/islands/space/shipQualityDetection", () => detection);

import SpaceScene from "@/components/islands/SpaceScene";

describe("SpaceScene", () => {
  beforeEach(() => {
    window.localStorage.clear();
    detection.detectShipQuality.mockReset();
    detection.detectShipQuality.mockResolvedValue("low");
    shipRenderer.assets.length = 0;
    shipRenderer.dispose.mockClear();
    shipRenderer.mount.mockClear();
    shipRenderer.failures.length = 0;
    shipRenderer.successes.length = 0;
  });

  afterEach(cleanup);

  it("layers the interactive starfield below the ship-only renderer", async () => {
    render(<SpaceScene />);

    expect(screen.getByTestId("space-scene")).toBeInTheDocument();
    expect(screen.getByTestId("starfield")).toBeInTheDocument();
    await waitFor(() =>
      expect(shipRenderer.mount).toHaveBeenCalledWith(expect.any(HTMLElement)),
    );
  });

  it("disposes the ship renderer when the scene unmounts", async () => {
    const { unmount } = render(<SpaceScene />);

    await waitFor(() => expect(shipRenderer.mount).toHaveBeenCalled());

    unmount();

    expect(shipRenderer.dispose).toHaveBeenCalledOnce();
  });

  it("reports a non-crashing failed ship renderer status", async () => {
    render(<SpaceScene />);

    await waitFor(() => expect(shipRenderer.mount).toHaveBeenCalled());

    act(() => shipRenderer.failures.at(-1)?.(new Error("WebGL unavailable")));

    expect(screen.getByTestId("space-scene")).toHaveAttribute(
      "data-ship-status",
      "failed",
    );
  });

  it("reports ready only after the ship renderer loads the GLB", async () => {
    render(<SpaceScene />);

    expect(screen.getByTestId("space-scene")).toHaveAttribute(
      "data-ship-status",
      "loading",
    );
    await waitFor(() => expect(shipRenderer.mount).toHaveBeenCalled());
    act(() =>
      shipRenderer.successes.at(-1)?.({ quality: "low", url: "/low.glb" }),
    );

    expect(screen.getByTestId("space-scene")).toHaveAttribute(
      "data-ship-status",
      "ready",
    );
  });

  it("updates validated warp events and removes the listener on unmount", async () => {
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<SpaceScene />);

    await waitFor(() => expect(shipRenderer.mount).toHaveBeenCalled());

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

  it("reports the actual ready asset quality", async () => {
    detection.detectShipQuality.mockResolvedValue("high");
    render(<SpaceScene />);

    await waitFor(() =>
      expect(shipRenderer.assets.at(-1)?.quality).toBe("high"),
    );
    act(() =>
      shipRenderer.successes.at(-1)?.({ quality: "high", url: "/high.glb" }),
    );

    expect(screen.getByTestId("space-scene")).toHaveAttribute(
      "data-ship-quality",
      "high",
    );
  });

  it("persists a quality choice before selecting its next asset", async () => {
    detection.detectShipQuality
      .mockResolvedValueOnce("low")
      .mockResolvedValueOnce("high");
    render(<SpaceScene />);

    await waitFor(() =>
      expect(shipRenderer.assets.at(-1)?.quality).toBe("low"),
    );
    fireEvent.change(screen.getByLabelText("Ship visual quality"), {
      target: { value: "high" },
    });

    await waitFor(() =>
      expect(window.localStorage.getItem("ship-quality-preference")).toBe(
        "high",
      ),
    );
    await waitFor(() =>
      expect(shipRenderer.assets.at(-1)?.quality).toBe("high"),
    );
  });
});
