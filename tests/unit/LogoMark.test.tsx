import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import LogoMark from "../../src/components/islands/LogoMark";

describe("LogoMark", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    cleanup();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("renders lowercase i and j; no uppercase IJ", () => {
    render(<LogoMark />);
    const link = screen.getByRole("link", { name: /home/i });
    expect(link).toBeInTheDocument();
    expect(link).not.toHaveTextContent("IJ");
    expect(link).toHaveTextContent("i");
    expect(link).toHaveTextContent("j");
  });

  it("has hats in rest state (hat-i and hat-j)", () => {
    render(<LogoMark />);
    expect(screen.getByTestId("hat-i")).toBeInTheDocument();
    expect(screen.getByTestId("hat-j")).toBeInTheDocument();
  });

  it("link has accessible name Home", () => {
    render(<LogoMark />);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  });

  it("activates on hover: brackets present and wrapper has active state", () => {
    const { container } = render(<LogoMark />);
    const wrapper = container.querySelector(".logo-mark-wrapper");
    const link = screen.getByRole("link", { name: "Home" });

    expect(wrapper).toHaveAttribute("data-state", "rest");

    fireEvent.mouseEnter(link);

    expect(wrapper).toHaveAttribute("data-state", "active");
    expect(link.textContent).toContain("<");
    expect(link.textContent).toContain(">");
  });

  it("reduced motion: state changes but no translate on hats when active", () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation(
      (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })
    );

    const { container } = render(<LogoMark />);
    const link = container.querySelector('a[aria-label="Home"]');
    if (!link) throw new Error("Home link not found");
    fireEvent.mouseEnter(link);

    const wrapper = container.querySelector(".logo-mark-wrapper");
    expect(wrapper).toHaveAttribute("data-state", "active");

    const hatI = container.querySelector('[data-testid="hat-i"]');
    const hatJ = container.querySelector('[data-testid="hat-j"]');
    expect(hatI).toBeInTheDocument();
    expect(hatJ).toBeInTheDocument();
    // With reduced motion, active variant uses translateX: 0; style should not show 6px translation
    const styleI = (hatI as HTMLElement).getAttribute("style") ?? "";
    const styleJ = (hatJ as HTMLElement).getAttribute("style") ?? "";
    expect(styleI).not.toMatch(/-6px|translateX\(-6/);
    expect(styleJ).not.toMatch(/6px|translateX\(6/);
  });
});
