import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, act } from "@testing-library/react";
import StarModal from "../../src/components/islands/StarModal";

// Mock fetch for Hubble data
const mockHubbleData = [
  {
    id: "test-nebula",
    title: "Test Nebula",
    date: "2024-01-01",
    description: "A test nebula for unit testing.",
    imagePath: "/hubble/images/test.webp",
    credit: "Test Credit",
    sourceUrl: "https://example.com",
  },
];

describe("StarModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHubbleData),
    });
  });

  afterEach(() => {
    document.body.style.overflow = "";
  });

  async function renderAndWaitForData() {
    const result = render(<StarModal />);

    // Wait for data to be fetched and state to settle
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/hubble/data.json");
    });
    // Allow microtasks to settle (React state updates)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    return result;
  }

  async function openModal(baseElement: HTMLElement) {
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("starclick", { detail: { hubbleIndex: 0 } }),
      );
      await new Promise((r) => setTimeout(r, 50));
    });

    // Wait for dialog to appear in the DOM
    await waitFor(
      () => {
        const dialog = baseElement.querySelector('[role="dialog"]');
        expect(dialog).toBeTruthy();
      },
      { timeout: 2000 },
    );
  }

  it("does not render modal initially", async () => {
    const { baseElement } = await renderAndWaitForData();
    expect(baseElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it("opens modal when starclick event is dispatched", async () => {
    const { baseElement } = await renderAndWaitForData();

    await openModal(baseElement);

    expect(baseElement.textContent).toContain("Test Nebula");
    expect(baseElement.textContent).toContain(
      "A test nebula for unit testing.",
    );
    expect(baseElement.textContent).toContain("Test Credit");
  });

  it("closes modal on close button click (restores body scroll)", async () => {
    const { baseElement } = await renderAndWaitForData();
    await openModal(baseElement);

    // Modal is open — body scroll should be hidden
    expect(document.body.style.overflow).toBe("hidden");

    const closeButton = baseElement.querySelector(
      '[aria-label="Close modal"]',
    ) as HTMLElement;
    expect(closeButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(closeButton);
      await new Promise((r) => setTimeout(r, 100));
    });

    // Body scroll should be restored when modal closes
    // Note: AnimatePresence keeps the dialog in DOM during exit animation
    // in JSDOM (no RAF), so we verify the state change via body overflow
    await waitFor(() => {
      expect(document.body.style.overflow).toBe("");
    });
  });

  it("closes modal on Escape key", async () => {
    const { baseElement } = await renderAndWaitForData();
    await openModal(baseElement);

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => {
      expect(baseElement.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  it("shows fallback when image fails to load", async () => {
    const { baseElement } = await renderAndWaitForData();
    await openModal(baseElement);

    const img = baseElement.querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();

    await act(async () => {
      fireEvent.error(img);
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => {
      expect(baseElement.textContent).toContain("Image unavailable");
    });
  });

  it("uses fallback data when fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { baseElement } = render(<StarModal />);

    // Wait for fetch to fail and fallback data to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("starclick", { detail: { hubbleIndex: 0 } }),
      );
      await new Promise((r) => setTimeout(r, 100));
    });

    await waitFor(
      () => {
        const dialog = baseElement.querySelector('[role="dialog"]');
        expect(dialog).toBeTruthy();
      },
      { timeout: 3000 },
    );

    expect(baseElement.textContent).toContain("A Distant Nebula");
  });

  it("traps focus with Tab when modal is open", async () => {
    const { baseElement } = await renderAndWaitForData();
    await openModal(baseElement);

    const dialog = baseElement.querySelector('[role="dialog"]') as HTMLElement;
    const closeButton = baseElement.querySelector(
      '[aria-label="Close modal"]',
    ) as HTMLElement;
    expect(closeButton).toBeTruthy();
    closeButton.focus();

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, a[href], [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const keyDownEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: false,
      bubbles: true,
    });
    Object.defineProperty(keyDownEvent, "preventDefault", {
      value: vi.fn(),
      configurable: true,
    });
    if (last) {
      last.focus();
      document.dispatchEvent(keyDownEvent);
      expect(
        (keyDownEvent as unknown as { preventDefault: () => void })
          .preventDefault,
      ).toHaveBeenCalled();
    }
  });
});
