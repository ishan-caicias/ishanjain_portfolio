import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function readReducedMotionPreference(): MediaQueryList | undefined {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return undefined;
  }

  return window.matchMedia(REDUCED_MOTION_QUERY);
}

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(
    () => readReducedMotionPreference()?.matches ?? false,
  );

  useEffect(() => {
    const mediaQuery = readReducedMotionPreference();
    if (!mediaQuery) {
      return undefined;
    }

    let mounted = true;
    const listener = (event: MediaQueryListEvent) => {
      if (mounted) {
        setReducedMotion(event.matches);
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
      return () => {
        mounted = false;
        mediaQuery.removeEventListener("change", listener);
      };
    }

    const legacyMediaQuery = mediaQuery as unknown as {
      addListener?: (callback: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (callback: (event: MediaQueryListEvent) => void) => void;
    };
    legacyMediaQuery.addListener?.(listener);
    return () => {
      mounted = false;
      legacyMediaQuery.removeListener?.(listener);
    };
  }, []);

  return reducedMotion;
}
