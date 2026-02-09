import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import MissionControl from "../../src/components/islands/MissionControl";

describe("MissionControl", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the trigger button", () => {
    const { container } = render(<MissionControl />);
    const trigger = container.querySelector(
      '[aria-label="Open mission control quick links"]',
    );
    expect(trigger).toBeInTheDocument();
  });

  it("opens panel on button click", async () => {
    const { container } = render(<MissionControl />);
    const trigger = container.querySelector(
      '[aria-label="Open mission control quick links"]',
    ) as HTMLElement;

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(container.querySelector('[role="menu"]')).toBeInTheDocument();
    });
  });

  it("closes panel on Escape key", async () => {
    const { container } = render(<MissionControl />);
    const trigger = container.querySelector(
      '[aria-label="Open mission control quick links"]',
    ) as HTMLElement;

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(container.querySelector('[role="menu"]')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(container.querySelector('[role="menu"]')).not.toBeInTheDocument();
    });
  });

  it("renders all quick links", async () => {
    const { container } = render(<MissionControl />);
    const trigger = container.querySelector(
      '[aria-label="Open mission control quick links"]',
    ) as HTMLElement;

    fireEvent.click(trigger);

    await waitFor(() => {
      const menu = container.querySelector('[role="menu"]');
      expect(menu).toBeInTheDocument();
      expect(menu!.textContent).toContain("Resume");
      expect(menu!.textContent).toContain("LinkedIn");
      expect(menu!.textContent).toContain("GitHub");
      expect(menu!.textContent).toContain("Copy Bio");
    });
  });

  it("copies bio to clipboard on Copy Bio click", async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    const { container } = render(<MissionControl />);
    const trigger = container.querySelector(
      '[aria-label="Open mission control quick links"]',
    ) as HTMLElement;

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(container.querySelector('[role="menu"]')).toBeInTheDocument();
    });

    const copyBtn = Array.from(
      container.querySelectorAll('[role="menuitem"]'),
    ).find((el) => el.textContent?.includes("Copy Bio")) as HTMLElement;
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.stringContaining("Ishan Jain"),
      );
    });
  });

  it("has correct aria-expanded state", async () => {
    const { container } = render(<MissionControl />);
    const trigger = container.querySelector(
      '[aria-label="Open mission control quick links"]',
    ) as HTMLElement;

    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });
  });
});
