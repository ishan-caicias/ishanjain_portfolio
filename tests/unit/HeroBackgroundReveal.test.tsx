import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import HeroBackgroundReveal from "../../src/components/islands/HeroBackgroundReveal";

const mockEntry = {
  id: "test-dso",
  label: "Test Nebula",
  imagePath: "/hero-dso/images/test-dso.webp",
  credit: "Test Credit",
  attributionRequired: false,
  license: "Public domain",
  licenseUrl: null,
  sourceUrl: "https://example.com",
};

const mockAttributedEntry = {
  ...mockEntry,
  id: "test-dso-2",
  label: "Another Nebula",
  attributionRequired: true,
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0",
};

function mockManifest(entries: unknown[]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(entries),
  });
}

async function renderAndWaitForData(entries: unknown[]) {
  mockManifest(entries);
  const result = render(<HeroBackgroundReveal />);

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith("/hero-dso/manifest.json");
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });

  return result;
}

async function clickStar(index: number) {
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent("starclick", { detail: { dsoIndex: index } }),
    );
    await new Promise((r) => setTimeout(r, 50));
  });
}

describe("HeroBackgroundReveal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.removeEventListener("keydown", () => {});
  });

  it("shows nothing until a star is clicked", async () => {
    const { baseElement } = await renderAndWaitForData([mockEntry]);
    expect(baseElement.textContent).not.toContain("Test Nebula");
  });

  it("reveals the credit line for the clicked object", async () => {
    const { baseElement } = await renderAndWaitForData([mockEntry]);

    await clickStar(0);

    expect(baseElement.textContent).toContain("Test Nebula");
    expect(baseElement.textContent).toContain("Test Credit");
  });

  it("shows a license link only when attribution is required", async () => {
    const { baseElement } = await renderAndWaitForData([mockAttributedEntry]);

    await clickStar(0);

    const link = baseElement.querySelector(
      "a[href='https://creativecommons.org/licenses/by/4.0']",
    );
    expect(link).toBeTruthy();
    expect(link?.textContent).toContain("CC BY 4.0");
  });

  it("does not show a license link when attribution is not required", async () => {
    const { baseElement } = await renderAndWaitForData([mockEntry]);

    await clickStar(0);

    expect(baseElement.querySelector("a")).toBeNull();
  });

  it("dismisses when the same star is clicked again", async () => {
    const { baseElement } = await renderAndWaitForData([mockEntry]);

    await clickStar(0);
    expect(baseElement.textContent).toContain("Test Nebula");

    await clickStar(0);
    expect(baseElement.textContent).not.toContain("Test Nebula");
  });

  it("switches to a different object when a different star is clicked", async () => {
    const { baseElement } = await renderAndWaitForData([
      mockEntry,
      mockAttributedEntry,
    ]);

    await clickStar(0);
    const firstLabel = baseElement.textContent?.includes("Test Nebula")
      ? "Test Nebula"
      : "Another Nebula";

    await clickStar(1);
    const secondLabel = baseElement.textContent?.includes("Test Nebula")
      ? "Test Nebula"
      : "Another Nebula";

    expect(firstLabel).not.toBe(secondLabel);
  });

  it("dismisses via the close button", async () => {
    const { baseElement, getByLabelText } = await renderAndWaitForData([
      mockEntry,
    ]);

    await clickStar(0);
    expect(baseElement.textContent).toContain("Test Nebula");

    await act(async () => {
      getByLabelText(/Return to starfield/i).click();
    });

    expect(baseElement.textContent).not.toContain("Test Nebula");
  });

  it("dismisses on Escape key", async () => {
    const { baseElement } = await renderAndWaitForData([mockEntry]);

    await clickStar(0);
    expect(baseElement.textContent).toContain("Test Nebula");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(baseElement.textContent).not.toContain("Test Nebula");
  });

  it("ignores a starclick index outside the sampled set", async () => {
    const { baseElement } = await renderAndWaitForData([mockEntry]);

    await clickStar(5);

    expect(baseElement.textContent).not.toContain("Test Nebula");
  });
});
