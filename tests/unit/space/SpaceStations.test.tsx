import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import SpaceStations from "../../../src/components/islands/space/SpaceStations";

describe("SpaceStations", () => {
  afterEach(cleanup);

  it("renders the constellation stations as labelled keyboard controls", () => {
    render(<SpaceStations onSelect={vi.fn()} />);

    expect(
      screen.getByRole("navigation", { name: "Space stations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Travel to Projects station" }),
    ).toHaveAttribute("data-station", "projects");
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("reports the selected station without moving focus", () => {
    const onSelect = vi.fn();
    render(<SpaceStations onSelect={onSelect} selectedStation="contact" />);

    const button = screen.getByRole("button", {
      name: "Travel to Contact station",
    });
    button.focus();
    fireEvent.click(button);

    expect(onSelect).toHaveBeenCalledWith("contact");
    expect(button).toHaveAttribute("aria-current", "true");
    expect(document.activeElement).toBe(button);
  });
});
