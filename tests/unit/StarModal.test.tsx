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
        new CustomEvent("starclick", {
          detail: { hubbleIndex: 0, isLegacy: true },
        }),
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
    expect(baseElement.textContent).toContain("A test nebula for unit testing.");
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
        new CustomEvent("starclick", {
          detail: { hubbleIndex: 0, isLegacy: true },
        }),
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

  it('shows "Today\'s Discovery" badge in NASA mode', async () => {
    // Mock NASA API response - title must match search terms (e.g. pillars-of-creation) for quality filter
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes("images-api.nasa.gov")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              collection: {
                items: [
                  {
                    data: [
                      {
                        title: "Pillars of Creation in Eagle Nebula",
                        description: "Pillars of creation nebula M16",
                        nasa_id: "NASA001",
                      },
                    ],
                    links: [
                      { href: "https://example.com/nasa.jpg", rel: "preview" },
                    ],
                  },
                ],
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockHubbleData),
      });
    });

    const { baseElement, getAllByText } = await renderAndWaitForData();

    await act(async () => {
      // Simulate NASA star click
      window.dispatchEvent(
        new CustomEvent("starclick", {
          detail: {
            targetId: "pillars-of-creation",
            isLegacy: false,
          },
        }),
      );
      await new Promise((r) => setTimeout(r, 300));
    });

    await waitFor(
      () => {
        const badges = getAllByText("Today's Discovery");
        expect(badges.length).toBeGreaterThan(0);
        expect(badges[0]).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("does NOT show badge in Hubble/legacy mode", async () => {
    const { baseElement } = await renderAndWaitForData();
    await openModal(baseElement);

    // Badge should not be present in legacy Hubble mode
    expect(baseElement.textContent).not.toContain("Today's Discovery");
  });

  it("has h-80 class on image container for fixed height", async () => {
    const { baseElement } = await renderAndWaitForData();
    await openModal(baseElement);

    await waitFor(() => {
      const imageContainer = baseElement.querySelector(".h-80");
      expect(imageContainer).toBeTruthy();
    });
  });

  it("has object-contain class on image element", async () => {
    const { baseElement } = await renderAndWaitForData();
    await openModal(baseElement);

    await waitFor(() => {
      const img = baseElement.querySelector("img.object-contain");
      expect(img).toBeTruthy();
    });
  });

  it("image container and element maintain aspect ratio", async () => {
    const { baseElement } = await renderAndWaitForData();
    await openModal(baseElement);

    await waitFor(() => {
      // Verify h-80 on container
      const imageContainer = baseElement.querySelector(
        ".h-80.w-full.overflow-hidden",
      );
      expect(imageContainer).toBeTruthy();

      // Verify object-contain on image
      const img = baseElement.querySelector("img.object-contain");
      expect(img).toBeTruthy();
    });
  });
});
