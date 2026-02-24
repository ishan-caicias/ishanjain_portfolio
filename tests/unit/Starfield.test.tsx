import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import Starfield from "../../src/components/islands/Starfield";

describe("Starfield", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a canvas with role img and aria-label", () => {
    const { container } = render(<Starfield />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute("role", "img");
    expect(canvas).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/starfield.*Hubble/i),
    );
  });

  it("renders with custom star counts when provided", () => {
    const { container } = render(
      <Starfield starCount={10} specialStarCount={2} />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });
});
