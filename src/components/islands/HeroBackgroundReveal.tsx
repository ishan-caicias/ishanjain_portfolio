import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { HeroDsoEntry } from "@/types";
import { loadHeroDsoData } from "@/utils/heroDso";

const MAX_IN_PLAY = 24;

function pickSample(entries: HeroDsoEntry[], size: number): HeroDsoEntry[] {
  const shuffled = [...entries];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, size);
}

export default function HeroBackgroundReveal() {
  const [sample, setSample] = useState<HeroDsoEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    loadHeroDsoData().then((entries) =>
      setSample(pickSample(entries, MAX_IN_PLAY)),
    );
  }, []);

  const dismiss = useCallback(() => setActiveIndex(null), []);

  useEffect(() => {
    const handleStarClick = (e: Event) => {
      const customEvent = e as CustomEvent<{ dsoIndex: number }>;
      const index = customEvent.detail.dsoIndex;
      if (!sample[index]) return;
      setImageLoaded(false);
      setActiveIndex((current) => (current === index ? null : index));
    };

    window.addEventListener("starclick", handleStarClick);
    return () => window.removeEventListener("starclick", handleStarClick);
  }, [sample]);

  useEffect(() => {
    if (activeIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", handleKeyDown);
    dismissButtonRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, dismiss]);

  const entry = activeIndex !== null ? sample[activeIndex] : null;

  return (
    <>
      {/* Background image layer - sits behind hero content, above the Starfield canvas */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <AnimatePresence>
          {entry && (
            <motion.div
              key={entry.id}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: imageLoaded ? 1 : 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <img
                src={entry.imagePath}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
                onLoad={() => setImageLoaded(true)}
              />
              <div
                className="absolute inset-0 bg-surface/75"
                aria-hidden="true"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Screen-reader announcement of background changes */}
      <p role="status" aria-live="polite" className="sr-only">
        {entry ? `Showing ${entry.label} in the background.` : ""}
      </p>

      {/* Persistent credit line + dismiss control */}
      {entry && (
        <div className="absolute bottom-6 right-6 z-20 flex max-w-xs items-start gap-2 rounded-lg border border-royal-700/50 bg-surface-elevated/90 px-3 py-2 text-xs text-text-dim backdrop-blur-sm">
          <div>
            <p className="font-medium text-text-muted">{entry.label}</p>
            <p className="mt-0.5">{entry.credit}</p>
            {entry.attributionRequired && entry.licenseUrl && (
              <a
                href={entry.licenseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-block text-gold-400 transition-colors hover:text-gold-300"
              >
                {entry.license} →
              </a>
            )}
          </div>
          <button
            ref={dismissButtonRef}
            onClick={dismiss}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-text-dim transition-colors hover:bg-surface hover:text-text-primary"
            aria-label={`Return to starfield from ${entry.label}`}
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
