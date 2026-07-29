/**
 * PF-11 D9.2 — the Render Console panel, driven through real DOM events (CLAUDE.md #18).
 *
 * RenderConsole talks to the engine only through `document.querySelector("babylon-scene")`'s
 * `sceneStats()`/`setLayers()` — the same arm's-length pattern `CraftQualityControl`
 * (SectionOverlay.tsx) uses for the ship-quality override. Tests stub a plain element with
 * those two methods rather than booting a real engine.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import RenderConsole from "@/components/islands/space/RenderConsole";
import { LAYERS, tierDefaults, LAYERS_STORAGE_KEY } from "@/lib/render-layers";

// vitest.config sets globals:false, so RTL's auto-cleanup never registers on its own
// (mission-control-bar.test.tsx's own discovery) — explicit afterEach required.
afterEach(cleanup);

let setLayersMock: ReturnType<typeof vi.fn>;
let sceneStatsMock: ReturnType<typeof vi.fn>;

function mountFakeEngine(layers = tierDefaults("full"), qualityTier = "full") {
  const el = document.createElement("babylon-scene");
  setLayersMock = vi.fn();
  sceneStatsMock = vi.fn(() => ({ layers: { ...layers }, qualityTier }));
  (el as unknown as { setLayers: typeof setLayersMock }).setLayers =
    setLayersMock;
  (el as unknown as { sceneStats: typeof sceneStatsMock }).sceneStats =
    sceneStatsMock;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  document.querySelector("babylon-scene")?.remove();
});

describe("RenderConsole", () => {
  it("renders every registered layer's label", () => {
    mountFakeEngine();
    render(<RenderConsole onClose={vi.fn()} />);
    expect(screen.getByText(/SDSS DR18 DEEP FIELD/)).toBeTruthy();
    expect(screen.getByText(/GAIA DR3 ASTEROID BELT · VISUAL/)).toBeTruthy();
    expect(
      screen.getByText(/GAIA DR3 TINY · FULL BACKGROUND FIELD/),
    ).toBeTruthy();
  });

  it("shows the measured device-tier preset chip from sceneStats", () => {
    mountFakeEngine(tierDefaults("balanced"), "balanced");
    render(<RenderConsole onClose={vi.fn()} />);
    expect(screen.getByText(/DEVICE PRESET · BALANCED/)).toBeTruthy();
  });

  // NAMED TEST CHANGES (CLAUDE.md #15), TR-113, in this file: (a) the bonus-stars note now
  // reads "APPLIES ON RELOAD" because that layer became a real boot-time toggle rather than an
  // inert row, and (b) `setLayers` gained a second `{ persist }` argument, so the two
  // call-shape assertions gained it. Neither weakens anything; the block below ADDS the
  // gaia-tiny checked-state assertion whose absence let the original ship ticked.
  it("renders each non-live layer per its status: always-on ticked, reload toggleable, unavailable OFF", () => {
    mountFakeEngine();
    render(<RenderConsole onClose={vi.fn()} />);
    expect(screen.getByText(/ALWAYS ON/)).toBeTruthy();
    expect(screen.getByText(/APPLIES ON RELOAD/)).toBeTruthy();
    expect(screen.getByText(/COMING IN A FUTURE UPDATE/)).toBeTruthy();

    const tinyCheckbox = screen.getByLabelText(
      /GAIA DR3 TINY.*\(not adjustable\)/,
    ) as HTMLInputElement;
    expect(tinyCheckbox.disabled).toBe(true);
    // THE REGRESSION THIS FILE MISSED: an unavailable layer must never claim to be rendering.
    // gaia-tiny shipped as a ticked box asserting 2.55M stars were being drawn from a dataset
    // that does not exist.
    expect(tinyCheckbox.checked).toBe(false);

    // star-field is the opposite case — genuinely always on, so ticked AND disabled.
    const starCheckbox = screen.getByLabelText(
      /STAR FIELD.*\(not adjustable\)/,
    ) as HTMLInputElement;
    expect(starCheckbox.disabled).toBe(true);
    expect(starCheckbox.checked).toBe(true);
  });

  it("toggling a live layer's checkbox calls setLayers with just that id", () => {
    mountFakeEngine();
    render(<RenderConsole onClose={vi.fn()} />);
    const checkbox = screen.getByLabelText(
      "SDSS DR18 DEEP FIELD",
    ) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(setLayersMock).toHaveBeenCalledWith(
      { "sdss-field": false },
      { persist: true },
    );
  });

  it("the belt-physics row is a number input, not a checkbox, and is clamped to its ceiling", () => {
    mountFakeEngine();
    render(<RenderConsole onClose={vi.fn()} />);
    const input = screen.getByLabelText(
      "GAIA DR3 ASTEROID BELT · PHYSICS",
    ) as HTMLInputElement;
    expect(input.type).toBe("number");
    fireEvent.change(input, { target: { value: "10" } });
    expect(setLayersMock).toHaveBeenCalledWith(
      { "belt-physics": 10 },
      { persist: true },
    );

    // TR-113: a hand-typed absurd count must not reach the engine as a Havok body budget.
    const belt = LAYERS.find((l) => l.id === "belt-physics")!;
    expect(input.max).toBe(String(belt.maxCount));
    fireEvent.change(input, { target: { value: "100000" } });
    expect(setLayersMock).toHaveBeenLastCalledWith(
      { "belt-physics": belt.maxCount },
      { persist: true },
    );
  });

  it("RESET TO AUTO clears the stored override WITHOUT re-persisting it", () => {
    mountFakeEngine(tierDefaults("balanced"), "balanced");
    localStorage.setItem(LAYERS_STORAGE_KEY, JSON.stringify({ x: 1 }));
    render(<RenderConsole onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("RESET TO AUTO"));
    // The whole point: the next boot must resolve from the DEVICE TIER, so nothing may remain
    // in storage. The original implementation removed the key and then immediately wrote the
    // full state back through setLayers, pinning the visitor off their tier forever.
    expect(setLayersMock).toHaveBeenLastCalledWith(expect.anything(), {
      persist: false,
    });
    expect(localStorage.getItem(LAYERS_STORAGE_KEY)).toBeNull();
  });

  it("a preset button applies every implemented layer's tier default in one setLayers call", () => {
    mountFakeEngine();
    render(<RenderConsole onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("LITE"));
    const call = setLayersMock.mock.calls.at(-1)![0];
    expect(call["sdss-field"]).toBe(tierDefaults("lite")["sdss-field"]);
    expect(call["belt-physics"]).toBe(tierDefaults("lite")["belt-physics"]);
    // not-yet-implemented layers are never included in an applied config
    expect(call["star-field"]).toBeUndefined();
    expect(call["gaia-tiny"]).toBeUndefined();
  });

  it("the EVERYTHING preset forces every implemented boolean layer on", () => {
    mountFakeEngine();
    render(<RenderConsole onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("EVERYTHING"));
    const call = setLayersMock.mock.calls.at(-1)![0];
    expect(call["sdss-field"]).toBe(true);
    expect(call["belt-visual"]).toBe(true);
    expect(call["nebula-volumes"]).toBe(true);
    // belt-physics is a count, not a boolean — EVERYTHING uses full tier's own budget
    expect(call["belt-physics"]).toBe(tierDefaults("full")["belt-physics"]);
  });

  it("RESET TO AUTO clears the persisted override and reapplies the current tier's defaults", () => {
    localStorage.setItem(
      LAYERS_STORAGE_KEY,
      JSON.stringify({ "sdss-field": false }),
    );
    mountFakeEngine(tierDefaults("balanced"), "balanced");
    render(<RenderConsole onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("RESET TO AUTO"));
    expect(localStorage.getItem(LAYERS_STORAGE_KEY)).toBeNull();
    const call = setLayersMock.mock.calls.at(-1)![0];
    expect(call["sdss-field"]).toBe(tierDefaults("balanced")["sdss-field"]);
  });

  it("shows the URL-override chip when ?layers= is present", () => {
    const original = window.location.search;
    Object.defineProperty(window, "location", {
      value: { ...window.location, search: "?layers=sdss-field:0" },
      writable: true,
    });
    mountFakeEngine();
    render(<RenderConsole onClose={vi.fn()} />);
    expect(screen.getByText("URL OVERRIDE")).toBeTruthy();
    Object.defineProperty(window, "location", {
      value: { ...window.location, search: original },
      writable: true,
    });
  });

  it("close button calls onClose", () => {
    mountFakeEngine();
    const onClose = vi.fn();
    render(<RenderConsole onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close render console"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clicking the scrim calls onClose", () => {
    mountFakeEngine();
    const onClose = vi.fn();
    const { container } = render(<RenderConsole onClose={onClose} />);
    const scrim = container.querySelector('[aria-hidden="true"]');
    expect(scrim).toBeTruthy();
    fireEvent.click(scrim!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("moves focus into the dialog on mount (PF-11 D4.3 focus-trap discipline)", () => {
    mountFakeEngine();
    render(<RenderConsole onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
  });

  it("updates the layer checkboxes when a cosmos:layers event arrives from elsewhere", () => {
    mountFakeEngine();
    render(<RenderConsole onClose={vi.fn()} />);
    const checkbox = screen.getByLabelText(
      "SDSS DR18 DEEP FIELD",
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent(
      window,
      new CustomEvent("cosmos:layers", {
        detail: { ...tierDefaults("full"), "sdss-field": false },
      }),
    );
    expect(checkbox.checked).toBe(false);
  });
});
