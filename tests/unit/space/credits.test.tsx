import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CreditsPanel from "../../../src/components/islands/space/CreditsPanel";

describe("CreditsPanel", () => {
  it("renders the ship attribution, source, licence, and modification note", () => {
    render(<CreditsPanel />);

    expect(
      screen.getByText("Sci-Fi Aircraft | Spaceship Fighter"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View model source" }),
    ).toHaveAttribute(
      "href",
      "https://sketchfab.com/3d-models/sci-fi-aircraft-spaceship-fighter-99c1d15965c74f3aa7b5999e2d4e42e1",
    );
    expect(
      screen.getByRole("link", { name: "CC BY 4.0 licence" }),
    ).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
    expect(
      screen.getByText("Converted to GLB and optimized for web delivery."),
    ).toBeInTheDocument();
  });
});
