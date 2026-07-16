import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const renderer = vi.hoisted(() => ({ mount: vi.fn(), dispose: vi.fn() }));
const detection = vi.hoisted(() => ({ detectShipQuality: vi.fn() }));

vi.mock("@/components/islands/Starfield", () => ({
  default: () => <canvas data-testid="starfield" />,
}));
vi.mock("@/components/islands/space/ShipRenderer", () => ({
  ShipRenderer: class {
    mount = renderer.mount;
    dispose = renderer.dispose;
  },
}));
vi.mock("@/components/islands/space/shipQualityDetection", () => detection);
vi.mock("@/components/islands/space/webglSupport", () => ({
  canCreateWebGL: vi.fn(() => true),
}));

import SpaceScene from "../../../src/components/islands/SpaceScene";

describe("SpaceScene travel integration", () => {
  beforeEach(() => {
    detection.detectShipQuality.mockResolvedValue("low");
    renderer.mount.mockClear();
    renderer.dispose.mockClear();
    document.body.innerHTML =
      '<main><section id="experience" /><section id="projects" /><section id="contact" /></main>';
  });

  afterEach(() => {
    cleanup();
  });

  it("announces normal travel and smooth-scrolls while preserving focus", async () => {
    const scrollIntoView = vi.fn();
    document.getElementById("projects")!.scrollIntoView = scrollIntoView;
    render(<SpaceScene webglSupported reducedMotion={false} />);

    const button = screen.getByRole("button", {
      name: "Travel to Projects station",
    });
    button.focus();
    fireEvent.click(button);

    expect(screen.getByTestId("space-travel-status")).toHaveTextContent(
      "Travelling to Projects.",
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(document.activeElement).toBe(button);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 550));
    });
    expect(screen.getByTestId("space-travel-status")).toHaveTextContent(
      "Arrived at Projects.",
    );
  });

  it("keeps semantic station controls when WebGL is unavailable", () => {
    render(<SpaceScene webglSupported={false} reducedMotion />);

    expect(screen.getByTestId("space-scene-fallback")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Travel to Contact station" }),
    ).toBeVisible();
    expect(screen.queryByTestId("starfield")).not.toBeInTheDocument();
    expect(renderer.mount).not.toHaveBeenCalled();
    expect(screen.getByTestId("space-scene")).toHaveAttribute(
      "data-reduced-motion",
      "true",
    );
  });
});
