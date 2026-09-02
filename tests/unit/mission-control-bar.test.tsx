/**
 * PF-11 D5.2 follow-up (2026-07-29 code review, finding 7): `MissionControlBar.tsx` gained ~60
 * lines of stateful combobox logic — open/close, `activeIndex` wraparound, Enter's top-ranked
 * fallback, Escape delegation — with no unit coverage at all, inside vitest's own 80%-threshold
 * `include` scope (`src/components/islands/**`). All of D5.2's coverage was 6 E2E specs on a
 * ~32-minute suite, and none of them caught finding 1 (the Escape-then-type dead state), which
 * an RTL test reproduces in milliseconds.
 *
 * This file drives the REAL component through real DOM events (CLAUDE.md #18 — behaviour, not
 * readiness): the state machine under test is entirely local to the component, so the host's
 * `cmd` is modelled by a small controlled harness rather than mocked away.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import MissionControlBar, {
  type CommandSuggestion,
} from "@/components/islands/space/MissionControlBar";

const body = (id: string): CommandSuggestion => ({
  id,
  name: id.toUpperCase(),
  type: "star",
  dist: "10 ly",
  color: "#ffffff",
  kind: "body",
});

const ALL = [body("sirius"), body("sirrah"), body("vega")];

/** Mirrors SpaceScene.tsx's own wiring: it owns `cmd`, clears it on Escape, and passes a
 * query-filtered `suggestions` plus a static `featured` list down. */
function Harness(props: {
  onSuggestionSelect?: (s: CommandSuggestion) => void;
  totalMatches?: number;
}) {
  const [cmd, setCmd] = useState("");
  const q = cmd.trim().toLowerCase();
  const suggestions = q ? ALL.filter((s) => s.id.includes(q)) : [];
  return (
    <MissionControlBar
      cmd={cmd}
      suggestions={suggestions}
      totalMatches={props.totalMatches ?? suggestions.length}
      featured={ALL}
      onCmdChange={setCmd}
      onCmdKeyDown={(e) => {
        if (e.key === "Escape") setCmd("");
      }}
      onSuggestionSelect={props.onSuggestionSelect ?? vi.fn()}
      onRandom={vi.fn()}
      onHome={vi.fn()}
    />
  );
}

// `vitest.config.ts` sets `globals: false`, so RTL's auto-cleanup afterEach never registers
// itself — without this, every render stacks another component in the same document and
// `screen` queries start matching multiple elements. (MissionControl.test.tsx sidesteps this by
// only ever querying its own `container`; role-based queries need the real cleanup.)
afterEach(cleanup);

const input = () => screen.getByRole("combobox");
const listbox = () => screen.queryByRole("listbox");

describe("MissionControlBar — combobox open/close (PF-11 D5.2)", () => {
  it("REGRESSION (code-review finding 1): typing after Escape re-opens the list", () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "sir" } });
    expect(listbox()).not.toBeNull();

    // Escape closes the list and clears the query, but does NOT move focus.
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(listbox()).toBeNull();

    // The visitor keeps typing without blurring. Before the fix this stayed closed forever.
    fireEvent.change(input(), { target: { value: "vega" } });
    expect(listbox()).not.toBeNull();
    expect(screen.getByRole("option", { name: /VEGA/ })).toBeInTheDocument();
  });

  it("shows the featured list on focus with an empty query, and hides it on blur", () => {
    render(<Harness />);
    expect(listbox()).toBeNull();
    fireEvent.focus(input());
    expect(screen.getByText("NOTABLE DESTINATIONS")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(ALL.length);
    fireEvent.blur(input());
    expect(listbox()).toBeNull();
  });

  it("renders the explicit NO CONTACT state rather than an empty silent list", () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "zzzz" } });
    expect(screen.getByText(/NO CONTACT/)).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});

describe("MissionControlBar — keyboard navigation (PF-11 D5.2)", () => {
  it("Enter with no arrow press activates the TOP-ranked option", () => {
    const onSelect = vi.fn();
    render(<Harness onSuggestionSelect={onSelect} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "sir" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe("sirius");
  });

  it("ArrowDown moves the highlight and Enter activates THAT option", () => {
    const onSelect = vi.fn();
    render(<Harness onSuggestionSelect={onSelect} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "sir" } });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onSelect.mock.calls[0][0].id).toBe("sirrah");
  });

  it("ArrowUp from the top wraps to the last option", () => {
    const onSelect = vi.fn();
    render(<Harness onSuggestionSelect={onSelect} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "sir" } });
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onSelect.mock.calls[0][0].id).toBe("sirrah"); // 2 matches: wraps 0 -> 1
  });

  it("a fresh keystroke re-tops the highlight — Enter never travels to a stale option", () => {
    const onSelect = vi.fn();
    render(<Harness onSuggestionSelect={onSelect} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "sir" } });
    fireEvent.keyDown(input(), { key: "ArrowDown" }); // highlight index 1
    fireEvent.change(input(), { target: { value: "sirius" } }); // now a 1-item list
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onSelect.mock.calls[0][0].id).toBe("sirius");
  });
});

describe("MissionControlBar — ARIA wiring (PF-11 D5.2, CLAUDE.md #7)", () => {
  it("aria-expanded tracks the list, and aria-controls resolves to the real listbox", () => {
    const { container } = render(<Harness />);
    expect(input()).toHaveAttribute("aria-expanded", "false");
    fireEvent.focus(input());
    expect(input()).toHaveAttribute("aria-expanded", "true");
    const controls = input().getAttribute("aria-controls");
    expect(container.querySelector(`#${controls}`)).toHaveAttribute(
      "role",
      "listbox",
    );
  });

  it("aria-activedescendant points at the option actually marked aria-selected", () => {
    const { container } = render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "sir" } });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    const selected = container.querySelectorAll('[aria-selected="true"]');
    expect(selected).toHaveLength(1);
    expect(input()).toHaveAttribute(
      "aria-activedescendant",
      selected[0].getAttribute("id"),
    );
  });
});

describe("MissionControlBar — honest truncation (PF-11 D5.2)", () => {
  it("shows 'N MATCHES · SHOWING n' only when the uncapped total exceeds the shown list", () => {
    const { rerender } = render(<Harness totalMatches={2} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "sir" } });
    expect(screen.queryByText(/MATCHES ·/)).toBeNull(); // 2 shown, 2 total

    rerender(<Harness totalMatches={97} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "sir" } });
    expect(screen.getByText(/97 MATCHES · SHOWING 2/)).toBeInTheDocument();
  });
});
