import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useReducedMotion } from "@/components/islands/space/useReducedMotion";

type MediaQueryStub = MediaQueryList & {
  emit: (matches: boolean) => void;
};

const createMediaQuery = (
  matches: boolean,
  mode: "event" | "listener" = "event",
): MediaQueryStub => {
  let current = matches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    media: "(prefers-reduced-motion: reduce)",
    get matches() {
      return current;
    },
    onchange: null,
    addEventListener:
      mode === "event"
        ? vi.fn(
            (_type: string, listener: EventListenerOrEventListenerObject) => {
              listeners.add(listener as (event: MediaQueryListEvent) => void);
            },
          )
        : undefined,
    removeEventListener:
      mode === "event"
        ? vi.fn(
            (_type: string, listener: EventListenerOrEventListenerObject) => {
              listeners.delete(
                listener as (event: MediaQueryListEvent) => void,
              );
            },
          )
        : undefined,
    addListener:
      mode === "listener"
        ? vi.fn((listener: (event: MediaQueryListEvent) => void) =>
            listeners.add(listener),
          )
        : undefined,
    removeListener:
      mode === "listener"
        ? vi.fn((listener: (event: MediaQueryListEvent) => void) =>
            listeners.delete(listener),
          )
        : undefined,
    dispatchEvent: vi.fn(() => true),
    emit(nextMatches: boolean) {
      current = nextMatches;
      const event = {
        matches: nextMatches,
        media: mediaQuery.media,
      } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  } as unknown as MediaQueryStub;

  return mediaQuery;
};

describe("useReducedMotion", () => {
  let matchMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    matchMedia = vi.fn();
    vi.stubGlobal("matchMedia", matchMedia);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes from the reduced-motion media query", () => {
    const mediaQuery = createMediaQuery(true);
    matchMedia.mockReturnValue(mediaQuery);

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("updates when the media query changes and removes the listener on unmount", () => {
    const mediaQuery = createMediaQuery(false);
    matchMedia.mockReturnValue(mediaQuery);
    const { result, unmount } = renderHook(() => useReducedMotion());

    act(() => mediaQuery.emit(true));
    expect(result.current).toBe(true);

    unmount();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );

    act(() => mediaQuery.emit(false));
    expect(result.current).toBe(true);
  });

  it("falls back to addListener when addEventListener is unavailable", () => {
    const mediaQuery = createMediaQuery(false, "listener");
    matchMedia.mockReturnValue(mediaQuery);
    const { result, unmount } = renderHook(() => useReducedMotion());

    act(() => mediaQuery.emit(true));
    expect(result.current).toBe(true);

    unmount();
    expect(mediaQuery.removeListener).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  it("syncs the current preference from the effect's media query", () => {
    const currentQuery = createMediaQuery(false);
    matchMedia.mockReturnValue(currentQuery);

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });
});
