import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { HubbleEntry } from "@/types";

export default function StarModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [entry, setEntry] = useState<HubbleEntry | null>(null);
  const [hubbleData, setHubbleData] = useState<HubbleEntry[]>([]);
  const [imageError, setImageError] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Load Hubble data on mount
  useEffect(() => {
    fetch("/hubble/data.json")
      .then((res) => res.json())
      .then((data: HubbleEntry[]) => setHubbleData(data))
      .catch(() => {
        setHubbleData([
          {
            id: "fallback",
            title: "A Distant Nebula",
            date: "2024-01-01",
            description:
              "Somewhere in the cosmos, a cloud of gas and dust glows with the light of newborn stars.",
            imagePath: "",
            credit: "The Universe",
            sourceUrl: "",
          },
        ]);
      });
  }, []);

  // Listen for star click events
  useEffect(() => {
    const handleStarClick = (e: Event) => {
      const customEvent = e as CustomEvent<{ hubbleIndex: number }>;
      const index = customEvent.detail.hubbleIndex;
      if (hubbleData[index]) {
        previousFocusRef.current = document.activeElement as HTMLElement;
        setEntry(hubbleData[index]);
        setImageError(false);
        setIsOpen(true);
      }
    };

    window.addEventListener("starclick", handleStarClick);
    return () => window.removeEventListener("starclick", handleStarClick);
  }, [hubbleData]);

  // Focus trap and escape key
  useEffect(() => {
    if (!isOpen) return;

    // Focus close button when modal opens
    setTimeout(() => closeButtonRef.current?.focus(), 100);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
      // Simple focus trap: Tab cycles within modal
      if (e.key === "Tab") {
        const modal = document.getElementById("star-modal");
        if (!modal) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
          'button, a[href], [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    // Prevent body scroll
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    // Restore focus to the previously focused element
    setTimeout(() => previousFocusRef.current?.focus(), 100);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && entry && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-surface/80 backdrop-blur-sm"
            onClick={closeModal}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            id="star-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Hubble image: ${entry.title}`}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-royal-700/50 bg-surface-elevated shadow-2xl"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {/* Close button */}
            <button
              ref={closeButtonRef}
              onClick={closeModal}
              className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-surface/80 text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
              aria-label="Close modal"
            >
              <svg
                className="h-4 w-4"
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

            {/* Image */}
            {entry.imagePath && !imageError ? (
              <div className="relative aspect-video w-full overflow-hidden bg-surface">
                <img
                  src={entry.imagePath}
                  alt={`Hubble telescope image: ${entry.title}`}
                  className="h-full w-full object-cover"
                  onError={() => setImageError(true)}
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-b from-royal-900 to-surface">
                <div className="text-center">
                  <div className="text-4xl" aria-hidden="true">
                    ✨
                  </div>
                  <p className="mt-2 text-sm text-text-dim">
                    Image unavailable
                  </p>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="p-6">
              <h3 className="font-heading text-xl font-bold text-text-primary">
                {entry.title}
              </h3>
              <p className="mt-1 text-xs text-text-dim">{entry.date}</p>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                {entry.description}
              </p>
              <p className="mt-3 text-xs text-text-dim">
                Credit: {entry.credit}
              </p>
              {entry.sourceUrl && (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-gold-400 transition-colors hover:text-gold-300"
                >
                  View source →
                </a>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
