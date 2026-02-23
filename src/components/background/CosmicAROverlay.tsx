import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CosmicObjectSelectedDetail } from "./cosmicTypes";
import { COSMIC_OBJECT_SELECTED_EVENT } from "./cosmicTypes";

interface ARCardData {
  id: string;
  kind: string;
  position: [number, number, number];
  screen: { x: number; y: number };
  timestamp: number;
}

interface ARCardPosition {
  x: number;
  y: number;
}

// Deterministic stat generation based on object ID and kind
function generateStats(id: string, kind: string) {
  // Use ID hash for consistent randomness
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const brightness = ["Dim", "Moderate", "Bright", "Brilliant"][hash % 4];
  const distance = ["Near", "Mid", "Far", "Distant"][Math.floor(hash / 10) % 4];

  const classes = {
    star: ["Main Sequence", "Red Giant", "White Dwarf", "Neutron"],
    galaxy: ["Spiral", "Elliptical", "Irregular", "Lenticular"],
    asteroid: ["C-type", "S-type", "M-type", "V-type"],
    comet: ["Short-period", "Long-period", "Halley-type", "Kreutz"],
  };

  const classType = classes[kind as keyof typeof classes]?.[hash % 4] || "Unknown";

  // Drift vector label based on position hash
  const posHash = Math.abs(hash * 137) % 8;
  const driftLabels = [
    "Forward-Right",
    "Forward-Left",
    "Starboard",
    "Port",
    "Zenith",
    "Nadir",
    "Trailing",
    "Leading",
  ];

  // Galaxy-specific: Morphology (same as class for galaxies)
  const morphology = kind === "galaxy" ? classType : undefined;

  return {
    brightness,
    distance,
    class: classType,
    drift: driftLabels[posHash],
    morphology,
  };
}

// Format kind for display (capitalize)
function formatKind(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

// Get short ID (last part after dash, or first 6 chars)
function getShortId(id: string): string {
  const parts = id.split("-");
  if (parts.length > 1) {
    return parts[parts.length - 1].toUpperCase();
  }
  return id.slice(0, 6).toUpperCase();
}

// Clamp position to viewport with padding
function clampToViewport(
  x: number,
  y: number,
  cardWidth: number,
  cardHeight: number
): ARCardPosition {
  const padding = 16;
  const maxX = window.innerWidth - cardWidth - padding;
  const maxY = window.innerHeight - cardHeight - padding;

  return {
    x: Math.max(padding, Math.min(x, maxX)),
    y: Math.max(padding, Math.min(y, maxY)),
  };
}

// ============================================
// HERO IMAGE MANIFEST LOADER
// ============================================

interface HeroManifest {
  [id: string]: {
    src: string;
  };
}

let manifestCache: HeroManifest | null = null;
let manifestPromise: Promise<HeroManifest> | null = null;

async function loadManifest(): Promise<HeroManifest> {
  if (manifestCache) return manifestCache;
  if (manifestPromise) return manifestPromise;

  manifestPromise = fetch('/hero-dso/manifest.json')
    .then(res => res.ok ? res.json() : {})
    .catch(() => ({}))
    .then(data => {
      manifestCache = data;
      return data;
    });

  return manifestPromise;
}

export default function CosmicAROverlay() {
  const [cardData, setCardData] = useState<ARCardData | null>(null);
  const [cardPosition, setCardPosition] = useState<ARCardPosition>({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [heroImageSrc, setHeroImageSrc] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const cardDataRef = useRef<ARCardData | null>(null);

  // Check for prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);

    const handleChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // Handle cosmic object selection
  useEffect(() => {
    const handleObjectSelected = (event: Event) => {
      const customEvent = event as CustomEvent<CosmicObjectSelectedDetail>;
      const detail = customEvent.detail;

      // Toggle: if clicking the same object, close the card
      // Use ref to get current value without dependency issues
      if (cardDataRef.current && cardDataRef.current.id === detail.id) {
        cardDataRef.current = null; // Update ref immediately
        setCardData(null);
        return;
      }

      // Set new card data
      const newCardData = {
        id: detail.id,
        kind: detail.kind,
        position: detail.position,
        screen: detail.screen,
        timestamp: detail.timestamp,
      };
      cardDataRef.current = newCardData; // Update ref immediately
      setCardData(newCardData);

      // Calculate initial position (will be clamped after render)
      setCardPosition({ x: detail.screen.x + 20, y: detail.screen.y - 50 });
    };

    window.addEventListener(COSMIC_OBJECT_SELECTED_EVENT, handleObjectSelected);
    return () => window.removeEventListener(COSMIC_OBJECT_SELECTED_EVENT, handleObjectSelected);
  }, []); // No dependencies - event listener stays stable

  // Clamp position after card renders (when we know its dimensions)
  useEffect(() => {
    if (cardData && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const clamped = clampToViewport(
        cardPosition.x,
        cardPosition.y,
        rect.width,
        rect.height
      );

      // Only update if position changed
      if (clamped.x !== cardPosition.x || clamped.y !== cardPosition.y) {
        setCardPosition(clamped);
      }
    }
  }, [cardData, cardPosition.x, cardPosition.y]);

  // Re-clamp on window resize
  useEffect(() => {
    if (!cardData) return;

    const handleResize = () => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const clamped = clampToViewport(
          cardPosition.x,
          cardPosition.y,
          rect.width,
          rect.height
        );
        setCardPosition(clamped);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [cardData, cardPosition.x, cardPosition.y]);

  // Check if hero image exists for this object via manifest
  useEffect(() => {
    if (!cardData?.id) {
      setHeroImageSrc(null);
      return;
    }

    // Load manifest and check if this object has a hero image
    loadManifest().then(manifest => {
      // Try exact ID match first
      let entry = manifest[cardData.id];

      // If no match, try extracting potential DSO IDs
      if (!entry) {
        const possibleIds = [
          cardData.id.toUpperCase(),
          cardData.id.split('-').pop()?.toUpperCase(),
        ].filter(Boolean) as string[];

        for (const testId of possibleIds) {
          if (manifest[testId]) {
            entry = manifest[testId];
            break;
          }
        }
      }

      // Set hero image source if found in manifest
      if (entry?.src) {
        setHeroImageSrc(entry.src);
      } else {
        setHeroImageSrc(null);
      }
    }).catch(() => {
      setHeroImageSrc(null);
    });
  }, [cardData?.id]);

  // Trigger scan animation on card open
  useEffect(() => {
    if (!cardData || !cardData.id) return;

    // Start scan animation
    setIsScanning(true);
    setScanProgress(0);

    // Skip animation if reduced motion
    if (reducedMotion) {
      setIsScanning(false);
      return;
    }

    // Deterministic scan duration based on object ID (400-700ms range)
    const hash = cardData.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const scanDuration = 400 + (hash % 300); // 400-700ms

    // Animate progress
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / scanDuration) * 100, 100);
      setScanProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        // Small delay before revealing stats
        setTimeout(() => setIsScanning(false), 100);
      }
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [cardData?.id, reducedMotion]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && cardDataRef.current) {
        cardDataRef.current = null; // Update ref immediately
        setCardData(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []); // No dependencies - stable listener

  // Handle clicks outside card
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!cardDataRef.current) return; // Early exit if no card is open

      // Don't close if clicking on a canvas element - assume it's the cosmic background
      // The selection handler will deal with it (including toggle logic)
      const target = e.target as HTMLElement;
      if (target.tagName === 'CANVAS') {
        return;
      }

      if (cardRef.current && !cardRef.current.contains(target as Node)) {
        cardDataRef.current = null; // Update ref immediately
        setCardData(null);
      }
    };

    // Use capture phase to catch clicks before they reach other elements
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, []); // No dependencies - stable listener

  // Focus close button when card opens
  useEffect(() => {
    if (cardData && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [cardData]);

  const handleClose = useCallback(() => {
    cardDataRef.current = null; // Update ref immediately
    setCardData(null);
  }, []);

  if (!cardData) return null;

  const stats = generateStats(cardData.id, cardData.kind);
  const title = formatKind(cardData.kind);
  const shortId = getShortId(cardData.id);

  return (
    <div
      className="fixed inset-0 z-[45]"
      style={{ pointerEvents: "none" }}
      data-testid="cosmic-ar-overlay"
    >
      <AnimatePresence>
        {cardData && (
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="absolute"
            style={{
              left: `${cardPosition.x}px`,
              top: `${cardPosition.y}px`,
              pointerEvents: "auto",
            }}
            role="dialog"
            aria-label="Cosmic object details"
            data-testid="cosmic-ar-card"
          >
            {/* Card container */}
            <div className="relative w-80 rounded-lg border border-royal-600/50 bg-surface-elevated/95 shadow-2xl backdrop-blur-md">
              {/* Animated scan border (disabled in reduced motion) */}
              {!reducedMotion && (
                <div className="absolute inset-0 overflow-hidden rounded-lg">
                  <motion.div
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(147, 197, 253, 0.3) 50%, transparent 100%)",
                    }}
                    animate={{
                      x: ["-100%", "100%"],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                </div>
              )}

              {/* Scan Animation Overlay */}
              {isScanning && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-surface-elevated/95 backdrop-blur-md">
                  <div className="text-center">
                    {/* Scanning text */}
                    <p className="mb-3 text-sm font-medium text-royal-300">Scanning...</p>

                    {/* Progress bar */}
                    <div className="mx-auto h-1 w-32 overflow-hidden rounded-full bg-royal-800/30">
                      <motion.div
                        className="h-full bg-gradient-to-r from-royal-500 to-gold-400"
                        style={{ width: `${scanProgress}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>

                    {/* Scanning animation (optional pulsing effect) */}
                    {!reducedMotion && (
                      <motion.div
                        className="mx-auto mt-4 h-8 w-8 rounded-full border-2 border-royal-400"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Card content */}
              <div className="relative z-10">
                {/* Hero Image (if exists in manifest) */}
                {!isScanning && heroImageSrc && (
                  <div className="relative overflow-hidden rounded-t-lg">
                    <img
                      src={heroImageSrc}
                      alt={`${title} - Deep-sky object`}
                      className="h-48 w-full object-cover"
                      loading="lazy"
                      onError={() => {
                        // Hide if image fails to load
                        setHeroImageSrc(null);
                      }}
                    />
                    {/* Credits overlay */}
                    <a
                      href="/credits"
                      className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-blue-300 backdrop-blur-sm transition-colors hover:bg-black/90 hover:text-blue-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Image Credits
                    </a>
                  </div>
                )}

                <div className="p-4">
                  {/* Header */}
                  <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-royal-300">
                      {title} <span className="text-royal-500">•</span>{" "}
                      <span className="text-sm font-mono text-gold-400">{shortId}</span>
                    </h3>
                    <p className="text-xs text-text-muted">
                      Selected at {new Date(cardData.timestamp).toLocaleTimeString()}
                    </p>
                  </div>

                  {/* Close button */}
                  <button
                    ref={closeButtonRef}
                    onClick={handleClose}
                    className="ml-2 rounded p-1 text-text-muted transition-colors hover:bg-royal-800/30 hover:text-royal-300 focus:outline-none focus:ring-2 focus:ring-royal-500"
                    aria-label="Close details"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Stats grid - only show when not scanning */}
                {!isScanning && (
                  <div className="space-y-2">
                    <StatRow label="Brightness" value={stats.brightness} />
                    <StatRow label="Distance" value={stats.distance} />
                    <StatRow label="Class" value={stats.class} />

                    {/* Galaxy-specific morphology row */}
                    {cardData.kind === "galaxy" && stats.morphology && (
                      <StatRow label="Morphology" value={stats.morphology} />
                    )}

                    <StatRow label="Drift Vector" value={stats.drift} />
                  </div>
                )}

                  {/* Position data (for debugging/reference) */}
                  <div className="mt-3 border-t border-royal-700/30 pt-3">
                    <p className="text-xs font-mono text-text-dim">
                      Position: [{cardData.position[0].toFixed(1)}, {cardData.position[1].toFixed(1)}, {cardData.position[2].toFixed(1)}]
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Stat row component
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded bg-surface/50 px-3 py-2">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-sm font-medium text-royal-200">{value}</span>
    </div>
  );
}
